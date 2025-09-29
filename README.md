Placeit Bulk Mockup Downloader (Chrome Extension)

This Chrome extension automates bulk downloading Placeit mockups by reading a CSV, mapping tags to template links, injecting your uploaded design, clicking the Download button, and closing the tab.

📂 Files in this repo

manifest.json — Extension manifest (MV3).

background.js — Background service worker (handles orchestration).

content.js — Content script (clicks the Download button).

popup.html — UI for uploading CSV + configs.

popup.js — Popup logic.

utils.js — Shared helpers.

mapping_sample.json — Example Tag → Placeit URL mapping.

README.md — Documentation.

icons/ — Placeholder extension icons.

🚀 Quick Start

Download/unzip the folder.

Open Chrome → Extensions → Manage Extensions.

Enable Developer mode (top right).

Click Load unpacked → select the unzipped folder.

Open the extension popup from the toolbar.

Paste your CSV text, mapping JSON, and config JSON, then click Start.

✅ Make sure you’re already logged in to your Placeit account in the same browser profile.

📊 Sample CSV format

Your CSV must have three columns:

productCode → Unique identifier for your product (optional but useful for logging).

uploaded_mockup → A Placeit editor URL containing your uploaded design (the URL includes customG_0=yourDesignId).

Tags → One or more tags (comma-separated) that match keys in your mapping JSON.

Example:
productCode,uploaded_mockup,Tags
P001,https://placeit.net/c/mockups/stages/crewneck-t-shirt-mockup-12345/editor?customG_0=abc123,front,black
P002,https://placeit.net/c/mockups/stages/hoodie-mockup-67890/editor?customG_0=xyz789,back,white

🗺️ Sample Mapping JSON

This maps each Tag to a base Placeit mockup URL (without customG_0).

{
"front": "https://placeit.net/c/mockups/stages/front-view-tshirt-11111/editor",
"back": "https://placeit.net/c/mockups/stages/back-view-tshirt-22222/editor",
"black": "https://placeit.net/c/mockups/stages/black-shirt-33333/editor",
"white": "https://placeit.net/c/mockups/stages/white-shirt-44444/editor"
}

⚙️ Sample Config JSON

This controls timings and retries.

{
"wait_before_click": 5000,
"post_click_wait": 8000,
"max_retries": 3,
"close_tab_on_success": true,
"max_concurrent_tabs": 2
}

🔄 How it works

Extension reads each CSV row.

Extracts customG_0 from uploaded_mockup.

For each Tag in Tags:

Finds matching mockup template URL from mapping JSON.

Appends customG_0 (your design ID).

Opens the new Placeit editor link in a background tab.

Waits → clicks Download → waits → closes tab.

Logs progress in popup UI.

⚠️ Notes

Be logged into Placeit before starting.

This extension simulates user behavior; it may need tuning (selectors, waits) if Placeit changes UI.

Respect Placeit’s Terms of Service. Don’t abuse automation.