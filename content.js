/**
 * content.js
 * Runs in page context. Attempts to locate the Download button with multiple fallbacks,
 * clicks it, handles potential modal flows (best-effort), and writes result to window.__placeit_click_result
 */

(function(){
  function findBySelectorList() {
    const selectors = [
      'button.button.primary.download-button.subscribed-user.show',
      'button.download-button',
      'div.download-button-wrapper button'
    ];
    for(const sel of selectors) {
      const el = document.querySelector(sel);
      if(el) return el;
    }
    return null;
  }

  function findByText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
    while(walker.nextNode()) {
      const node = walker.currentNode;
      try {
        const text = node.innerText && node.innerText.trim().toLowerCase();
        if(text === 'download' || text === 'download now' || text === 'download file') return node;
      } catch(e) {}
    }
    return null;
  }

  function findDownloadButton() {
    return document.querySelector('button.download-button')
  }

  function waitForButton(timeoutMs) {
    return new Promise((resolve) => {
      const existing = findBySelectorList() || findByText();
      if(existing) return resolve(existing);

      const mo = new MutationObserver(() => {
        const found = findBySelectorList() || findByText();
        if(found) {
          mo.disconnect();
          resolve(found);
        }
      });
      mo.observe(document, { childList: true, subtree: true, attributes: true });
      setTimeout(() => {
        mo.disconnect();
        resolve(null);
      }, timeoutMs || 15000);
    });
  }

  function waitForDownloadButton(timeoutMs) {
    return new Promise((resolve) => {
      const existing = findDownloadButton();
      if(existing) return resolve(existing);
      const mo = new MutationObserver(() => {
        const found = findDownloadButton();
        if(found) {
          mo.disconnect();
          resolve(found);
        }
      });
      mo.observe(document, { childList: true, subtree: true, attributes: true });
      setTimeout(() => {
        mo.disconnect();
        resolve(null);
      }, timeoutMs || 15000);
    });
  }

  async function attemptClickFlow() {
    try {
      const btn = await waitForButton(15000);
      if(!btn) {
        window.__placeit_click_result = { success: false, message: 'download_button_not_found' };
        return;
      }

      // make clickable
      try { btn.scrollIntoView({ block: 'center', inline: 'center' }); } catch(e){}
      // Attempt click
      btn.click();

      // Wait for possible modal/popups - best-effort attempt to find confirm button
      await new Promise(res => setTimeout(res, 1200));
      // try again to find any button that says 'Download' inside modal
      const confirm = (function(){
        const candidates = Array.from(document.querySelectorAll('button')).filter(b=>{
          try{
            const txt = b.innerText && b.innerText.trim().toLowerCase();
            return txt && txt.includes('download') || txt.includes('export') || txt.includes('save');
          }catch(e){ return false; }
        });
        return candidates.length ? candidates[0] : null;
      })();
      if(confirm) {
        try { confirm.click(); } catch(e){}
      }

      window.__placeit_click_result = { success: true, message: 'clicked' };
    } catch(e) {
      window.__placeit_click_result = { success: false, message: e && e.message };
    }
  }

  async function clickDownloadButton() {
    const btn = await waitForDownloadButton(15000);
    if (!btn) {
      window.__placeit_click_result = { success: false, message: 'download_button_not_found' };
      return;
    }
    try {
      btn.click();
      console.log("About to click Button:", btn);
      window.__placeit_click_result = { success: true, message: 'download_button_clicked' };
    } catch (e) {
      window.__placeit_click_result = { success: false, message: 'download_button_click_failed' };
    }
  }

  attemptClickFlow();
  clickDownloadButton();
})();
