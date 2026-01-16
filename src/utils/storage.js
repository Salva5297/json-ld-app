/**
 * Storage Utilities
 * Handles localStorage operations for saving/loading documents
 */

const STORAGE_KEYS = {
  JSONLD: 'jsonld-builder-document',
  SHACL: 'jsonld-builder-shacl',
  FRAME: 'jsonld-builder-frame',
  PREFERENCES: 'jsonld-builder-preferences',
  RECENT: 'jsonld-builder-recent'
};

/**
 * Save JSON-LD document to localStorage
 */
export function saveJsonLd(doc) {
  try {
    localStorage.setItem(STORAGE_KEYS.JSONLD, JSON.stringify(doc, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save JSON-LD:', e);
    return false;
  }
}

/**
 * Load JSON-LD document from localStorage
 */
export function loadJsonLd() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JSONLD);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load JSON-LD:', e);
    return null;
  }
}

/**
 * Save SHACL shapes to localStorage
 */
export function saveShacl(shacl) {
  try {
    localStorage.setItem(STORAGE_KEYS.SHACL, shacl);
    return true;
  } catch (e) {
    console.error('Failed to save SHACL:', e);
    return false;
  }
}

/**
 * Load SHACL shapes from localStorage
 */
export function loadShacl() {
  try {
    return localStorage.getItem(STORAGE_KEYS.SHACL);
  } catch (e) {
    console.error('Failed to load SHACL:', e);
    return null;
  }
}

/**
 * Save frame document to localStorage
 */
export function saveFrame(frame) {
  try {
    localStorage.setItem(STORAGE_KEYS.FRAME, JSON.stringify(frame, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save frame:', e);
    return false;
  }
}

/**
 * Load frame document from localStorage
 */
export function loadFrame() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FRAME);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load frame:', e);
    return null;
  }
}

/**
 * Save user preferences
 */
export function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
    return true;
  } catch (e) {
    console.error('Failed to save preferences:', e);
    return false;
  }
}

/**
 * Load user preferences
 */
export function loadPreferences() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return data ? JSON.parse(data) : getDefaultPreferences();
  } catch (e) {
    console.error('Failed to load preferences:', e);
    return getDefaultPreferences();
  }
}

/**
 * Get default preferences
 */
export function getDefaultPreferences() {
  return {
    theme: 'dark',
    autoProcess: true,
    fontSize: 14,
    activeView: 'expanded'
  };
}

/**
 * Add to recent documents
 */
export function addToRecent(name, doc, shacl = null) {
  try {
    const recent = loadRecent();
    const entry = {
      name,
      doc,
      shacl,
      timestamp: Date.now()
    };
    
    // Remove duplicate if exists
    const filtered = recent.filter(r => r.name !== name);
    
    // Add to front and limit to 10
    filtered.unshift(entry);
    const limited = filtered.slice(0, 10);
    
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(limited));
    return true;
  } catch (e) {
    console.error('Failed to add to recent:', e);
    return false;
  }
}

/**
 * Load recent documents
 */
export function loadRecent() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load recent:', e);
    return [];
  }
}

/**
 * Clear all storage
 */
export function clearStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (e) {
    console.error('Failed to clear storage:', e);
    return false;
  }
}

/**
 * Export document as file download
 */
export function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import file and read content
 */
export function importFile(accept = '.json,.jsonld') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve({
          name: file.name,
          content: event.target.result
        });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    
    input.click();
  });
}

export default {
  saveJsonLd,
  loadJsonLd,
  saveShacl,
  loadShacl,
  saveFrame,
  loadFrame,
  savePreferences,
  loadPreferences,
  addToRecent,
  loadRecent,
  clearStorage,
  downloadFile,
  importFile
};
