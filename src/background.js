import { DEFAULT_CONFIG, TAB_CHECK_INTERVAL_MS, BUTTON_WAIT_TIMEOUT_MS, MODAL_WAIT_MS } from './config.js';

const runState = {
  running: false,
  stopRequested: false,
  totalMockups: 0,
  processedMockups: 0
};

// Queue management
const queue = {
  items: [],
  processing: false,

  add(payload) {
    this.items.push(payload);
    this.notifyQueueChange();
    this.processNext();
  },

  async processNext() {
    if (this.processing || this.items.length === 0) return;

    this.processing = true;
    const payload = this.items.shift();
    this.notifyQueueChange();

    try {
      runState.running = true;
      runState.stopRequested = false;
      await startRun(payload);
      sendMessage('runFinished');
    } catch (err) {
      sendMessage('runError', { error: err?.message });
    } finally {
      runState.running = false;
      this.processing = false;

      if (this.items.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.processNext();
      } else {
        this.notifyQueueChange();
      }
    }
  },

  notifyQueueChange() {
    sendMessage('queueUpdated', {
      queueCount: this.items.length,
      isProcessing: this.processing || runState.running
    });
  },

  getStatus() {
    return {
      queueCount: this.items.length,
      isProcessing: this.processing || runState.running
    };
  }
};

const handleStartRun = (payload, sendResponse) => {
  queue.add(payload);
  sendResponse({ ok: true });
};

const handleStopRun = (sendResponse) => {
  runState.stopRequested = true;
  sendResponse({ ok: true });
};

const handleGetQueueStatus = (sendResponse) => {
  sendResponse(queue.getStatus());
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.action) return;

  if (msg.action === 'startRun') {
    handleStartRun(msg.payload, sendResponse);
  } else if (msg.action === 'stopRun') {
    handleStopRun(sendResponse);
  } else if (msg.action === 'getQueueStatus') {
    handleGetQueueStatus(sendResponse);
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
    func: (buttonTimeout, modalWait) => {
      const DOWNLOAD_BUTTON_SELECTORS = [
        'button.button.primary.download-button.subscribed-user.show',
        'button.download-button',
        'div.download-button-wrapper button'
      ];

      const DOWNLOAD_TEXT_PATTERNS = ['download'];

      const setClickResult = (success, message) => {
        window.__placeit_click_result = { success, message };
      };

      const findElementBySelectors = (selectors) => {
        return selectors
          .map(selector => document.querySelector(selector))
          .find(element => element) || null;
      };

      const findElementByText = (textPatterns) => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT
        );

        while (walker.nextNode()) {
          const node = walker.currentNode;
          try {
            const text = node.innerText?.trim().toLowerCase();
            if (textPatterns.includes(text)) return node;
          } catch (e) {
          }
        }
        return null;
      };

      const findDownloadButton = () => {
        return findElementBySelectors(DOWNLOAD_BUTTON_SELECTORS) ||
               findElementByText(DOWNLOAD_TEXT_PATTERNS);
      };

      const observeForElement = (findFunction, timeoutMs) => {
        return new Promise((resolve) => {
          const existing = findFunction();
          if (existing) return resolve(existing);

          const observer = new MutationObserver(() => {
            const found = findFunction();
            if (found) {
              observer.disconnect();
              resolve(found);
            }
          });

          observer.observe(document, {
            childList: true,
            subtree: true,
            attributes: true
          });

          setTimeout(() => {
            observer.disconnect();
            resolve(null);
          }, timeoutMs);
        });
      };

      const waitForDownloadButton = (timeoutMs = buttonTimeout) => {
        return observeForElement(findDownloadButton, timeoutMs);
      };

      const scrollIntoViewSafely = (element) => {
        try {
          element.scrollIntoView({ block: 'center', inline: 'center' });
        } catch (e) {
        }
      };

      const findModalDownloadButton = () => {
        return Array.from(document.querySelectorAll('button'))
          .find(button => {
            try {
              const text = button.innerText?.trim().toLowerCase();
              return text?.includes('download');
            } catch (e) {
              return false;
            }
          }) || null;
      };

      const clickElementSafely = (element) => {
        try {
          element.click();
          return true;
        } catch (e) {
          return false;
        }
      };

      const handleModalFlow = async () => {
        await new Promise(resolve => setTimeout(resolve, modalWait));
        const modalButton = findModalDownloadButton();
        if (modalButton) {
          clickElementSafely(modalButton);
        }
      };

      const attemptDownload = async () => {
        try {
          const button = await waitForDownloadButton();

          if (!button) {
            setClickResult(false, 'download_button_not_found');
            return;
          }

          scrollIntoViewSafely(button);
          const clicked = clickElementSafely(button);

          if (!clicked) {
            setClickResult(false, 'click_failed');
            return;
          }

          await handleModalFlow();
          setClickResult(true, 'download_initiated');

        } catch (e) {
          setClickResult(false, e?.message || 'unknown_error');
        }
      };

      attemptDownload();
    },
    args: [BUTTON_WAIT_TIMEOUT_MS, MODAL_WAIT_MS]
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

const sendProgress = () => {
  sendMessage('progress', {
    processed: runState.processedMockups,
    total: runState.totalMockups
  });
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

    // Update progress
    runState.processedMockups++;
    sendProgress();
  } catch (e) {
    logMessage(`Error processing tag ${tag}: ${e?.message}`, 'error', { tag, rowIndex });
    sendStatus(rowIndex, tag, 'failed', { message: e?.message });

    // Update progress even on failure
    runState.processedMockups++;
    sendProgress();
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

    const mappingEntry = mapping[tag];
    if (!mappingEntry) {
      logMessage(`Tag mapping missing for ${tag}. Skipping.`, 'warn', { tag, rowIndex });
      sendStatus(rowIndex, tag, 'skipped', { reason: 'missing_tag_mapping' });
      continue;
    }

    const baseUrl = typeof mappingEntry === 'string' ? mappingEntry : mappingEntry.mockupUrl;
    if (!baseUrl) {
      logMessage(`Tag mapping URL missing for ${tag}. Skipping.`, 'warn', { tag, rowIndex });
      sendStatus(rowIndex, tag, 'skipped', { reason: 'missing_mockup_url' });
      continue;
    }

    await processTag(tag, baseUrl, customId, rowIndex, config);
  }

  return true;
};

const filterValidRows = (rows) => {
  return rows.filter(row => {
    const customId = extractCustomId(row.uploaded_mockup);
    return customId !== null && customId !== undefined && customId !== '';
  });
};

const calculateTotalMockups = (rows, mapping) => {
  let total = 0;

  for (const row of rows) {
    const tags = parseTags(row.Tags);

    for (const tag of tags) {
      const mappingEntry = mapping[tag];
      if (mappingEntry) {
        const baseUrl = typeof mappingEntry === 'string' ? mappingEntry : mappingEntry.mockupUrl;
        if (baseUrl) {
          total++;
        }
      }
    }
  }

  return total;
};

const startRun = async ({ rows, mapping }) => {
  const config = DEFAULT_CONFIG;

  // Filter rows that have customG_0
  const validRows = filterValidRows(rows);
  const filteredCount = rows.length - validRows.length;

  if (filteredCount > 0) {
    logMessage(`Filtered out ${filteredCount} row(s) without customG_0 parameter`, 'info');
  }

  if (validRows.length === 0) {
    logMessage('No valid rows to process', 'warn');
    return;
  }

  // Calculate total mockups
  runState.totalMockups = calculateTotalMockups(validRows, mapping);
  runState.processedMockups = 0;

  logMessage(`Run started: ${validRows.length} valid rows, ${runState.totalMockups} total mockups`, 'info');
  sendProgress();

  for (let rowIndex = 0; rowIndex < validRows.length; rowIndex++) {
    const shouldContinue = await processRow(validRows[rowIndex], rowIndex, mapping, config);
    if (!shouldContinue) break;
  }

  logMessage('Run completed', 'info');
};