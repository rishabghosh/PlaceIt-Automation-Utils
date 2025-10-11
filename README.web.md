# Placeit Bulk Mockup Generator - Web Application

A standalone web application for generating multiple Placeit mockup URLs with your design automatically injected. This is the web version of the Chrome extension, designed to be deployed on GitLab Pages or any static hosting service.

## Features

- 🌐 Standalone web application (no browser extension required)
- 📊 CSV data input with file upload support
- 🗺️ JSON-based tag to URL mapping
- 🔗 Automatic URL generation with design injection
- 📥 Download generated URLs as a text file
- 🚀 Bulk open URLs in new tabs
- 💅 Modern, responsive UI
- 🔄 Real-time statistics and progress tracking

## Live Demo

Once deployed to GitLab Pages, your application will be available at:
```
https://[your-username].gitlab.io/[repository-name]/
```

## Local Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rishabghosh/PlaceIt-Automation-Utils.git
   cd PlaceIt-Automation-Utils
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev:web
   ```
   The application will open at `http://localhost:3000`

### Build for Production

```bash
npm run build:web
```

This creates an optimized build in the `public/` directory.

### Preview Production Build

```bash
npm run preview:web
```

## Deployment to GitLab Pages

### Automatic Deployment (Recommended)

The repository includes a `.gitlab-ci.yml` file that automatically deploys to GitLab Pages when you push to the `main` branch.

1. **Push your code to GitLab**
   ```bash
   git remote add gitlab git@gitlab.com:[your-username]/[repository-name].git
   git push gitlab main
   ```

2. **Enable GitLab Pages**
   - Go to your GitLab project
   - Navigate to Settings > Pages
   - Your site will be automatically deployed after the CI/CD pipeline completes

3. **Access your site**
   - URL: `https://[your-username].gitlab.io/[repository-name]/`
   - Check Settings > Pages for the exact URL

### Manual Deployment

If you prefer manual deployment:

1. **Build the application**
   ```bash
   npm run build:web
   ```

2. **Upload the `public/` folder** to your GitLab repository

3. **Configure GitLab Pages** in your project settings

## Usage Guide

### 1. Prepare Your CSV Data

Create a CSV file with the following structure:

```csv
productCode,uploaded_mockup,Tags
P001,https://placeit.net/c/mockups/stages/crewneck-t-shirt-mockup-12345/editor?customG_0=abc123,front,black
P002,https://placeit.net/c/mockups/stages/hoodie-mockup-67890/editor?customG_0=xyz789,back,white
```

**Required Columns:**
- `productCode` - Unique identifier for your product
- `uploaded_mockup` - Placeit editor URL with your design (must include `customG_0` parameter)
- `Tags` - Comma-separated tags (can span multiple columns)

### 2. Create Tag Mapping JSON

Map each tag to a Placeit mockup template URL:

```json
{
  "front": "https://placeit.net/c/mockups/stages/front-view-tshirt-11111/editor",
  "back": "https://placeit.net/c/mockups/stages/back-view-tshirt-22222/editor",
  "black": "https://placeit.net/c/mockups/stages/black-shirt-33333/editor",
  "white": "https://placeit.net/c/mockups/stages/white-shirt-44444/editor"
}
```

Or use the extended format with crop configurations:

```json
{
  "front": {
    "mockupUrl": "https://placeit.net/c/mockups/stages/front-view-tshirt-11111/editor",
    "downloadedName": "original-placeit-filename",
    "crop": {
      "height": 1440,
      "width": 1440,
      "x": 0,
      "y": 190
    },
    "renameTo": "front-view"
  }
}
```

### 3. Generate URLs

1. **Paste or upload your CSV data** in the first section
2. **Paste or upload your tag mapping JSON** in the second section
3. Click **Generate URLs** button
4. View the generated URLs with statistics

### 4. Use Generated URLs

**Copy individual URLs:**
- Click the "Copy" button next to any URL

**Open individual URLs:**
- Click the "Open" button to open in a new tab

**Download all URLs:**
- Click "Download URLs as Text" to save a text file with all URLs

**Open all URLs:**
- Click "Open All URLs" to open all URLs in new tabs
- URLs are opened in batches of 10 to prevent browser blocking

## How It Works

1. **Parse CSV Data**: Extracts product information and tags from CSV
2. **Extract Design ID**: Gets the `customG_0` parameter from your uploaded mockup URL
3. **Process Tags**: For each tag in each row:
   - Finds the matching template URL from the mapping
   - Appends your design ID (`customG_0`) to the template URL
   - Creates the final mockup URL
4. **Display Results**: Shows all generated URLs with copy/open options

## Differences from Chrome Extension

| Feature | Chrome Extension | Web Application |
|---------|-----------------|-----------------|
| URL Generation | ✅ Yes | ✅ Yes |
| Automatic Downloads | ✅ Yes | ❌ No (manual) |
| Tab Control | ✅ Automatic | ⚠️ Manual/Batch |
| Installation | Chrome only | Any browser |
| Deployment | Local extension | Static hosting |
| Updates | Manual reload | Auto-updated |

The web application generates the URLs but cannot automatically trigger downloads like the Chrome extension. Users need to manually visit URLs or use the "Open All" feature.

## Project Structure

```
.
├── index.html              # Main HTML file
├── web-app.js             # Web application JavaScript
├── vite.config.web.js     # Vite configuration for web build
├── .gitlab-ci.yml         # GitLab CI/CD configuration
├── public/                # Build output directory
├── src/                   # Chrome extension source (separate)
│   ├── mapping_sample.json
│   └── samples/
└── README.web.md         # This file
```

## Configuration

### GitLab CI/CD Pipeline

The `.gitlab-ci.yml` file defines two stages:

1. **Build**: Installs dependencies and builds the application
2. **Deploy**: Deploys to GitLab Pages

### Base URL Configuration

The application uses relative paths (`base: './'`) in `vite.config.web.js` to work correctly when deployed to subdirectories on GitLab Pages.

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with ES6+ support.

## Limitations

1. **No Automatic Downloads**: Unlike the Chrome extension, the web app cannot automatically trigger Placeit downloads
2. **Pop-up Blockers**: Opening many URLs at once may be blocked by browser pop-up blockers
3. **No Tab Management**: Cannot automatically close tabs after downloads complete
4. **CORS Restrictions**: Cannot directly access Placeit's API due to CORS policies

## Workarounds

**For Bulk Downloads:**
- Use the "Open All URLs" feature with a download manager extension
- Download the URL list and use a script/tool to process them
- Use the Chrome extension version for full automation

**For Large Batches:**
- URLs are opened in batches of 10 with 2-second delays
- Adjust batch size in `web-app.js` if needed

## Troubleshooting

**URLs not generating:**
- Verify your CSV has the correct column headers
- Ensure the `uploaded_mockup` contains a valid `customG_0` parameter
- Check that your mapping JSON is valid

**Pop-ups blocked:**
- Allow pop-ups for your domain in browser settings
- Use "Download URLs as Text" instead and process manually

**GitLab Pages not updating:**
- Check the CI/CD pipeline status in GitLab
- Verify the pipeline completed successfully
- Clear browser cache and hard reload

**Sample mapping not loading:**
- Ensure `src/mapping_sample.json` exists in your repository
- Check the file path in `web-app.js`

## Advanced Usage

### Custom Batch Size

Edit `web-app.js` line ~230 to change batch size:

```javascript
const maxBatchSize = 10; // Change this number
```

### Custom Delays

Edit `web-app.js` line ~244 to change delay between batches:

```javascript
setTimeout(() => openBatch(endIndex), 2000); // Change delay in ms
```

### Styling Customization

All styles are in `index.html` within the `<style>` tag. Customize colors, fonts, and layout as needed.

## Contributing

Issues and pull requests are welcome at the [GitHub repository](https://github.com/rishabghosh/PlaceIt-Automation-Utils).

## License

ISC

## Related

- **Chrome Extension Version**: See [README.md](./README.md) for the full-featured Chrome extension
- **Image Cropping Tool**: See [crop-and-rename.js](./crop-and-rename.js) for post-processing downloaded images

## Support

For issues specific to:
- **Web Application**: Open an issue on GitHub/GitLab
- **Chrome Extension**: See the main README.md
- **Placeit Platform**: Contact Placeit support