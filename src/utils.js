export const extractQueryParam = (url, key) => {
  try {
    const urlObject = new URL(url);
    return urlObject.searchParams.get(key);
  } catch (e) {
    return null;
  }
};

export const addOrReplaceParam = (url, key, value) => {
  try {
    const urlObject = new URL(url);
    urlObject.searchParams.set(key, value);
    return urlObject.toString();
  } catch (e) {
    return buildFallbackUrl(url, key, value);
  }
};

const buildFallbackUrl = (url, key, value) => {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(value);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodedKey}=${encodedValue}`;
};

// PlaceIt-specific utilities for removing images via dropdown menu
export const findDropdownButton = () => {
  // Find the button with class "btn dropdown-toggle btn-default" that contains pixel dimensions
  const buttons = document.querySelectorAll('button.btn.dropdown-toggle.btn-default');
  return Array.from(buttons).find(button => {
    try {
      const text = button.innerText?.toLowerCase();
      return text && text.includes('px'); // Look for pixel dimensions like "1200x200px"
    } catch (e) {
      return false;
    }
  }) || null;
};

export const findRemoveImageOption = () => {
  // Find the "Remove this Image" option in the dropdown menu
  const menuItems = document.querySelectorAll('a.remove-placeholder');
  return menuItems[0] || null;
};

export const clickElementSafely = (element) => {
  try {
    element.click();
    return true;
  } catch (e) {
    return false;
  }
};

export const observeForElement = (findFunction, timeoutMs = 5000) => {
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

export const removeImageViaDropdown = async (timeoutMs = 10000) => {
  try {
    // Log: Function execution started
    console.log('[removeImageViaDropdown] Function executed with timeout:', timeoutMs);

    // Step 1: Find and click the dropdown button
    console.log('[removeImageViaDropdown] Searching for dropdown button...');
    const dropdownButton = await observeForElement(findDropdownButton, timeoutMs / 2);

    if (!dropdownButton) {
      console.error('[removeImageViaDropdown] Dropdown button NOT found');
      return { success: false, message: 'dropdown_button_not_found' };
    }

    console.log('[removeImageViaDropdown] Dropdown button FOUND:', dropdownButton);
    const clickSuccess = clickElementSafely(dropdownButton);
    console.log('[removeImageViaDropdown] Dropdown button clicked:', clickSuccess);

    // Wait a bit for the dropdown menu to appear
    console.log('[removeImageViaDropdown] Waiting 300ms for dropdown menu to appear...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 2: Find and click the "Remove this Image" option
    console.log('[removeImageViaDropdown] Observing for "Remove this Image" option...');
    const removeOption = await observeForElement(findRemoveImageOption, timeoutMs / 2);

    if (!removeOption) {
      console.error('[removeImageViaDropdown] "Remove this Image" option NOT found');
      return { success: false, message: 'remove_option_not_found' };
    }

    console.log('[removeImageViaDropdown] "Remove this Image" option FOUND:', removeOption);
    const clicked = clickElementSafely(removeOption);
    console.log('[removeImageViaDropdown] "Remove this Image" option clicked:', clicked);

    if (!clicked) {
      console.error('[removeImageViaDropdown] Failed to click "Remove this Image" option');
      return { success: false, message: 'remove_option_click_failed' };
    }

    console.log('[removeImageViaDropdown] SUCCESS - Image removal initiated');
    return { success: true, message: 'image_removal_initiated' };

  } catch (e) {
    console.error('[removeImageViaDropdown] ERROR:', e?.message || 'unknown_error', e);
    return { success: false, message: e?.message || 'unknown_error' };
  }
};

// Actions mapping - maps action names to their corresponding functions
export const ACTIONS = {
  HoodieRemoveSleeve: removeImageViaDropdown
};

// Helper to get action function by name
export const getAction = (actionName) => {
  return ACTIONS[actionName] || null;
};
