const SOURCE_KIND_LABELS = {
  drawing: "чертежа",
  sketch: "эскиза",
  model: "математической модели"
};

export function generateSourceReport(input = {}) {
  const text = normalizeText([input.fileName, input.sourceNotes, input.requirements, input.dimensions].filter(Boolean).join("\n"));
  const fileName = String(input.fileName || "").trim();
  const sourceType = input.sourceType || "drawing";
  const inferred = {
    sourceType,
    fileName,
    partNumber: input.partNumber || inferPartNumber(text, fileName),
    partName: input.partName || inferPartName(text, fileName),
    material: input.material || inferMaterial(text),
    dimensions: input.dimensions || inferDimensions(text),
    productionType: input.productionType || "single",
    blankType: input.blankType || "auto",
    requirements: input.requirements || inferRequirements(text),
    equipment: input.equipment || inferEquipment(text),
    sourceNotes: input.sourceNotes || ""
  };

  const extractedFields = [
    field("Обозначение детали", "partNumber", inferred.partNumber, sourceOf(input.partNumber)),
    field("Наименование детали", "partName", inferred.partName, sourceOf(input.partName)),
    field("Материал", "material", inferred.material, sourceOf(input.material)),
    field("Габариты / масса", "dimensions", inferred.dimensions, sourceOf(input.dimensions)),
    field("Ключевые требования", "requirements", inferred.requirements, sourceOf(input.requirements)),
    field("Оборудование", "equipment", inferred.equipment, sourceOf(input.equipment))
  ];

  const missing = extractedFields
    .filter((item) => !item.value || item.value === "требуется уточнить")
    .map((item) => item.label.toLowerCase());

  const confidence = Math.round((extractedFields.filter((item) => item.value && item.value !== "требуется уточнить").length / extractedFields.length) * 100);

  return {
    sourceTitle: `Отчёт по данным ${SOURCE_KIND_LABELS[sourceType] || "исходника"}`,
    fileName,
    confidence,
    extractedFields,
    missing,
    inferredProject: inferred,
    conclusions: buildConclusions(inferred, missing)
  };
}

function field(label, target, value, source) {
  return {
    label,
    target,
    value: value || "требуется уточнить",
    source,
    confidence: value ? (source === "заполнено пользователем" ? "высокая" : "черновая") : "нет данных"
  };
}

function sourceOf(existingValue) {
  return existingValue ? "заполнено пользователем" : "из исходника / распознанного текста";
}

function inferPartNumber(text, fileName) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const match = text.match(/[А-ЯA-Z]{2,}[-_ ]?\d{1,4}(?:[.-]\d{1,4})?/i) || base.match(/[А-ЯA-Z]{2,}[-_ ]?\d{1,4}(?:[.-]\d{1,4})?/i);
  return match ? match[0].replaceAll("_", "-").toUpperCase() : "";
}

function inferPartName(text, fileName) {
  const candidates = [
    [/вал/i, "Вал"],
    [/кроншт/i, "Кронштейн"],
    [/корпус/i, "Корпус"],
    [/втулк/i, "Втулка"],
    [/фланец/i, "Фланец"],
    [/плита/i, "Плита"],
    [/шестер/i, "Шестерня"],
    [/ось/i, "Ось"]
  ];
  const haystack = `${text} ${fileName}`;
  const found = candidates.find(([pattern]) => pattern.test(haystack));
  return found ? found[1] : "";
}

function inferMaterial(text) {
  const match = text.match(/(?:материал[:\s-]*)?((?:сталь|стал[ьи]|алюмини[йя]|бронза|латунь|чугун|титан)[^,;\n]*)/i);
  return match ? capitalize(match[1].trim()) : "";
}

function inferDimensions(text) {
  const diameter = text.match(/(?:Ø|Ф|D)\s?\d+(?:[,.]\d+)?(?:\s?[xх×]\s?\d+(?:[,.]\d+)?){0,2}\s?(?:мм)?/i);
  if (diameter) return normalizeDimension(diameter[0]);

  const box = text.match(/\d+(?:[,.]\d+)?\s?[xх×]\s?\d+(?:[,.]\d+)?(?:\s?[xх×]\s?\d+(?:[,.]\d+)?)?\s?(?:мм)?/i);
  if (box) return normalizeDimension(box[0]);

  const mass = text.match(/масса[:\s-]*\d+(?:[,.]\d+)?\s?(?:кг|kg|г)/i);
  return mass ? mass[0] : "";
}

function inferRequirements(text) {
  const fragments = [];
  const patterns = [
    /Ra\s?\d+(?:[,.]\d+)?/gi,
    /\b\d{1,3}\s?h[5-9]\b/gi,
    /\b\d{1,3}\s?P[5-9]\b/gi,
    /HRC\s?\d+\s?(?:\.\.\.|-)\s?\d+/gi,
    /[MМ]\d+(?:x\d+(?:[,.]\d+)?)?/gi,
    /паз[^,;\n]*/gi,
    /отверсти[ея][^,;\n]*/gi,
    /термообработк[а-я\s\d.-]*/gi
  ];

  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) fragments.push(...matches.map((item) => item.trim()));
  });

  return [...new Set(fragments)].slice(0, 8).join(", ");
}

function inferEquipment(text) {
  const machines = [];
  if (/токар|вал|Ø|Ф\s?\d/i.test(text)) machines.push("токарный ЧПУ");
  if (/фрез|паз|плоск|карман/i.test(text)) machines.push("вертикально-фрезерный ОЦ");
  if (/шлиф|Ra\s?0|Ra\s?1[,.]?6|h6/i.test(text)) machines.push("круглошлифовальный");
  return [...new Set(machines)].join(", ");
}

function buildConclusions(project, missing) {
  const conclusions = [
    "Данные перенесены в графы карточки детали; незаполненные позиции помечены как требующие уточнения.",
    "Перед созданием ТП проверьте базы, припуски, точность, шероховатость и материал по оригиналу документа."
  ];

  if (project.fileName && /\.(step|stp|iges|igs|stl|obj|sldprt|x_t|x_b)$/i.test(project.fileName)) {
    conclusions.push("Для мат. модели рекомендуется дополнительно снять PMI/атрибуты модели и сверить их с КД.");
  }

  if (project.fileName && /\.(jpe?g|png|svg)$/i.test(project.fileName)) {
    conclusions.push("Изображение добавлено как растровый/графический исходник; для автоматического заполнения граф вставьте OCR-текст с основной надписи и технических требований.");
  }

  if (missing.length) {
    conclusions.push(`Не хватает данных: ${missing.join(", ")}.`);
  }

  return conclusions;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeDimension(value) {
  return value.replace(/[xх]/gi, "×").replace(/\s+/g, "");
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}
