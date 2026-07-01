import assert from "node:assert/strict";
import { generateCncProgram } from "../src/cnc.js";
import { analyzeInput, exportProcessAsText, generateProcess } from "../src/domain.js";
import { generateSourceReport } from "../src/report.js";
import { runTechnologistAgent } from "../src/technologist-agent.js";
import { extractToolFeatures } from "../src/tool-catalog.js";

const shaftProject = {
  sourceType: "drawing",
  fileName: "ВАЛ-24.001.pdf",
  partNumber: "ВАЛ-24.001",
  partName: "Вал приводной",
  material: "Сталь 45 ГОСТ 1050-2013",
  dimensions: "Ø48×220 мм",
  productionType: "batch",
  blankType: "auto",
  requirements: "Шейки Ø35 h6, паз 8P9, Ra 1.6, отверстие М8, HRC 40...45",
  equipment: "токарный ЧПУ, вертикально-фрезерный, круглошлифовальный"
};

const analysis = analyzeInput(shaftProject);
assert.equal(analysis.readiness, 100);
assert.deepEqual(analysis.missing, []);

const process = generateProcess(shaftProject);
assert.equal(process.blank.code, "round-bar");
assert.ok(process.operations.some((operation) => operation.name === "Токарная черновая"));
assert.ok(process.operations.some((operation) => operation.name === "Фрезерная"));
assert.ok(process.operations.some((operation) => operation.name === "Сверлильная / резьбонарезная"));
assert.ok(process.operations.some((operation) => operation.name === "Термическая"));
assert.ok(process.operations.some((operation) => operation.name === "Круглошлифовальная"));
assert.ok(process.tooling.every((item) => item.catalogSource.includes("/Users/pavel/Desktop/Работа ии/Каталоги")));
assert.ok(process.tooling.some((item) => item.catalogSource.includes("К 20-21-88(резцы).pdf")));
assert.ok(process.tooling.some((item) => item.catalogSource.includes("К 20-43-87(фрезы).pdf")));
assert.ok(process.tooling.some((item) => item.catalogSource.includes("К 20-42-87")));
assert.ok(process.tooling.some((item) => item.size.includes("метчик M8")));
assert.ok(process.tooling.some((item) => item.size.includes("сверло Ø6.8 под M8")));
assert.ok(process.tooling.some((item) => item.size.includes("черновая фреза Ø6 + чистовая фреза Ø8")));
assert.equal(process.gostStandard, "ГОСТ 3.1118-82");
assert.ok(process.gostDocuments.some((document) => document.code === "МК"));
assert.ok(process.gostDocuments.some((document) => document.form.includes("ГОСТ 3.1118-82")));

const text = exportProcessAsText(process);
assert.ok(text.includes("Каталог-источник"));
assert.ok(text.includes("ВАЛ-24.001"));
assert.ok(text.includes("КОМПЛЕКТ ДОКУМЕНТОВ ПО ГОСТ 3.1118-82"));

const sourceReport = generateSourceReport({
  sourceType: "drawing",
  fileName: "ВАЛ-24.001.jpg",
  sourceNotes: "Материал Сталь 45 ГОСТ 1050-2013. Ø48×220 мм. Шейки Ø35 h6, паз 8P9, Ra 1.6, HRC 40...45, отверстие М8."
});
assert.equal(sourceReport.inferredProject.partNumber, "ВАЛ-24.001");
assert.equal(sourceReport.inferredProject.partName, "Вал");
assert.ok(sourceReport.inferredProject.material.includes("Сталь 45"));
assert.ok(sourceReport.inferredProject.dimensions.includes("Ø48×220"));
assert.ok(sourceReport.inferredProject.requirements.includes("Ra 1.6"));
assert.ok(sourceReport.conclusions.some((conclusion) => conclusion.includes("Изображение добавлено")));

const toolFeatures = extractToolFeatures("Ø35 h6, паз 8P9, резьба M8, Ra 1.6");
assert.equal(toolFeatures.fits[0].diameter, 35);
assert.equal(toolFeatures.threads[0].diameter, 8);
assert.equal(toolFeatures.slots[0], 8);

const plateProcess = generateProcess({
  sourceType: "drawing",
  fileName: "ПЛИТА-01.jpg",
  partNumber: "ПЛИТА-01",
  partName: "Плита",
  material: "Сталь 20",
  dimensions: "120×80×20 мм",
  requirements: "паз 12P9, отверстие Ø10 H7, 2 отверстия Ø6",
  equipment: "вертикально-фрезерный ОЦ"
});
assert.ok(plateProcess.tooling.some((item) => item.size.includes("черновая фреза Ø8 + чистовая фреза Ø12")));
assert.ok(plateProcess.tooling.some((item) => item.size.includes("сверло Ø9.5 под последующее развертывание Ø10 h7")));
assert.ok(plateProcess.tooling.some((item) => item.size.includes("развертка Ø10 h7")));
assert.ok(plateProcess.tooling.some((item) => item.size.includes("сверло Ø6")));

const agentResult = runTechnologistAgent({
  sourceType: "drawing",
  fileName: "ВАЛ-24.001.jpg",
  sourceNotes: "Материал Сталь 45 ГОСТ 1050-2013. Ø48×220 мм. Шейки Ø35 h6, паз 8P9, Ra 1.6, HRC 40...45, отверстие М8."
});
assert.equal(agentResult.profile.name, "Агент инженер-технолог");
assert.ok(agentResult.summary.includes("подготовил маршрут"));
assert.ok(agentResult.drawingAnalysis.findings.some((finding) => finding.includes("Исходник подключён")));
assert.ok(agentResult.process.gostDocuments.some((document) => document.code === "МК"));

const sinumerikProgram = generateCncProgram(process, { controller: "sinumerik" });
assert.equal(sinumerikProgram.extension, "mpf");
assert.ok(sinumerikProgram.text.includes("G96 S180 M3"));
assert.ok(sinumerikProgram.text.includes("T=\"ROUGH_TURN\" D1"));
assert.ok(sinumerikProgram.safetyNote.includes("симуляция"));

const nc210Program = generateCncProgram(process, { controller: "nc210" });
assert.equal(nc210Program.extension, "nc");
assert.ok(nc210Program.text.includes("G21 G40 G49 G80 G90"));
assert.ok(nc210Program.text.includes("T0101"));
assert.ok(nc210Program.text.includes("M30"));

const incomplete = analyzeInput({ sourceType: "sketch", partName: "Кронштейн" });
assert.ok(incomplete.readiness < 100);
assert.ok(incomplete.questions.some((question) => question.includes("материал")));

console.log("domain tests passed");
