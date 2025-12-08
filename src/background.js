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

const executeActions = async (tabId, actions) => {
  console.log('[executeActions] Called with tabId:', tabId, 'actions:', actions);

  if (!actions || actions.length === 0) {
    console.log('[executeActions] No actions to execute');
    return { success: true, message: 'no_actions' };
  }

  try {
    console.log('[executeActions] Injecting action functions into tab', tabId);
    // Inject action execution script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: async (actionNames) => {
        console.log('[executeActions-injected] Script injected with actionNames:', actionNames);

        // ...existing code...
        const findDropdownButton = () => {
          const buttons = document.querySelectorAll('button.btn.dropdown-toggle.btn-default');
          return Array.from(buttons).find(button => {
            try {
              const text = button.innerText?.toLowerCase();
              return text && text.includes('px');
            } catch (e) {
              return false;
            }
          }) || null;
        };

        const findRemoveImageOption = () => {
          const menuItems = document.querySelectorAll('a.remove-placeholder');
          return menuItems[0] || null;
        };

        const clickElementSafely = (element) => {
          try {
            element.click();
            return true;
          } catch (e) {
            return false;
          }
        };

        const observeForElement = (findFunction, timeoutMs = 5000) => {
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

        const removeImageViaDropdown = async (timeoutMs = 10000) => {
          try {
            // Log: Function execution started
            console.log('[removeImageViaDropdown] Function executed with timeout:', timeoutMs);

            // Step 1: Find and click the dropdown button
            console.log('[removeImageViaDropdown] Searching for dropdown button...');
            const dropdownButton = await observeForElement(findDropdownButton, timeoutMs / 2);
            if (!dropdownButton) {
              console.error('[removeImageViaDropdown] Dropdown button NOT found');
              return { success: false, message: 'dropdown_button_not_found' };
            }

            console.log('[removeImageViaDropdown] Dropdown button FOUND:', dropdownButton);
            const clickSuccess = clickElementSafely(dropdownButton);
            console.log('[removeImageViaDropdown] Dropdown button clicked:', clickSuccess);

            console.log('[removeImageViaDropdown] Waiting 300ms for dropdown menu to appear...');
            await new Promise(resolve => setTimeout(resolve, 300));

            // Step 2: Find and click the "Remove this Image" option
            console.log('[removeImageViaDropdown] Observing for "Remove this Image" option...');
            const removeOption = await observeForElement(findRemoveImageOption, timeoutMs / 2);
            if (!removeOption) {
              console.error('[removeImageViaDropdown] "Remove this Image" option NOT found');
              return { success: false, message: 'remove_option_not_found' };
            }

            console.log('[removeImageViaDropdown] "Remove this Image" option FOUND:', removeOption);
            const clicked = clickElementSafely(removeOption);
            console.log('[removeImageViaDropdown] "Remove this Image" option clicked:', clicked);

            if (!clicked) {
              console.error('[removeImageViaDropdown] Failed to click "Remove this Image" option');
              return { success: false, message: 'remove_option_click_failed' };
            }

            console.log('[removeImageViaDropdown] SUCCESS - Image removal initiated');
            return { success: true, message: 'image_removal_initiated' };
          } catch (e) {
            console.error('[removeImageViaDropdown] ERROR:', e?.message || 'unknown_error', e);
            return { success: false, message: e?.message || 'unknown_error' };
          }
        };

        // Define actions mapping AFTER function definition
        const ACTIONS = {
          HoodieRemoveSleeve: removeImageViaDropdown
        };

        console.log('[executeActions-injected] ACTIONS object:', Object.keys(ACTIONS));

        // Execute each action
        const results = [];
        for (const actionName of actionNames) {
          console.log('[executeActions-injected] Processing action:', actionName);
          const actionFunc = ACTIONS[actionName];
          if (!actionFunc) {
            console.error('[executeActions-injected] Action function not found:', actionName);
            results.push({ actionName, success: false, message: 'action_not_found' });
            continue;
          }

          console.log('[executeActions-injected] Found action function, executing:', actionName);
          try {
            const result = await actionFunc();
            console.log('[executeActions-injected] Action result:', actionName, result);
            results.push({ actionName, ...result });
          } catch (e) {
            console.error('[executeActions-injected] Action execution error:', actionName, e?.message);
            results.push({ actionName, success: false, message: e?.message || 'action_execution_error' });
          }
        }

        window.__placeit_actions_result = results;
        console.log('[executeActions-injected] Storing results:', results);
      },
      args: [actions]
    });

    console.log('[executeActions] Script injection complete, reading results');
    // Read the results
    const scriptResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__placeit_actions_result || []
    });

    const results = scriptResult?.[0]?.result || [];
    console.log('[executeActions] Final results:', results);
    return { success: true, message: 'actions_executed', results };

  } catch (e) {
    console.error('[executeActions] Error:', e?.message);
    logMessage(`Error executing actions: ${e?.message}`, 'error');
    return { success: false, message: e?.message || 'actions_execution_failed' };
  }
};

const processTag = async (tag, baseUrl, customId, rowIndex, config, mappingEntry) => {
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

    // Execute actions if they exist in the mapping entry
    if (mappingEntry && mappingEntry.actions && mappingEntry.actions.length > 0) {
      logMessage(`Executing ${mappingEntry.actions.length} action(s) for tag ${tag}`, 'info', { tag, rowIndex });
      const actionsResult = await executeActions(tab.id, mappingEntry.actions);
      logMessage(`Actions result: ${JSON.stringify(actionsResult)}`, 'info', { tag, rowIndex });

      if (!actionsResult.success) {
        logMessage(`Warning: Actions execution had issues for tag ${tag}`, 'warn', { tag, rowIndex, details: actionsResult });
      }

      // Give browser time to process the actions before clicking download
      await sleep(1000);
    }

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

    await processTag(tag, baseUrl, customId, rowIndex, config, mappingEntry);
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