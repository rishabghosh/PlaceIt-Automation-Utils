// Web Application JavaScript for Placeit Bulk Mockup Generator

let generatedUrls = [];

// Utility Functions
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    // Handle Tags field - collect remaining values as tags
    if (values.length > headers.length) {
      const tagStartIndex = headers.indexOf('Tags');
      if (tagStartIndex !== -1) {
        const allTags = values.slice(tagStartIndex).map(t => t.trim()).filter(Boolean);
        row.Tags = allTags;
      }
    } else if (row.Tags) {
      // If tags are in a single cell, split by comma
      row.Tags = row.Tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    rows.push(row);
  }

  return rows;
};

const extractCustomId = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('customG_0');
  } catch (e) {
    return null;
  }
};

const buildFinalUrl = (baseUrl, customId) => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.delete('customG_0');
    url.searchParams.set('customG_0', encodeURIComponent(customId));
    return url.toString();
  } catch (e) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}customG_0=${encodeURIComponent(customId)}`;
  }
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
};

const showAlert = (message, type = 'success') => {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} show`;
  alert.textContent = message;
  container.appendChild(alert);

  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 300);
  }, 5000);
};

// File Upload Handlers
const setupFileUpload = (inputId, textareaId, parser) => {
  const fileInput = document.getElementById(inputId);
  const textarea = document.getElementById(textareaId);

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (parser) {
        const parsed = parser(text);
        textarea.value = JSON.stringify(parsed, null, 2);
      } else {
        textarea.value = text;
      }
      showAlert(`File "${file.name}" loaded successfully`, 'success');
    } catch (error) {
      showAlert(`Error loading file: ${error.message}`, 'error');
    }

    fileInput.value = '';
  });
};

// URL Generation
const generateUrls = () => {
  try {
    const csvInput = document.getElementById('csvInput').value.trim();
    const mappingInput = document.getElementById('mappingInput').value.trim();

    if (!csvInput) {
      showAlert('Please enter CSV data', 'error');
      return;
    }

    if (!mappingInput) {
      showAlert('Please enter tag mapping JSON', 'error');
      return;
    }

    // Parse inputs
    const rows = parseCSV(csvInput);
    const mapping = JSON.parse(mappingInput);

    // Generate URLs
    generatedUrls = [];
    let urlCount = 0;

    rows.forEach((row, rowIndex) => {
      const customId = extractCustomId(row.uploaded_mockup);

      if (!customId) {
        console.warn(`Row ${rowIndex + 1}: No customG_0 found in uploaded_mockup`);
        return;
      }

      const tags = normalizeTags(row.Tags);

      tags.forEach(tag => {
        const mappingEntry = mapping[tag];
        if (!mappingEntry) {
          console.warn(`Row ${rowIndex + 1}: No mapping found for tag "${tag}"`);
          return;
        }

        const baseUrl = typeof mappingEntry === 'string'
          ? mappingEntry
          : mappingEntry.mockupUrl;

        if (!baseUrl) {
          console.warn(`Row ${rowIndex + 1}: No mockupUrl found for tag "${tag}"`);
          return;
        }

        const finalUrl = buildFinalUrl(baseUrl, customId);

        generatedUrls.push({
          productCode: row.productCode || `Row ${rowIndex + 1}`,
          tag,
          url: finalUrl,
          rowIndex
        });

        urlCount++;
      });
    });

    if (urlCount === 0) {
      showAlert('No URLs were generated. Check your data and mapping.', 'error');
      return;
    }

    renderUrls();
    showAlert(`Successfully generated ${urlCount} URLs from ${rows.length} rows`, 'success');

    // Show action buttons
    document.getElementById('downloadUrlsBtn').style.display = 'flex';
    document.getElementById('openAllBtn').style.display = 'flex';

  } catch (error) {
    showAlert(`Error generating URLs: ${error.message}`, 'error');
    console.error(error);
  }
};

// Render URLs
const renderUrls = () => {
  const output = document.getElementById('output');

  if (generatedUrls.length === 0) {
    output.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No URLs generated yet. Fill in the fields above and click Generate.</p>
      </div>
    `;
    return;
  }

  // Create stats
  const uniqueProducts = new Set(generatedUrls.map(u => u.productCode)).size;
  const uniqueTags = new Set(generatedUrls.map(u => u.tag)).size;

  let html = `
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${generatedUrls.length}</div>
        <div class="stat-label">Total URLs</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${uniqueProducts}</div>
        <div class="stat-label">Products</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${uniqueTags}</div>
        <div class="stat-label">Unique Tags</div>
      </div>
    </div>
    <ul class="url-list">
  `;

  generatedUrls.forEach((item, index) => {
    html += `
      <li class="url-item">
        <div class="url-item-info">
          <div class="url-item-tag">${item.productCode} - ${item.tag}</div>
          <div class="url-item-url">${item.url}</div>
        </div>
        <div class="url-item-actions">
          <button class="btn-secondary copy-btn" onclick="copyUrl(${index})">
            📋 Copy
          </button>
          <button class="btn-primary open-btn" onclick="openUrl(${index})">
            🔗 Open
          </button>
        </div>
      </li>
    `;
  });

  html += '</ul>';
  output.innerHTML = html;
};

// URL Actions
window.copyUrl = (index) => {
  const url = generatedUrls[index].url;
  navigator.clipboard.writeText(url).then(() => {
    showAlert('URL copied to clipboard', 'success');
  }).catch(err => {
    showAlert('Failed to copy URL', 'error');
  });
};

window.openUrl = (index) => {
  const url = generatedUrls[index].url;
  window.open(url, '_blank');
};

const downloadUrls = () => {
  if (generatedUrls.length === 0) {
    showAlert('No URLs to download', 'error');
    return;
  }

  let content = '# Placeit Mockup URLs\n';
  content += `# Generated: ${new Date().toLocaleString()}\n`;
  content += `# Total URLs: ${generatedUrls.length}\n\n`;

  generatedUrls.forEach(item => {
    content += `# ${item.productCode} - ${item.tag}\n`;
    content += `${item.url}\n\n`;
  });

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `placeit-urls-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showAlert('URLs downloaded successfully', 'success');
};

const openAllUrls = () => {
  if (generatedUrls.length === 0) {
    showAlert('No URLs to open', 'error');
    return;
  }

  const confirmMsg = `This will open ${generatedUrls.length} new tabs. Continue?`;
  if (!confirm(confirmMsg)) {
    return;
  }

  let openedCount = 0;
  const maxBatchSize = 10;

  const openBatch = (startIndex) => {
    const endIndex = Math.min(startIndex + maxBatchSize, generatedUrls.length);

    for (let i = startIndex; i < endIndex; i++) {
      window.open(generatedUrls[i].url, '_blank');
      openedCount++;
    }

    if (endIndex < generatedUrls.length) {
      showAlert(`Opened ${openedCount}/${generatedUrls.length} URLs. Opening more in 2 seconds...`, 'success');
      setTimeout(() => openBatch(endIndex), 2000);
    } else {
      showAlert(`All ${openedCount} URLs opened successfully`, 'success');
    }
  };

  openBatch(0);
};

const clearAll = () => {
  if (confirm('Clear all data? This cannot be undone.')) {
    document.getElementById('csvInput').value = '';
    document.getElementById('mappingInput').value = '';
    generatedUrls = [];
    renderUrls();
    document.getElementById('downloadUrlsBtn').style.display = 'none';
    document.getElementById('openAllBtn').style.display = 'none';
    showAlert('All data cleared', 'success');
  }
};

const loadSampleMapping = async () => {
  try {
    const response = await fetch('/src/mapping_sample.json');
    if (!response.ok) {
      throw new Error('Sample mapping file not found');
    }
    const data = await response.json();
    document.getElementById('mappingInput').value = JSON.stringify(data, null, 2);
    showAlert('Sample mapping loaded', 'success');
  } catch (error) {
    showAlert(`Could not load sample mapping: ${error.message}`, 'error');
  }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // File uploads
  setupFileUpload('csvFile', 'csvInput', null);
  setupFileUpload('mappingFile', 'mappingInput', (text) => JSON.parse(text));

  // Buttons
  document.getElementById('generateBtn').addEventListener('click', generateUrls);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('downloadUrlsBtn').addEventListener('click', downloadUrls);
  document.getElementById('openAllBtn').addEventListener('click', openAllUrls);
  document.getElementById('loadSampleMapping').addEventListener('click', loadSampleMapping);

  // Try to load sample mapping on startup
  loadSampleMapping();
});