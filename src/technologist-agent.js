import { generateProcess } from "./domain.js";
import { generateSourceReport } from "./report.js";

const AGENT_PROFILE = {
  name: "Агент инженер-технолог",
  role: "Анализ чертежа, эскиза или мат. модели и разработка технологического процесса",
  standard: "ГОСТ 3.1118-82",
  constraints: [
    "использовать только каталоги инструмента из /Users/pavel/Desktop/Работа ии/Каталоги",
    "если точный типоразмер не найден, указывать: типоразмер уточнить по каталогу ...",
    "сохранять графу Каталог-источник в ведомости инструмента и оснастки"
  ]
};

export function runTechnologistAgent(input = {}) {
  const sourceReport = generateSourceReport(input);
  const project = {
    ...input,
    ...sourceReport.inferredProject
  };
  const process = generateProcess(project);
  const drawingAnalysis = analyzeDrawing(project, sourceReport);
  const manufacturability = analyzeManufacturability(project, process);
  const nextActions = buildNextActions(sourceReport, drawingAnalysis, manufacturability);

  return {
    profile: AGENT_PROFILE,
    status: sourceReport.confidence >= 80 ? "готов к выпуску чернового ТП" : "требуются уточнения",
    confidence: sourceReport.confidence,
    sourceReport,
    drawingAnalysis,
    manufacturability,
    process,
    nextActions,
    summary: buildSummary(project, sourceReport, process)
  };
}

function analyzeDrawing(project, sourceReport) {
  const text = `${project.fileName} ${project.sourceNotes} ${project.requirements} ${project.dimensions}`.toLowerCase();
  const findings = [];
  const risks = [];

  findings.push(sourceReport.fileName ? `Исходник подключён: ${sourceReport.fileName}.` : "Исходный файл не загружен; анализ выполнен по ручному описанию.");

  if (project.partNumber) findings.push(`Обозначение детали определено: ${project.partNumber}.`);
  if (project.partName) findings.push(`Тип детали определён: ${project.partName}.`);
  if (project.material) findings.push(`Материал указан: ${project.material}.`);
  if (project.dimensions) findings.push(`Габариты/масса указаны: ${project.dimensions}.`);

  if (/ra|шерох/i.test(text)) findings.push("Найдены требования к шероховатости.");
  else risks.push("Не найдены требования к шероховатости ответственных поверхностей.");

  if (/\bh\d|\bp\d|допуск|квалитет|посад/i.test(text)) findings.push("Найдены признаки допусков, посадок или квалитетов.");
  else risks.push("Не найдены посадки/допуски — для точного ТП нужно уточнить критичные размеры.");

  if (/баз|установ|центр|ось/i.test(text)) findings.push("Есть признаки базирования или осей установки.");
  else risks.push("Технологические базы не определены явно; агент назначит предварительные базы.");

  if (/термо|hrc|закал|твч|цементац/i.test(text)) findings.push("Найдены требования к термообработке.");
  if (/покрыт|цинк|оксид|анод|фосфат/i.test(text)) findings.push("Найдены требования к покрытию.");

  sourceReport.missing.forEach((item) => risks.push(`Не заполнено поле: ${item}.`));

  return {
    findings,
    risks: [...new Set(risks)],
    sourceQuality: sourceReport.confidence >= 80 ? "достаточно для чернового ТП" : "нужно уточнить исходные данные"
  };
}

function analyzeManufacturability(project, process) {
  const notes = [];
  const warnings = [];
  const operationNames = process.operations.map((operation) => operation.name).join(", ");

  notes.push(`Предварительный маршрут: ${operationNames}.`);
  notes.push(`Комплект документов: ${process.gostDocuments.map((document) => document.code).join(", ")} по ${process.gostStandard}.`);

  if (!project.equipment) {
    warnings.push("Оборудование не задано — рабочие центры назначены предварительно.");
  }

  if (!project.material) {
    warnings.push("Материал не указан — режимы резания и заготовка требуют уточнения.");
  }

  if (!/ra|h\d|p\d|допуск|квалитет/i.test(project.requirements || "")) {
    warnings.push("Недостаточно данных по точности — финишные операции могут измениться после уточнения КД.");
  }

  if (process.tooling.some((item) => item.size.includes("типоразмер уточнить по каталогу"))) {
    notes.push("Инструмент подобран по типу; точные типоразмеры помечены для уточнения по каталогу.");
  }

  return {
    notes,
    warnings,
    routeReady: warnings.length <= 1
  };
}

function buildNextActions(sourceReport, drawingAnalysis, manufacturability) {
  const actions = [];

  if (sourceReport.missing.length) {
    actions.push("Заполнить недостающие графы карточки детали по основной надписи и техническим требованиям.");
  }

  if (drawingAnalysis.risks.some((risk) => risk.includes("базы"))) {
    actions.push("Уточнить конструкторские и технологические базы по чертежу или модели.");
  }

  if (manufacturability.warnings.length) {
    actions.push("Проверить предупреждения агента перед выпуском комплекта документов.");
  }

  actions.push("После проверки нажать «Создать ТП» и сформировать комплект документов по ГОСТ 3.1118-82.");
  return [...new Set(actions)];
}

function buildSummary(project, sourceReport, process) {
  const part = [project.partNumber, project.partName].filter(Boolean).join(" — ") || "деталь без обозначения";
  return `${AGENT_PROFILE.name} проанализировал исходник для ${part}, заполнил графы с уверенностью ${sourceReport.confidence}% и подготовил маршрут из ${process.operations.length} операций.`;
}
