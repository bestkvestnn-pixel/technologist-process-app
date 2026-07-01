export const TOOL_CATALOG_ROOT = "/Users/pavel/Desktop/Работа ии/Каталоги";

const CATALOGS = {
  turning: "К 20-21-88(резцы).pdf",
  drilling: "К 20-15-88(сверла_зенкера_развертки).pdf",
  threading: "К 20-42-87(резьбовой).pdf",
  milling: "К 20-43-87(фрезы).pdf",
  millingExtra: "Фрезы 1257.pdf",
  measuring: "К 20-19-89(измерит).pdf",
  gauges: "К 20-36-86(калибры гладкие).pdf",
  fitter: "К 20-27-89(слесарный).pdf",
  tolerances: "ГОСТ 25347-2013.pdf"
};

const STANDARD_ENDMILL_DIAMETERS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 32];
const STANDARD_DRILL_DIAMETERS = [
  1, 1.2, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.2, 3.3, 3.5, 3.8, 4, 4.2, 4.5, 4.8, 5, 5.2, 5.5, 5.8, 6, 6.2, 6.5, 6.8, 7,
  7.5, 7.8, 8, 8.2, 8.5, 8.8, 9, 9.5, 10, 10.2, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 19, 20
];

export function selectCatalogTooling(project, hints) {
  const requirements = `${project.partName} ${project.dimensions} ${project.requirements} ${project.sourceNotes}`;
  const features = extractToolFeatures(requirements);
  const items = [];

  items.push(selectMeasuringTool(features));

  if (hints.isShaft) {
    items.push(selectTurningTool(features), selectShaftFixture(features));
  }

  if (!hints.isShaft || hints.hasMilling) {
    items.push(selectMillingTool(features));
  }

  if (hints.hasHoles || features.threads.length) {
    items.push(...selectHoleTools(features));
  }

  if (hints.hasGrinding) {
    items.push(selectGrindingTool(features));
  }

  return items.map((item) => ({
    ...item,
    catalogSource: catalogPath(item.catalogKey)
  }));
}

export function extractToolFeatures(text) {
  const normalized = String(text || "").replaceAll(",", ".");
  const diameters = [...normalized.matchAll(/(?:Ø|Ф|D)\s?(\d+(?:\.\d+)?)/gi)].map((match) => Number(match[1]));
  const fits = [...normalized.matchAll(/(?:Ø|Ф|D)?\s?(\d+(?:\.\d+)?)\s?(h[5-9]|js[5-9]|p[5-9])/gi)].map((match) => ({
    diameter: Number(match[1]),
    fit: match[2].toLowerCase()
  }));
  const threads = [...normalized.matchAll(/[MМ](\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?/gi)].map((match) => ({
    diameter: Number(match[1]),
    pitch: match[2] ? Number(match[2]) : standardMetricPitch(Number(match[1]))
  }));
  const slots = [...normalized.matchAll(/паз\s?(\d+(?:\.\d+)?)/gi)].map((match) => Number(match[1]));
  const holes = [
    ...normalized.matchAll(/(?:отв(?:ерсти[ея])?|сверл(?:ить|ение)?)[^.;,\n]{0,24}(?:Ø|Ф|D)\s?(\d+(?:\.\d+)?)/gi)
  ].map((match) => Number(match[1]));
  const roughness = [...normalized.matchAll(/Ra\s?(\d+(?:\.\d+)?)/gi)].map((match) => Number(match[1]));

  return {
    diameters,
    fits,
    threads,
    slots,
    holes,
    roughness,
    maxDiameter: diameters.length ? Math.max(...diameters) : null,
    minDiameter: diameters.length ? Math.min(...diameters) : null
  };
}

function selectMeasuringTool(features) {
  const preciseFit = features.fits[0];

  if (preciseFit) {
    return {
      name: "Калибр гладкий предельный",
      purpose: `Контроль посадочного размера Ø${formatNumber(preciseFit.diameter)} ${preciseFit.fit}`,
      size: `калибр-скоба/пробка Ø${formatNumber(preciseFit.diameter)} ${preciseFit.fit}`,
      catalogKey: "gauges",
      catalogStatus: "подобрано по посадке из требований"
    };
  }

  if (features.maxDiameter) {
    return {
      name: "Штангенциркуль / микрометр",
      purpose: `Контроль наружных размеров до Ø${formatNumber(features.maxDiameter)}`,
      size: measuringRange(features.maxDiameter),
      catalogKey: "measuring",
      catalogStatus: "подобрано по максимальному размеру"
    };
  }

  return {
    name: "Средства измерения",
    purpose: "Входной, промежуточный и окончательный контроль размеров",
    size: "типоразмер уточнить по каталогу средств измерения",
    catalogKey: "measuring",
    catalogStatus: "нет размера для точного подбора"
  };
}

function selectTurningTool(features) {
  const diameter = features.maxDiameter ? `Ø${formatNumber(features.maxDiameter)}` : "наружных поверхностей";

  return {
    name: "Резец токарный проходной с механическим креплением пластины",
    purpose: `Черновое и чистовое точение ${diameter}`,
    size: features.maxDiameter
      ? `резец проходной для наружного точения ${diameter}; державку уточнить по резцедержателю станка`
      : "типоразмер уточнить по каталогу токарного инструмента",
    catalogKey: "turning",
    catalogStatus: features.maxDiameter ? "тип инструмента подобран по диаметру детали" : "нет диаметра для точного подбора"
  };
}

function selectShaftFixture(features) {
  return {
    name: "Центр / поводковая оснастка",
    purpose: "Базирование детали типа вал",
    size: features.maxDiameter
      ? `центр и поводковая оснастка под заготовку до Ø${formatNumber(features.maxDiameter)}`
      : "типоразмер уточнить по каталогу станочной оснастки",
    catalogKey: "fitter",
    catalogStatus: features.maxDiameter ? "подобрано по габариту заготовки" : "нет диаметра для точного подбора"
  };
}

function selectMillingTool(features) {
  const slot = features.slots[0];

  if (slot) {
    const roughDiameter = chooseStandardAtMost(slot * 0.75, STANDARD_ENDMILL_DIAMETERS) || chooseStandardBelow(slot, STANDARD_ENDMILL_DIAMETERS);
    const finishDiameter = chooseStandardAtMost(slot, STANDARD_ENDMILL_DIAMETERS) || slot;
    const sameTool = roughDiameter === finishDiameter;

    return {
      name: sameTool ? "Фреза концевая" : "Фрезы концевые черновая/чистовая",
      purpose: `Фрезерование паза ${formatNumber(slot)} мм`,
      size: sameTool
        ? `фреза концевая Ø${formatNumber(finishDiameter)} для паза ${formatNumber(slot)} мм`
        : `черновая фреза Ø${formatNumber(roughDiameter)} + чистовая фреза Ø${formatNumber(finishDiameter)} для паза ${formatNumber(slot)} мм`,
      catalogKey: "milling",
      catalogStatus: "оптимальные диаметры подобраны по ширине паза: черновая меньше ширины, чистовая по размеру"
    };
  }

  return {
    name: "Фреза концевая",
    purpose: "Фрезерование плоскостей, пазов и контуров",
    size: "типоразмер уточнить по каталогу фрезерного инструмента",
    catalogKey: "milling",
    catalogStatus: "нет ширины/контура для точного подбора"
  };
}

function selectHoleTools(features) {
  const threadTools = features.threads.flatMap((thread) => {
    const drillDiameter = thread.diameter - thread.pitch;
    const standardDrill = chooseClosest(drillDiameter, STANDARD_DRILL_DIAMETERS);
    return [
      {
        name: "Сверло спиральное",
        purpose: `Предварительное отверстие под резьбу M${formatNumber(thread.diameter)}`,
        size: `сверло Ø${formatNumber(standardDrill)} под M${formatNumber(thread.diameter)}×${formatNumber(thread.pitch)}`,
        catalogKey: "drilling",
        catalogStatus: `оптимальный диаметр сверла выбран по правилу Dрезьбы − шаг = Ø${formatNumber(drillDiameter)}`
      },
      {
        name: "Метчик машинный",
        purpose: `Нарезание резьбы M${formatNumber(thread.diameter)}`,
        size: `метчик M${formatNumber(thread.diameter)}×${formatNumber(thread.pitch)}`,
        catalogKey: "threading",
        catalogStatus: "подобрано по обозначению резьбы"
      }
    ];
  });

  const plainHoleTools = features.holes
    .filter((hole) => !features.threads.some((thread) => Math.abs(thread.diameter - hole) < 0.01))
    .flatMap((hole) => {
      const preciseFit = features.fits.find((fit) => Math.abs(fit.diameter - hole) < 0.01);

      if (preciseFit) {
        const drill = chooseStandardAtMost(hole - reamingAllowance(hole), STANDARD_DRILL_DIAMETERS);
        return [
          {
            name: "Сверло спиральное",
            purpose: `Предварительное сверление под точное отверстие Ø${formatNumber(hole)} ${preciseFit.fit}`,
            size: `сверло Ø${formatNumber(drill)} под последующее развертывание Ø${formatNumber(hole)} ${preciseFit.fit}`,
            catalogKey: "drilling",
            catalogStatus: "оптимальный диаметр выбран с припуском под развертку"
          },
          {
            name: "Развертка машинная",
            purpose: `Чистовая обработка отверстия Ø${formatNumber(hole)} ${preciseFit.fit}`,
            size: `развертка Ø${formatNumber(hole)} ${preciseFit.fit}`,
            catalogKey: "drilling",
            catalogStatus: "подобрано по точному диаметру отверстия"
          }
        ];
      }

      return [
        {
          name: "Сверло спиральное",
          purpose: `Сверление отверстия Ø${formatNumber(hole)}`,
          size: `сверло Ø${formatNumber(chooseClosest(hole, STANDARD_DRILL_DIAMETERS))}`,
          catalogKey: "drilling",
          catalogStatus: "оптимальный диаметр сверла выбран по диаметру отверстия"
        }
      ];
    });

  const tools = [...plainHoleTools, ...threadTools];

  if (!tools.length) {
    return [
      {
        name: "Сверло / зенкер / развертка",
        purpose: "Обработка отверстий",
        size: "типоразмер уточнить по каталогу осевого инструмента",
        catalogKey: "drilling",
        catalogStatus: "нет диаметра отверстия для точного подбора"
      }
    ];
  }

  return tools;
}

function selectGrindingTool(features) {
  const diameter = features.fits[0]?.diameter || features.minDiameter;
  return {
    name: "Шлифовальный круг",
    purpose: "Финишная обработка точных поверхностей",
    size: diameter
      ? `шлифовальный круг для обработки поверхности Ø${formatNumber(diameter)}; характеристику уточнить по материалу и станку`
      : "типоразмер уточнить по каталогу шлифовальных кругов",
    catalogKey: "measuring",
    catalogStatus: diameter ? "операция определена по точной поверхности" : "нет размера для точного подбора"
  };
}

function standardMetricPitch(diameter) {
  return (
    {
      3: 0.5,
      4: 0.7,
      5: 0.8,
      6: 1,
      8: 1.25,
      10: 1.5,
      12: 1.75,
      16: 2,
      20: 2.5
    }[diameter] || Math.round(diameter * 0.15 * 100) / 100
  );
}

function reamingAllowance(diameter) {
  if (diameter <= 6) return 0.2;
  if (diameter <= 12) return 0.3;
  if (diameter <= 20) return 0.5;
  return 0.8;
}

function chooseStandardAtMost(target, values) {
  return [...values].reverse().find((value) => value <= target) || null;
}

function chooseStandardBelow(target, values) {
  return [...values].reverse().find((value) => value < target) || null;
}

function chooseClosest(target, values) {
  return values.reduce((best, value) => (Math.abs(value - target) < Math.abs(best - target) ? value : best), values[0]);
}

function measuringRange(value) {
  if (value <= 25) return "микрометр 0–25 мм";
  if (value <= 50) return "микрометр 25–50 мм / штангенциркуль 0–150 мм";
  if (value <= 150) return "штангенциркуль 0–150 мм";
  if (value <= 300) return "штангенциркуль 0–300 мм";
  return "типоразмер уточнить по каталогу средств измерения";
}

function catalogPath(key) {
  return `${TOOL_CATALOG_ROOT}/${CATALOGS[key] || CATALOGS.measuring}`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
