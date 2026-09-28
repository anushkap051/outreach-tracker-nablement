# Beacon Outreach Tracker

A small web app for tracking Beacon's small-business outreach. It replaces the
`Beacon_Outreach_Tracker.xlsx` spreadsheet and comes preloaded with its 40
Atlanta and Pittsburgh leads.

## Running it

No install or build step. Open `index.html` in a browser (double-click it), or
host the folder anywhere that serves static files (for example GitHub Pages).

Opened as a file, your changes are saved in that browser only. Use **Data →
Download backup** now and then, and **Restore backup** to move your data to
another computer or browser.

When the app is published as a claude.ai artifact, it saves to the artifact's
online database instead (one record per business under `businesses/`, and the
weekly plan under `meta/plan`), so every device shows the same data.

## What's in it

- **Today**: follow-ups due today or overdue, upcoming meetings, businesses
  planned for today, and the top not-yet-contacted leads by priority.
- **Pipeline**: every business, with search, filters (region, ICP, sector,
  status, priority, day), sortable columns and a status dropdown on each row.
  Rows are colored the same way as the spreadsheet: blue for meeting
  scheduled, light green for meeting completed, dark green for deal won, grey
  for not interested or not a fit. A red "Due" tag marks follow-ups that are due.
- **Business editor** (click any business): every spreadsheet column, plus
  one-click buttons for common updates ("Left message", "Meeting scheduled",
  "Follow up in 2 days", …). Choosing a status also fills in the matching
  fields: Visited/Called, First Contact Date, Meeting Scheduled and so on.
- **Dashboard**: pipeline by region and ICP, contact and meeting rates, the
  ICP leads → opportunities → wins table, results by sector, and objections.
- **Weekly Plan**: the day-by-day plan with editable targets and notes, and a
  "Done" count that updates from the pipeline.
- **Export CSV** to open the data in Google Sheets or Excel.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `data/seed.js`: the starting data imported from the spreadsheet
