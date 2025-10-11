// PlaceIt Helper Sidebar Content Script
// Injects sidebar on PlaceIt mockup editor pages

const MAPPING_FILE_PATH = 'src/mapping_sample.json';

const state = {
  customG_0: null,
  selectedModels: [],
  mapping: null,
  isGenerating: false
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

// Categorize model codes
const categorizeModels = (mapping) => {
  const categories = {
    'Oversized Male': [],
    'Regular Male': [],
    'Oversized Female': [],
    'Regular Female': []
  };

  Object.keys(mapping).forEach(code => {
    if (code.startsWith('OM-')) {
      categories['Oversized Male'].push(code);
    } else if (code.startsWith('RM-')) {
      categories['Regular Male'].push(code);
    } else if (code.startsWith('OF-')) {
      categories['Oversized Female'].push(code);
    } else if (code.startsWith('RF-')) {
      categories['Regular Female'].push(code);
    }
  });

  return categories;
};

// Create sidebar HTML
const createSidebarHTML = (categories) => {
  const categoriesHTML = Object.entries(categories)
    .map(([categoryName, codes]) => {
      if (codes.length === 0) return '';

      const buttonsHTML = codes
        .map(code => `<button class="model-btn" data-code="${code}">${code}</button>`)
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

  return `
    <div id="placeit-helper-sidebar">
      <div class="sidebar-header">
        <h3>PlaceIt Helper</h3>
        <button class="sidebar-toggle" id="sidebar-toggle">→</button>
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

        <div id="model-categories">
          ${categoriesHTML}
        </div>

        ${categoriesHTML === '' ? `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-text">No models found in mapping</div>
          </div>
        ` : ''}
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

  if (sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
    toggle.textContent = '→';
  } else {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    toggle.textContent = '←';
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
  const categories = categorizeModels(state.mapping);

  // Create and inject sidebar
  const sidebarHTML = createSidebarHTML(categories);
  const container = document.createElement('div');
  container.innerHTML = sidebarHTML;
  document.body.appendChild(container.firstElementChild);

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content.css');
  document.head.appendChild(link);

  // Add body class to enable push layout
  document.body.classList.add('placeit-helper-active');

  // Attach event listeners
  const retrieveBtn = document.getElementById('retrieve-profile-btn');
  const generateBtn = document.getElementById('generate-btn');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const modelCategories = document.getElementById('model-categories');

  if (retrieveBtn) {
    retrieveBtn.addEventListener('click', handleRetrieveProfile);
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerate);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggle);
  }

  if (modelCategories) {
    modelCategories.addEventListener('click', handleModelClick);
  }

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