# DLP Generator — Setup Guide

A Google Sheets–powered Daily Lesson Plan generator for International Islamic School Malaysia (Secondary). Pick a subject, teacher, class, semester, week and topic from dropdowns; the form auto-fills objectives, activities, resources and assessments from your sheet, computes the correct dates for each teaching day, and exports a pixel-matched PDF or PNG of the DLP table.

## Files

- `index.html` – page structure and the DLP table template
- `style.css` – fixed-size table styling matching the school template
- `app.js` – Google Sheet fetch, dropdown logic, date calculation, PDF/PNG export
- `logo.png` – **you add this** (the IIS Malaysia crest), referenced separately so you can swap it anytime

## 1. Set up the Google Sheet

Create a sheet with **one row per topic entry** (a topic can span several days), using these exact column headers in row 1, in this order:

| # | Column | Example |
|---|---|---|
| 1 | Semester | Semester 1 |
| 2 | Subject | Islamic Studies |
| 3 | Teacher | Ahmad Mu'az |
| 4 | Coordinator | Coordinator name (used for the "Checked by" line) |
| 5 | Week | 1 |
| 6 | WeekStartDate | 2026-08-17 |
| 7 | Class | 10 Razi |
| 8 | Days | Monday, Wednesday, Friday |
| 9 | Topic | Introduction to Islamic Studies: Syllabus, Past Papers, and Learning Strategies |
| 10 | Objectives | One objective per line (use Alt+Enter inside the cell for line breaks) |
| 11 | Activities | One activity per line |
| 12 | Resources | One resource per line |
| 13 | Assessments | One assessment per line |

The app reads columns **by header name**, not by position, so this exact order isn't strictly required for it to function — but keeping your sheet in this sequence makes manual editing and review easier, and matches the app's dropdown flow below.

Notes:
- `WeekStartDate` must be the **Monday** of that week (ISO format `YYYY-MM-DD` works best; Sheets date-formatted cells also work).
- `Days` is comma-separated weekday names. The app uses this to calculate the exact date for each teaching day in that week (e.g. Monday 17 Aug, Wednesday 19 Aug, Friday 21 Aug) and displays them even on days with no separate lesson — matching your template where Monday/Friday can be blank placeholders while Wednesday carries the full lesson.
- Use Alt+Enter (Windows) or Option+Return (Mac) inside a Sheets cell to create line breaks within Objectives/Activities/Resources/Assessments — the app splits on line breaks and renders each as a bullet.

## 2. Publish the sheet so the app can read it

1. In Google Sheets: **File → Share → Publish to web**.
2. Choose the specific sheet/tab, format **CSV** is fine, but leave default (the app uses the `gviz` endpoint, which works once the sheet is at least link-shared).
3. Alternatively, and more robustly: **Share → General access → Anyone with the link → Viewer**. This lets the `gviz/tq` JSON endpoint read it without needing an API key.
4. Copy the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjKlMnOpQrStUvWxYz`**`/edit`
5. Note the **gid** of the tab (visible in the URL after `#gid=`), if you use more than one tab.

## 3. Configure the app

Open `app.js` and edit the two constants at the top:

```js
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
const GID = "0"; // change if your data is not on the first tab
```

## 4. Add your logo

Save the IIS Malaysia crest as `logo.png` (transparent background recommended) in the same folder as `index.html`. It's referenced as a separate `<img>` layer in the top-left header cell, so you can replace the file anytime without touching the code.

## 5. Run it

- **Quickest:** open `index.html` directly in a browser (double-click it). Because data is fetched over HTTPS from Google, this works even from a local file in most browsers — if fetch is blocked by CORS locally, use a simple local server instead:
  ```bash
  npx serve .
  ```
- **Host it for free on GitHub Pages:** push this folder to a GitHub repo, then enable Pages (Settings → Pages → Deploy from branch → `main` → `/root`). You already use GitHub, so this fits your workflow directly.

## 6. Using the generator

The dropdown chain now follows your sheet's column order:

1. **Semester → Subject → Teacher → Class → Week** — each choice filters the next dropdown's options.
2. **Topic** — filtered down to only the topics that exist for that exact semester/subject/teacher/class/week combination; picking one auto-fills Objectives, Activities, Resources, and Assessments.
3. The **Day & Date** column is pre-filled from the sheet's `Days` and `WeekStartDate` but every date cell is editable after preview if you need to shift a public holiday, etc.
4. Click **Preview** to render the fixed-size table exactly like your school template.
5. Click **Download PDF** or **Download PNG** — both use `html2canvas` to snapshot the rendered table at high resolution, so formatting always matches what you see on screen.
6. **Prepared by** (Teacher) and **Checked by** (Coordinator) at the bottom of the table are pulled automatically from those two columns.

## Extending later

- Add a `Notes` or `Homework` column if your DLP template grows — just add the header to the sheet and a matching line in the `COLS` object at the top of `app.js`.
- If a single teacher teaches multiple subjects/classes, the Teacher dropdown will only show teachers who have rows for the previously selected Semester + Subject, so the list stays relevant.
- If you outgrow client-side Sheets reads (e.g. need write-back from the browser), swap the `gviz` fetch for a small Google Apps Script Web App endpoint — same UI, just change the fetch URL in `app.js`.
