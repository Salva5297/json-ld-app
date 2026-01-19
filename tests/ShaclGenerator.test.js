/**
 * Tests for SHACL Generator Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import shaclGenerator from '../src/services/ShaclGenerator.js';

describe('ShaclGenerator', () => {
  describe('generateFromJsonLd', () => {
    it('should generate SHACL shapes from a simple Schema.org Person', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "https://example.org/person/john",
        "name": "John Doe",
        "email": "john@example.org"
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sh:NodeShape');
      expect(result.data).toContain('sh:targetClass');
      expect(result.data).toContain('sh:property');
    });
    
    it('should handle documents with array context', async () => {
      const doc = {
        "@context": [
          "https://www.w3.org/2019/wot/td/v1",
          {
            "sdt": "urn:sdt:"
          }
        ],
        "@type": "SDT",
        "title": "Test Thing"
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sh:NodeShape');
      // Should not contain invalid syntax like <SDT>Shape
      expect(result.data).not.toMatch(/<\w+>Shape/);
    });
    
    it('should generate valid Turtle syntax for shape names', async () => {
      const doc = {
        "@context": {
          "dcterms": "http://purl.org/dc/terms/"
        },
        "@type": "dcterms:Text",
        "dcterms:title": "Test Document"
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      // Shape name should be properly prefixed
      expect(result.data).toMatch(/\w+:\w+Shape/);
    });
    
    it('should handle documents without @type', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@id": "https://example.org/thing",
        "name": "Something"
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sh:NodeShape');
    });
    
    it('should include sh:minCount for properties', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Org"
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sh:minCount');
    });
    
    it('should handle nested objects', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "San Francisco"
        }
      };
      
      const result = await shaclGenerator.generateFromJsonLd(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sh:property');
    });
    
    it('should return error for invalid input', async () => {
      const result = await shaclGenerator.generateFromJsonLd(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('generateTemplate', () => {
    it('should generate a basic SHACL template', () => {
      const template = shaclGenerator.generateTemplate('Person');
      
      expect(template).toContain('@prefix sh:');
      expect(template).toContain('ex:PersonShape');
      expect(template).toContain('sh:targetClass ex:Person');
    });
    
    it('should use custom namespace', () => {
      const template = shaclGenerator.generateTemplate('Product', 'https://myapp.org/');
      
      expect(template).toContain('https://myapp.org/');
    });
  });
});
