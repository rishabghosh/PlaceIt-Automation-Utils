import { BUTTON_WAIT_TIMEOUT_MS, MODAL_WAIT_MS } from './config.js';

(() => {
  const DOWNLOAD_BUTTON_SELECTORS = [
    'button.button.primary.download-button.subscribed-user.show',
    'button.download-button',
    'div.download-button-wrapper button'
  ];

  const DOWNLOAD_TEXT_PATTERNS = ['download', 'download now', 'download file'];

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

  const waitForDownloadButton = (timeoutMs = BUTTON_WAIT_TIMEOUT_MS) => {
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
    await new Promise(resolve => setTimeout(resolve, MODAL_WAIT_MS));
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
})();