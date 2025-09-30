/**
 * popup.js
 * Lightweight UI for prototype: reads pasted CSV, mapping JSON, config JSON, and sends run to background.
 */

function log(msg, level='info') {
  const el = document.getElementById('log');
  const p = document.createElement('div');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.prepend(p);
}

let uploadedRows = [];
let defaultConfig = {
  open_interval_ms: 5000,
  wait_before_click_ms: 10000,
  retry_attempts: 2,
  timeout_ms: 30000,
  post_click_wait_ms: 4000,
  skip_if_no_button: true
};

// Load mapping_sample.json on extension load
fetch(chrome.runtime.getURL('src/mapping_sample.json'))
  .then(res => res.json())
  .then(data => {
    document.getElementById('mappingInput').value = JSON.stringify(data, null, 2);
  })
  .catch(() => {});

// function to parse pasted JSON from textarea
function getPastedRows() {
  const val = document.getElementById('jsonRowsInput').value.trim();
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    if (!Array.isArray(arr)) throw new Error('JSON must be an array');
    return arr;
  } catch (e) {
    log('Error parsing pasted JSON: ' + e.message);
    return [];
  }
}

// Start button click handler
document.getElementById('startBtn').addEventListener('click', () => {
  try {
    const uploadedRows = getPastedRows();
    if (!uploadedRows.length) { log('No rows loaded from pasted JSON'); return; }
    const mapping = JSON.parse(document.getElementById('mappingInput').value);
    chrome.runtime.sendMessage({ action: 'startRun', payload: { rows: uploadedRows, mapping } }, (resp) => {
      if(resp && resp.ok) {
        log('Run started');
      } else {
        log('Failed to start run: ' + (resp && resp.error));
      }
    });
  } catch(e) {
    log('Error: ' + e.message);
  }
});

// Stop button click handler
document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopRun' }, (resp) => {
    log('Stop requested');
  });
});

// Preview button click handler
document.getElementById('previewBtn').addEventListener('click', () => {
  try {
    const uploadedRows = getPastedRows();
    if (!uploadedRows.length) { log('No rows loaded'); return; }
    const mapping = JSON.parse(document.getElementById('mappingInput').value);
    const first = uploadedRows[0];
    const custom = (new URL(first.uploaded_mockup)).searchParams.get('customG_0');
    let tags = first.Tags;
    if (Array.isArray(tags)) {
      tags = tags.map(t => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      tags = [];
    }
    const assembled = tags.map(t=>{
      let base = mapping[t] || '[MISSING]';
      try {
        const u = new URL(base);
        u.searchParams.delete('customG_0');
        u.searchParams.set('customG_0', custom);
        return u.toString();
      } catch(e) {
        return base + (base.includes('?') ? '&' : '?') + 'customG_0=' + custom;
      }
    });
    log('Preview URLs:\n' + assembled.join('\n'));
  } catch(e) {
    log('Preview error: ' + e.message);
  }
});

// receive runtime messages (logs/status) from background
chrome.runtime.onMessage.addListener((msg) => {
  if(msg.action === 'log') {
    log(msg.message);
  } else if(msg.action === 'status') {
    log(`STATUS row ${msg.rowIndex+1 || '?'} tag ${msg.tag || ''}: ${msg.status} ${msg.message ? ' - '+msg.message : ''}`);
  } else if(msg.action === 'runFinished') {
    log('Run finished');
  } else if(msg.action === 'runError') {
    log('Run error: ' + (msg.error || 'unknown'));
  }
});
