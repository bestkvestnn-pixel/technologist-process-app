import { generateCncProgram } from "./cnc.js";
import { analyzeInput, exportProcessAsText, generateProcess, labels } from "./domain.js";
import { generateSourceReport } from "./report.js";
import { runTechnologistAgent } from "./technologist-agent.js";

const form = document.querySelector("#processForm");
const fileInput = document.querySelector("#sourceFile");
const fileHint = document.querySelector("#fileHint");
const imagePreview = document.querySelector("#imagePreview");
const imagePreviewImg = document.querySelector("#imagePreviewImg");
const imagePreviewCaption = document.querySelector("#imagePreviewCaption");
const sourceTypePill = document.querySelector("#sourceTypePill");
const readinessScore = document.querySelector("#readinessScore");
const readinessProgress = document.querySelector("#readinessProgress");
const extractionList = document.querySelector("#extractionList");
const questionsList = document.querySelector("#questionsList");
const reportFieldsList = document.querySelector("#reportFieldsList");
const agentStatusPill = document.querySelector("#agentStatusPill");
const agentSummary = document.querySelector("#agentSummary");
const agentFindingsList = document.querySelector("#agentFindingsList");
const routeTimeline = document.querySelector("#routeTimeline");
const toolingTable = document.querySelector("#toolingTable");
const documentsSet = document.querySelector("#documentsSet");
const operationTemplate = document.querySelector("#operationTemplate");
const cncController = document.querySelector("#cncController");
const cncProgramName = document.querySelector("#cncProgramName");
const cncSafetyNote = document.querySelector("#cncSafetyNote");
const cncProgramCode = document.querySelector("#cncProgramCode");

const state = {
  fileName: "",
  agentResult: null,
  sourceReport: null,
  process: null,
  cncProgram: null
};

let previewObjectUrl = "";

const demoProject = {
  sourceType: "drawing",
  fileName: "ВАЛ-24.001.pdf",
  partNumber: "ВАЛ-24.001",
  partName: "Вал приводной",
  material: "Сталь 45 ГОСТ 1050-2013",
  dimensions: "Ø48×220 мм, масса 1.8 кг",
  productionType: "batch",
  blankType: "auto",
  requirements: "Шейки Ø35 h6, паз 8P9, Ra 1.6, термообработка HRC 40...45, отверстие М8",
  equipment: "токарный ЧПУ, вертикально-фрезерный ОЦ, круглошлифовальный"
};

restore();
bindEvents();
refreshAnalysis();

function bindEvents() {
  form.addEventListener("input", () => {
    persist();
    refreshAnalysis();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    state.fileName = file?.name || "";
    fileHint.textContent = state.fileName || defaultFileHint();
    renderImagePreview(file);
    persist();
    refreshAnalysis();
  });

  document.querySelector("#generateButton").addEventListener("click", () => {
    if (!state.agentResult) {
      state.agentResult = runTechnologistAgent(readForm());
      state.sourceReport = state.agentResult.sourceReport;
      applyReportToForm(state.sourceReport);
      renderSourceReport(state.sourceReport);
      renderAgentResult(state.agentResult);
    }
    state.process = generateProcess(readForm());
    persist();
    renderProcess(state.process);
    renderDocumentsSet(state.process.gostDocuments);
  });

  document.querySelector("#generateReportButton").addEventListener("click", () => {
    state.agentResult = runTechnologistAgent(readForm());
    state.sourceReport = state.agentResult.sourceReport;
    applyReportToForm(state.sourceReport);
    persist();
    refreshAnalysis();
    renderSourceReport(state.sourceReport);
    renderAgentResult(state.agentResult);
  });

  document.querySelector("#exportJsonButton").addEventListener("click", () => {
    const process = state.process || generateProcess(readForm());
    download(`tech-process-${safeFileName(process.project.partNumber || "draft")}.json`, JSON.stringify(process, null, 2));
  });

  document.querySelector("#exportTextButton").addEventListener("click", () => {
    const process = state.process || generateProcess(readForm());
    download(`tech-process-${safeFileName(process.project.partNumber || "draft")}.txt`, exportProcessAsText(process));
  });

  document.querySelector("#generateCncButton").addEventListener("click", () => {
    const process = ensureProcess();
    state.cncProgram = generateCncProgram(process, { controller: cncController.value });
    persist();
    renderCncProgram(state.cncProgram);
  });

  document.querySelector("#exportCncButton").addEventListener("click", () => {
    const program = state.cncProgram || generateCncProgram(ensureProcess(), { controller: cncController.value });
    download(`${safeFileName(program.programName)}.${program.extension}`, program.text);
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    localStorage.removeItem("technologist-process-app");
    state.fileName = "";
    state.agentResult = null;
    state.sourceReport = null;
    state.process = null;
    state.cncProgram = null;
    form.reset();
    fileInput.value = "";
    fileHint.textContent = defaultFileHint();
    clearImagePreview();
    refreshAnalysis();
    renderEmptyAgent();
    renderEmptyReport();
    renderEmptyProcess();
    renderEmptyDocumentsSet();
    renderEmptyCncProgram();
  });

  document.querySelector("#loadDemoButton").addEventListener("click", () => {
    writeForm(demoProject);
    state.fileName = demoProject.fileName;
    fileHint.textContent = demoProject.fileName;
    clearImagePreview();
    state.process = generateProcess(readForm());
    state.agentResult = runTechnologistAgent(readForm());
    state.sourceReport = state.agentResult.sourceReport;
    state.cncProgram = generateCncProgram(state.process, { controller: cncController.value });
    persist();
    refreshAnalysis();
    renderSourceReport(state.sourceReport);
    renderAgentResult(state.agentResult);
    renderProcess(state.process);
    renderDocumentsSet(state.process.gostDocuments);
    renderCncProgram(state.cncProgram);
  });
}

function ensureProcess() {
  if (!state.process) {
    state.process = generateProcess(readForm());
    renderProcess(state.process);
  }

  return state.process;
}

function readForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    ...data,
    fileName: state.fileName
  };
}

function renderImagePreview(file) {
  clearImagePreview();

  if (!file || !isPreviewableImage(file)) {
    return;
  }

  previewObjectUrl = URL.createObjectURL(file);
  imagePreviewImg.src = previewObjectUrl;
  imagePreviewCaption.textContent = `${file.name} — JPG/изображение добавлено`;
  imagePreview.hidden = false;
}

function clearImagePreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }

  imagePreviewImg.removeAttribute("src");
  imagePreview.hidden = true;
  imagePreviewCaption.textContent = "Предпросмотр изображения";
}

function isPreviewableImage(file) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|svg)$/i.test(file.name);
}

function writeForm(project) {
  Object.entries(project).forEach(([key, value]) => {
    if (key === "fileName") return;
    const field = form.elements[key];
    if (!field) return;

    if (field instanceof RadioNodeList) {
      [...field].forEach((radio) => {
        radio.checked = radio.value === value;
      });
    } else {
      field.value = value;
    }
  });
}

function applyReportToForm(report) {
  Object.entries(report.inferredProject).forEach(([key, value]) => {
    if (!value || key === "fileName") return;
    const field = form.elements[key];
    if (!field) return;

    if (field instanceof RadioNodeList) {
      [...field].forEach((radio) => {
        radio.checked = radio.value === value;
      });
      return;
    }

    if (!field.value) {
      field.value = value;
    }
  });
}

function refreshAnalysis() {
  const analysis = analyzeInput(readForm());
  sourceTypePill.textContent = labels.source[analysis.project.sourceType];
  readinessScore.textContent = `${analysis.readiness}%`;
  readinessProgress.value = analysis.readiness;
  renderExtraction(analysis.extraction);
  renderQuestions(analysis.questions);
}

function renderExtraction(items) {
  extractionList.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item.label;
      li.className = item.ready ? "ready" : "";
      return li;
    })
  );
}

function renderQuestions(questions) {
  questionsList.replaceChildren(
    ...(questions.length ? questions : ["Критичных вопросов нет — можно выпускать черновик ТП."]).map((question) => {
      const li = document.createElement("li");
      li.textContent = question;
      return li;
    })
  );
}

function renderSourceReport(report) {
  reportFieldsList.replaceChildren(
    ...report.extractedFields.map((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)} <small>(${escapeHtml(item.confidence)})</small>`;
      return li;
    }),
    ...report.conclusions.map((conclusion) => {
      const li = document.createElement("li");
      li.textContent = conclusion;
      return li;
    })
  );
}

function renderEmptyReport() {
  reportFieldsList.innerHTML = "<li>Сформируйте отчёт после загрузки файла или вставки текста.</li>";
}

function renderAgentResult(result) {
  agentStatusPill.textContent = `${result.profile.name}: ${result.status}`;
  agentSummary.textContent = result.summary;

  const items = [
    ...result.drawingAnalysis.findings.map((text) => ({ text, className: "ready" })),
    ...result.drawingAnalysis.risks.map((text) => ({ text, className: "warning" })),
    ...result.manufacturability.notes.map((text) => ({ text, className: "" })),
    ...result.manufacturability.warnings.map((text) => ({ text, className: "warning" })),
    ...result.nextActions.map((text) => ({ text: `Действие: ${text}`, className: "" }))
  ];

  agentFindingsList.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item.text;
      li.className = item.className;
      return li;
    })
  );
}

function renderEmptyAgent() {
  agentStatusPill.textContent = "не запускался";
  agentSummary.textContent = "Агент подключится при формировании отчёта или создании ТП.";
  agentFindingsList.innerHTML = "<li>Анализ чертежа и рекомендации появятся здесь.</li>";
}

function renderProcess(process) {
  routeTimeline.classList.remove("empty-state");
  routeTimeline.replaceChildren(
    ...process.operations.map((operation) => {
      const node = operationTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".operation__index").textContent = operation.code;
      node.querySelector("h3").textContent = operation.name;
      node.querySelector(".pill").textContent = operation.workCenter;
      node.querySelector("p").textContent = operation.purpose;
      node.querySelector("ul").replaceChildren(
        ...operation.transitions.map((transition) => {
          const li = document.createElement("li");
          li.textContent = transition;
          return li;
        })
      );
      return node;
    })
  );

  toolingTable.replaceChildren(
    ...process.tooling.map((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}. ${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.purpose)}</td>
        <td>${escapeHtml(item.size)}${item.catalogStatus ? `<br><small>${escapeHtml(item.catalogStatus)}</small>` : ""}</td>
        <td>${escapeHtml(item.catalogSource)}</td>
      `;
      return row;
    })
  );
}

function renderDocumentsSet(documents) {
  documentsSet.classList.remove("empty-state");
  documentsSet.replaceChildren(
    ...documents.map((doc) => {
      const article = document.createElement("article");
      article.className = "document-card";

      const rows = doc.rows
        .slice(0, 6)
        .map((row) => {
          const values = Object.entries(row)
            .map(([key, value]) => `<span><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</span>`)
            .join("");
          return `<li>${values}</li>`;
        })
        .join("");

      article.innerHTML = `
        <div class="document-card__header">
          <span class="document-code">${escapeHtml(doc.code)}</span>
          <div>
            <h3>${escapeHtml(doc.name)}</h3>
            <p>${escapeHtml(doc.form)}</p>
          </div>
        </div>
        <p>${escapeHtml(doc.purpose)}</p>
        <ul>${rows}</ul>
      `;
      return article;
    })
  );
}

function renderCncProgram(program) {
  cncProgramName.textContent = `${program.controllerLabel} • ${program.programName} • ${program.machiningKind === "turning" ? "токарная" : "фрезерная"} обработка`;
  cncSafetyNote.textContent = program.safetyNote;
  cncProgramCode.textContent = program.text;
}

function renderEmptyProcess() {
  routeTimeline.className = "timeline empty-state";
  routeTimeline.textContent = "Сначала сформируйте отчёт по исходнику, затем нажмите «Создать ТП».";
  toolingTable.innerHTML = '<tr><td colspan="4" class="muted">Ведомость появится после формирования процесса.</td></tr>';
}

function renderEmptyDocumentsSet() {
  documentsSet.className = "documents-set empty-state";
  documentsSet.textContent = "Комплект документов будет сформирован после создания технологического процесса.";
}

function renderEmptyCncProgram() {
  cncProgramName.textContent = "программа не сформирована";
  cncSafetyNote.textContent = "Сначала сформируйте ТП, затем выберите стойку и создайте черновой G-код.";
  cncProgramCode.textContent = "G-код появится здесь.";
}

function persist() {
  localStorage.setItem(
    "technologist-process-app",
    JSON.stringify({
      form: readForm(),
      agentResult: state.agentResult,
      sourceReport: state.sourceReport,
      process: state.process,
      cncProgram: state.cncProgram,
      cncController: cncController.value
    })
  );
}

function restore() {
  const raw = localStorage.getItem("technologist-process-app");
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (saved.form) {
      writeForm(saved.form);
      state.fileName = saved.form.fileName || "";
      fileHint.textContent = state.fileName || fileHint.textContent;
      clearImagePreview();
    }
    if (saved.process) {
      state.process = saved.process;
      renderProcess(saved.process);
      renderDocumentsSet(saved.process.gostDocuments || []);
    }
    if (saved.sourceReport) {
      state.sourceReport = saved.sourceReport;
      renderSourceReport(saved.sourceReport);
    }
    if (saved.agentResult) {
      state.agentResult = saved.agentResult;
      renderAgentResult(saved.agentResult);
    }
    if (saved.cncController) {
      cncController.value = saved.cncController;
    }
    if (saved.cncProgram) {
      state.cncProgram = saved.cncProgram;
      renderCncProgram(saved.cncProgram);
    }
  } catch {
    localStorage.removeItem("technologist-process-app");
  }
}

function defaultFileHint() {
  return "PDF, JPG/JPEG, PNG, SVG, STEP/STP, IGES, STL, OBJ, SLDPRT, Parasolid";
}

function download(fileName, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return String(value).replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-|-$/g, "") || "draft";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
