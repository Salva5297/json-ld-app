/**
 * Tests for Utility functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as storage from '../src/utils/storage.js';
import * as share from '../src/utils/share.js';

describe('Storage Utils', () => {
  const mockLocalStorage = (() => {
    let store = {};
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((i) => Object.keys(store)[i] || null)
    };
  })();

  beforeEach(() => {
    // Mock localStorage
    vi.stubGlobal('localStorage', mockLocalStorage);
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveJsonLd', () => {
    it('should save JSON-LD document to localStorage', () => {
      const doc = { "@type": "Person", "name": "John" };
      
      const result = storage.saveJsonLd(doc);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('loadJsonLd', () => {
    it('should load JSON-LD document from localStorage', () => {
      const doc = { "@type": "Person", "name": "John" };
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(doc));
      
      const result = storage.loadJsonLd();
      
      expect(result).toEqual(doc);
    });

    it('should return null for non-existent document', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);
      
      const result = storage.loadJsonLd();
      
      expect(result).toBeNull();
    });
  });

  describe('saveShacl', () => {
    it('should save SHACL shapes to localStorage', () => {
      const shacl = '@prefix sh: <http://www.w3.org/ns/shacl#> .';
      
      const result = storage.saveShacl(shacl);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('loadShacl', () => {
    it('should load SHACL shapes from localStorage', () => {
      const shacl = '@prefix sh: <http://www.w3.org/ns/shacl#> .';
      mockLocalStorage.getItem.mockReturnValueOnce(shacl);
      
      const result = storage.loadShacl();
      
      expect(result).toBe(shacl);
    });
  });

  describe('saveFrame', () => {
    it('should save frame to localStorage', () => {
      const frame = { "@type": "Person" };
      
      const result = storage.saveFrame(frame);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('loadFrame', () => {
    it('should load frame from localStorage', () => {
      const frame = { "@type": "Person" };
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(frame));
      
      const result = storage.loadFrame();
      
      expect(result).toEqual(frame);
    });
  });

  describe('savePreferences', () => {
    it('should save preferences to localStorage', () => {
      const prefs = { theme: 'dark' };
      
      const result = storage.savePreferences(prefs);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});

describe('Share Utils', () => {
  describe('encodeDocument', () => {
    it('should encode a document to base64', () => {
      const doc = { "@type": "Person", "name": "John" };
      
      const encoded = share.encodeDocument(doc);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      // Should be base64 encoded
      expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should encode string documents', () => {
      const docString = '{"@type": "Person"}';
      
      const encoded = share.encodeDocument(docString);
      
      expect(encoded).toBeDefined();
    });

    it('should handle complex documents', () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John Doe",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "San Francisco"
        }
      };
      
      const encoded = share.encodeDocument(doc);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
    });
  });

  describe('decodeDocument', () => {
    it('should decode a base64 encoded document', () => {
      const doc = { "@type": "Person", "name": "John" };
      const encoded = share.encodeDocument(doc);
      
      const result = share.decodeDocument(encoded);
      
      expect(result).toEqual(doc);
    });

    it('should return null for invalid encoded data', () => {
      const result = share.decodeDocument('!!!invalid!!!');
      
      expect(result).toBeNull();
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      vi.stubGlobal('navigator', { clipboard: mockClipboard });
      
      const result = await share.copyToClipboard('test text');
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });

    it('should handle clipboard errors', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error'))
      };
      vi.stubGlobal('navigator', { clipboard: mockClipboard });
      
      const result = await share.copyToClipboard('test text');
      
      expect(result).toBe(false);
    });
  });
});
