const {
  VITE_MAPPING_FILE_PATH,
  VITE_OPEN_INTERVAL_MS,
  VITE_WAIT_BEFORE_CLICK_MS,
  VITE_RETRY_ATTEMPTS,
  VITE_TIMEOUT_MS,
  VITE_POST_CLICK_WAIT_MS,
  VITE_SKIP_IF_NO_BUTTON,
  VITE_TAB_CHECK_INTERVAL_MS,
  VITE_BUTTON_WAIT_TIMEOUT_MS,
  VITE_MODAL_WAIT_MS
} = import.meta.env;

export const MAPPING_FILE_PATH = VITE_MAPPING_FILE_PATH;

export const DEFAULT_CONFIG = {
  open_interval_ms: parseInt(VITE_OPEN_INTERVAL_MS),
  wait_before_click_ms: parseInt(VITE_WAIT_BEFORE_CLICK_MS),
  retry_attempts: parseInt(VITE_RETRY_ATTEMPTS),
  timeout_ms: parseInt(VITE_TIMEOUT_MS),
  post_click_wait_ms: parseInt(VITE_POST_CLICK_WAIT_MS),
  skip_if_no_button: VITE_SKIP_IF_NO_BUTTON === 'true'
};

export const TAB_CHECK_INTERVAL_MS = parseInt(VITE_TAB_CHECK_INTERVAL_MS);

export const BUTTON_WAIT_TIMEOUT_MS = parseInt(VITE_BUTTON_WAIT_TIMEOUT_MS);
export const MODAL_WAIT_MS = parseInt(VITE_MODAL_WAIT_MS);