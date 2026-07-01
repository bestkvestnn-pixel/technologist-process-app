import { selectCatalogTooling } from "./tool-catalog.js";

const SOURCE_LABELS = {
  drawing: "чертёж",
  sketch: "эскиз",
  model: "мат. модель"
};

const PRODUCTION_LABELS = {
  single: "единичное",
  batch: "серийное",
  mass: "массовое"
};

const REQUIRED_FIELDS = [
  ["partNumber", "обозначение детали"],
  ["partName", "наименование детали"],
  ["material", "материал"],
  ["dimensions", "габариты или масса"],
  ["requirements", "ключевые поверхности и требования"]
];

export function normalizeProject(input = {}) {
  return {
    sourceType: input.sourceType || "drawing",
    fileName: input.fileName || "",
    partNumber: clean(input.partNumber),
    partName: clean(input.partName),
    material: clean(input.material),
    dimensions: clean(input.dimensions),
    productionType: input.productionType || "single",
    blankType: input.blankType || "auto",
    requirements: clean(input.requirements),
    equipment: clean(input.equipment),
    sourceNotes: clean(input.sourceNotes)
  };
}

export function analyzeInput(rawProject) {
  const project = normalizeProject(rawProject);
  const missing = REQUIRED_FIELDS
    .filter(([field]) => !project[field])
    .map(([, label]) => label);

  const extraction = [
    {
      label: `Тип исходника: ${SOURCE_LABELS[project.sourceType]}`,
      ready: true
    },
    {
      label: project.fileName ? `Файл: ${project.fileName}` : "Файл не загружен — можно работать по ручному описанию",
      ready: Boolean(project.fileName)
    },
    {
      label: project.material ? `Материал: ${project.material}` : "Материал не указан",
      ready: Boolean(project.material)
    },
    {
      label: project.dimensions ? `Габариты/масса: ${project.dimensions}` : "Габариты или масса не указаны",
      ready: Boolean(project.dimensions)
    },
    {
      label: project.requirements ? "Требования к поверхностям внесены" : "Нет требований по точности, шероховатости и покрытиям",
      ready: Boolean(project.requirements)
    }
  ];

  const readiness = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);

  return {
    project,
    missing,
    extraction,
    readiness,
    questions: buildClarifyingQuestions(project, missing)
  };
}

export function generateProcess(rawProject) {
  const analysis = analyzeInput(rawProject);
  const { project } = analysis;
  const featureHints = detectFeatures(project);
  const blank = chooseBlank(project, featureHints);
  const operations = buildOperations(project, featureHints, blank);
  const tooling = buildTooling(project, featureHints, operations);
  const gostDocuments = buildGostDocumentSet(project, operations, tooling);

  return {
    ...analysis,
    blank,
    operations,
    tooling,
    documents: [
      "Маршрутная карта по ГОСТ 3.1118-82",
      "Операционные карты",
      "Карта эскизов",
      "Карта технического контроля",
      "Ведомость инструмента и оснастки"
    ],
    gostStandard: "ГОСТ 3.1118-82",
    gostDocuments,
    generatedAt: new Date().toISOString()
  };
}

export function exportProcessAsText(process) {
  const p = process.project;
  const lines = [
    "ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС",
    `Деталь: ${p.partName || "не указано"} (${p.partNumber || "без обозначения"})`,
    `Исходник: ${SOURCE_LABELS[p.sourceType]}${p.fileName ? ` — ${p.fileName}` : ""}`,
    `Материал: ${p.material || "не указан"}`,
    `Производство: ${PRODUCTION_LABELS[p.productionType]}`,
    `Заготовка: ${process.blank.name}`,
    "",
    "МАРШРУТ:"
  ];

  process.operations.forEach((operation, index) => {
    lines.push(`${String(index + 1).padStart(2, "0")}. ${operation.name} — ${operation.workCenter}`);
    lines.push(`    ${operation.purpose}`);
    operation.transitions.forEach((transition) => lines.push(`    • ${transition}`));
  });

  lines.push("", "ИНСТРУМЕНТ И ОСНАСТКА:");
  process.tooling.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.name}; назначение: ${item.purpose}; типоразмер: ${item.size}; Каталог-источник: ${item.catalogSource}`
    );
  });

  if (process.questions.length) {
    lines.push("", "ВОПРОСЫ ДЛЯ УТОЧНЕНИЯ:");
    process.questions.forEach((question) => lines.push(`• ${question}`));
  }

  lines.push("", "КОМПЛЕКТ ДОКУМЕНТОВ ПО ГОСТ 3.1118-82:");
  process.gostDocuments.forEach((document) => {
    lines.push(`• ${document.name} — ${document.form}`);
  });

  return lines.join("\n");
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildClarifyingQuestions(project, missing) {
  const questions = missing.map((field) => `Уточнить ${field}.`);

  if (!project.fileName) {
    questions.push("Приложить чертёж, эскиз или 3D-модель для проверки формы, баз и размеров.");
  }

  if (!/ra|шерох|h\d|js\d|p\d|квалитет|допуск/i.test(project.requirements)) {
    questions.push("Уточнить точность, посадки и шероховатость критичных поверхностей.");
  }

  if (!project.equipment) {
    questions.push("Уточнить доступное оборудование и ограничения по станкам.");
  }

  return [...new Set(questions)];
}

function detectFeatures(project) {
  const text = `${project.partName} ${project.dimensions} ${project.requirements} ${project.equipment}`.toLowerCase();

  return {
    isShaft: /вал|ось|ø|диаметр|ше[йе]к|круг/.test(text),
    hasHoles: /отверст|резьб|[mм]\d+|сверл/.test(text),
    hasMilling: /паз|лыск|плоск|карман|фрез/.test(text),
    hasGrinding: /ra\s*0[,.]?[48]|ra\s*1[,.]?6|h6|h7|шлиф/.test(text),
    hasHeatTreatment: /hrc|закал|цементац|термо|твч|улучш/.test(text),
    hasCoating: /покрыт|цинк|оксид|анод|фосфат/.test(text),
    hasModelFile: /\.(step|stp|iges|igs|stl|obj|sldprt|x_t|x_b)$/i.test(project.fileName)
  };
}

function chooseBlank(project, hints) {
  if (project.blankType !== "auto") {
    return {
      code: project.blankType,
      name: blankName(project.blankType),
      note: "Тип заготовки выбран пользователем."
    };
  }

  if (hints.isShaft) {
    return {
      code: "round-bar",
      name: "Круглый прокат с припуском на обработку",
      note: "Выбран по признакам тела вращения."
    };
  }

  if (hints.hasMilling) {
    return {
      code: "sheet",
      name: "Плита / сортовой прокат с припуском",
      note: "Выбрана по признакам призматической детали."
    };
  }

  return {
    code: "universal",
    name: "Заготовка по расчету припусков",
    note: "Требуется уточнить форму исходной заготовки."
  };
}

function blankName(code) {
  return {
    "round-bar": "Круглый прокат",
    sheet: "Лист / плита",
    casting: "Отливка",
    forging: "Поковка",
    weldment: "Сварная заготовка"
  }[code] || "Заготовка по расчету припусков";
}

function buildOperations(project, hints, blank) {
  const operations = [
    {
      code: "005",
      name: "Входной контроль исходных данных",
      workCenter: "ОТК / технолог",
      purpose: "Проверить комплектность чертежа, эскиза или мат. модели, материал, требования и базы.",
      transitions: [
        "Сверить обозначение, ревизию документации и материал.",
        "Выделить конструкторские и технологические базы.",
        "Зафиксировать неуказанные размеры и требования в перечне уточнений."
      ]
    },
    {
      code: "010",
      name: "Заготовительная",
      workCenter: "Заготовительный участок",
      purpose: `Подготовить заготовку: ${blank.name}.`,
      transitions: [
        "Назначить припуски на черновую и чистовую обработку.",
        "Промаркировать заготовку по обозначению детали.",
        "Проконтролировать материал и отсутствие видимых дефектов."
      ]
    }
  ];

  if (hints.isShaft) {
    operations.push({
      code: "020",
      name: "Токарная черновая",
      workCenter: workCenter(project, "Токарный станок / токарный ЧПУ"),
      purpose: "Получить основные наружные поверхности с припуском под чистовую обработку.",
      transitions: [
        "Установить заготовку в патроне или центрах.",
        "Подрезать торец и зацентровать при необходимости.",
        "Черновое точение ступеней, канавок и торцов."
      ]
    });
    operations.push({
      code: "030",
      name: "Токарная чистовая",
      workCenter: workCenter(project, "Токарный ЧПУ"),
      purpose: "Обеспечить размеры, посадки и шероховатость наружных поверхностей.",
      transitions: [
        "Чистовое точение базовых шеек и торцов.",
        "Снять фаски и притупить острые кромки.",
        "Промежуточный контроль диаметров и биения."
      ]
    });
  } else {
    operations.push({
      code: "020",
      name: "Фрезерная черновая",
      workCenter: workCenter(project, "Вертикально-фрезерный станок / ОЦ"),
      purpose: "Сформировать базовые плоскости и основной контур детали.",
      transitions: [
        "Установить заготовку на технологические базы.",
        "Черновое фрезерование базовой и противоположной плоскостей.",
        "Обработка контура с припуском под чистовой проход."
      ]
    });
    operations.push({
      code: "030",
      name: "Фрезерная чистовая",
      workCenter: workCenter(project, "Обрабатывающий центр"),
      purpose: "Получить окончательные плоскости, уступы и контуры.",
      transitions: [
        "Чистовое фрезерование баз и ответственных поверхностей.",
        "Обработать фаски, радиусы и переходные элементы.",
        "Промежуточный контроль размеров от баз."
      ]
    });
  }

  if (hints.hasMilling && hints.isShaft) {
    operations.push({
      code: "040",
      name: "Фрезерная",
      workCenter: workCenter(project, "Вертикально-фрезерный станок / ОЦ"),
      purpose: "Обработать пазы, лыски или плоскости, не получаемые точением.",
      transitions: [
        "Выставить деталь по технологическим базам.",
        "Фрезеровать паз/лыску с припуском на чистовой проход.",
        "Проверить ширину, глубину и расположение элемента."
      ]
    });
  }

  if (hints.hasHoles) {
    operations.push({
      code: nextCode(operations),
      name: "Сверлильная / резьбонарезная",
      workCenter: workCenter(project, "Сверлильный станок / ОЦ"),
      purpose: "Получить отверстия, резьбы и зенковки согласно требованиям.",
      transitions: [
        "Разметить или запрограммировать координаты отверстий.",
        "Сверлить, зенкеровать или развернуть отверстия.",
        "Нарезать резьбы и выполнить контроль проходным/непроходным калибром."
      ]
    });
  }

  if (hints.hasHeatTreatment) {
    operations.push({
      code: nextCode(operations),
      name: "Термическая",
      workCenter: "Термический участок",
      purpose: "Обеспечить требуемую твердость и структуру материала.",
      transitions: [
        "Выполнить термообработку по заданной твердости.",
        "Провести контроль твердости.",
        "Учесть возможную поводку перед финишной обработкой."
      ]
    });
  }

  if (hints.hasGrinding) {
    operations.push({
      code: nextCode(operations),
      name: hints.isShaft ? "Круглошлифовальная" : "Плоскошлифовальная",
      workCenter: hints.isShaft ? "Круглошлифовальный станок" : "Плоскошлифовальный станок",
      purpose: "Обеспечить точные посадочные размеры и низкую шероховатость.",
      transitions: [
        "Установить деталь по чистовым базам.",
        "Шлифовать ответственные поверхности до размера.",
        "Контролировать размер, форму, шероховатость и при необходимости биение."
      ]
    });
  }

  if (hints.hasCoating) {
    operations.push({
      code: nextCode(operations),
      name: "Покрытие",
      workCenter: "Гальванический / окрасочный участок",
      purpose: "Нанести защитное или функциональное покрытие.",
      transitions: [
        "Подготовить поверхность под покрытие.",
        "Нанести покрытие по требованиям чертежа.",
        "Проверить внешний вид и толщину покрытия."
      ]
    });
  }

  operations.push({
    code: nextCode(operations),
    name: "Финишный контроль",
    workCenter: "ОТК",
    purpose: "Подтвердить соответствие детали чертежу, эскизу или мат. модели.",
    transitions: [
      "Проверить критичные размеры и взаимное расположение поверхностей.",
      "Проверить шероховатость, твердость и покрытие при наличии требований.",
      "Оформить маршрутную карту, карту контроля и ведомость инструмента."
    ]
  });

  return operations;
}

function buildTooling(project, hints) {
  return selectCatalogTooling(project, hints);
}

function buildGostDocumentSet(project, operations, tooling) {
  return [
    {
      code: "МК",
      name: "Маршрутная карта",
      form: "Форма маршрутной карты по ГОСТ 3.1118-82",
      purpose: "Основной маршрут изготовления детали с перечнем операций, оборудования и технологической оснастки.",
      fields: {
        "Обозначение детали": project.partNumber || "требуется уточнить",
        "Наименование детали": project.partName || "требуется уточнить",
        "Материал": project.material || "требуется уточнить",
        "Тип производства": PRODUCTION_LABELS[project.productionType],
        "Заготовка": project.blankType === "auto" ? "подобрать автоматически" : project.blankType
      },
      rows: operations.map((operation) => ({
        "Опер.": operation.code,
        "Наименование операции": operation.name,
        "Оборудование": operation.workCenter,
        "Содержание": operation.purpose,
        "Документ": "МК ГОСТ 3.1118-82"
      }))
    },
    {
      code: "ОК",
      name: "Операционные карты",
      form: "Операционная детализация к маршруту",
      purpose: "Переходы, установы, режимы и контроль для операций маршрута.",
      rows: operations.map((operation) => ({
        "Опер.": operation.code,
        "Переходы": operation.transitions.join("; "),
        "Инструмент": selectToolingForOperation(operation, tooling),
        "Контроль": operation.name.includes("контроль") ? "Окончательный контроль" : "Промежуточный контроль по требованиям КД"
      }))
    },
    {
      code: "КЭ",
      name: "Карта эскизов",
      form: "Эскиз обработки / базирования",
      purpose: "Графическая привязка установов, баз и обрабатываемых поверхностей.",
      rows: operations
        .filter((operation) => !/контроль|заготов/i.test(operation.name))
        .map((operation) => ({
          "Опер.": operation.code,
          "Эскиз": `Эскиз установки и базирования для операции ${operation.name}`,
          "Базы": "уточнить по чертежу / модели"
        }))
    },
    {
      code: "КТК",
      name: "Карта технического контроля",
      form: "Контрольная карта",
      purpose: "Перечень контролируемых параметров, средств измерения и этапов контроля.",
      rows: [
        {
          "Контроль": "Входной",
          "Параметры": "Материал, заготовка, комплектность КД",
          "Средства": "типоразмер уточнить по каталогу средств измерения"
        },
        {
          "Контроль": "Операционный",
          "Параметры": project.requirements || "критичные размеры и требования уточнить",
          "Средства": "типоразмер уточнить по каталогу средств измерения"
        },
        {
          "Контроль": "Приёмочный",
          "Параметры": "Соответствие детали чертежу, эскизу или мат. модели",
          "Средства": "типоразмер уточнить по каталогу средств измерения"
        }
      ]
    },
    {
      code: "ВИО",
      name: "Ведомость инструмента и оснастки",
      form: "Ведомость применяемых средств технологического оснащения",
      purpose: "Инструмент, приспособления, средства контроля с обязательным каталогом-источником.",
      rows: tooling.map((item, index) => ({
        "Поз.": index + 1,
        "Наименование": item.name,
        "Назначение": item.purpose,
        "Типоразмер": item.size,
        "Каталог-источник": item.catalogSource
      }))
    }
  ];
}

function selectToolingForOperation(operation, tooling) {
  const name = operation.name.toLowerCase();
  const preferred = tooling.find((item) => {
    const itemName = item.name.toLowerCase();
    return (
      (name.includes("токар") && itemName.includes("токар")) ||
      (name.includes("фрез") && itemName.includes("фрез")) ||
      (name.includes("свер") && /сверл|метчик|разверт/.test(itemName)) ||
      (name.includes("шлиф") && itemName.includes("шлиф"))
    );
  });

  return preferred ? `${preferred.name}; ${preferred.size}` : "согласно ведомости инструмента";
}

function workCenter(project, fallback) {
  return project.equipment || fallback;
}

function nextCode(operations) {
  const last = Number(operations.at(-1).code);
  return String(last + 10).padStart(3, "0");
}

export const labels = {
  source: SOURCE_LABELS,
  production: PRODUCTION_LABELS
};
