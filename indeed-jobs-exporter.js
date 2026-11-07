/**
 * Indeed Applied Jobs Exporter (v3.0)
 * 
 * Works on:
 * - https://myjobs.indeed.com/applied (and /saved, /interviews, /archived)
 * - https://in.indeed.com/myjobs/applied
 * - https://www.indeed.com/myjobs/applied
 * 
 * Features:
 * - Red "🛑 Stop Scraping" button to pause/stop scraping at any time.
 * - Mid-scrape downloading: Click "Download Excel (CSV)" at ANY time.
 * - Handles both infinite-scroll / "Load More" feeds and multi-page pagination.
 * - Immediate on-screen capture on load (never 0 jobs).
 * - Clean 4 columns: Job Title, Company, Location, Date Applied / Status.
 */

(function runIndeedExporter() {
    const oldWidget = document.getElementById("indeed-job-exporter-widget");
    if (oldWidget) oldWidget.remove();

    const jobsMap = new Map();
    const cleanText = text => (text ? text.replace(/\s+/g, " ").trim() : "");
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    let isScraping = false;
    let stopRequested = false;

    // Detect job cards across different Indeed versions & layouts
    function getJobElements() {
        const selectors = [
            'div[data-testid*="job-card"]',
            'div[data-testid*="simpler-job-card"]',
            'div[data-testid*="applied-job-card"]',
            'div[data-testid*="card"]',
            'li[data-testid*="job"]',
            'div.job_seen_beacon',
            'div.cardOutline',
            'div.slider_item',
            'ul[class*="jobList"] > li',
            'div[class*="JobCard"]',
            'div[class*="job-card"]'
        ];

        let elements = Array.from(document.querySelectorAll(selectors.join(', ')));
        elements = elements.filter(el => el.innerText && el.innerText.trim().length > 15);

        // Fallback: Locate via job links or applied status text containers
        if (elements.length === 0) {
            const links = Array.from(document.querySelectorAll('a[href*="/viewjob"], a[data-jk], a[href*="/rc/clk"], a[href*="myjobs"]'));
            const seen = new Set();
            for (const link of links) {
                const container = link.closest('li, div[class*="card"], div[class*="Card"], [role="article"]') || link.parentElement?.parentElement;
                if (container && !seen.has(container) && container.innerText.trim().length > 15) {
                    seen.add(container);
                    elements.push(container);
                }
            }
        }

        // Ultra-fallback: scan all <li> or card-like divs in main content
        if (elements.length === 0) {
            const mainFeed = document.querySelector('main, #main, [role="main"], #mosaic-provider-jobcards');
            if (mainFeed) {
                const candidateCards = Array.from(mainFeed.querySelectorAll('li, div[class*="item"]'))
                    .filter(el => el.innerText && /applied|application|viewjob|interview/i.test(el.innerText));
                elements.push(...candidateCards);
            }
        }

        return elements;
    }

    function parseJobCard(card) {
        if (!card) return null;
        const rawText = cleanText(card.innerText);
        if (!rawText || rawText.length < 5) return null;

        let title = "";
        let company = "";
        let location = "";
        let dateApplied = "Applied";

        // A. Try DOM-specific elements first (Highest accuracy)
        const titleEl = card.querySelector('h2 a, h3 a, a[data-jk], a[href*="/viewjob"], h2, h3, [class*="jobTitle"], [data-testid*="job-title"]');
        if (titleEl) {
            title = cleanText(titleEl.innerText);
        }

        const compEl = card.querySelector('[data-testid="company-name"], [class*="companyName"], [class*="company_name"], [data-testid*="company"]');
        if (compEl) {
            company = cleanText(compEl.innerText);
        }

        const locEl = card.querySelector('[data-testid="text-location"], [class*="companyLocation"], [class*="jobLocation"], [data-testid*="location"]');
        if (locEl) {
            location = cleanText(locEl.innerText);
        }

        const statusEl = card.querySelector('[data-testid*="status"], [class*="status"], [class*="badge"], [data-testid*="applied"]');
        if (statusEl && /applied|submitted|viewed|interview/i.test(statusEl.innerText)) {
            dateApplied = cleanText(statusEl.innerText);
        }

        // B. Text-line Parsing Fallback (Resilient to hashed / obfuscated CSS classes)
        const rawLines = card.innerText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

        // Extract Date Applied / Status from text
        const appliedMatch = rawText.match(/(Applied(?:\s+on)?\s+[A-Za-z0-9,\s]+(?:\d{4})?|Applied\s+\d+\s*(?:m|h|d|w|mo|yr|mins?|hours?|days?|weeks?|months?|years?)\s+ago|Application (?:submitted|viewed)|Not selected by employer)/i);
        if (appliedMatch) {
            dateApplied = cleanText(appliedMatch[0]);
        }

        // If title wasn't found via DOM
        if (!title && rawLines.length > 0) {
            title = rawLines[0];
            if (/^(applied|save|saved|interviewing|new)/i.test(title) && rawLines.length > 1) {
                title = rawLines[1];
            }
        }

        // If company wasn't found via DOM
        if (!company && rawLines.length > 1) {
            for (let i = 1; i < Math.min(rawLines.length, 4); i++) {
                const line = rawLines[i];
                if (line !== title && !line.includes(title) && !/^(applied|save|remote|hybrid|full-time|part-time|\$|₹)/i.test(line)) {
                    company = line;
                    break;
                }
            }
        }

        // If location wasn't found via DOM
        if (!location) {
            for (const line of rawLines) {
                if (line !== title && line !== company) {
                    if (/(remote|hybrid|on-site|\b[A-Z][a-z]+,\s*[A-Z]{2}\b|bengaluru|bangalore|pune|mumbai|delhi|hyderabad|chennai|noida|gurgaon|gurugram|ahmedabad|india)/i.test(line)) {
                        location = line;
                        break;
                    }
                }
            }
        }

        // Clean company star ratings (e.g. "Bosch 4.1 ★" -> "Bosch")
        if (company) {
            company = company.replace(/\s+\d+(\.\d+)?\s*(★|stars?)?.*$/i, "").trim();
        }

        // Clean notification & badge clutter
        if (title) {
            title = title.replace(/^new\s+/i, "")
                         .replace(/^(hiring multiple candidates|urgently hiring)\s+/i, "")
                         .replace(/\s*–\s*job post$/i, "")
                         .trim();
        }

        // Final sanitation
        return {
            title: title || "Unknown Title",
            company: company || "-",
            location: location || "-",
            dateApplied: dateApplied || "Applied"
        };
    }

    function captureCurrentPage() {
        let addedCount = 0;
        const items = getJobElements();

        items.forEach(card => {
            const job = parseJobCard(card);
            if (job && job.title && job.title !== "Unknown Title") {
                const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}|${job.dateApplied.toLowerCase()}`;
                if (!jobsMap.has(key)) {
                    jobsMap.set(key, job);
                    addedCount++;
                }
            }
        });

        updateWidgetUI();
        return addedCount;
    }

    // Handles both traditional pagination and "Load More" / "Show more" buttons
    function findNextOrLoadMoreButton() {
        // 1. "Load More" / "Show More" buttons (common on myjobs)
        const loadMoreSelectors = [
            'button[data-testid*="load-more"]',
            'button[data-testid*="show-more"]',
            'button[class*="loadMore"]',
            'button[class*="showMore"]'
        ];
        for (const sel of loadMoreSelectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled && btn.offsetParent !== null) return { btn, type: 'loadMore' };
        }

        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const btn of buttons) {
            const txt = btn.innerText ? btn.innerText.trim().toLowerCase() : '';
            if ((txt.includes('show more') || txt.includes('load more') || txt.includes('view more')) && btn.offsetParent !== null) {
                return { btn, type: 'loadMore' };
            }
        }

        // 2. Pagination "Next" buttons
        const paginationSelectors = [
            'a[data-testid="pagination-page-next"]',
            'button[data-testid="pagination-page-next"]',
            'a[aria-label="Next Page"]',
            'button[aria-label="Next Page"]',
            'a[aria-label="Next"]',
            'button[aria-label="Next"]',
            'nav[aria-label="pagination"] a:last-child'
        ];
        for (const sel of paginationSelectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled && !btn.classList.contains("disabled") && btn.getAttribute("aria-disabled") !== "true") {
                return { btn, type: 'nextPage' };
            }
        }

        return null;
    }

    function downloadCSV() {
        if (jobsMap.size === 0) {
            captureCurrentPage();
        }

        const jobs = Array.from(jobsMap.values());
        if (jobs.length === 0) {
            alert("No jobs found on this page. Please make sure you are logged in at https://myjobs.indeed.com/applied");
            return;
        }

        const headers = ["Job Title", "Company", "Location", "Date Applied"];
        const rows = jobs.map(j => [
            `"${(j.title || '').replace(/"/g, '""')}"`,
            `"${(j.company || '').replace(/"/g, '""')}"`,
            `"${(j.location || '').replace(/"/g, '""')}"`,
            `"${(j.dateApplied || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `indeed_applied_jobs_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Floating UI Widget
    const panel = document.createElement("div");
    panel.id = "indeed-job-exporter-widget";
    panel.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        background: #14171A;
        color: #FFFFFF;
        padding: 18px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.55);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 320px;
        border: 1px solid #2F3336;
        line-height: 1.4;
    `;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:15px; color:#2164F4;">💼 Indeed Jobs Exporter</strong>
            <button id="ind-close-btn" style="background:transparent; border:none; color:#8B949E; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="background:#0D1117; padding:10px; border-radius:8px; margin-bottom:12px; font-size:13px;">
            <div>Total Jobs: <strong id="ind-job-count" style="color:#25A55F; font-size:16px;">0</strong></div>
            <div id="ind-last-preview" style="color:#8B949E; font-size:11px; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Scanning...</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <button id="ind-auto-btn" style="background:#25A55F; color:#FFF; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer; transition: background 0.2s;">
                🚀 Auto-Scrape All Pages
            </button>
            <button id="ind-capture-btn" style="background:#21262D; color:#C9D1D9; border:1px solid #30363D; padding:8px; border-radius:6px; cursor:pointer;">
                ➕ Capture Current Page
            </button>
            <button id="ind-download-btn" style="background:#2164F4; color:#FFF; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">
                📥 Download Excel (CSV)
            </button>
        </div>
        <div id="ind-status-log" style="color:#8B949E; font-size:11px; margin-top:10px; text-align:center;">Ready</div>
    `;

    document.body.appendChild(panel);

    function updateWidgetUI(msg = null) {
        const countEl = document.getElementById("ind-job-count");
        const previewEl = document.getElementById("ind-last-preview");
        const logEl = document.getElementById("ind-status-log");

        if (countEl) countEl.innerText = jobsMap.size;
        if (msg && logEl) logEl.innerText = msg;

        if (jobsMap.size > 0 && previewEl) {
            const lastJob = Array.from(jobsMap.values())[jobsMap.size - 1];
            previewEl.innerText = `${lastJob.title} @ ${lastJob.company}`;
            previewEl.style.color = "#C9D1D9";
        }
    }

    document.getElementById("ind-close-btn").onclick = () => panel.remove();
    document.getElementById("ind-capture-btn").onclick = () => {
        const count = captureCurrentPage();
        updateWidgetUI(`Captured ${count} new jobs`);
    };
    document.getElementById("ind-download-btn").onclick = () => downloadCSV();

    const autoBtn = document.getElementById("ind-auto-btn");
    autoBtn.onclick = async () => {
        if (isScraping) {
            stopRequested = true;
            autoBtn.innerText = "⏳ Stopping...";
            autoBtn.style.background = "#6E7681";
            return;
        }

        isScraping = true;
        stopRequested = false;
        autoBtn.innerText = "🛑 Stop Scraping";
        autoBtn.style.background = "#DA3633";

        let cycle = 1;
        let consecutiveNoNewJobs = 0;

        while (!stopRequested) {
            updateWidgetUI(`Scrolling & scanning batch ${cycle}...`);

            // Progressive scrolling to trigger lazy loading
            const scrollSteps = [0.3, 0.6, 0.85, 1.0];
            for (const step of scrollSteps) {
                if (stopRequested) break;
                window.scrollTo({ top: document.body.scrollHeight * step, behavior: "smooth" });
                await sleep(650);
            }
            if (stopRequested) break;

            const newFound = captureCurrentPage();

            if (newFound === 0) {
                consecutiveNoNewJobs++;
            } else {
                consecutiveNoNewJobs = 0;
            }

            // Check for Next Page / Load More button
            const nextAction = findNextOrLoadMoreButton();
            if (nextAction && !stopRequested) {
                consecutiveNoNewJobs = 0;
                updateWidgetUI(nextAction.type === 'loadMore' ? 'Loading more jobs...' : 'Navigating to next page...');
                nextAction.btn.scrollIntoView({ behavior: "smooth", block: "center" });
                await sleep(500);
                if (stopRequested) break;

                nextAction.btn.click();
                await sleep(3200);
            } else {
                if (consecutiveNoNewJobs >= 3) {
                    updateWidgetUI("Reached the end of your applications.");
                    break;
                }
                await sleep(1500);
            }

            cycle++;
        }

        if (stopRequested) {
            updateWidgetUI(`Stopped. ${jobsMap.size} jobs ready to export.`);
        } else {
            updateWidgetUI(`Complete! Total: ${jobsMap.size} jobs.`);
        }

        autoBtn.innerText = "🚀 Auto-Scrape All Pages";
        autoBtn.style.background = "#25A55F";
        isScraping = false;
        stopRequested = false;
    };

    // Auto-capture whatever is initially rendered
    window.scrollTo({ top: document.body.scrollHeight * 0.5, behavior: "smooth" });
    setTimeout(() => {
        captureCurrentPage();
        updateWidgetUI("Ready! Click 'Auto-Scrape All Pages'");
    }, 1000);
})();
