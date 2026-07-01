const CONTROLLER_LABELS = {
  nc210: "NC 210",
  sinumerik: "Sinumerik"
};

const CONTROLLER_EXTENSIONS = {
  nc210: "nc",
  sinumerik: "mpf"
};

export function generateCncProgram(process, options = {}) {
  const controller = options.controller || "sinumerik";
  const machiningKind = detectMachiningKind(process);
  const safeName = normalizeProgramName(process.project.partNumber || "TECH_PROCESS");
  const context = {
    controller,
    machiningKind,
    programName: controller === "sinumerik" ? `${safeName}.MPF` : `O${numericProgramName(safeName)}`,
    partName: process.project.partName || "ДЕТАЛЬ",
    partNumber: process.project.partNumber || "БЕЗ ОБОЗНАЧЕНИЯ",
    material: process.project.material || "МАТЕРИАЛ НЕ УКАЗАН",
    dimensions: process.project.dimensions || "ГАБАРИТЫ НЕ УКАЗАНЫ",
    date: new Date().toISOString().slice(0, 10)
  };

  const lines = controller === "nc210" ? buildNc210Program(process, context) : buildSinumerikProgram(process, context);

  return {
    controller,
    controllerLabel: CONTROLLER_LABELS[controller] || controller,
    extension: CONTROLLER_EXTENSIONS[controller] || "nc",
    machiningKind,
    programName: context.programName,
    safetyNote:
      "Черновой G-код требует проверки технологом/наладчиком: нулевая точка, инструмент, коррекции, припуски, ограничения станка и симуляция обязательны.",
    lines,
    text: lines.join("\n")
  };
}

function buildNc210Program(process, context) {
  const comment = (text) => `(${text})`;
  const lines = [
    "%",
    context.programName,
    comment(`ТП: ${context.partNumber} ${context.partName}`),
    comment(`Материал: ${context.material}`),
    comment(`Габариты: ${context.dimensions}`),
    comment("ВНИМАНИЕ: проверить привязку G54, коррекции инструмента и холостой ход"),
    "G21 G40 G49 G80 G90",
    "G54",
    "G00 Z100.000"
  ];

  if (context.machiningKind === "turning") {
    lines.push(...buildIsoTurningBody(comment));
  } else {
    lines.push(...buildIsoMillingBody(comment, process));
  }

  lines.push("G00 Z100.000", "M05", "M09", "G53 G00 Z0", "M30", "%");
  return lines;
}

function buildSinumerikProgram(process, context) {
  const comment = (text) => `; ${text}`;
  const lines = [
    `%_N_${context.programName}`,
    comment(`ТП: ${context.partNumber} ${context.partName}`),
    comment(`Материал: ${context.material}`),
    comment(`Габариты: ${context.dimensions}`),
    comment("ВНИМАНИЕ: проверить WORKOFFSET, TOFFSET, D-коррекции и выполнить симуляцию"),
    "G17 G21 G40 G54 G64 G90",
    "SUPA G0 Z100"
  ];

  if (context.machiningKind === "turning") {
    lines.push(...buildSinumerikTurningBody(comment));
  } else {
    lines.push(...buildSinumerikMillingBody(comment, process));
  }

  lines.push("SUPA G0 Z100", "M5", "M9", "M30");
  return lines;
}

function buildIsoTurningBody(comment) {
  return [
    comment("Операция 020: токарная черновая"),
    "T0101",
    "G96 S180 M03",
    "G50 S2500",
    "M08",
    "G00 X54.000 Z3.000",
    "G01 Z0.000 F0.25",
    "G01 X48.000",
    "G01 Z-70.000",
    "G00 X56.000",
    "G00 Z3.000",
    comment("Операция 030: токарная чистовая"),
    "T0202",
    "G96 S220 M03",
    "G00 X50.000 Z2.000",
    "G01 X35.200 F0.12",
    "G01 Z-45.000",
    "G01 X48.000",
    "G01 Z-70.000",
    "G00 X80.000 Z80.000",
    comment("Контрольная остановка после чистового прохода"),
    "M00"
  ];
}

function buildSinumerikTurningBody(comment) {
  return [
    comment("Операция 020: токарная черновая"),
    "T=\"ROUGH_TURN\" D1",
    "G96 S180 M3",
    "LIMS=2500",
    "M8",
    "G0 X54 Z3",
    "G1 Z0 F0.25",
    "G1 X48",
    "G1 Z-70",
    "G0 X56",
    "G0 Z3",
    comment("Операция 030: токарная чистовая"),
    "T=\"FINISH_TURN\" D1",
    "G96 S220 M3",
    "G0 X50 Z2",
    "G1 X35.2 F0.12",
    "G1 Z-45",
    "G1 X48",
    "G1 Z-70",
    "G0 X80 Z80",
    comment("Контрольная остановка после чистового прохода"),
    "M0"
  ];
}

function buildIsoMillingBody(comment, process) {
  const hasHoles = hasOperation(process, /сверлиль/i);
  const lines = [
    comment("Операция 020: фрезерная черновая"),
    "T01 M06",
    "S2500 M03",
    "M08",
    "G00 X0.000 Y0.000 Z50.000",
    "G00 Z5.000",
    "G01 Z-2.000 F120",
    "G01 X80.000 F380",
    "G01 Y40.000",
    "G01 X0.000",
    "G01 Y0.000",
    "G00 Z20.000",
    comment("Операция 030: фрезерная чистовая"),
    "T02 M06",
    "S4200 M03",
    "G00 X0.000 Y0.000 Z30.000",
    "G01 Z-2.200 F90",
    "G01 X80.000 F240",
    "G01 Y40.000",
    "G01 X0.000",
    "G01 Y0.000",
    "G00 Z30.000"
  ];

  if (hasHoles) {
    lines.push(
      comment("Операция: сверление отверстий"),
      "T03 M06",
      "S1800 M03",
      "G00 X20.000 Y20.000 Z30.000",
      "G81 X20.000 Y20.000 Z-12.000 R3.000 F120",
      "X60.000 Y20.000",
      "G80",
      "G00 Z30.000"
    );
  }

  return lines;
}

function buildSinumerikMillingBody(comment, process) {
  const hasHoles = hasOperation(process, /сверлиль/i);
  const lines = [
    comment("Операция 020: фрезерная черновая"),
    "T=\"ENDMILL_ROUGH\" D1 M6",
    "S2500 M3",
    "M8",
    "G0 X0 Y0 Z50",
    "G0 Z5",
    "G1 Z-2 F120",
    "G1 X80 F380",
    "G1 Y40",
    "G1 X0",
    "G1 Y0",
    "G0 Z20",
    comment("Операция 030: фрезерная чистовая"),
    "T=\"ENDMILL_FINISH\" D1 M6",
    "S4200 M3",
    "G0 X0 Y0 Z30",
    "G1 Z-2.2 F90",
    "G1 X80 F240",
    "G1 Y40",
    "G1 X0",
    "G1 Y0",
    "G0 Z30"
  ];

  if (hasHoles) {
    lines.push(
      comment("Операция: сверление отверстий"),
      "T=\"DRILL\" D1 M6",
      "S1800 M3",
      "G0 X20 Y20 Z30",
      "CYCLE82(3,-12,2,0,0,120)",
      "X60 Y20",
      "MCALL",
      "G0 Z30"
    );
  }

  return lines;
}

function detectMachiningKind(process) {
  return process.operations.some((operation) => /токар/i.test(operation.name)) ? "turning" : "milling";
}

function hasOperation(process, pattern) {
  return process.operations.some((operation) => pattern.test(operation.name) || pattern.test(operation.purpose));
}

function normalizeProgramName(value) {
  const transliterated = String(value)
    .toUpperCase()
    .replaceAll("А", "A")
    .replaceAll("Б", "B")
    .replaceAll("В", "V")
    .replaceAll("Г", "G")
    .replaceAll("Д", "D")
    .replaceAll("Е", "E")
    .replaceAll("Ё", "E")
    .replaceAll("Ж", "ZH")
    .replaceAll("З", "Z")
    .replaceAll("И", "I")
    .replaceAll("Й", "Y")
    .replaceAll("К", "K")
    .replaceAll("Л", "L")
    .replaceAll("М", "M")
    .replaceAll("Н", "N")
    .replaceAll("О", "O")
    .replaceAll("П", "P")
    .replaceAll("Р", "R")
    .replaceAll("С", "S")
    .replaceAll("Т", "T")
    .replaceAll("У", "U")
    .replaceAll("Ф", "F")
    .replaceAll("Х", "H")
    .replaceAll("Ц", "C")
    .replaceAll("Ч", "CH")
    .replaceAll("Ш", "SH")
    .replaceAll("Щ", "SCH")
    .replaceAll("Ы", "Y")
    .replaceAll("Э", "E")
    .replaceAll("Ю", "YU")
    .replaceAll("Я", "YA")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (transliterated || "TECH_PROCESS").slice(0, 24);
}

function numericProgramName(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.padStart(4, "0");
}
