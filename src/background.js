const DEFAULT_CONFIG = {
  open_interval_ms: 5000,
  wait_before_click_ms: 10000,
  retry_attempts: 2,
  timeout_ms: 30000,
  post_click_wait_ms: 4000,
  skip_if_no_button: true
};

const TAB_CHECK_INTERVAL_MS = 500;

const runState = {
  running: false,
  stopRequested: false
};

const handleStartRun = (payload, sendResponse) => {
  if (runState.running) {
    sendResponse({ ok: false, error: 'Run already in progress' });
    return;
  }

  runState.running = true;
  runState.stopRequested = false;

  startRun(payload)
    .then(() => {
      runState.running = false;
      sendMessage('runFinished');
    })
    .catch(err => {
      runState.running = false;
      sendMessage('runError', { error: err?.message });
    });

  sendResponse({ ok: true });
};

const handleStopRun = (sendResponse) => {
  runState.stopRequested = true;
  sendResponse({ ok: true });
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.action) return;

  if (msg.action === 'startRun') {
    handleStartRun(msg.payload, sendResponse);
  } else if (msg.action === 'stopRun') {
    handleStopRun(sendResponse);
  }

  return true;
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessage = (action, data = {}) => {
  chrome.runtime.sendMessage({ action, ...data });
};

const logMessage = (message, level = 'info', meta = {}) => {
  sendMessage('log', { message, level, ...meta });
};

const sendStatus = (rowIndex, tag, status, extraData = {}) => {
  sendMessage('status', { rowIndex, tag, status, ...extraData });
};

const extractCustomId = (url) => {
  try {
    return new URL(url).searchParams.get('customG_0');
  } catch (e) {
    return null;
  }
};

const buildFinalUrl = (baseUrl, customId) => {
  const encodedId = encodeURIComponent(customId);

  if (baseUrl.includes('customG_0=')) {
    return baseUrl.replace(/([?&]customG_0=)[^&]*/, `$1${encodedId}`);
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}customG_0=${encodedId}`;
};

const parseTags = (tagsCell) => {
  const tagsString = tagsCell || tagsCell === 0 ? String(tagsCell) : '';
  return tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
};

const isTabLoaded = (tab) => tab?.status === 'complete';

const waitForTabComplete = (tabId, timeoutMs) => {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkTabStatus = () => {
      chrome.tabs.get(tabId)
        .then(tab => {
          if (!tab) return resolve(false);
          if (isTabLoaded(tab)) return resolve(true);
          if (Date.now() - startTime > timeoutMs) return resolve(false);

          setTimeout(checkTabStatus, TAB_CHECK_INTERVAL_MS);
        })
        .catch(() => resolve(false));
    };

    checkTabStatus();
  });
};

const injectClickScript = (tabId) => {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
};

const readClickResult = (tabId) => {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__placeit_click_result || { success: false, message: 'no_result' }
  });
};

const extractClickResult = (scriptResult) => {
  return scriptResult?.[0]?.result || { success: false, message: 'no_result' };
};

const attemptClickInTab = async (tabId, config) => {
  const { retry_attempts, post_click_wait_ms, skip_if_no_button } = config;
  let lastError = null;

  for (let attempt = 0; attempt < retry_attempts; attempt++) {
    try {
      await injectClickScript(tabId);
      await sleep(post_click_wait_ms);

      const scriptResult = await readClickResult(tabId);
      const result = extractClickResult(scriptResult);

      if (result.success) {
        return { success: true, message: result.message || 'clicked' };
      }

      lastError = result.message || 'click_failed';

      if (skip_if_no_button) {
        return { success: false, message: 'button_not_found_and_skipping' };
      }

      await sleep(1000 + attempt * 500);
    } catch (e) {
      lastError = e?.message;
      await sleep(500);
    }
  }

  return { success: false, message: lastError || 'unknown' };
};

const createTab = (url) => {
  return chrome.tabs.create({ url, active: false });
};

const processTag = async (tag, baseUrl, customId, rowIndex, config) => {
  const finalUrl = buildFinalUrl(baseUrl, customId);

  logMessage(`Opening tag ${tag} -> ${finalUrl}`, 'info', { tag, finalUrl, rowIndex });
  sendStatus(rowIndex, tag, 'opening', { url: finalUrl });

  try {
    const tab = await createTab(finalUrl);
    const loaded = await waitForTabComplete(tab.id, config.timeout_ms);

    if (!loaded) {
      logMessage(`Tab ${tab.id} did not finish loading within timeout.`, 'warn', {
        tabId: tab.id,
        rowIndex,
        tag
      });
    }

    await sleep(config.wait_before_click_ms);

    const result = await attemptClickInTab(tab.id, config);
    const status = result.success ? 'success' : 'failed';

    sendStatus(rowIndex, tag, status, { message: result.message });
  } catch (e) {
    logMessage(`Error processing tag ${tag}: ${e?.message}`, 'error', { tag, rowIndex });
    sendStatus(rowIndex, tag, 'failed', { message: e?.message });
  }

  await sleep(config.open_interval_ms);
};

const processRow = async (row, rowIndex, mapping, config) => {
  if (runState.stopRequested) {
    logMessage('Stop requested — aborting run', 'warn');
    return false;
  }

  const productCode = row.productCode || row.productCode === 0 ? String(row.productCode) : '';
  const uploadedMockupUrl = row.uploaded_mockup;

  logMessage(`Processing row ${rowIndex + 1}: ${productCode}`, 'info', {
    rowIndex,
    productCode
  });

  const customId = extractCustomId(uploadedMockupUrl);
  if (!customId) {
    sendStatus(rowIndex, null, 'skipped', { reason: 'missing_customG_0' });
    return true;
  }

  const tags = parseTags(row.Tags);

  for (const tag of tags) {
    if (runState.stopRequested) return false;

    const baseUrl = mapping[tag];
    if (!baseUrl) {
      logMessage(`Tag mapping missing for ${tag}. Skipping.`, 'warn', { tag, rowIndex });
      sendStatus(rowIndex, tag, 'skipped', { reason: 'missing_tag_mapping' });
      continue;
    }

    await processTag(tag, baseUrl, customId, rowIndex, config);
  }

  return true;
};

const startRun = async ({ rows, mapping }) => {
  const config = DEFAULT_CONFIG;
  logMessage('Run started', 'info');

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const shouldContinue = await processRow(rows[rowIndex], rowIndex, mapping, config);
    if (!shouldContinue) break;
  }

  logMessage('Run completed', 'info');
};