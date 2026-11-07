# Indeed Applied Jobs Exporter 💼

> **Export all your Indeed applied jobs directly into a clean Excel-ready CSV in seconds.**
> Works directly inside your browser via Bookmarklet or DevTools Console. No extensions, no credentials, 100% private.

---

## ✨ Features

- 🛑 **Instant Stop Button**: Pause or stop scraping at any moment without losing collected data.
- 📥 **Mid-Scrape CSV Downloads**: Hit **"Download Excel (CSV)"** at any point during scraping to export everything collected so far.
- ⚡ **Auto-Scroll & Pagination**: Automatically handles dynamic infinite-scroll feeds, "Load More" buttons, and multi-page pagination.
- 📊 **Real-Time Floating Control Panel**: Clean dark-mode floating widget showing live job count and real-time previews.
- 🎯 **Clean 4-Column Dataset**: Formats directly into:
  - `Job Title`
  - `Company`
  - `Location`
  - `Date Applied` (or current application status)
- 🔒 **100% Client-Side & Private**: Runs entirely in your local browser sandbox. Zero external requests, zero analytics, no data tracking.

---

## 🚀 Quick Start

### Method 1: Browser Console (Fastest)

1. Navigate to your Indeed applied jobs page:
   - Global / US: **[https://myjobs.indeed.com/applied](https://myjobs.indeed.com/applied)**
   - India: **[https://in.indeed.com/myjobs/applied](https://in.indeed.com/myjobs/applied)**
2. Press `F12` (or Right-Click anywhere $\to$ **Inspect**) and open the **Console** tab.
3. Copy the full script from [`indeed-jobs-exporter.js`](./indeed-jobs-exporter.js), paste it into the console, and press `Enter`.
4. The floating control panel will appear in the bottom-right corner.
5. Click **🚀 Auto-Scrape All Pages** or **📥 Download Excel (CSV)**.

---

### Method 2: Browser Bookmarklet (One-Click)

1. Create a new bookmark in your browser (Ctrl+D / Cmd+D).
2. Name it: `💼 Indeed Exporter`.
3. Set the URL to the code inside [`bookmarklet.txt`](./bookmarklet.txt) (begins with `javascript:...`).
4. Whenever you're on `myjobs.indeed.com/applied`, simply click your bookmark!

---

## 📋 Supported URLs

- `https://myjobs.indeed.com/applied`
- `https://myjobs.indeed.com/` (*Saved*, *Applied*, *Interviews*, *Archived*)
- `https://in.indeed.com/myjobs/applied`
- `https://www.indeed.com/myjobs/applied`
- Also functions on Indeed search result feeds.

---

## 📁 Output Format

Exports as UTF-8 with BOM (`\uFEFF`) for instant compatibility with Microsoft Excel, Google Sheets, Notion, and Apple Numbers:

| Job Title | Company | Location | Date Applied |
| :--- | :--- | :--- | :--- |
| Hardware Engineer | Bosch Group | Bengaluru (Hybrid) | Applied 2d ago |
| PCB Design Engineer | Qualcomm | Hyderabad (On-site) | Applied 1w ago |
| Electronics Engineer | Texas Instruments | India (Remote) | Applied Oct 24 |

---

## 📄 License

[MIT](./LICENSE) © 2026
