# DLP Generator — Two Modes

The page now has a mode toggle at the top:

- **Load & Save (from Sheet)** — your original workflow. Reads all lookup tabs (Subjects, Teachers, Classes, Coordinators, Weeks, Resources, Assessments, Topics) from Google Sheets, offers dropdowns/checkboxes, and can save a new entry back into the `Lessons` tab.
- **Quick Fill (no save)** — anyone opens the same page and types Subject, Teacher, Coordinator, Class, Week, Week start date, Days, Topic, Objectives, Activities, Resources, and Assessments directly, with **no Google Sheet required at all**. They click Preview, then Download PDF or PNG. Nothing is written anywhere — this mode never touches your sheet.

Both modes render through the exact same fixed-size table and the same PDF/PNG export, so output always looks identical regardless of which mode was used to fill it in.

## Files

- `index.html` – page structure, mode toggle, and both sets of form controls
- `style.css` – styling, including the mode toggle and hidden/shown field pairs
- `app.js` – mode-switching logic, sheet fetch, form handling, preview rendering, PDF/PNG export, save-to-sheet
- `apps_script.gs` – Apps Script Web App used only by Load & Save mode's Save button
- `logo.png` – you add this (school crest)

## How the mode switch works

Every field that has a sheet-backed dropdown (Subject, Teacher, Coordinator, Class, Week, Resources, Assessments) has a matching free-text input hidden right underneath it. Switching to **Quick Fill** hides the dropdown and reveals the free-text version (or, if the sheet failed to load even in Sheet mode, the free-text fallback appears automatically so the page is never stuck unusable).

Topic, Objectives, and Activities are always free-text — those were already meant to be typed by hand.

A **Week start date** picker and a **Teaching days** field only make sense in Quick Fill, since Sheet mode already computes both automatically from the `Weeks` and `Lessons` tabs. In Quick Fill, whoever fills the form picks the Monday date directly and types their days (e.g. `Monday, Wednesday, Friday`), and the app calculates each day's actual date the same way as before.

## Setting up Load & Save mode (unchanged from before)

If you haven't done this part yet:

1. Create the `Lessons`, `Subjects`, `Teachers`, `Classes`, `Coordinators`, `Weeks`, `Resources`, `Assessments`, and `Topics` tabs as described in the multi-tab setup.
2. Share the sheet as **Anyone with the link — Viewer**.
3. Collect each tab's `gid` and paste into the `GIDS` object in `app.js`.
4. Deploy `apps_script.gs` as a Web App (see the previous README section, unchanged) and paste the URL into `APPS_SCRIPT_URL`.

If the sheet is unreachable or not yet configured, Load & Save mode will show free-text fallbacks automatically (identical to Quick Fill) so the page still works — you'll just see a status message noting the sheet couldn't be loaded.

## Sharing Quick Fill mode with other teachers

Since Quick Fill needs no sheet access and no Apps Script, you can host `index.html` + `style.css` + `app.js` + `logo.png` on GitHub Pages (or any static host) and hand out the link to any teacher. They:

1. Open the page.
2. Click **Quick Fill (no save)** — it's worth setting this as the default tab if most visitors are other teachers rather than you managing the master sheet. To do that, change the last two lines of `app.js` from:
   ```js
   setMode("sheet");
   loadAll();
   ```
   to:
   ```js
   setMode("quick");
   loadAll();
   ```
   This still loads the sheet quietly in the background (so if you personally switch to Sheet mode, it's ready), but visitors land on Quick Fill by default.
3. Fill in Semester, Subject, Teacher, Coordinator, Class, Week, Week start date, Days, Topic, Objectives, Activities, Resources, Assessments.
4. Click **Preview**, then **Download PDF** or **Download PNG**.

No login, no sheet permissions, and no risk of someone else overwriting your `Lessons` data — Quick Fill mode simply never calls the save endpoint.

## Notes on Resources/Assessments in Quick Fill

Since there's no lookup tab to select from in Quick Fill, these become plain textareas — one resource or assessment per line, same convention as Objectives/Activities. If the sheet did load successfully even while in Quick Fill, you could optionally re-enable the checkbox pickers instead of the textareas by adjusting the visibility rule in `setMode()` inside `app.js` — currently it defaults to always showing textareas in Quick Fill for simplicity and to guarantee the mode never depends on the sheet.

## Everything else

Preview rendering, the fixed-size fixed-height table cells, the separate `logo.png` layer, and PDF/PNG export via `html2canvas`/`jsPDF` are unchanged and shared by both modes.
