/**
 * background.js (service worker)
 * Orchestrates rows -> tags -> open tab -> inject click script -> close tab
 *
 * Messages expected from popup:
 *   { action: 'startRun', payload: { rows, mapping, config } }
 *   { action: 'stopRun' }
 *
 * Sends status updates via chrome.runtime.sendMessage back to popup.
 */

let runState = {
  running: false,
  stopRequested: false
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(!msg || !msg.action) return;
  if(msg.action === 'startRun') {
    if(runState.running) {
      sendResponse({ ok: false, error: 'Run already in progress' });
      return;
    }
    runState.running = true;
    runState.stopRequested = false;
    startRun(msg.payload).then(() => {
      runState.running = false;
      chrome.runtime.sendMessage({ action: 'runFinished' });
    }).catch(err => {
      runState.running = false;
      chrome.runtime.sendMessage({ action: 'runError', error: err && err.message });
    });
    sendResponse({ ok: true });
  } else if(msg.action === 'stopRun') {
    runState.stopRequested = true;
    sendResponse({ ok: true });
  }
  // allow async response
  return true;
});

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function parseQueryParam(url, key) {
  try {
    const u = new URL(url);
    return u.searchParams.get(key);
  } catch(e) {
    return null;
  }
}

function addOrReplaceParam(baseUrl, key, value) {
  const u = new URL(baseUrl);
  u.searchParams.set(key, value);
  return u.toString();
}

async function startRun({ rows, mapping, config }) {
  // rows: array of { productCode, uploaded_mockup, Tags }
  // mapping: { tagCode: baseUrl, ... }
  // config: object with open_interval_ms, wait_before_click_ms, retry_attempts, timeout_ms, post_click_wait_ms, max_concurrent_tabs, skip_if_no_button
  chrome.runtime.sendMessage({ action: 'log', message: 'Run started', level: 'info' });

  for (let ri = 0; ri < rows.length; ++ri) {
    if(runState.stopRequested) {
      chrome.runtime.sendMessage({ action: 'log', message: 'Stop requested — aborting run', level: 'warn' });
      break;
    }
    const row = rows[ri];
    const productCode = row.productCode || row.productCode === 0 ? String(row.productCode) : '';
    const uploaded_mockup = row.uploaded_mockup;
    const tagsCell = row.Tags || row.Tags === 0 ? String(row.Tags) : '';
    chrome.runtime.sendMessage({ action: 'log', message: `Processing row ${ri+1}: ${productCode}`, level: 'info', meta: { rowIndex: ri, productCode } });

    const customId = parseQueryParam(uploaded_mockup, 'customG_0');
    if(!customId) {
      chrome.runtime.sendMessage({ action: 'status', rowIndex: ri, status: 'skipped', reason: 'missing_customG_0' });
      continue;
    }

    // split tags: allow comma or comma+space
    const tags = tagsCell.split(',').map(t => t.trim()).filter(Boolean);
    for (let ti = 0; ti < tags.length; ++ti) {
      if(runState.stopRequested) break;
      const tag = tags[ti];
      let baseUrl = mapping[tag];
      if(!baseUrl) {
        chrome.runtime.sendMessage({ action: 'log', message: `Tag mapping missing for ${tag}. Skipping.`, level: 'warn', meta: { tag, rowIndex: ri }});
        chrome.runtime.sendMessage({ action: 'status', rowIndex: ri, tag, status: 'skipped', reason: 'missing_tag_mapping' });
        continue;
      }

      // normalize mapping by removing customG_0 if present
      try {
        const u = new URL(baseUrl);
        u.searchParams.delete('customG_0');
        baseUrl = u.toString();
      } catch(e) {
        // if invalid URL, still attempt to append
      }

      const finalUrl = addOrReplaceParam(baseUrl, 'customG_0', customId);
      chrome.runtime.sendMessage({ action: 'log', message: `Opening tag ${tag} -> ${finalUrl}`, level: 'info', meta: { tag, finalUrl, rowIndex: ri }});
      chrome.runtime.sendMessage({ action: 'status', rowIndex: ri, tag, status: 'opening', url: finalUrl });

      try {
        // open tab
        const createdTab = await chrome.tabs.create({ url: finalUrl, active: false });
        const tabId = createdTab.id;

        // wait for load or timeout
        const pageLoadTimeout = config.timeout_ms || 30000;
        let loaded = await waitForTabComplete(tabId, pageLoadTimeout);
        if(!loaded) {
          chrome.runtime.sendMessage({ action: 'log', message: `Tab ${tabId} did not finish loading within timeout.`, level: 'warn', meta: { tabId, rowIndex: ri, tag }});
        }

        // wait additional wait_before_click
        const waitBeforeClick = config.wait_before_click_ms || 10000;
        await sleep(waitBeforeClick);

        // attempt click via scripting
        const attemptResult = await attemptClickInTab(tabId, config.retry_attempts || 2, config.post_click_wait_ms || 4000, config.skip_if_no_button);
        chrome.runtime.sendMessage({ action: 'status', rowIndex: ri, tag, status: attemptResult.success ? 'success' : 'failed', message: attemptResult.message });

        // close tab
        try {
          await chrome.tabs.remove(tabId);
        } catch(e) {
          // ignore
        }

      } catch(e) {
        chrome.runtime.sendMessage({ action: 'log', message: `Error processing tag ${tag}: ${e && e.message}`, level: 'error', meta: { tag, rowIndex: ri }});
        chrome.runtime.sendMessage({ action: 'status', rowIndex: ri, tag, status: 'failed', message: e && e.message });
      }

      // wait open_interval_ms before next tag
      const openInterval = config.open_interval_ms || 5000;
      await sleep(openInterval);
    } // tags loop
  } // rows loop

  chrome.runtime.sendMessage({ action: 'log', message: 'Run completed', level: 'info' });
}

/**
 * Wait until tab's document.readyState is 'complete' or until timeout
 */
function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      chrome.tabs.get(tabId).then(tab => {
        if(!tab) return resolve(false);
        // detect if suspended or discarded
        if(tab.status === 'complete') return resolve(true);
        if(Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 500);
      }).catch(err => resolve(false));
    }
    check();
  });
}

/**
 * attemptClickInTab: uses chrome.scripting.executeScript to run click routine in the tab.
 * Retries clicking if necessary.
 */
async function attemptClickInTab(tabId, retryAttempts, postClickWaitMs, skipIfNoButton) {
  let lastErr = null;
  for(let attempt=0; attempt < (retryAttempts||1); ++attempt) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      // content.js sends a message back with result via chrome.runtime.sendMessage - but executeScript returns result of last expression
      // We will also wait for a short duration to collect any post-click behavior
      await new Promise(res => setTimeout(res, postClickWaitMs || 4000));
      // We assume content script set window.__placeit_click_result on the page; try to read it
      const readRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return window.__placeit_click_result || { success: false, message: 'no_result' };
        }
      });
      const val = readRes && readRes[0] && readRes[0].result ? readRes[0].result : { success: false, message: 'no_result' };
      if(val.success) {
        return { success: true, message: val.message || 'clicked' };
      } else {
        lastErr = val.message || 'click_failed';
        if(skipIfNoButton) {
          return { success: false, message: 'button_not_found_and_skipping' };
        }
        // retry after small backoff
        await new Promise(res => setTimeout(res, 1000 + attempt*500));
      }
    } catch(e) {
      lastErr = e && e.message;
      await new Promise(res => setTimeout(res, 500));
    }
  }
  return { success: false, message: lastErr || 'unknown' };
}
