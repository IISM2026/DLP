# DLP Generator — Multi-Tab Setup Guide

This version splits your spreadsheet into a main `Lessons` tab plus dedicated lookup tabs for Subjects, Teachers, Classes, Coordinators, Weeks (pre-filled 1–25 with dates), Resources, and Assessments. You now only type **Topic, Objectives, and Activities** by hand — everything else is picked from a dropdown, checkbox list, or pre-filled table. New topics you type are automatically saved back into the `Topics` tab so they show up as suggestions next time.

## Files

- `index.html` – page structure and form controls
- `style.css` – styling for the form and the fixed-size DLP table
- `app.js` – reads all tabs, drives the form, renders the preview, exports PDF/PNG, saves new entries
- `apps_script.gs` – paste this into Google Apps Script; it's what lets the app write back to your sheet
- `logo.png` – you add this (school crest)

## 1. Create the tabs in your spreadsheet

Inside your existing spreadsheet (`19gLRGZRoe8mwS0Mlvp58fKmzGibAEsNCXFT2Cj_wMFA`), create these tabs with these exact headers in row 1:

**Lessons** (main data — one row per topic entry, this is what grows over the year)
`Semester | Subject | Teacher | Coordinator | Week | Class | Days | Topic | Objectives | Activities | Resources | Assessments`

**Subjects** — single column: `Subject`
**Teachers** — single column: `Teacher`
**Classes** — single column: `Class`
**Coordinators** — single column: `Coordinator`
**Resources** — single column: `ResourceLabel`
**Assessments** — single column: `AssessmentLabel`
**Topics** — single column: `Topic` (start empty or seed with known topics; the app appends to this automatically)

**Weeks** — pre-filled table, two columns: `Week | WeekStartDate`
Fill in rows 1–25 once, e.g.:

| Week | WeekStartDate |
|---|---|
| 1 | 2026-08-17 |
| 2 | 2026-08-24 |
| 3 | 2026-08-31 |
| … | … |
| 25 | (your term's last week's Monday) |

Because `WeekStartDate` is a lookup now, you set each Monday date **once for the whole year**, not per subject/class — every subject and teacher shares the same week calendar.

Notes on `Days` in `Lessons`: this stores your teaching days for that Class+Subject combo (e.g. `Monday, Wednesday, Friday`). The app auto-detects a Class+Subject's usual days from any previous row and reuses them, so you rarely need to touch this — but you can still adjust it in the sheet directly for holiday weeks.

## 2. Share the sheet

**Share → General access → Anyone with the link → Viewer.** This must stay on for the app's read side to work, exactly as before.

## 3. Find each tab's GID

Click each tab in your browser and copy the number after `#gid=` in the URL. Then in `app.js`, fill in the `GIDS` object:

```js
const GIDS = {
  Lessons: "0",
  Subjects: "123456789",
  Teachers: "234567890",
  Classes: "345678901",
  Coordinators: "456789012",
  Weeks: "567890123",
  Resources: "678901234",
  Assessments: "789012345",
  Topics: "890123456"
};
```

## 4. Deploy the Apps Script (enables auto-saving new Topics)

Plain sheet reads (`gviz`) are read-only — to let the app append a new Lessons row and auto-grow the Topics list, it needs a tiny Apps Script Web App as a write endpoint.

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete the placeholder code, paste in the contents of `apps_script.gs`.
3. Click **Deploy → New deployment**.
4. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**.
5. Click **Deploy**, and approve the permission prompts (this is your own script acting on your own sheet).
6. Copy the **Web app URL** it gives you — looks like `https://script.google.com/macros/s/AKfycb.../exec`.
7. Paste that URL into `APPS_SCRIPT_URL` in `app.js`.

If you skip this step, everything still works except the **Save Entry to Sheet** button — Preview, PDF, and PNG export all work purely from what's typed into the form, without needing to save anything back to the sheet first.

## 5. Using the generator

1. Pick **Semester, Subject, Teacher, Coordinator, Class, Week** from dropdowns — these are now flat lookup lists, not cascading, since each is independent metadata.
2. Type or pick a **Topic** — start typing and existing topics from the `Topics` tab autocomplete via the built-in browser suggestion list.
3. Type **Objectives** and **Activities**, one line per point (each line becomes a bullet in the final table).
4. Tick the relevant **Resources** and **Assessments** checkboxes — as many as apply.
5. Click **Preview** — the fixed-size table renders with dates auto-calculated from the `Weeks` tab and the Class's usual teaching days.
6. Click **Save Entry to Sheet** to append this as a new row in `Lessons` and register any brand-new topic into `Topics` for future reuse.
7. Click **Download PDF** or **Download PNG** to export.

## Why this structure

Storing Subjects/Teachers/Classes/Coordinators/Resources/Assessments in their own tabs means you edit each list in exactly one place. Renaming a resource, or fixing a teacher's name spelling, updates instantly everywhere it's used, instead of requiring a find-and-replace across a growing `Lessons` history. The `Weeks` tab means the entire term's date calendar is set once, not duplicated per subject.

## Extending later

- Add a `Homework` or `Notes` tab/column the same way — add the header, add it to `COLS`/`LOOKUPS` handling in `app.js`, add a form field in `index.html`.
- If you want Resources/Assessments checkboxes to also support "type a new one," add a small text input beside each picker that calls the same `saveEntry`-style Apps Script pattern to append to those tabs too.
- If multiple teachers will use this generator, consider locking the Teacher dropdown to a value from a login/session instead of a free dropdown, to avoid mix-ups.
