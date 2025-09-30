# Placeit Bulk Mockup Downloader

Chrome extension for automating bulk downloads of Placeit mockups by reading CSV data, mapping tags to template links, injecting your uploaded design, and triggering downloads.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Data Format](#data-format)
- [How It Works](#how-it-works)
- [Development](#development)
- [Notes](#notes)

## Features

- 🚀 Bulk download Placeit mockups from CSV data
- 🎯 Tag-based URL mapping system
- ⚙️ Configurable timing and retry settings via `.env`
- 📊 Real-time progress logging in popup UI
- 🔄 Automatic design injection using `customG_0` parameter

## Project Structure

```
.
├── src/
│   ├── background.js      # Service worker (orchestration)
│   ├── content.js         # Content script (download button automation)
│   ├── popup.js           # Popup UI logic
│   ├── popup.html         # Extension popup interface
│   ├── utils.js           # URL manipulation utilities
│   ├── config.js          # Centralized configuration loader
│   └── mapping_sample.json # Example tag-to-URL mapping
├── public/
│   └── icons/             # Extension icons
├── manifest.json          # Chrome extension manifest (MV3)
├── .env                   # Environment configuration
├── vite.config.js         # Vite build configuration
└── README.md
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- Chrome browser
- Active Placeit account

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/rishabghosh/PlaceIt-Automation-Utils.git
   cd PlaceIt-Automation-Utils
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the `.env` file and configure as needed:
   ```bash
   # .env is already provided with default values
   # Modify values if you need different timing configurations
   ```

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist/` folder
   - Pin the extension to your toolbar

## Configuration

### Environment Variables

Create or modify the `.env` file in the project root:

```env
# Mapping file path
VITE_MAPPING_FILE_PATH=src/mapping_sample.json

# Background script timing (all values in milliseconds)
VITE_OPEN_INTERVAL_MS=5000           # Delay between opening tabs
VITE_WAIT_BEFORE_CLICK_MS=10000      # Wait time before clicking download
VITE_RETRY_ATTEMPTS=2                # Number of retry attempts
VITE_TIMEOUT_MS=30000                # Tab load timeout
VITE_POST_CLICK_WAIT_MS=4000         # Wait after clicking download
VITE_SKIP_IF_NO_BUTTON=true          # Skip if download button not found

# Tab checking interval
VITE_TAB_CHECK_INTERVAL_MS=500       # Interval for checking tab status

# Content script timing
VITE_BUTTON_WAIT_TIMEOUT_MS=15000    # Timeout for finding download button
VITE_MODAL_WAIT_MS=1200              # Wait for modal to appear
```

**After modifying `.env`:** Run `npm run build` to rebuild the extension with new values.

## Usage

### 1. Prepare Your Data

**CSV Format:**
```csv
productCode,uploaded_mockup,Tags
P001,https://placeit.net/c/mockups/stages/crewneck-t-shirt-mockup-12345/editor?customG_0=abc123,front,black
P002,https://placeit.net/c/mockups/stages/hoodie-mockup-67890/editor?customG_0=xyz789,back,white
```

**Required Columns:**
- `productCode` - Unique identifier for your product (optional, useful for logging)
- `uploaded_mockup` - Placeit editor URL containing your uploaded design (includes `customG_0=yourDesignId`)
- `Tags` - Comma-separated tags matching keys in your mapping JSON

### 2. Create Mapping JSON

Map each tag to a base Placeit mockup URL (without `customG_0`):

```json
{
  "front": "https://placeit.net/c/mockups/stages/front-view-tshirt-11111/editor",
  "back": "https://placeit.net/c/mockups/stages/back-view-tshirt-22222/editor",
  "black": "https://placeit.net/c/mockups/stages/black-shirt-33333/editor",
  "white": "https://placeit.net/c/mockups/stages/white-shirt-44444/editor"
}
```

### 3. Run the Extension

1. **Log in to Placeit** in your Chrome browser
2. **Open the extension popup** from the toolbar
3. **Paste your CSV data** into the JSON Rows input
4. **Paste your mapping JSON** into the Mapping input
5. **Click Preview** to verify URLs (optional)
6. **Click Start** to begin bulk downloads
7. Monitor progress in the log window

## Data Format

### CSV Structure

| Column | Description | Required | Example |
|--------|-------------|----------|---------|
| `productCode` | Product identifier | No | `P001` |
| `uploaded_mockup` | Placeit editor URL with design | Yes | `https://placeit.net/...?customG_0=abc123` |
| `Tags` | Comma-separated tag list | Yes | `front,black` |

### Mapping JSON Structure

```json
{
  "tag_name": "base_placeit_mockup_url_without_customG_0"
}
```

## How It Works

1. **Read CSV Data**: Extension parses each row from the CSV
2. **Extract Design ID**: Extracts `customG_0` parameter from `uploaded_mockup` URL
3. **Process Tags**: For each tag in the `Tags` column:
   - Finds matching mockup template URL from mapping JSON
   - Appends `customG_0` parameter with your design ID
   - Opens the complete URL in a background tab
4. **Trigger Download**: Waits for page load, clicks download button, waits for download to start
5. **Log Progress**: Updates popup UI with status of each download

## Development

### Build Commands

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Project Tech Stack

- **Build Tool**: Vite
- **Plugin**: @crxjs/vite-plugin (Chrome extension support)
- **Language**: JavaScript (ES Modules)
- **Manifest**: Chrome Extension Manifest V3

### Configuration Files

- `.env` - Environment variables (timing, paths)
- `vite.config.js` - Vite build configuration
- `manifest.json` - Chrome extension manifest
- `src/config.js` - Centralized config loader

## Notes

⚠️ **Important Considerations:**

- **Authentication**: You must be logged into Placeit before starting the automation
- **UI Changes**: This extension simulates user behavior and may need updates if Placeit changes their UI
- **Terms of Service**: Respect Placeit's Terms of Service - don't abuse automation
- **Rate Limiting**: Configure appropriate delays in `.env` to avoid overwhelming Placeit's servers
- **Browser Profile**: Use the same Chrome profile where you're logged into Placeit

### Troubleshooting

**Downloads not starting:**
- Verify you're logged into Placeit
- Check that `VITE_WAIT_BEFORE_CLICK_MS` is long enough for page load
- Increase `VITE_BUTTON_WAIT_TIMEOUT_MS` if pages load slowly

**Button not found errors:**
- Placeit may have changed their UI
- Update selectors in `src/content.js` if needed
- Enable `VITE_SKIP_IF_NO_BUTTON=true` to skip problematic URLs

**Tabs opening too quickly:**
- Increase `VITE_OPEN_INTERVAL_MS` to add more delay between tabs
- Reduce concurrent operations to avoid overwhelming the browser

### License

ISC

### Contributing

Issues and pull requests are welcome at [GitHub repository](https://github.com/rishabghosh/PlaceIt-Automation-Utils).