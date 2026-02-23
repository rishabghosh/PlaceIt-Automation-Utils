const ELEMENTS = {
  saveToggle: 'saveToggle',
  waitSeconds: 'waitSeconds',
  waitNextSeconds: 'waitNextSeconds',
  progressText: 'progressText',
  progressBar: 'progressBar',
  processingSpinner: 'processingSpinner'
};

const updateProgressUI = (processed, total) => {
  const progressText = document.getElementById(ELEMENTS.progressText);
  progressText.textContent = `${processed} / ${total}`;

  const progressBar = document.getElementById(ELEMENTS.progressBar);
  const percentage = total > 0 ? (processed / total) * 100 : 0;
  progressBar.style.width = `${percentage}%`;
};

const initializeEventListeners = () => {
  const saveToggle = document.getElementById(ELEMENTS.saveToggle);
  const waitSeconds = document.getElementById(ELEMENTS.waitSeconds);
  const waitNextSeconds = document.getElementById(ELEMENTS.waitNextSeconds);

  // Load saved settings from Chrome extension storage
  chrome.storage.local.get(['shouldDownload', 'waitBeforeDownloadSeconds', 'waitNextItemSeconds'], (result) => {
    if (result.shouldDownload !== undefined) {
      saveToggle.checked = result.shouldDownload;
    } else {
      saveToggle.checked = true; // default
    }

    if (result.waitBeforeDownloadSeconds !== undefined) {
      waitSeconds.value = result.waitBeforeDownloadSeconds;
    } else {
      waitSeconds.value = 15; // default to 15s instead of 0
    }

    if (result.waitNextItemSeconds !== undefined) {
      waitNextSeconds.value = result.waitNextItemSeconds;
    } else {
      waitNextSeconds.value = 30; // default to 30s
    }
  });

  // Save settings on change
  saveToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ shouldDownload: e.target.checked });
  });

  waitSeconds.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    chrome.storage.local.set({ waitBeforeDownloadSeconds: val });
  });

  waitNextSeconds.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    chrome.storage.local.set({ waitNextItemSeconds: val });
  });

  // Listen for progress updates from background worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progress') {
      updateProgressUI(msg.processed, msg.total);
    } else if (msg.action === 'queueUpdated') {
      const spinner = document.getElementById(ELEMENTS.processingSpinner);
      if (msg.isProcessing) {
        spinner.classList.add('active');
      } else {
        spinner.classList.remove('active');
      }
    } else if (msg.action === 'runFinished') {
      const spinner = document.getElementById(ELEMENTS.processingSpinner);
      spinner.classList.remove('active');
    }
  });
};

const requestCurrentProgress = () => {
  chrome.runtime.sendMessage({ action: 'getProgress' }, (response) => {
    if (response) {
      updateProgressUI(response.processed, response.total);
    }
  });

  chrome.runtime.sendMessage({ action: 'getQueueStatus' }, (response) => {
    if (response) {
      const spinner = document.getElementById(ELEMENTS.processingSpinner);
      if (response.isProcessing) {
        spinner.classList.add('active');
      } else {
        spinner.classList.remove('active');
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  requestCurrentProgress();
});