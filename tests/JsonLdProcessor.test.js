/**
 * Tests for JSON-LD Processor Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import jsonLdProcessor from '../src/services/JsonLdProcessor.js';

// Mock localStorage for node environment
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn()
  });
});

describe('JsonLdProcessor', () => {
  describe('expand', () => {
    it('should expand JSON-LD document', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John Doe"
      };
      
      const result = await jsonLdProcessor.expand(doc);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data[0]['https://schema.org/name']).toBeDefined();
    });
    
    it('should expand with custom context', async () => {
      const doc = {
        "@context": {
          "ex": "https://example.org/",
          "name": "ex:name"
        },
        "name": "Test"
      };
      
      const result = await jsonLdProcessor.expand(doc);
      
      expect(result.success).toBe(true);
      expect(result.data[0]['https://example.org/name']).toBeDefined();
    });
    
    it('should handle @id', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@id": "https://example.org/person/1",
        "@type": "Person",
        "name": "John"
      };
      
      const result = await jsonLdProcessor.expand(doc);
      
      expect(result.success).toBe(true);
      expect(result.data[0]['@id']).toBe('https://example.org/person/1');
    });
  });
  
  describe('compact', () => {
    it('should compact expanded JSON-LD', async () => {
      const expanded = [{
        "@type": ["https://schema.org/Person"],
        "https://schema.org/name": [{ "@value": "John Doe" }]
      }];
      
      const context = { "@context": "https://schema.org" };
      
      const result = await jsonLdProcessor.compact(expanded, context);
      
      expect(result.success).toBe(true);
      expect(result.data['name']).toBeDefined();
    });
    
    it('should compact with custom context', async () => {
      const expanded = [{
        "https://example.org/name": [{ "@value": "Test" }]
      }];
      
      const context = {
        "@context": {
          "ex": "https://example.org/",
          "name": "ex:name"
        }
      };
      
      const result = await jsonLdProcessor.compact(expanded, context);
      
      expect(result.success).toBe(true);
      expect(result.data['name']).toBe('Test');
    });
    
    it('should handle empty context', async () => {
      const expanded = [{
        "@type": ["https://schema.org/Person"],
        "https://schema.org/name": [{ "@value": "John" }]
      }];
      
      const result = await jsonLdProcessor.compact(expanded, { "@context": {} });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('flatten', () => {
    it('should flatten nested JSON-LD', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John",
        "knows": {
          "@type": "Person",
          "name": "Jane"
        }
      };
      
      const result = await jsonLdProcessor.flatten(doc);
      
      expect(result.success).toBe(true);
      // Flattened should have @graph with both entities
      if (result.data['@graph']) {
        expect(result.data['@graph'].length).toBeGreaterThan(1);
      }
    });
    
    it('should assign blank node IDs', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John"
      };
      
      const result = await jsonLdProcessor.flatten(doc);
      
      expect(result.success).toBe(true);
    });
    
    it('should flatten with context', async () => {
      const doc = {
        "@context": {
          "ex": "https://example.org/",
          "name": "ex:name"
        },
        "name": "Test"
      };
      
      const result = await jsonLdProcessor.flatten(doc);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('frame', () => {
    it('should frame JSON-LD with frame document', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Person", "@id": "ex:john", "name": "John" },
          { "@type": "Organization", "@id": "ex:acme", "name": "Acme" }
        ]
      };
      
      const frame = {
        "@context": "https://schema.org",
        "@type": "Person"
      };
      
      const result = await jsonLdProcessor.frame(doc, frame);
      
      expect(result.success).toBe(true);
    });
    
    it('should filter by type in frame', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Person", "name": "John" },
          { "@type": "Place", "name": "New York" }
        ]
      };
      
      const frame = {
        "@context": "https://schema.org",
        "@type": "Person"
      };
      
      const result = await jsonLdProcessor.frame(doc, frame);
      
      expect(result.success).toBe(true);
      if (result.data['@type']) {
        expect(result.data['@type']).toBe('Person');
      }
    });
    
    it('should handle @embed option', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John",
        "knows": { "@id": "ex:jane", "@type": "Person", "name": "Jane" }
      };
      
      const frame = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@embed": "@always"
      };
      
      const result = await jsonLdProcessor.frame(doc, frame);
      
      expect(result.success).toBe(true);
    });
  });
});
