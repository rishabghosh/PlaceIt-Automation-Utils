/**
 * content.js
 * Runs in page context. Attempts to locate the Download button with multiple fallbacks,
 * clicks it, handles potential modal flows (best-effort), and writes result to window.__placeit_click_result
 */

(() => {
  const findBySelectorList = () => {
    const selectors = [
      'button.button.primary.download-button.subscribed-user.show',
      'button.download-button',
      'div.download-button-wrapper button'
    ];

    return selectors.map(sel => document.querySelector(sel)).find(el => el) || null;
  };

  const findByText = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
    while(walker.nextNode()) {
      const node = walker.currentNode;
      try {
        const text = node.innerText?.trim().toLowerCase();
        if(text === 'download' || text === 'download now' || text === 'download file') return node;
      } catch(e) {}
    }
    return null;
  };

  const findDownloadButton = () => document.querySelector('button.download-button');

  const waitForButton = (timeoutMs) => {
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
  };

  const waitForDownloadButton = (timeoutMs) => {
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
  };

  const attemptClickFlow = async () => {
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
      const confirm = Array.from(document.querySelectorAll('button'))
        .filter(b => {
          try{
            const txt = b.innerText?.trim().toLowerCase();
            return txt?.includes('download');
          }catch(e){ return false; }
        })[0] || null;

      if(confirm) {
        try { confirm.click(); } catch(e){}
      }

      window.__placeit_click_result = { success: true, message: 'clicked' };
    } catch(e) {
      window.__placeit_click_result = { success: false, message: e?.message };
    }
  };

  const clickDownloadButton = async () => {
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
  };

  attemptClickFlow();
  clickDownloadButton();
})();