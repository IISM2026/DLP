/* ============================================================
   DLP Generator — app.js
   Reads a published Google Sheet, drives cascading dropdowns,
   computes per-day dates for the selected week, and exports
   the rendered table as PDF or PNG.

   Sheet column order (headers must match row 1 exactly):
   Semester | Subject | Teacher | Coordinator | Week | WeekStartDate |
   Class | Days | Topic | Objectives | Activities | Resources | Assessments
   ============================================================ */

// ---- 1. CONFIGURE THESE TWO VALUES ----
const SHEET_ID = "19gLRGZRoe8mwS0Mlvp58fKmzGibAEsNCXFT2Cj_wMFA";
const GID = "0"; // tab/sheet gid, "0" = first tab

const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

// Column headers — matched by name, so sheet column ORDER does not matter.
const COLS = {
  semester: "Semester",
  subject: "Subject",
  teacher: "Teacher",
  coordinator: "Coordinator",
  week: "Week",
  weekStart: "WeekStartDate",
  class: "Class",
  days: "Days",
  topic: "Topic",
  objectives: "Objectives",
  activities: "Activities",
  resources: "Resources",
  assessments: "Assessments"
};

let RECORDS = []; // parsed sheet rows as objects

const el = (id) => document.getElementById(id);
const statusMsg = el("statusMsg");

const semesterSelect = el("semesterSelect");
const subjectSelect = el("subjectSelect");
const teacherSelect = el("teacherSelect");
const classSelect = el("classSelect");
const weekSelect = el("weekSelect");
const topicSelect = el("topicSelect");
const previewBtn = el("previewBtn");
const pdfBtn = el("pdfBtn");
const pngBtn = el("pngBtn");
const reloadBtn = el("reloadBtn");

// ---------------------------------------------------------------
// Fetch + parse the Google Sheet via the gviz JSON endpoint
// ---------------------------------------------------------------
async function loadSheet() {
  statusMsg.textContent = "Connecting to Google Sheet…";
  setSelectDisabled(true);
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const json = extractGvizJson(text);
    RECORDS = gvizToRecords(json);
    if (RECORDS.length === 0) {
      statusMsg.textContent = "Sheet connected, but no rows were found. Check your headers match the README.";
      return;
    }
    statusMsg.textContent = `Loaded ${RECORDS.length} row(s) from the sheet.`;
    populateSemesters();
    setSelectDisabled(false);
  } catch (err) {
    console.error(err);
    statusMsg.textContent =
      "Could not load the sheet. Make sure SHEET_ID is set in app.js and the sheet is shared as 'Anyone with the link — Viewer'.";
  }
}

// gviz responses wrap JSON in "google.visualization.Query.setResponse(...)"
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
    r.c.forEach((cell, i) => {
      const key = cols[i];
      if (!key) return;
      obj[key] = cell ? (cell.f ?? cell.v ?? "") : "";
    });
    return obj;
  });
}

function setSelectDisabled(disabled) {
  [semesterSelect, subjectSelect, teacherSelect, classSelect, weekSelect, topicSelect].forEach(
    (s) => (s.disabled = disabled)
  );
}

// ---------------------------------------------------------------
// Cascading dropdown population
// Chain follows the sheet's logical order:
// Semester -> Subject -> Teacher -> Class -> Week -> Topic
// ---------------------------------------------------------------
function uniqueValues(records, key) {
  return [...new Set(records.map((r) => String(r[key] ?? "").trim()).filter(Boolean))];
}

function fillSelect(selectEl, values, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function populateSemesters() {
  fillSelect(semesterSelect, uniqueValues(RECORDS, COLS.semester), "Select semester");
  clearDownstream(["subject", "teacher", "class", "week", "topic"]);
}

function populateSubjects() {
  const sem = semesterSelect.value;
  const filtered = RECORDS.filter((r) => String(r[COLS.semester]).trim() === sem);
  fillSelect(subjectSelect, uniqueValues(filtered, COLS.subject), "Select subject");
  clearDownstream(["teacher", "class", "week", "topic"]);
}

function populateTeachers() {
  const { sem, subj } = currentFilters();
  const filtered = RECORDS.filter(
    (r) => String(r[COLS.semester]).trim() === sem && String(r[COLS.subject]).trim() === subj
  );
  fillSelect(teacherSelect, uniqueValues(filtered, COLS.teacher), "Select teacher");
  clearDownstream(["class", "week", "topic"]);
}

function populateClasses() {
  const { sem, subj, teacher } = currentFilters();
  const filtered = RECORDS.filter(
    (r) =>
      String(r[COLS.semester]).trim() === sem &&
      String(r[COLS.subject]).trim() === subj &&
      String(r[COLS.teacher]).trim() === teacher
  );
  fillSelect(classSelect, uniqueValues(filtered, COLS.class), "Select class");
  clearDownstream(["week", "topic"]);
}

function populateWeeks() {
  const { sem, subj, teacher, cls } = currentFilters();
  const filtered = RECORDS.filter(
    (r) =>
      String(r[COLS.semester]).trim() === sem &&
      String(r[COLS.subject]).trim() === subj &&
      String(r[COLS.teacher]).trim() === teacher &&
      String(r[COLS.class]).trim() === cls
  );
  const weeks = uniqueValues(filtered, COLS.week).sort((a, b) => Number(a) - Number(b));
  fillSelect(weekSelect, weeks, "Select week");
  clearDownstream(["topic"]);
}

function populateTopics() {
  const { sem, subj, teacher, cls, week } = currentFilters();
  const filtered = RECORDS.filter(
    (r) =>
      String(r[COLS.semester]).trim() === sem &&
      String(r[COLS.subject]).trim() === subj &&
      String(r[COLS.teacher]).trim() === teacher &&
      String(r[COLS.class]).trim() === cls &&
      String(r[COLS.week]).trim() === week
  );
  fillSelect(topicSelect, uniqueValues(filtered, COLS.topic), "Select topic");
}

function clearDownstream(fields) {
  const map = {
    subject: subjectSelect,
    teacher: teacherSelect,
    class: classSelect,
    week: weekSelect,
    topic: topicSelect
  };
  fields.forEach((f) => fillSelect(map[f], [], `Select ${f}`));
  pdfBtn.disabled = true;
  pngBtn.disabled = true;
}

function currentFilters() {
  return {
    sem: semesterSelect.value,
    subj: subjectSelect.value,
    teacher: teacherSelect.value,
    cls: classSelect.value,
    week: weekSelect.value,
    topic: topicSelect.value
  };
}

// ---------------------------------------------------------------
// Date helpers — compute each teaching day's date from WeekStartDate + Days
// ---------------------------------------------------------------
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseWeekStart(value) {
  // Handles gviz Date(YYYY,M,D) serial strings and plain ISO strings
  if (typeof value === "string" && value.startsWith("Date(")) {
    const parts = value.replace("Date(", "").replace(")", "").split(",").map(Number);
    return new Date(parts[0], parts[1], parts[2]);
  }
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function dateForWeekday(weekStart, weekdayName) {
  const targetIdx = WEEKDAYS.findIndex((d) => d.toLowerCase() === weekdayName.trim().toLowerCase());
  if (targetIdx < 0 || !weekStart) return null;
  const mondayIdx = 1; // WeekStartDate is defined as the Monday of that week
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
// Rendering the DLP table
// ---------------------------------------------------------------
function splitToItems(text) {
  return String(text || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listOrEmpty(items, emptyLabel) {
  if (items.length === 0) return `<p class="empty-note">${emptyLabel}</p>`;
  return `<ul class="cell-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPreview() {
  const { sem, subj, teacher, cls, week, topic } = currentFilters();
  if (!sem || !subj || !teacher || !cls || !week || !topic) {
    statusMsg.textContent = "Please select semester, subject, teacher, class, week and topic first.";
    return;
  }
  const record = RECORDS.find(
    (r) =>
      String(r[COLS.semester]).trim() === sem &&
      String(r[COLS.subject]).trim() === subj &&
      String(r[COLS.teacher]).trim() === teacher &&
      String(r[COLS.class]).trim() === cls &&
      String(r[COLS.week]).trim() === week &&
      String(r[COLS.topic]).trim() === topic
  );
  if (!record) {
    statusMsg.textContent = "Could not find that combination in the sheet.";
    return;
  }

  el("titleSemester").textContent = `SEMESTER ${extractSemesterNumber(sem)}`;
  el("metaSubject").textContent = subj;
  el("metaClass").textContent = cls;
  el("metaWeek").textContent = week;
  el("signTeacher").textContent = record[COLS.teacher] || "Teacher Name";
  el("signCoordinator").textContent = record[COLS.coordinator] || "Coordinator";

  const weekStart = parseWeekStart(record[COLS.weekStart]);
  const days = splitToItems(String(record[COLS.days] || "").replace(/,/g, "\n"));

  const objectives = splitToItems(record[COLS.objectives]);
  const activities = splitToItems(record[COLS.activities]);
  const resources = splitToItems(record[COLS.resources]);
  const assessments = splitToItems(record[COLS.assessments]);

  el("dlpBody").innerHTML = buildMergedRows(days, weekStart, topic, objectives, activities, resources, assessments);

  statusMsg.textContent = "Preview generated. You can now download as PDF or PNG.";
  pdfBtn.disabled = false;
  pngBtn.disabled = false;
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
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(resources, "No resources listed.")}</td>
          <td class="merged-cell" rowspan="${rowspan}">${listOrEmpty(assessments, "No assessments listed.")}</td>
        </tr>`;
      }
      return `<tr>${dayCell}</tr>`;
    })
    .join("");
}

function extractSemesterNumber(semStr) {
  const m = String(semStr).match(/\d+/);
  return m ? m[0] : semStr;
}

// ---------------------------------------------------------------
// Export — PDF and PNG via html2canvas
// ---------------------------------------------------------------
async function captureCanvas() {
  const target = el("dlpTable");
  return await html2canvas(target, { scale: 2.5, backgroundColor: "#ffffff" });
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
  const widthMm = canvas.width * pxToMm / 2.5;
  const heightMm = canvas.height * pxToMm / 2.5;
  const orientation = widthMm > heightMm ? "landscape" : "portrait";

  const pdf = new jsPDF({ orientation, unit: "mm", format: [widthMm, heightMm] });
  pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
  pdf.save(buildFileName("pdf"));
  statusMsg.textContent = "PDF downloaded.";
}

function buildFileName(ext) {
  const { subj, cls, week } = currentFilters();
  const clean = (s) => String(s).replace(/[^a-z0-9]+/gi, "_");
  return `DLP_${clean(subj)}_${clean(cls)}_Week${clean(week)}.${ext}`;
}

// ---------------------------------------------------------------
// Event wiring — follows Semester -> Subject -> Teacher -> Class -> Week -> Topic
// ---------------------------------------------------------------
semesterSelect.addEventListener("change", populateSubjects);
subjectSelect.addEventListener("change", populateTeachers);
teacherSelect.addEventListener("change", populateClasses);
classSelect.addEventListener("change", populateWeeks);
weekSelect.addEventListener("change", populateTopics);
previewBtn.addEventListener("click", renderPreview);
pdfBtn.addEventListener("click", exportPdf);
pngBtn.addEventListener("click", exportPng);
reloadBtn.addEventListener("click", loadSheet);

loadSheet();
