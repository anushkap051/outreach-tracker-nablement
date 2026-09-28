# Beacon Outreach Tracker

A small web app for tracking Beacon's small-business outreach. It replaces the
`Beacon_Outreach_Tracker.xlsx` spreadsheet.

- **Today**: follow-ups due today or overdue, upcoming meetings, businesses
  planned for today, and the top not-yet-contacted leads by priority.
- **Pipeline**: every business, with search, filters, sortable columns and a
  status dropdown on each row. Row colors match the spreadsheet: blue for
  meeting scheduled, light green for meeting completed, dark green for deal
  won, grey for not interested or not a fit. A red "Due" tag marks follow-ups
  that are due.
- **Business editor** (click any business): every spreadsheet column, plus
  one-click buttons for common updates ("Left message", "Meeting scheduled",
  "Follow up in 2 days", …). Choosing a status also fills in the matching
  fields: Visited/Called, First Contact Date, Meeting Scheduled and so on.
- **Dashboard**: pipeline by region and ICP, contact and meeting rates, the
  ICP leads → opportunities → wins table, results by sector, and objections.
- **Data menu**: export CSV (for Google Sheets or Excel), download a backup,
  restore a backup.

## Where data is stored

| How the app is opened | Storage |
|---|---|
| Hosted, with `firebase-config.js` filled in | Firebase Firestore, behind Google sign-in. Same data on every device. |
| Published as a claude.ai artifact | The artifact's online database. |
| Opened as a plain file, no config | That browser only. |

The business list itself is never stored in this repository.

## Hosting it with Google sign-in (Firebase + GitHub Pages)

1. **Create a Firebase project.** Go to https://console.firebase.google.com,
   click **Create a project**, name it (for example `beacon-outreach`). Google
   Analytics isn't needed.
2. **Turn on Google sign-in.** In the left menu: **Build → Authentication →
   Get started → Sign-in method → Google → Enable**, choose your support
   email, **Save**.
3. **Create the database.** **Build → Firestore Database → Create database**.
   Pick a location near you (for example `nam5 (United States)`) and start in
   **production mode**.
4. **Lock it to your account.** In Firestore, open the **Rules** tab, replace
   everything with the contents of [`firestore.rules`](firestore.rules), put
   your Google email address where it says `you@example.com`, and click
   **Publish**. To give a teammate access later, add their address to the
   list, e.g. `['you@gmail.com', 'teammate@gmail.com']`.
5. **Register the web app.** **Project settings** (gear icon) → **Your apps**
   → the **`</>`** (Web) button → give it a nickname → **Register app**. Copy
   the `firebaseConfig = { ... }` values into `firebase-config.js`, replacing
   `null`.
6. **Publish the site.** On GitHub: repo **Settings → Pages → Build and
   deployment → Deploy from a branch**, pick the branch and `/ (root)`,
   **Save**. After a minute the app is at
   `https://<your-github-username>.github.io/outreach-tracker-nablement/`.
7. **Allow that address to sign in.** Firebase **Authentication → Settings →
   Authorized domains → Add domain** → `<your-github-username>.github.io`.
8. **Bring your data in.** Open the site, sign in, then **Data → Restore
   backup** and choose a backup `.json` file.

The values in `firebase-config.js` identify the project and are safe to
publish; the Firestore rules are what keep the data private.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `firebase-config.js`: Firebase project settings (empty until you set it up)
- `firestore.rules`: database access rules to paste into Firebase
