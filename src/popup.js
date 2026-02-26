const ELEMENTS = {
  themeToggle: 'themeToggle',
  saveToggle: 'saveToggle',
  waitBeforeActionsSeconds: 'waitBeforeActionsSeconds',
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
  const themeToggle = document.getElementById(ELEMENTS.themeToggle);
  const saveToggle = document.getElementById(ELEMENTS.saveToggle);
  const waitBeforeActionsSeconds = document.getElementById(ELEMENTS.waitBeforeActionsSeconds);
  const waitSeconds = document.getElementById(ELEMENTS.waitSeconds);
  const waitNextSeconds = document.getElementById(ELEMENTS.waitNextSeconds);

  // Load saved settings from Chrome extension storage
  chrome.storage.local.get(['isDarkTheme', 'shouldDownload', 'waitBeforeActionsSeconds', 'waitBeforeDownloadSeconds', 'waitNextItemSeconds'], (result) => {
    // Theme setup
    const isDarkTheme = result.isDarkTheme !== undefined ? result.isDarkTheme : true; // default dark
    themeToggle.checked = isDarkTheme;
    if (!isDarkTheme) {
      document.body.classList.add('light-theme');
    }

    if (result.shouldDownload !== undefined) {
      saveToggle.checked = result.shouldDownload;
    } else {
      saveToggle.checked = true; // default
    }

    if (result.waitBeforeActionsSeconds !== undefined) {
      waitBeforeActionsSeconds.value = result.waitBeforeActionsSeconds;
    } else {
      waitBeforeActionsSeconds.value = 10; // default to 10s
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
  themeToggle.addEventListener('change', (e) => {
    const isDark = e.target.checked;
    chrome.storage.local.set({ isDarkTheme: isDark });
    if (isDark) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  });

  saveToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ shouldDownload: e.target.checked });
  });

  waitBeforeActionsSeconds.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    chrome.storage.local.set({ waitBeforeActionsSeconds: val });
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