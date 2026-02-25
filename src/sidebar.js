// PlaceIt Helper Sidebar Content Script
// Injects sidebar on PlaceIt mockup editor pages

const MAPPING_FILE_PATH = 'src/mapping_sample.json';

const state = {
  customG_0: null,
  selectedModels: [],
  mapping: null,
  isGenerating: false,
  activeTab: 'front' // 'front' or 'back'
};

// Check if we're on a PlaceIt mockup editor page
const isPlaceitMockupPage = () => {
  return window.location.href.includes('placeit.net/c/mockups/stages');
};

// Extract customG_0 from current URL
const extractCustomG_0 = () => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('customG_0');
  } catch (e) {
    return null;
  }
};

// Load mapping configuration
const loadMapping = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL(MAPPING_FILE_PATH));
    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Failed to load mapping:', e);
    return null;
  }
};

// Categorize model codes by side (front/back) and category
const categorizeModels = (mapping) => {
  const front = {
    'Oversized Male': [],
    'Regular Male': [],
    'Oversized Female': [],
    'Regular Female': [],
    'Hoodie Male': [],
    'Hoodie Female': [],
  };

  const back = {
    'Oversized Male': [],
    'Regular Male': [],
    'Oversized Female': [],
    'Regular Female': [],
    'Hoodie Male': [],
    'Hoodie Female': [],
  };

  Object.entries(mapping).forEach(([code, data]) => {
    const targetCategories = data.side === 'front' ? front : back;
    const modelData = {
      code,
      displayName: data.displayName || code,
      manualIntervention: data.manualIntervention || false,
      narrowMockupContainer: data.narrowMockupContainer || false
    };

    if (code.startsWith('OM-')) {
      targetCategories['Oversized Male'].push(modelData);
    } else if (code.startsWith('RM-')) {
      targetCategories['Regular Male'].push(modelData);
    } else if (code.startsWith('OF-')) {
      targetCategories['Oversized Female'].push(modelData);
    } else if (code.startsWith('RF-')) {
      targetCategories['Regular Female'].push(modelData);
    } else if (code.startsWith('HM-')) {
      targetCategories['Hoodie Male'].push(modelData);
    } else if (code.startsWith('HF-')) {
      targetCategories['Hoodie Female'].push(modelData);
    }
  });

  return { front, back };
};

// Create categories HTML for a specific side
const createCategoriesHTML = (categories) => {
  return Object.entries(categories)
    .map(([categoryName, models]) => {
      if (models.length === 0) return '';

      const buttonsHTML = models
        .map(model => {
          const icons = [];

          if (model.manualIntervention) {
            icons.push('<span class="model-icon warning-icon" title="Manual intervention needed">⚠️</span>');
          }

          if (model.narrowMockupContainer) {
            icons.push('<span class="model-icon container-icon" title="Using a different container">⭕</span>');
          }

          const iconsHTML = icons.length > 0 ? `<span class="model-icons">${icons.join('')}</span>` : '';

          return `<button class="model-btn" data-code="${model.code}">
            <span class="model-name">${model.displayName}</span>${iconsHTML}
          </button>`;
        })
        .join('');

      return `
        <div class="model-category">
          <div class="category-title">${categoryName}</div>
          <div class="model-buttons">
            ${buttonsHTML}
          </div>
        </div>
      `;
    })
    .join('');
};

// Create sidebar HTML
const createSidebarHTML = (frontCategories, backCategories) => {
  const frontHTML = createCategoriesHTML(frontCategories);
  const backHTML = createCategoriesHTML(backCategories);

  return `
    <div id="placeit-helper-sidebar">
      <div class="sidebar-header">
        <h3 class="sidebar-title">Placeit Automation</h3>
        <button class="sidebar-toggle" id="sidebar-toggle" title="Collapse sidebar">
          <span class="toggle-icon">←</span>
        </button>
      </div>

      <div class="sidebar-content">
        <div class="profile-section">
          <button class="retrieve-btn" id="retrieve-profile-btn">
            📋 Retrieve Profile
          </button>
          <div class="profile-display" id="profile-display">
            <label>Custom ID</label>
            <div class="profile-value" id="profile-value"></div>
          </div>
          <div class="status-message" id="status-message"></div>
        </div>

        <div class="tabs-container">
          <div class="tabs">
            <button class="tab active" data-tab="front">Front</button>
            <button class="tab" data-tab="back">Back</button>
          </div>
        </div>

        <div class="tab-content active" id="front-tab">
          ${frontHTML || '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No front models found</div></div>'}
        </div>

        <div class="tab-content" id="back-tab">
          ${backHTML || '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No back models found</div></div>'}
        </div>
      </div>

      <div class="generate-section">
        <button class="generate-btn" id="generate-btn" disabled>
          🚀 Generate <span class="count" id="selected-count">0</span>
        </button>
      </div>
    </div>
  `;
};

// Show status message
const showStatus = (message, type = 'info') => {
  const statusEl = document.getElementById('status-message');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;

  setTimeout(() => {
    statusEl.classList.remove('visible');
  }, 3000);
};

// Update selected count
const updateSelectedCount = () => {
  const countEl = document.getElementById('selected-count');
  const generateBtn = document.getElementById('generate-btn');

  if (countEl) {
    countEl.textContent = state.selectedModels.length;
  }

  if (generateBtn) {
    generateBtn.disabled = state.selectedModels.length === 0 || !state.customG_0 || state.isGenerating;
  }
};

// Handle retrieve profile click
const handleRetrieveProfile = () => {
  const customG_0 = extractCustomG_0();

  if (!customG_0) {
    showStatus('No customG_0 found in URL', 'error');
    return;
  }

  state.customG_0 = customG_0;

  const profileDisplay = document.getElementById('profile-display');
  const profileValue = document.getElementById('profile-value');

  if (profileValue) {
    profileValue.textContent = customG_0;
  }

  if (profileDisplay) {
    profileDisplay.classList.add('visible');
  }

  showStatus('Profile retrieved successfully!', 'success');
  updateSelectedCount();
};

// Handle model button click
const handleModelClick = (event) => {
  const button = event.target.closest('.model-btn');
  if (!button) return;

  const code = button.dataset.code;

  if (state.selectedModels.includes(code)) {
    // Deselect
    state.selectedModels = state.selectedModels.filter(c => c !== code);
    button.classList.remove('selected');
  } else {
    // Select
    state.selectedModels.push(code);
    button.classList.add('selected');
  }

  updateSelectedCount();
};

// Handle generate button click
const handleGenerate = async () => {
  if (!state.customG_0) {
    showStatus('Please retrieve profile first', 'error');
    return;
  }

  if (state.selectedModels.length === 0) {
    showStatus('Please select at least one model', 'error');
    return;
  }

  if (!state.mapping) {
    showStatus('Mapping not loaded', 'error');
    return;
  }

  state.isGenerating = true;
  updateSelectedCount();

  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.innerHTML = '<span class="loading"></span> Generating...';
  }

  // Build synthetic row for processing
  const syntheticRow = {
    productCode: 'sidebar-generated',
    uploaded_mockup: window.location.href,
    Tags: [...state.selectedModels]
  };

  // Send to background script
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startRun',
      payload: {
        rows: [syntheticRow],
        mapping: state.mapping
      }
    });

    if (response?.ok) {
      showStatus(`Started processing ${state.selectedModels.length} mockup(s)`, 'success');

      // Clear selections
      state.selectedModels = [];
      document.querySelectorAll('.model-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
      });
    } else {
      showStatus('Failed to start: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  } finally {
    state.isGenerating = false;
    if (generateBtn) {
      generateBtn.innerHTML = '🚀 Generate <span class="count" id="selected-count">0</span>';
    }
    updateSelectedCount();
  }
};

// Handle sidebar toggle
const handleToggle = () => {
  const sidebar = document.getElementById('placeit-helper-sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const toggleIcon = toggle.querySelector('.toggle-icon');
  const title = sidebar.querySelector('.sidebar-title');

  if (sidebar.classList.contains('collapsed')) {
    // Expand sidebar
    sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
    if (toggleIcon) toggleIcon.textContent = '←';
    toggle.setAttribute('title', 'Collapse sidebar');
    if (title) title.style.display = 'block';
  } else {
    // Collapse sidebar
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    if (toggleIcon) toggleIcon.textContent = '→';
    toggle.setAttribute('title', 'Expand sidebar');
    if (title) title.style.display = 'none';
  }
};

// Initialize sidebar
const initializeSidebar = async () => {
  // Check if sidebar already exists
  if (document.getElementById('placeit-helper-sidebar')) {
    return;
  }

  // Load mapping
  state.mapping = await loadMapping();
  if (!state.mapping) {
    console.error('Failed to load mapping configuration');
    return;
  }

  // Categorize models
  const { front, back } = categorizeModels(state.mapping);

  // Create and inject sidebar
  const sidebarHTML = createSidebarHTML(front, back);
  const container = document.createElement('div');
  container.innerHTML = sidebarHTML;
  document.body.appendChild(container.firstElementChild);

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content.css');
  document.head.appendChild(link);

  // Apply Theme
  chrome.storage.local.get(['isDarkTheme'], (result) => {
    const isDark = result.isDarkTheme !== undefined ? result.isDarkTheme : true;
    const sidebarElement = document.getElementById('placeit-helper-sidebar');
    if (sidebarElement && !isDark) {
      sidebarElement.classList.add('light-theme');
    }
  });

  // Listen for storage changes to update theme live
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isDarkTheme !== undefined) {
      const isDark = changes.isDarkTheme.newValue;
      const sidebarElement = document.getElementById('placeit-helper-sidebar');
      if (sidebarElement) {
        if (isDark) {
          sidebarElement.classList.remove('light-theme');
        } else {
          sidebarElement.classList.add('light-theme');
        }
      }
    }
  });

  // Add body class to enable push layout
  document.body.classList.add('placeit-helper-active');

  // Attach event listeners
  const retrieveBtn = document.getElementById('retrieve-profile-btn');
  const generateBtn = document.getElementById('generate-btn');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const frontTab = document.getElementById('front-tab');
  const backTab = document.getElementById('back-tab');
  const tabs = document.querySelectorAll('.tab');

  if (retrieveBtn) {
    retrieveBtn.addEventListener('click', handleRetrieveProfile);
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerate);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggle);
  }

  // Add click listeners for model buttons in both tabs
  if (frontTab) {
    frontTab.addEventListener('click', handleModelClick);
  }

  if (backTab) {
    backTab.addEventListener('click', handleModelClick);
  }

  // Handle tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      state.activeTab = tabName;

      // Update active tab button
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });

  console.log('PlaceIt Helper sidebar initialized');
};

// Main execution
if (isPlaceitMockupPage()) {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebar);
  } else {
    initializeSidebar();
  }
}