/**
 * Tests for Documentation Generator Service
 */

import { describe, it, expect } from 'vitest';
import documentationGenerator from '../src/services/DocumentationGenerator.js';

describe('DocumentationGenerator', () => {
  describe('generateDocumentation', () => {
    it('should generate HTML documentation from JSON-LD', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "https://example.org/person/john",
        "name": "John Doe",
        "email": "john@example.org",
        "jobTitle": "Software Engineer"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('<!DOCTYPE html>');
      expect(result.data).toContain('John Doe');
      expect(result.data).toContain('Person');
    });
    
    it('should include table of contents', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Org"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('Table of Contents');
      expect(result.data).toContain('Namespaces');
    });
    
    it('should include prefix table', async () => {
      const doc = {
        "@context": {
          "schema": "https://schema.org/",
          "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "@type": "schema:Person",
        "foaf:name": "John"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('schema');
      expect(result.data).toContain('foaf');
    });
    
    it('should handle dark theme option', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Thing",
        "name": "Test"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc, { theme: 'dark' });
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('#1a1a2e'); // Dark theme color
    });
    
    it('should include properties table for entities', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Widget",
        "price": 29.99,
        "available": true
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('Properties');
      expect(result.data).toContain('name');
      expect(result.data).toContain('price');
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
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('address');
    });
    
    it('should handle arrays', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John",
        "sameAs": [
          "https://twitter.com/john",
          "https://linkedin.com/in/john"
        ]
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('sameAs');
      expect(result.data).toContain('[2]'); // Array cardinality
    });
    
    it('should return error for invalid input', async () => {
      const result = await documentationGenerator.generateDocumentation(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('generateMarkdownDocumentation', () => {
    it('should generate Markdown documentation', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John Doe"
      };
      
      const result = await documentationGenerator.generateMarkdownDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('# ');
      expect(result.data).toContain('## ');
      expect(result.data).toContain('John Doe');
    });
    
    it('should include markdown tables', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Org",
        "url": "https://example.org"
      };
      
      const result = await documentationGenerator.generateMarkdownDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('| Property |');
      expect(result.data).toContain('|--------|');
    });
    
    it('should include prefix table', async () => {
      const doc = {
        "@context": {
          "dc": "http://purl.org/dc/elements/1.1/"
        },
        "dc:title": "Test"
      };
      
      const result = await documentationGenerator.generateMarkdownDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('| Prefix | Namespace URI |');
    });
    
    it('should handle complex documents', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Test Article",
        "author": {
          "@type": "Person",
          "name": "John"
        },
        "datePublished": "2024-01-15"
      };
      
      const result = await documentationGenerator.generateMarkdownDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('Article');
      expect(result.data).toContain('headline');
      expect(result.data).toContain('author');
    });
  });
  
  describe('generatePdfDocumentation', () => {
    it('should generate PDF-ready HTML documentation', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John Doe"
      };
      
      const result = await documentationGenerator.generatePdfDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('<!DOCTYPE html>');
      expect(result.data).toContain('@media print');
      expect(result.data).toContain('@page');
    });
    
    it('should include print-specific styles', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Test"
      };
      
      const result = await documentationGenerator.generatePdfDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('page-break');
      expect(result.data).toContain('print-color-adjust');
    });
    
    it('should use light theme for PDF', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Thing",
        "name": "Test"
      };
      
      const result = await documentationGenerator.generatePdfDocumentation(doc, { theme: 'dark' });
      
      expect(result.success).toBe(true);
      // PDF should always use light theme regardless of option
      expect(result.data).toContain('#ffffff'); // Light background color
    });
  });
  
  describe('generateMermaidDiagramsOnly', () => {
    it('should generate Mermaid diagrams from JSON-LD', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John Doe",
        "email": "john@example.org"
      };
      
      const result = await documentationGenerator.generateMermaidDiagramsOnly(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('classDiagram');
      expect(result.data).toHaveProperty('flowchart');
      expect(result.data).toHaveProperty('erDiagram');
    });
    
    it('should generate valid class diagram syntax', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Org",
        "url": "https://example.org"
      };
      
      const result = await documentationGenerator.generateMermaidDiagramsOnly(doc);
      
      expect(result.success).toBe(true);
      expect(result.data.classDiagram).toContain('classDiagram');
      expect(result.data.classDiagram).toContain('class ');
    });
    
    it('should generate valid RDF graph (flowchart) syntax', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Widget"
      };
      
      const result = await documentationGenerator.generateMermaidDiagramsOnly(doc);
      
      expect(result.success).toBe(true);
      expect(result.data.flowchart).toContain('flowchart');
      expect(result.data.rdfGraph).toContain('flowchart');
    });
    
    it('should generate valid ER diagram syntax', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Conference"
      };
      
      const result = await documentationGenerator.generateMermaidDiagramsOnly(doc);
      
      expect(result.success).toBe(true);
      expect(result.data.erDiagram).toContain('erDiagram');
    });
    
    it('should handle complex documents with relationships', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Test Article",
        "author": {
          "@type": "Person",
          "name": "John"
        },
        "publisher": {
          "@type": "Organization",
          "name": "News Corp"
        }
      };
      
      const result = await documentationGenerator.generateMermaidDiagramsOnly(doc);
      
      expect(result.success).toBe(true);
      expect(result.data.classDiagram).toBeDefined();
      expect(result.data.flowchart).toBeDefined();
    });
    
    it('should return error for invalid input', async () => {
      const result = await documentationGenerator.generateMermaidDiagramsOnly(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('Mermaid diagrams in documentation', () => {
    it('should include Mermaid diagrams in HTML documentation', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "John"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('mermaid');
      expect(result.data).toContain('flowchart');
      expect(result.data).toContain('Document Overview');
    });
    
    it('should include Mermaid diagrams in Markdown documentation', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Org"
      };
      
      const result = await documentationGenerator.generateMarkdownDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('```mermaid');
      expect(result.data).toContain('flowchart');
    });
    
    it('should include Mermaid.js script in HTML', async () => {
      const doc = {
        "@context": "https://schema.org",
        "@type": "Thing",
        "name": "Test"
      };
      
      const result = await documentationGenerator.generateDocumentation(doc);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('cdn.jsdelivr.net/npm/mermaid');
      expect(result.data).toContain('mermaid.initialize');
    });
  });
});
