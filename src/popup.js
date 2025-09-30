import { MAPPING_FILE_PATH } from './config.js';

const ELEMENTS = {
  log: 'log',
  jsonRowsInput: 'jsonRowsInput',
  mappingInput: 'mappingInput',
  startBtn: 'startBtn',
  stopBtn: 'stopBtn',
  previewBtn: 'previewBtn'
};

const createLogEntry = (message) => {
  const entry = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  return entry;
};

const log = (message) => {
  const logContainer = document.getElementById(ELEMENTS.log);
  const entry = createLogEntry(message);
  logContainer.prepend(entry);
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
    log(`Error parsing pasted JSON: ${parseResult.error}`);
    return [];
  }

  try {
    return validateArray(parseResult.data);
  } catch (e) {
    log(e.message);
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
  return new URL(url).searchParams.get('customG_0');
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
    const baseUrl = mapping[tag] || '[MISSING]';
    return buildPreviewUrl(baseUrl, customParam);
  });
};

const handleStartClick = async () => {
  const rows = getPastedRows();
  if (!rows.length) {
    log('No rows loaded from pasted JSON');
    return;
  }

  const mappingResult = getMappingConfig();
  if (!mappingResult.success) {
    log('Error parsing mapping: ' + mappingResult.error);
    return;
  }

  const response = await sendMessageToBackground('startRun', {
    rows,
    mapping: mappingResult.data
  });

  if (response?.ok) {
    log('Run started');
  } else {
    log('Failed to start run: ' + (response?.error || 'Unknown error'));
  }
};

const handleStopClick = async () => {
  await sendMessageToBackground('stopRun');
  log('Stop requested');
};

const handlePreviewClick = () => {
  const rows = getPastedRows();
  if (!rows.length) {
    log('No rows loaded');
    return;
  }

  const mappingResult = getMappingConfig();
  if (!mappingResult.success) {
    log('Preview error: ' + mappingResult.error);
    return;
  }

  try {
    const previewUrls = generatePreviewUrls(rows[0], mappingResult.data);
    log('Preview URLs:\n' + previewUrls.join('\n'));
  } catch (e) {
    log('Preview error: ' + e.message);
  }
};

const handleLogMessage = (message) => {
  log(message);
};

const handleStatusMessage = (msg) => {
  const rowNum = msg.rowIndex + 1 || '?';
  const tag = msg.tag || '';
  const extraInfo = msg.message ? ' - ' + msg.message : '';
  log(`STATUS row ${rowNum} tag ${tag}: ${msg.status}${extraInfo}`);
};

const handleRunFinished = () => {
  log('Run finished');
};

const handleRunError = (error) => {
  log('Run error: ' + (error || 'unknown'));
};

const initializeEventListeners = () => {
  document.getElementById(ELEMENTS.startBtn).addEventListener('click', handleStartClick);
  document.getElementById(ELEMENTS.stopBtn).addEventListener('click', handleStopClick);
  document.getElementById(ELEMENTS.previewBtn).addEventListener('click', handlePreviewClick);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'log') {
      handleLogMessage(msg.message);
    } else if (msg.action === 'status') {
      handleStatusMessage(msg);
    } else if (msg.action === 'runFinished') {
      handleRunFinished();
    } else if (msg.action === 'runError') {
      handleRunError(msg.error);
    }
  });
};

const loadMappingSample = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL(MAPPING_FILE_PATH));
    const data = await response.json();
    document.getElementById(ELEMENTS.mappingInput).value = JSON.stringify(data, null, 2);
  } catch (e) {
  }
};

loadMappingSample();
initializeEventListeners();