/**
 * Share Utilities
 * Handles permalink generation and URL parameter parsing
 */

/**
 * Compress and encode a JSON document for URL
 */
export function encodeDocument(doc) {
  try {
    const json = typeof doc === 'string' ? doc : JSON.stringify(doc);
    // Use base64 encoding for URL safety
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded;
  } catch (e) {
    console.error('Failed to encode document:', e);
    return null;
  }
}

/**
 * Decode a document from URL parameter
 */
export function decodeDocument(encoded) {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to decode document:', e);
    return null;
  }
}

/**
 * Generate a permalink with the current document state
 */
export function generatePermalink(jsonld, shacl = null, frame = null) {
  const url = new URL(window.location.href);
  url.search = ''; // Clear existing params
  
  if (jsonld) {
    const encoded = encodeDocument(jsonld);
    if (encoded) {
      // If the encoded data is too long, we can't use it in URL
      if (encoded.length > 8000) {
        return { success: false, error: 'Document too large for URL sharing' };
      }
      url.searchParams.set('doc', encoded);
    }
  }
  
  if (shacl) {
    const encoded = encodeDocument(shacl);
    if (encoded && encoded.length < 4000) {
      url.searchParams.set('shacl', encoded);
    }
  }
  
  if (frame) {
    const encoded = encodeDocument(frame);
    if (encoded && encoded.length < 2000) {
      url.searchParams.set('frame', encoded);
    }
  }
  
  return { success: true, url: url.toString() };
}

/**
 * Parse URL parameters and extract documents
 */
export function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {
    hasParams: false,
    jsonld: null,
    shacl: null,
    frame: null
  };
  
  const docParam = params.get('doc');
  if (docParam) {
    result.jsonld = decodeDocument(docParam);
    result.hasParams = true;
  }
  
  const shaclParam = params.get('shacl');
  if (shaclParam) {
    result.shacl = decodeDocument(shaclParam);
    result.hasParams = true;
  }
  
  const frameParam = params.get('frame');
  if (frameParam) {
    result.frame = decodeDocument(frameParam);
    result.hasParams = true;
  }
  
  return result;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    return false;
  }
}

/**
 * Clear URL parameters without reloading
 */
export function clearUrlParams() {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, document.title, url.toString());
}

export default {
  encodeDocument,
  decodeDocument,
  generatePermalink,
  parseUrlParams,
  copyToClipboard,
  clearUrlParams
};
