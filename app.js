/* ============================================================
   DLP Generator — app.js  (multi-tab lookup version)
   ------------------------------------------------------------
   TABS EXPECTED IN THE SPREADSHEET:
     Lessons      – Semester, Subject, Teacher, Coordinator, Week,
                    Class, Topic, Objectives, Activities,
                    Resources, Assessments
                    (Resources/Assessments store comma-separated
                     LABELS chosen from the Resources/Assessments tabs)
     Subjects     – Subject
     Teachers     – Teacher
     Classes      – Class
     Coordinators – Coordinator
     Weeks        – Week, WeekStartDate   (pre-filled 1-25, each Monday)
     Resources    – ResourceLabel
     Assessments  – AssessmentLabel
     Topics       – Topic   (auto-grows: every new topic typed gets
                             appended here so it's reusable later)
   ------------------------------------------------------------
   WRITE-BACK (auto-saving new Topics) requires a small Google
   Apps Script Web App, since plain gviz reads are read-only.
   See APPS_SCRIPT_URL below and the README for the deploy steps.
   ============================================================ */

// ---- 1. CONFIGURE THESE ----
const SHEET_ID = "19gLRGZRoe8mwS0Mlvp58fKmzGibAEsNCXFT2Cj_wMFA";

// gid for each tab — open each tab in the browser and copy the number after #gid=
const GIDS = {
  Lessons: "0",
  Subjects: "PASTE_GID",
  Teachers: "PASTE_GID",
  Classes: "PASTE_GID",
  Coordinators: "PASTE_GID",
  Weeks: "PASTE_GID",
  Resources: "PASTE_GID",
  Assessments: "PASTE_GID",
  Topics: "PASTE_GID"
};

// Apps Script Web App URL (for appending new Topics back to the sheet)
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const gvizUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let LESSONS = [];
let LOOKUPS = { Subjects: [], Teachers: [], Classes: [], Coordinators: [], Weeks: [], Resources: [], Assessments: [], Topics: [] };

const el = (id) => document.getElementById(id);
const statusMsg = el("statusMsg");

const semesterSelect = el("semesterSelect");
const subjectSelect = el("subjectSelect");
const teacherSelect = el("teacherSelect");
const coordinatorSelect = el("coordinatorSelect");
const classSelect = el("classSelect");
const weekSelect = el("weekSelect");
const topicInput = el("topicInput");
const topicDatalist = el("topicDatalist");
const objectivesInput = el("objectivesInput");
const activitiesInput = el("activitiesInput");
const resourcesPicker = el("resourcesPicker");
const assessmentsPicker = el("assessmentsPicker");

const previewBtn = el("previewBtn");
const pdfBtn = el("pdfBtn");
const pngBtn = el("pngBtn");
const reloadBtn = el("reloadBtn");
const saveEntryBtn = el("saveEntryBtn");

// ---------------------------------------------------------------
// Fetch helpers
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
// Load everything
// ---------------------------------------------------------------
async function loadAll() {
  statusMsg.textContent = "Connecting to Google Sheet…";
  setControlsDisabled(true);
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

    LESSONS = lessons;
    LOOKUPS.Subjects = subjects.map((r) => r.Subject).filter(Boolean);
    LOOKUPS.Teachers = teachers.map((r) => r.Teacher).filter(Boolean);
    LOOKUPS.Classes = classes.map((r) => r.Class).filter(Boolean);
    LOOKUPS.Coordinators = coordinators.map((r) => r.Coordinator).filter(Boolean);
    LOOKUPS.Weeks = weeks; // keep full rows: {Week, WeekStartDate}
    LOOKUPS.Resources = resources.map((r) => r.ResourceLabel).filter(Boolean);
    LOOKUPS.Assessments = assessments.map((r) => r.AssessmentLabel).filter(Boolean);
    LOOKUPS.Topics = topics.map((r) => r.Topic).filter(Boolean);

    populateStaticDropdowns();
    statusMsg.textContent = `Loaded ${LESSONS.length} lesson row(s) and all lookup tabs.`;
    setControlsDisabled(false);
  } catch (err) {
    console.error(err);
    statusMsg.textContent =
      "Could not load the sheet or one of its tabs. Check SHEET_ID, each tab's GID, and sharing permissions.";
  }
}

function setControlsDisabled(disabled) {
  [
    semesterSelect, subjectSelect, teacherSelect, coordinatorSelect,
    classSelect, weekSelect, topicInput, objectivesInput, activitiesInput
  ].forEach((s) => (s.disabled = disabled));
}

// ---------------------------------------------------------------
// Populate all dropdowns from lookup tabs (independent, no cascade needed
// since Subjects/Teachers/Classes/Coordinators are now flat lookup lists)
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

// Checkbox-list picker for multi-select Resources / Assessments
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
// Date helpers — WeekStartDate now comes from the Weeks lookup tab
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

// ---------------------------------------------------------------
// Days for the selected class+subject: look them up from an existing
// Lessons row if one exists for that Class, else default to Mon/Wed/Fri.
// You can still hand-edit day names/dates after preview.
// ---------------------------------------------------------------
function defaultDaysFor(cls, subj) {
  const existing = LESSONS.find(
    (r) => String(r.Class).trim() === cls && String(r.Subject).trim() === subj && r.Days
  );
  if (existing) return splitToItems(String(existing.Days).replace(/,/g, "\n"));
  return ["Monday", "Wednesday", "Friday"];
}

// ---------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------
function currentForm() {
  return {
    semester: semesterSelect.value,
    subject: subjectSelect.value,
    teacher: teacherSelect.value,
    coordinator: coordinatorSelect.value,
    cls: classSelect.value,
    week: weekSelect.value,
    topic: topicInput.value.trim(),
    objectives: objectivesInput.value,
    activities: activitiesInput.value,
    resources: getCheckedValues(resourcesPicker),
    assessments: getCheckedValues(assessmentsPicker)
  };
}

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

  const weekStart = getWeekStartDate(f.week);
  const days = defaultDaysFor(f.cls, f.subject);

  const objectives = splitToItems(f.objectives);
  const activities = splitToItems(f.activities);

  el("dlpBody").innerHTML = buildMergedRows(
    days, weekStart, f.topic, objectives, activities, f.resources, f.assessments
  );

  statusMsg.textContent = "Preview generated. You can now download as PDF or PNG, or save this entry to the sheet.";
  pdfBtn.disabled = false;
  pngBtn.disabled = false;
  saveEntryBtn.disabled = false;
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
// Save entry back to the sheet (Lessons row) + auto-append new Topic
// Requires APPS_SCRIPT_URL to be configured — see README.
// ---------------------------------------------------------------
async function saveEntry() {
  const f = currentForm();
  if (!f.semester || !f.subject || !f.teacher || !f.cls || !f.week || !f.topic) {
    statusMsg.textContent = "Fill in the form and click Preview before saving.";
    return;
  }
  if (APPS_SCRIPT_URL.includes("PASTE_")) {
    statusMsg.textContent = "Saving is not configured yet — set APPS_SCRIPT_URL in app.js (see README).";
    return;
  }

  const days = defaultDaysFor(f.cls, f.subject);
  const payload = {
    Semester: f.semester,
    Subject: f.subject,
    Teacher: f.teacher,
    Coordinator: f.coordinator,
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

loadAll();
