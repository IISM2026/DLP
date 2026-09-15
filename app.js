/* ============================================================
   DLP Generator — app.js  (fully self-contained, no Google Sheet)
   ------------------------------------------------------------
   Every lookup list lives right here as a constant. To edit any
   list (add a teacher, class, resource, assessment...), just
   edit the arrays below — no spreadsheet, no fetch, no backend.
   ============================================================ */

// ---- 1. EDIT THESE LISTS AS NEEDED ----

// Add teacher names here. Currently empty — add "Ahmad Mu'az" (or
// whichever teachers you want in the dropdown) as new array items,
// one string per teacher, e.g.: const TEACHERS = ["Ahmad Mu'az", "Nurul Huda"];
const TEACHERS = [
  "Ahmad Mu'az"
];

const COORDINATORS = [
  "Jalal Alwan"
];

const SUBJECTS = [
  "Islamic Studies",
  "Islamic History"
];

// Classes: Grade 7 to 11, each with 5 streams (F, R, G, IK, IN)
const CLASSES = (() => {
  const grades = [7, 8, 9, 10, 11];
  const streams = ["F", "R", "G", "IK", "IN"];
  const list = [];
  grades.forEach((g) => streams.forEach((s) => list.push(`${g}${s}`)));
  return list;
})();

// Weeks 1–18, starting Monday 17 Aug 2026, one week apart
const WEEKS = (() => {
  const start = new Date(2026, 7, 17); // month is 0-indexed: 7 = August
  const list = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    list.push({ week: i + 1, start: d });
  }
  return list;
})();

const RESOURCES = [
  "Islamic Studies Book",
  "YouTube Educational Video",
  "Whiteboard / Interactive Board",
  "Worksheet Handout",
  "Past-Year Paper",
  "PowerPoint / Slides",
  "Qur'an / Hadith Text"
];

// Beyond your two, added common formative-assessment types used in
// secondary classrooms (exit tickets, quizzes, oral questioning, etc.)
const ASSESSMENTS = [
  "Exit Ticket",
  "Short Quiz",
  "Oral Questioning",
  "Think-Pair-Share",
  "Worksheet Completion",
  "Group Presentation",
  "Peer Assessment",
  "Class Discussion Observation"
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MAX_DAYS = 3;

// ---------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------
const el = (id) => document.getElementById(id);
const statusMsg = el("statusMsg");

const semesterSelect = el("semesterSelect");
const teacherSelect = el("teacherSelect");
const coordinatorSelect = el("coordinatorSelect");
const subjectSelect = el("subjectSelect");
const classSelect = el("classSelect");
const weekSelect = el("weekSelect");
const daysRow = el("daysRow");

const topicInput = el("topicInput");
const objectivesInput = el("objectivesInput");
const activitiesInput = el("activitiesInput");
const resourcesPicker = el("resourcesPicker");
const assessmentsPicker = el("assessmentsPicker");

const previewBtn = el("previewBtn");
const pdfBtn = el("pdfBtn");
const pngBtn = el("pngBtn");

// ---------------------------------------------------------------
// Populate all dropdowns / pickers on load
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

function init() {
  fillSelect(teacherSelect, TEACHERS, TEACHERS.length ? "Select teacher" : "No teachers added yet");
  fillSelect(coordinatorSelect, COORDINATORS, "Select coordinator");
  fillSelect(subjectSelect, SUBJECTS, "Select subject");
  fillSelect(classSelect, CLASSES, "Select class");
  fillSelect(weekSelect, WEEKS.map((w) => String(w.week)), "Select week");

  daysRow.innerHTML = WEEKDAYS.map(
    (d, i) => `
    <label class="day-chip" for="day_${i}">
      <input type="checkbox" id="day_${i}" value="${d}">
      <span>${d}</span>
    </label>`
  ).join("");
  daysRow.addEventListener("change", enforceMaxDays);

  renderPicker(resourcesPicker, RESOURCES, "res");
  renderPicker(assessmentsPicker, ASSESSMENTS, "assess");
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

function enforceMaxDays() {
  const boxes = [...daysRow.querySelectorAll("input[type=checkbox]")];
  const checked = boxes.filter((b) => b.checked);
  if (checked.length > MAX_DAYS) {
    checked[0].checked = false;
    statusMsg.textContent = `You can select up to ${MAX_DAYS} teaching days only.`;
  }
}

function getCheckedValues(container) {
  return [...container.querySelectorAll("input[type=checkbox]:checked")].map((cb) => cb.value);
}

// ---------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------
function getWeekStart(weekNum) {
  const row = WEEKS.find((w) => String(w.week) === String(weekNum));
  return row ? row.start : null;
}

function dateForWeekday(weekStart, weekdayName) {
  const idx = WEEKDAYS.indexOf(weekdayName);
  if (idx < 0 || !weekStart) return null;
  const d = new Date(weekStart);
  d.setDate(d.getDate() + idx); // WEEKDAYS[0] = Monday = weekStart itself
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

// ---------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------
function currentForm() {
  return {
    semester: semesterSelect.value,
    teacher: teacherSelect.value,
    coordinator: coordinatorSelect.value,
    subject: subjectSelect.value,
    cls: classSelect.value,
    week: weekSelect.value,
    days: [...daysRow.querySelectorAll("input:checked")].map((cb) => cb.value),
    topic: topicInput.value.trim(),
    objectives: objectivesInput.value,
    activities: activitiesInput.value,
    resources: getCheckedValues(resourcesPicker),
    assessments: getCheckedValues(assessmentsPicker)
  };
}

function renderPreview() {
  const f = currentForm();
  if (!f.semester || !f.teacher || !f.subject || !f.cls || !f.week || !f.topic || f.days.length === 0) {
    statusMsg.textContent = "Please fill Semester, Teacher, Subject, Class, Week, at least one Teaching day, and Topic.";
    return;
  }

  el("titleSemester").textContent = `SEMESTER ${f.semester}`;
  el("metaSubject").textContent = f.subject;
  el("metaClass").textContent = f.cls;
  el("metaWeek").textContent = f.week;
  el("signTeacher").textContent = f.teacher || "Teacher Name";
  el("signCoordinator").textContent = f.coordinator || "Coordinator";

  const weekStart = getWeekStart(f.week);
  const orderedDays = WEEKDAYS.filter((d) => f.days.includes(d)); // keep Mon->Fri order regardless of click order

  const objectives = splitToItems(f.objectives);
  const activities = splitToItems(f.activities);

  el("dlpBody").innerHTML = buildMergedRows(
    orderedDays, weekStart, f.topic, objectives, activities, f.resources, f.assessments
  );

  statusMsg.textContent = "Preview generated. Download as PDF or PNG.";
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
// Event wiring
// ---------------------------------------------------------------
previewBtn.addEventListener("click", renderPreview);
pdfBtn.addEventListener("click", exportPdf);
pngBtn.addEventListener("click", exportPng);

init();
