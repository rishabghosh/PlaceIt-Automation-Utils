/**
 * utils.js
 * URL manipulation utilities for query parameters
 */

const extractQueryParam = (url, key) => {
  try {
    const urlObject = new URL(url);
    return urlObject.searchParams.get(key);
  } catch (e) {
    return null;
  }
};

const addOrReplaceParam = (url, key, value) => {
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

export { extractQueryParam, addOrReplaceParam };