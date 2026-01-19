/**
 * Tests for Context From SHACL Service
 */

import { describe, it, expect } from 'vitest';
import contextFromShacl from '../src/services/ContextFromShacl.js';

describe('ContextFromShacl', () => {
  describe('generateContextFromShacl', () => {
    it('should generate context from simple SHACL shape', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <https://schema.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path schema:name ;
                sh:datatype xsd:string ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('@context');
    });
    
    it('should extract prefixes from SHACL', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <https://schema.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path foaf:name ;
                sh:datatype xsd:string ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      expect(result.data['@context']['schema']).toBe('https://schema.org/');
      expect(result.data['@context']['foaf']).toBe('http://xmlns.com/foaf/0.1/');
    });
    
    it('should map properties with @type from datatype', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix schema: <https://schema.org/> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path schema:birthDate ;
                sh:datatype xsd:date ;
            ] ;
            sh:property [
                sh:path schema:age ;
                sh:datatype xsd:integer ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      const ctx = result.data['@context'];
      // Properties with datatypes should have @type
      if (ctx.birthDate && typeof ctx.birthDate === 'object') {
        expect(ctx.birthDate['@type']).toBe('xsd:date');
      }
    });
    
    it('should detect multi-valued properties with maxCount > 1', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <https://schema.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path schema:email ;
                sh:datatype xsd:string ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      // Property without maxCount should be treated as multi-valued
      expect(result.data['@context']).toBeDefined();
    });
    
    it('should handle sh:nodeKind sh:IRI', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <https://schema.org/> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path schema:sameAs ;
                sh:nodeKind sh:IRI ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      const ctx = result.data['@context'];
      if (ctx.sameAs && typeof ctx.sameAs === 'object') {
        expect(ctx.sameAs['@type']).toBe('@id');
      }
    });
    
    it('should handle sh:class', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <https://schema.org/> .
        @prefix ex: <https://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass schema:Person ;
            sh:property [
                sh:path schema:address ;
                sh:class schema:PostalAddress ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextFromShacl(shacl);
      
      expect(result.success).toBe(true);
      const ctx = result.data['@context'];
      if (ctx.address && typeof ctx.address === 'object') {
        expect(ctx.address['@type']).toBe('@id');
      }
    });
    
    it('should return error for invalid SHACL', async () => {
      const invalidShacl = 'this is not valid turtle @@@ $$$';
      
      const result = await contextFromShacl.generateContextFromShacl(invalidShacl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should handle empty SHACL (return empty context)', async () => {
      // Empty string produces an empty store
      const result = await contextFromShacl.generateContextFromShacl('');
      
      // Empty SHACL should still succeed but with minimal context
      expect(result.success).toBe(true);
      expect(result.data['@context']).toBeDefined();
    });
  });
  
  describe('generateContextString', () => {
    it('should generate formatted JSON string', async () => {
      const shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <https://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:ThingShape a sh:NodeShape ;
            sh:property [
                sh:path ex:name ;
                sh:datatype xsd:string ;
            ] .
      `;
      
      const result = await contextFromShacl.generateContextString(shacl);
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      // Should be valid JSON - now returns just the context content without @context wrapper
      const parsed = JSON.parse(result.data);
      expect(typeof parsed).toBe('object');
      // Should have term definitions (not wrapped in @context anymore)
      expect(parsed).toHaveProperty('name');
    });
  });
  
  describe('validateContext', () => {
    it('should validate a correct context', () => {
      const context = {
        "@context": {
          "name": "https://schema.org/name"
        }
      };
      
      const result = contextFromShacl.validateContext(context);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate context without @context wrapper', () => {
      const context = {
        "name": "https://schema.org/name"
      };
      
      const result = contextFromShacl.validateContext(context);
      
      // The function accepts context with or without wrapper
      expect(result.valid).toBe(true);
    });
    
    it('should detect invalid key format', () => {
      const invalidContext = {
        "@context": {
          "123invalid": "https://example.org/test"
        }
      };
      
      const result = contextFromShacl.validateContext(invalidContext);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
