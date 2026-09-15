/* ============================================================
   DLP Generator — app.js  (Sheet mode + Quick Fill mode)
   ------------------------------------------------------------
   Lessons tab is simplified to only:
     Week | Class | Days | Topic | Objectives | Activities | Resources | Assessments
   Semester / Subject / Teacher / Coordinator are picked from
   their own lookup tabs each time and are NOT stored per Lessons
   row — they're attached fresh whenever you fill the form.
   ------------------------------------------------------------
   TWO MODES:
   1. "sheet"  — reads all lookup tabs from Google Sheets, offers
                 dropdowns, and can save new entries back via the
                 Apps Script Web App (see apps_script.gs).
   2. "quick"  — no sheet dependency required to fill the form.
                 Any teacher can open the page and type everything
                 directly. Nothing is saved; Preview + PDF/PNG only.
   ============================================================ */

// ---- 1. CONFIGURE ----
const SHEET_ID = "19gLRGZRoe8mwS0Mlvp58fKmzGibAEsNCXFT2Cj_wMFA";

const GIDS = {
  Lessons: "492370097",
  Subjects: "1065178766",
  Teachers: "1949288889",
  Classes: "1340083187",
  Coordinators: "841956882",
  Weeks: "39294606",
  Resources: "241556045",
  Assessments: "655947972",
  Topics: "960685870"
};

const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const gvizUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let MODE = "sheet"; // "sheet" | "quick"
let SHEET_READY = false;
let LESSONS = [];
let LOOKUPS = { Subjects: [], Teachers: [], Classes: [], Coordinators: [], Weeks: [], Resources: [], Assessments: [], Topics: [] };

const el = (id) => document.getElementById(id);
const statusMsg = el("statusMsg");

const modeSheetBtn = el("modeSheetBtn");
const modeQuickBtn = el("modeQuickBtn");
const modeHint = el("modeHint");

const semesterSelect = el("semesterSelect");

const subjectSelect = el("subjectSelect");
const subjectFreeInput = el("subjectFreeInput");
const teacherSelect = el("teacherSelect");
const teacherFreeInput = el("teacherFreeInput");
const coordinatorSelect = el("coordinatorSelect");
const coordinatorFreeInput = el("coordinatorFreeInput");
const classSelect = el("classSelect");
const classFreeInput = el("classFreeInput");
const weekSelect = el("weekSelect");
const weekFreeInput = el("weekFreeInput");
const weekStartField = el("weekStartField");
const weekStartFreeInput = el("weekStartFreeInput");
const daysFreeInput = el("daysFreeInput");

const topicInput = el("topicInput");
const topicDatalist = el("topicDatalist");
const objectivesInput = el("objectivesInput");
const activitiesInput = el("activitiesInput");

const resourcesPicker = el("resourcesPicker");
const resourcesFreeTextarea = el("resourcesFreeTextarea");
const assessmentsPicker = el("assessmentsPicker");
const assessmentsFreeTextarea = el("assessmentsFreeTextarea");

const previewBtn = el("previewBtn");
const pdfBtn = el("pdfBtn");
const pngBtn = el("pngBtn");
const reloadBtn = el("reloadBtn");
const saveEntryBtn = el("saveEntryBtn");

// ---------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------
function setMode(newMode) {
  MODE = newMode;
  const isQuick = MODE === "quick";

  modeSheetBtn.classList.toggle("active", !isQuick);
  modeQuickBtn.classList.toggle("active", isQuick);
  modeSheetBtn.setAttribute("aria-selected", String(!isQuick));
  modeQuickBtn.setAttribute("aria-selected", String(isQuick));

  modeHint.textContent = isQuick
    ? "Quick Fill: type everything directly. Nothing is saved to the sheet — Preview and PDF/PNG export only."
    : "Load & Save: pick from your Google Sheet's lookup tabs. New entries can be saved back to the sheet.";

  toggleFreePair(subjectSelect, subjectFreeInput, isQuick && !SHEET_READY);
  toggleFreePair(teacherSelect, teacherFreeInput, isQuick && !SHEET_READY);
  toggleFreePair(coordinatorSelect, coordinatorFreeInput, isQuick && !SHEET_READY);
  toggleFreePair(classSelect, classFreeInput, isQuick && !SHEET_READY);
  toggleFreePair(weekSelect, weekFreeInput, isQuick && !SHEET_READY);

  weekStartField.classList.toggle("hidden", !isQuick);

  resourcesPicker.classList.toggle("hidden", isQuick && !SHEET_READY);
  resourcesFreeTextarea.classList.toggle("hidden", !(isQuick && !SHEET_READY));
  assessmentsPicker.classList.toggle("hidden", isQuick && !SHEET_READY);
  assessmentsFreeTextarea.classList.toggle("hidden", !(isQuick && !SHEET_READY));

  saveEntryBtn.classList.toggle("hidden", isQuick);
  saveEntryBtn.disabled = true;

  pdfBtn.disabled = true;
  pngBtn.disabled = true;
}

function toggleFreePair(selectEl, freeInputEl, showFreeInput) {
  selectEl.classList.toggle("hidden", showFreeInput);
  freeInputEl.classList.toggle("hidden", !showFreeInput);
}

modeSheetBtn.addEventListener("click", () => setMode("sheet"));
modeQuickBtn.addEventListener("click", () => setMode("quick"));

// ---------------------------------------------------------------
// Fetch helpers (Sheet mode)
// ---------------------------------------------------------------
function extractGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.substring(start, end + 1));
}

function gvizToRecords(json) {
  const cols = json.table.cols.map((c) => (c.label || c.id || "").trim());
  const rows = json.table.rows || [];
  return rows.map((r) => {
    const obj = {};
    (r.c || []).forEach((cell, i) => {
      const key = cols[i];
      if (!key) return;
      obj[key] = cell ? (cell.f ?? cell.v ?? "") : "";
    });
    return obj;
  });
}

async function fetchTab(gid) {
  const res = await fetch(gvizUrl(gid));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return gvizToRecords(extractGvizJson(text));
}

// ---------------------------------------------------------------
// Load everything from the sheet
// ---------------------------------------------------------------
async function loadAll() {
  statusMsg.textContent = "Connecting to Google Sheet…";
  try {
    const [lessons, subjects, teachers, classes, coordinators, weeks, resources, assessments, topics] =
      await Promise.all([
        fetchTab(GIDS.Lessons),
        fetchTab(GIDS.Subjects),
        fetchTab(GIDS.Teachers),
        fetchTab(GIDS.Classes),
        fetchTab(GIDS.Coordinators),
        fetchTab(GIDS.Weeks),
        fetchTab(GIDS.Resources),
        fetchTab(GIDS.Assessments),
        fetchTab(GIDS.Topics)
      ]);

    LESSONS = lessons; // Week, Class, Days, Topic, Objectives, Activities, Resources, Assessments
    LOOKUPS.Subjects = subjects.map((r) => r.Subject).filter(Boolean);
    LOOKUPS.Teachers = teachers.map((r) => r.Teacher).filter(Boolean);
    LOOKUPS.Classes = classes.map((r) => r.Class).filter(Boolean);
    LOOKUPS.Coordinators = coordinators.map((r) => r.Coordinator).filter(Boolean);
    LOOKUPS.Weeks = weeks; // {Week, WeekStartDate}
    LOOKUPS.Resources = resources.map((r) => r.ResourceLabel).filter(Boolean);
    LOOKUPS.Assessments = assessments.map((r) => r.AssessmentLabel).filter(Boolean);
    LOOKUPS.Topics = topics.map((r) => r.Topic).filter(Boolean);

    SHEET_READY = true;
    populateStaticDropdowns();
    statusMsg.textContent = `Loaded ${LESSONS.length} lesson row(s) and all lookup tabs. Both modes are ready.`;
  } catch (err) {
    console.error(err);
    SHEET_READY = false;
    fillSelect(semesterSelect, ["Semester 1", "Semester 2"], "Select semester");
    statusMsg.textContent =
      "Could not load the sheet — Quick Fill mode still works using typed input. Check GIDS in app.js and sheet sharing.";
  }
  setMode(MODE);
}

// ---------------------------------------------------------------
// Populate dropdowns from lookup tabs
// ---------------------------------------------------------------
function fillSelect(selectEl, values, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function populateStaticDropdowns() {
  fillSelect(semesterSelect, ["Semester 1", "Semester 2"], "Select semester");
  fillSelect(subjectSelect, LOOKUPS.Subjects, "Select subject");
  fillSelect(teacherSelect, LOOKUPS.Teachers, "Select teacher");
  fillSelect(coordinatorSelect, LOOKUPS.Coordinators, "Select coordinator");
  fillSelect(classSelect, LOOKUPS.Classes, "Select class");

  const weekNums = LOOKUPS.Weeks
    .map((r) => String(r.Week).trim())
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  fillSelect(weekSelect, weekNums, "Select week (1–25)");

  topicDatalist.innerHTML = LOOKUPS.Topics.map((t) => `<option value="${escapeHtml(t)}">`).join("");

  renderPicker(resourcesPicker, LOOKUPS.Resources, "res");
  renderPicker(assessmentsPicker, LOOKUPS.Assessments, "assess");
}

function renderPicker(container, items, prefix) {
  container.innerHTML = items
    .map((label, i) => {
      const id = `${prefix}_${i}`;
      return `
      <label class="picker-item" for="${id}">
        <input type="checkbox" id="${id}" value="${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
      </label>`;
    })
    .join("");
}

function getCheckedValues(container) {
  return [...container.querySelectorAll("input[type=checkbox]:checked")].map((cb) => cb.value);
}

// ---------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseSheetDate(value) {
  if (typeof value === "string" && value.startsWith("Date(")) {
    const parts = value.replace("Date(", "").replace(")", "").split(",").map(Number);
    return new Date(parts[0], parts[1], parts[2]);
  }
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function getWeekStartDate(weekNum) {
  const row = LOOKUPS.Weeks.find((r) => String(r.Week).trim() === String(weekNum).trim());
  return row ? parseSheetDate(row.WeekStartDate) : null;
}

function dateForWeekday(weekStart, weekdayName) {
  const targetIdx = WEEKDAYS.findIndex((d) => d.toLowerCase() === weekdayName.trim().toLowerCase());
  if (targetIdx < 0 || !weekStart) return null;
  const mondayIdx = 1;
  const offset = ((targetIdx - mondayIdx) + 7) % 7;
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDate(d) {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day} ${month} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------
function splitToItems(text) {
  return String(text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
}
function listOrEmpty(items, emptyLabel) {
  if (items.length === 0) return `<p class="empty-note">${emptyLabel}</p>`;
  return `<ul class="cell-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function extractSemesterNumber(semStr) {
  const m = String(semStr).match(/\d+/);
  return m ? m[0] : semStr;
}

// Lessons is now Week+Class scoped only (no Subject/Teacher stored),
// so "usual days" lookup matches on Week+Class.
function defaultDaysFor(week, cls) {
  const existing = LESSONS.find(
    (r) => String(r.Week).trim() === String(week).trim() && String(r.Class).trim() === cls && r.Days
  );
  if (existing) return splitToItems(String(existing.Days).replace(/,/g, "\n"));
  return ["Monday", "Wednesday", "Friday"];
}

// ---------------------------------------------------------------
// Reading the form
// ---------------------------------------------------------------
function valueOrFree(selectEl, freeInputEl) {
  return freeInputEl.classList.contains("hidden") ? selectEl.value : freeInputEl.value.trim();
}

function currentForm() {
  const isQuick = MODE === "quick";

  let week, weekStart, days;
  week = weekFreeInput.classList.contains("hidden") ? weekSelect.value : weekFreeInput.value.trim();

  if (isQuick && weekStartFreeInput.value) {
    weekStart = new Date(weekStartFreeInput.value);
  } else {
    weekStart = getWeekStartDate(week);
  }

  if (daysFreeInput.value.trim()) {
    days = splitToItems(daysFreeInput.value.replace(/,/g, "\n"));
  } else {
    days = isQuick ? ["Monday", "Wednesday", "Friday"] : null; // resolved later via defaultDaysFor
  }

  const resourcesFromPicker = getCheckedValues(resourcesPicker);
  const resources = resourcesFromPicker.length ? resourcesFromPicker : splitToItems(resourcesFreeTextarea.value);

  const assessmentsFromPicker = getCheckedValues(assessmentsPicker);
  const assessments = assessmentsFromPicker.length ? assessmentsFromPicker : splitToItems(assessmentsFreeTextarea.value);

  return {
    semester: semesterSelect.value,
    subject: valueOrFree(subjectSelect, subjectFreeInput),
    teacher: valueOrFree(teacherSelect, teacherFreeInput),
    coordinator: valueOrFree(coordinatorSelect, coordinatorFreeInput),
    cls: valueOrFree(classSelect, classFreeInput),
    week,
    weekStart,
    days,
    topic: topicInput.value.trim(),
    objectives: objectivesInput.value,
    activities: activitiesInput.value,
    resources,
    assessments
  };
}

// ---------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------
function renderPreview() {
  const f = currentForm();
  if (!f.semester || !f.subject || !f.teacher || !f.cls || !f.week || !f.topic) {
    statusMsg.textContent = "Please fill Semester, Subject, Teacher, Class, Week and Topic first.";
    return;
  }

  el("titleSemester").textContent = `SEMESTER ${extractSemesterNumber(f.semester)}`;
  el("metaSubject").textContent = f.subject;
  el("metaClass").textContent = f.cls;
  el("metaWeek").textContent = f.week;
  el("signTeacher").textContent = f.teacher || "Teacher Name";
  el("signCoordinator").textContent = f.coordinator || "Coordinator";

  const weekStart = f.weekStart || getWeekStartDate(f.week);
  const days = f.days || defaultDaysFor(f.week, f.cls);

  const objectives = splitToItems(f.objectives);
  const activities = splitToItems(f.activities);

  el("dlpBody").innerHTML = buildMergedRows(
    days, weekStart, f.topic, objectives, activities, f.resources, f.assessments
  );

  const canSave = MODE === "sheet" && SHEET_READY;
  statusMsg.textContent = canSave
    ? "Preview generated. Download PDF/PNG, or save this entry to the sheet."
    : "Preview generated. Download as PDF or PNG.";
  pdfBtn.disabled = false;
  pngBtn.disabled = false;
  saveEntryBtn.disabled = !canSave;
}

function buildMergedRows(days, weekStart, topic, objectives, activities, resources, assessments) {
  const rowspan = days.length || 1;
  return days
    .map((dayName, idx) => {
      const dateObj = dateForWeekday(weekStart, dayName);
      const dateStr = formatDate(dateObj);
      const dayCell = `<td class="day-cell"><span class="day-name">${escapeHtml(dayName)}</span><span class="day-date">${escapeHtml(dateStr)}</span></td>`;
      if (idx === 0) {
        return `<tr>
          ${dayCell}
          <td class="merged-cell" rowspan="${rowspan}">${escapeHtml(topic)}</td>
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(objectives, "No objectives listed.")}</td>
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(activities, "No activities listed.")}</td>
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(resources, "No resources selected.")}</td>
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(assessments, "No assessments selected.")}</td>
        </tr>`;
      }
      return `<tr>${dayCell}</tr>`;
    })
    .join("");
}

// ---------------------------------------------------------------
// Export — PDF and PNG via html2canvas
// ---------------------------------------------------------------
async function captureCanvas() {
  return await html2canvas(el("dlpTable"), { scale: 2.5, backgroundColor: "#ffffff" });
}

async function exportPng() {
  statusMsg.textContent = "Rendering PNG…";
  const canvas = await captureCanvas();
  const link = document.createElement("a");
  link.download = buildFileName("png");
  link.href = canvas.toDataURL("image/png");
  link.click();
  statusMsg.textContent = "PNG downloaded.";
}

async function exportPdf() {
  statusMsg.textContent = "Rendering PDF…";
  const canvas = await captureCanvas();
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pxToMm = 0.264583;
  const widthMm = (canvas.width * pxToMm) / 2.5;
  const heightMm = (canvas.height * pxToMm) / 2.5;
  const orientation = widthMm > heightMm ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: [widthMm, heightMm] });
  pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
  pdf.save(buildFileName("pdf"));
  statusMsg.textContent = "PDF downloaded.";
}

function buildFileName(ext) {
  const f = currentForm();
  const clean = (s) => String(s).replace(/[^a-z0-9]+/gi, "_");
  return `DLP_${clean(f.subject)}_${clean(f.cls)}_Week${clean(f.week)}.${ext}`;
}

// ---------------------------------------------------------------
// Save entry back to the sheet — Lessons row is now simplified to
// Week, Class, Days, Topic, Objectives, Activities, Resources, Assessments
// ---------------------------------------------------------------
async function saveEntry() {
  if (MODE !== "sheet" || !SHEET_READY) {
    statusMsg.textContent = "Saving is only available in Load & Save mode with the sheet connected.";
    return;
  }
  const f = currentForm();
  if (!f.semester || !f.subject || !f.teacher || !f.cls || !f.week || !f.topic) {
    statusMsg.textContent = "Fill in the form and click Preview before saving.";
    return;
  }
  if (APPS_SCRIPT_URL.includes("PASTE_")) {
    statusMsg.textContent = "Saving is not configured yet — set APPS_SCRIPT_URL in app.js (see README).";
    return;
  }

  const days = f.days || defaultDaysFor(f.week, f.cls);
  const payload = {
    Week: f.week,
    Class: f.cls,
    Days: days.join(", "),
    Topic: f.topic,
    Objectives: f.objectives,
    Activities: f.activities,
    Resources: f.resources.join(", "),
    Assessments: f.assessments.join(", ")
  };

  statusMsg.textContent = "Saving entry to sheet…";
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    statusMsg.textContent = "Saved. Reloading sheet data…";
    if (!LOOKUPS.Topics.includes(f.topic)) LOOKUPS.Topics.push(f.topic);
    topicDatalist.innerHTML = LOOKUPS.Topics.map((t) => `<option value="${escapeHtml(t)}">`).join("");
    await loadAll();
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Save failed — check the Apps Script deployment URL and permissions.";
  }
}

// ---------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------
previewBtn.addEventListener("click", renderPreview);
pdfBtn.addEventListener("click", exportPdf);
pngBtn.addEventListener("click", exportPng);
reloadBtn.addEventListener("click", loadAll);
saveEntryBtn.addEventListener("click", saveEntry);

setMode("sheet");
loadAll();
