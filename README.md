# Spendly: personal money tracker

**Live app:** https://munayemshipu1.github.io/spendly/

An installable web app (PWA). It runs full-screen from your iPhone home screen, works offline,
and keeps all data on the device. No accounts, no server, no build step.

## Features

- **Quick entry:** amount, category and Save. You can switch between expense and income inside the panel,
  add an optional note, pick a date, and Undo after saving, editing or deleting.
- **Home:** overview for the selected period, an income vs expenses bar chart (tap a bar for details),
  a spending/income donut chart by category, and the
  entries for the selected day. The bottom bar (Income · Today/Home · Expenses) is on every screen.
- **Periods:** Week, Month, Year, All time or a custom date range (with shortcuts like "Last 30 days").
  These are available on the home screen, Statistics and category pages.
- **Statistics:** comparison with the previous period, a 6-period trend chart, and a list of every week, month or year.
- **Recurring payments:** rent, insurance, bills, subscriptions or salary are added automatically on their day
  each month. Missed months are filled in the next time the app opens, and you can pause, resume or edit each one.
  Set one up from Menu → Recurring payments, or turn on "Repeat every month" when adding an entry.
- **Categories:** your own names, icons or emoji, and colours. Drag to reorder.
- **Search** all transactions; **export** to CSV; **back up / restore** to a JSON file.
- £ by default, with other currency symbols available, plus light, dark or system theme.

## Run it locally

```bash
node tools/serve.js
```

Open http://localhost:5173. The script also prints a LAN address so you can try it on your phone over the same Wi-Fi.

## Put it on your iPhone

The offline mode needs **HTTPS**, so host the folder on any free static host:

- **GitHub Pages:** push this folder to a repo, then Settings → Pages → deploy from `main`.
- **Netlify Drop:** drag this folder onto https://app.netlify.com/drop.

Then, on the iPhone: open the URL in **Safari** → Share → **Add to Home Screen**.

> **Your data belongs to the URL.** Entries saved at one address (e.g. your LAN IP) don't appear at another
> (e.g. GitHub Pages). To move them, use Settings → **Back up data** and then **Restore from backup** at the new address.
> iOS keeps home-screen app data indefinitely, but take a backup now and then.

## Updating

After changing any file, bump `VERSION` in `sw.js` so installed copies download the new version.

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | Shell and styles (light and dark themes) |
| `js/app.js` | Screens, panels, dialogs, charts, recurring payments |
| `js/store.js` | Saving to localStorage, default categories, sample data, backup checks |
| `js/util.js` | Date, period and amount helpers |
| `js/icons.js` | Material Design icons (Apache 2.0) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and install metadata |
| `tools/` | Local server and app icon generator (`node tools/make-icons.js`) |
