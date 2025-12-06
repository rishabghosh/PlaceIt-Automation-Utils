import { MAPPING_FILE_PATH } from './config.js';

const ELEMENTS = {
  log: 'log',
  jsonRowsInput: 'jsonRowsInput',
  mappingInput: 'mappingInput',
  startBtn: 'startBtn',
  stopBtn: 'stopBtn',
  previewBtn: 'previewBtn',
  downloadSampleBtn: 'downloadSampleBtn',
  clearLogBtn: 'clearLogBtn',
  progressSection: 'progressSection',
  progressBar: 'progressBar',
  progressText: 'progressText',
  queueBadge: 'queueBadge'
};

const createLogEntry = (message, statusClass = '') => {
  const entry = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();

  if (statusClass) {
    const badge = `<span class="status-badge ${statusClass}">${statusClass.replace('status-', '').toUpperCase()}</span>`;
    entry.innerHTML = `[${timestamp}] ${message} ${badge}`;
  } else {
    entry.textContent = `[${timestamp}] ${message}`;
  }

  return entry;
};

const log = (message, statusClass = '') => {
  const logContainer = document.getElementById(ELEMENTS.log);
  const entry = createLogEntry(message, statusClass);
  logContainer.prepend(entry);

  // Auto-scroll to top to show newest entry
  logContainer.scrollTop = 0;
};

const clearLog = () => {
  const logContainer = document.getElementById(ELEMENTS.log);
  logContainer.innerHTML = '';
  log('Log cleared');
};

const parseJSON = (jsonString) => {
  try {
    return { success: true, data: JSON.parse(jsonString) };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

const validateArray = (data) => {
  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array');
  }
  return data;
};

const getPastedRows = () => {
  const input = document.getElementById(ELEMENTS.jsonRowsInput).value.trim();
  if (!input) return [];

  const parseResult = parseJSON(input);
  if (!parseResult.success) {
    log(`Error parsing pasted JSON: ${parseResult.error}`, 'status-failed');
    return [];
  }

  try {
    return validateArray(parseResult.data);
  } catch (e) {
    log(e.message, 'status-failed');
    return [];
  }
};

const getMappingConfig = () => {
  const input = document.getElementById(ELEMENTS.mappingInput).value;
  return parseJSON(input);
};

const sendMessageToBackground = (action, payload = {}) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      resolve(response);
    });
  });
};

const normalizeTagsToArray = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }

  return [];
};

const extractCustomParam = (url) => {
  try {
    return new URL(url).searchParams.get('customG_0');
  } catch (e) {
    return null;
  }
};

const buildPreviewUrl = (baseUrl, customParam) => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.delete('customG_0');
    url.searchParams.set('customG_0', customParam);
    return url.toString();
  } catch (e) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}customG_0=${customParam}`;
  }
};

const generatePreviewUrls = (firstRow, mapping) => {
  const customParam = extractCustomParam(firstRow.uploaded_mockup);
  const tags = normalizeTagsToArray(firstRow.Tags);

  return tags.map(tag => {
    const mappingEntry = mapping[tag];
    const baseUrl = mappingEntry
      ? (typeof mappingEntry === 'string' ? mappingEntry : mappingEntry.mockupUrl)
      : '[MISSING]';
    return buildPreviewUrl(baseUrl, customParam);
  });
};

const handleStartClick = async () => {
  const rows = getPastedRows();
  if (!rows.length) {
    log('No rows loaded from pasted JSON', 'status-failed');
    return;
  }

  const mappingResult = getMappingConfig();
  if (!mappingResult.success) {
    log('Error parsing mapping: ' + mappingResult.error, 'status-failed');
    return;
  }

  const response = await sendMessageToBackground('startRun', {
    rows,
    mapping: mappingResult.data
  });

  if (response?.ok) {
    log('Run started - Processing ' + rows.length + ' rows', 'status-success');
  } else {
    log('Failed to start run: ' + (response?.error || 'Unknown error'), 'status-failed');
  }
};

const handleStopClick = async () => {
  await sendMessageToBackground('stopRun');
  log('Stop requested', 'status-skipped');
};

const handlePreviewClick = () => {
  const rows = getPastedRows();
  if (!rows.length) {
    log('No rows loaded', 'status-failed');
    return;
  }

  const mappingResult = getMappingConfig();
  if (!mappingResult.success) {
    log('Preview error: ' + mappingResult.error, 'status-failed');
    return;
  }

  try {
    const previewUrls = generatePreviewUrls(rows[0], mappingResult.data);
    log('Preview URLs for first row:', 'status-success');
    previewUrls.forEach((url, idx) => {
      log(`  ${idx + 1}. ${url}`);
    });
  } catch (e) {
    log('Preview error: ' + e.message, 'status-failed');
  }
};

const handleDownloadSampleClick = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('src/samples/rows_sample.json'));
    const sampleData = await response.json();

    const jsonString = JSON.stringify(sampleData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'rows_sample.json';
    a.click();

    URL.revokeObjectURL(url);
    log('Sample JSON downloaded', 'status-success');
  } catch (e) {
    log('Error downloading sample: ' + e.message, 'status-failed');
  }
};

const handleLogMessage = (message) => {
  log(message);
};

const handleStatusMessage = (msg) => {
  const rowNum = msg.rowIndex + 1 || '?';
  const tag = msg.tag || '';
  const extraInfo = msg.message ? ' - ' + msg.message : '';
  const statusText = `Row ${rowNum} | Tag: ${tag} | ${msg.status}${extraInfo}`;

  let statusClass = '';
  switch(msg.status.toLowerCase()) {
    case 'success':
      statusClass = 'status-success';
      break;
    case 'failed':
      statusClass = 'status-failed';
      break;
    case 'opening':
      statusClass = 'status-opening';
      break;
    case 'skipped':
      statusClass = 'status-skipped';
      break;
  }

  log(statusText, statusClass);
};

const handleProgressUpdate = (msg) => {
  const { processed, total } = msg;

  // Show progress section if hidden
  const progressSection = document.getElementById(ELEMENTS.progressSection);
  if (progressSection.style.display === 'none') {
    progressSection.style.display = 'block';
  }

  // Update progress text
  const progressText = document.getElementById(ELEMENTS.progressText);
  progressText.textContent = `${processed} / ${total} mockups processed`;

  // Update progress bar
  const progressBar = document.getElementById(ELEMENTS.progressBar);
  const percentage = total > 0 ? (processed / total) * 100 : 0;
  progressBar.style.width = `${percentage}%`;

  // Show percentage inside bar if there's space
  if (percentage > 10) {
    progressBar.textContent = `${Math.round(percentage)}%`;
  } else {
    progressBar.textContent = '';
  }
};

const handleRunFinished = () => {
  log('Run finished - All rows processed', 'status-success');
};

const handleRunError = (error) => {
  log('Run error: ' + (error || 'unknown'), 'status-failed');
};

const handleQueueUpdate = (msg) => {
  const { queueCount, isProcessing } = msg;
  const badge = document.getElementById(ELEMENTS.queueBadge);

  if (queueCount === 0 && !isProcessing) {
    badge.classList.add('hidden');
  } else {
    badge.classList.remove('hidden');
    badge.textContent = queueCount;

    if (queueCount > 0) {
      log(`Queue updated: ${queueCount} item(s) waiting`, 'status-skipped');
    }
  }
};

const initializeEventListeners = () => {
  document.getElementById(ELEMENTS.startBtn).addEventListener('click', handleStartClick);
  document.getElementById(ELEMENTS.stopBtn).addEventListener('click', handleStopClick);
  document.getElementById(ELEMENTS.previewBtn).addEventListener('click', handlePreviewClick);
  document.getElementById(ELEMENTS.downloadSampleBtn).addEventListener('click', handleDownloadSampleClick);
  document.getElementById(ELEMENTS.clearLogBtn).addEventListener('click', clearLog);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'log') {
      handleLogMessage(msg.message);
    } else if (msg.action === 'status') {
      handleStatusMessage(msg);
    } else if (msg.action === 'progress') {
      handleProgressUpdate(msg);
    } else if (msg.action === 'runFinished') {
      handleRunFinished();
    } else if (msg.action === 'runError') {
      handleRunError(msg.error);
    } else if (msg.action === 'queueUpdated') {
      handleQueueUpdate(msg);
    }
  });
};

const loadMappingSample = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL(MAPPING_FILE_PATH));
    const data = await response.json();
    document.getElementById(ELEMENTS.mappingInput).value = JSON.stringify(data, null, 2);
    log('Mapping configuration loaded', 'status-success');
  } catch (e) {
    log('Could not load default mapping configuration', 'status-skipped');
  }
};

// Initialize the fullscreen interface
const initialize = async () => {
  log('Fullscreen interface loaded', 'status-success');
  await loadMappingSample();
  initializeEventListeners();
};

initialize();