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

function parseCSV(text) {
  // very simple CSV parse: assume header row and no quoted commas
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const vals = lines[i].split(',').map(v=>v.trim());
    const obj = {};
    for(let j=0;j<headers.length;j++){
      obj[headers[j]] = vals[j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

document.getElementById('startBtn').addEventListener('click', () => {
  try {
    const csvText = document.getElementById('csvInput').value;
    const rows = parseCSV(csvText);
    if(!rows.length) { log('No rows parsed from CSV'); return; }
    const mapping = JSON.parse(document.getElementById('mappingInput').value);
    const config = JSON.parse(document.getElementById('configInput').value);
    chrome.runtime.sendMessage({ action: 'startRun', payload: { rows, mapping, config } }, (resp) => {
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

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopRun' }, (resp) => {
    log('Stop requested');
  });
});

document.getElementById('previewBtn').addEventListener('click', () => {
  try {
    const csvText = document.getElementById('csvInput').value;
    const rows = parseCSV(csvText);
    if(!rows.length) { log('No rows parsed'); return; }
    const mapping = JSON.parse(document.getElementById('mappingInput').value);
    const first = rows[0];
    const custom = (new URL(first.uploaded_mockup)).searchParams.get('customG_0');
    const tags = (first.Tags || '').split(',').map(t=>t.trim()).filter(Boolean);
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
