// utility functions (if needed)
function extractQueryParam(url, key) {
  try {
    const u = new URL(url);
    return u.searchParams.get(key);
  } catch(e) {
    return null;
  }
}
function addOrReplaceParam(url, key, value) {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch(e) {
    // fallback
    if(url.indexOf('?') === -1) return url + '?' + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    return url + '&' + encodeURIComponent(key) + '=' + encodeURIComponent(value);
  }
}
module.exports = { extractQueryParam, addOrReplaceParam };
