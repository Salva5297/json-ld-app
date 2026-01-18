/**
 * SHACL Generator Service
 * Generates SHACL shapes from JSON-LD documents
 */

import jsonld from 'jsonld';

/**
 * Common XSD datatypes mapping
 */
const XSD_TYPES = {
  string: 'xsd:string',
  number: 'xsd:decimal',
  integer: 'xsd:integer',
  boolean: 'xsd:boolean',
  date: 'xsd:date',
  dateTime: 'xsd:dateTime'
};

/**
 * Detect the datatype of a value
 */
function detectDatatype(value) {
  if (typeof value === 'boolean') return 'xsd:boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'xsd:integer' : 'xsd:decimal';
  }
  if (typeof value === 'string') {
    // Check for date patterns
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'xsd:dateTime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'xsd:date';
    // Check for URI
    if (/^https?:\/\//.test(value)) return '@id';
    return 'xsd:string';
  }
  return null;
}

/**
 * Shorten a URI using common prefixes
 */
function shortenUri(uri, prefixes) {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (uri.startsWith(namespace)) {
      return `${prefix}:${uri.slice(namespace.length)}`;
    }
  }
  return `<${uri}>`;
}

/**
 * Extract prefixes from context
 */
function extractPrefixes(context) {
  const prefixes = {
    'sh': 'http://www.w3.org/ns/shacl#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
  };
  
  // Handle array of contexts (merge all into one)
  if (Array.isArray(context)) {
    for (const ctx of context) {
      const extracted = extractPrefixes(ctx);
      Object.assign(prefixes, extracted);
    }
    return prefixes;
  }
  
  if (typeof context === 'string') {
    // Common context URLs
    if (context === 'https://schema.org' || context === 'http://schema.org') {
      prefixes['schema'] = 'https://schema.org/';
    }
  } else if (context !== null && typeof context === 'object') {
    for (const [key, value] of Object.entries(context)) {
      if (key.startsWith('@')) continue;
      
      // Ensure value is a string before calling string methods
      if (typeof value === 'string') {
        if (value.endsWith('/') || value.endsWith('#')) {
          prefixes[key] = value;
        } else if (value.startsWith('http://') || value.startsWith('https://')) {
          // Extract namespace from property IRI
          const namespace = value.substring(0, value.lastIndexOf('/') + 1) || 
                           value.substring(0, value.lastIndexOf('#') + 1);
          if (namespace) {
            // Try to infer prefix from namespace
            const lastPart = namespace.replace(/[/#]$/, '').split('/').pop();
            if (lastPart && !prefixes[lastPart]) {
              prefixes[lastPart] = namespace;
            }
          }
        }
      }
    }
  }
  
  return prefixes;
}

/**
 * Analyze a JSON-LD document and extract property information
 */
async function analyzeDocument(doc) {
  const properties = new Map();
  const types = new Set();
  
  // Expand the document to get full IRIs
  let expanded;
  try {
    expanded = await jsonld.expand(doc);
  } catch (e) {
    // If expansion fails, analyze the document as-is
    expanded = Array.isArray(doc) ? doc : [doc];
  }
  
  function analyzeNode(node, parentType = null) {
    if (Array.isArray(node)) {
      node.forEach(n => analyzeNode(n, parentType));
      return;
    }
    
    if (typeof node !== 'object' || node === null) return;
    
    // Get type
    const nodeType = node['@type'] || node['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'];
    if (nodeType) {
      const typeValue = Array.isArray(nodeType) ? nodeType[0] : nodeType;
      const typeName = typeof typeValue === 'object' ? typeValue['@id'] : typeValue;
      if (typeName) types.add(typeName);
    }
    
    // Analyze properties
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@')) continue;
      
      const propInfo = {
        path: key,
        count: 1,
        types: new Set(),
        isArray: Array.isArray(value),
        isRequired: true,
        nodeKind: null
      };
      
      // Determine property characteristics
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (typeof v === 'object' && v !== null) {
          if (v['@id']) {
            propInfo.nodeKind = 'sh:IRI';
            propInfo.types.add('@id');
          } else if (v['@value']) {
            const dtype = detectDatatype(v['@value']);
            if (dtype) propInfo.types.add(dtype);
          } else {
            // Nested object
            propInfo.nodeKind = 'sh:BlankNodeOrIRI';
            analyzeNode(v);
          }
        } else {
          const dtype = detectDatatype(v);
          if (dtype) propInfo.types.add(dtype);
          if (dtype === '@id') {
            propInfo.nodeKind = 'sh:IRI';
          }
        }
      }
      
      // Merge with existing property info
      if (properties.has(key)) {
        const existing = properties.get(key);
        existing.count++;
        propInfo.types.forEach(t => existing.types.add(t));
        if (propInfo.nodeKind) existing.nodeKind = propInfo.nodeKind;
      } else {
        properties.set(key, propInfo);
      }
    }
  }
  
  for (const node of expanded) {
    analyzeNode(node);
  }
  
  return { properties, types };
}

/**
 * Generate a valid SHACL shape name from a class name
 * @param {string} targetClass - The target class (prefixed or full URI)
 * @param {object} prefixes - Available prefixes
 * @returns {string} A valid Turtle shape name
 */
function generateShapeName(targetClass, prefixes) {
  if (!targetClass) {
    return 'ex:GeneratedShape';
  }
  
  // If it's a full URI wrapped in <>
  if (targetClass.startsWith('<') && targetClass.endsWith('>')) {
    const uri = targetClass.slice(1, -1);
    // Extract local name from URI
    let localName = uri.split('/').pop() || uri.split('#').pop() || 'Thing';
    // Clean up the local name to be a valid identifier
    localName = localName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!localName) localName = 'Thing';
    return `ex:${localName}Shape`;
  }
  
  // If it's a prefixed name (e.g., schema:Person)
  if (targetClass.includes(':')) {
    const [prefix, localName] = targetClass.split(':');
    // Check if the prefix exists
    if (prefixes[prefix]) {
      // Clean up local name
      const cleanName = localName.replace(/[^a-zA-Z0-9_-]/g, '');
      return `${prefix}:${cleanName}Shape`;
    } else {
      // Use ex: prefix for unknown prefixes
      const cleanName = localName.replace(/[^a-zA-Z0-9_-]/g, '');
      return `ex:${cleanName}Shape`;
    }
  }
  
  // Plain name without prefix
  const cleanName = targetClass.replace(/[^a-zA-Z0-9_-]/g, '');
  return `ex:${cleanName || 'Generated'}Shape`;
}

/**
 * Generate SHACL shapes from a JSON-LD document
 * @param {object} jsonldDoc - The JSON-LD document to analyze
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateFromJsonLd(jsonldDoc) {
  try {
    const context = jsonldDoc['@context'] || {};
    const prefixes = extractPrefixes(context);
    
    // Ensure we have an 'ex' prefix for generated shapes
    if (!prefixes['ex']) {
      prefixes['ex'] = 'https://example.org/shapes#';
    }
    
    const { properties, types } = await analyzeDocument(jsonldDoc);
    
    // Build Turtle output
    const lines = [];
    
    // Add prefixes
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      lines.push(`@prefix ${prefix}: <${namespace}> .`);
    }
    lines.push('');
    
    // Determine shape target
    const docType = jsonldDoc['@type'];
    let targetClass = null;
    
    if (docType) {
      const typeName = Array.isArray(docType) ? docType[0] : docType;
      if (typeName.includes(':')) {
        targetClass = typeName;
      } else if (typeof context === 'string' && context.includes('schema.org')) {
        targetClass = `schema:${typeName}`;
        if (!prefixes['schema']) {
          lines.unshift('@prefix schema: <https://schema.org/> .');
          prefixes['schema'] = 'https://schema.org/';
        }
      } else if (Array.isArray(context)) {
        // For array contexts, try to find a suitable prefix or use ex:
        targetClass = `ex:${typeName}`;
      } else if (context && typeof context === 'object' && context['@vocab']) {
        const vocab = context['@vocab'];
        // Find or create prefix for vocab
        let vocabPrefix = null;
        for (const [prefix, ns] of Object.entries(prefixes)) {
          if (ns === vocab) {
            vocabPrefix = prefix;
            break;
          }
        }
        if (!vocabPrefix) {
          vocabPrefix = 'ex';
          if (!lines.some(l => l.includes('@prefix ex:'))) {
            lines.unshift(`@prefix ex: <${vocab}> .`);
          }
          prefixes['ex'] = vocab;
        }
        targetClass = `${vocabPrefix}:${typeName}`;
      } else {
        // Use ex: prefix for plain type names
        targetClass = `ex:${typeName}`;
      }
    }
    
    // Generate a valid shape name
    const shapeName = generateShapeName(targetClass, prefixes);
    
    lines.push(`# Generated SHACL Shape`);
    lines.push(`# Based on analyzed JSON-LD document structure`);
    lines.push('');
    
    if (targetClass) {
      lines.push(`${shapeName} a sh:NodeShape ;`);
      lines.push(`    sh:targetClass ${targetClass} ;`);
    } else {
      lines.push(`${shapeName} a sh:NodeShape ;`);
    }
    
    // Add property shapes
    const propEntries = Array.from(properties.entries());
    propEntries.forEach(([path, info], index) => {
      const isLast = index === propEntries.length - 1;
      const terminator = isLast ? ' .' : ' ;';
      
      lines.push(`    sh:property [`);
      
      // Determine path - ensure valid Turtle syntax
      let shapePath = path;
      if (path.startsWith('http://') || path.startsWith('https://')) {
        shapePath = shortenUri(path, prefixes);
        lines.push(`        sh:path ${shapePath} ;`);
      } else if (path.includes(':')) {
        // Already prefixed
        lines.push(`        sh:path ${path} ;`);
      } else {
        // Try to resolve from context (handle both object and array contexts)
        let ctxValue = null;
        if (Array.isArray(context)) {
          // Search through array contexts for the property
          for (const ctx of context) {
            if (ctx && typeof ctx === 'object' && ctx[path]) {
              ctxValue = ctx[path];
              break;
            }
          }
        } else if (context && typeof context === 'object' && !Array.isArray(context)) {
          ctxValue = context[path];
        }
        
        if (ctxValue && typeof ctxValue === 'string') {
          const shortPath = shortenUri(ctxValue, prefixes);
          lines.push(`        sh:path ${shortPath} ;`);
        } else if (targetClass && targetClass.includes(':')) {
          const prefix = targetClass.split(':')[0];
          // Ensure the property name is a valid local name
          const cleanPath = path.replace(/[^a-zA-Z0-9_-]/g, '') || 'property';
          lines.push(`        sh:path ${prefix}:${cleanPath} ;`);
        } else {
          // Use ex: prefix for unknown properties
          const cleanPath = path.replace(/[^a-zA-Z0-9_-]/g, '') || 'property';
          lines.push(`        sh:path ex:${cleanPath} ;`);
        }
      }
      
      // Add constraints based on analysis
      lines.push(`        sh:minCount 1 ;`);
      
      // Add datatype or nodeKind
      if (info.nodeKind) {
        lines.push(`        sh:nodeKind ${info.nodeKind} ;`);
      } else if (info.types.size === 1) {
        const dtype = Array.from(info.types)[0];
        if (dtype && dtype !== '@id') {
          lines.push(`        sh:datatype ${dtype} ;`);
        }
      }
      
      lines.push(`        sh:message "Property ${path} is required" ;`);
      lines.push(`    ]${terminator}`);
    });
    
    // If no properties, close the shape
    if (propEntries.length === 0) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(' ;', ' .');
    }
    
    return { success: true, data: lines.join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate a basic SHACL template for a given type
 */
export function generateTemplate(typeName, namespace = 'https://example.org/') {
  return `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <${namespace}> .

ex:${typeName}Shape a sh:NodeShape ;
    sh:targetClass ex:${typeName} ;
    sh:property [
        sh:path ex:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Must have a name" ;
    ] ;
    sh:property [
        sh:path ex:description ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
    ] .
`;
}

export default {
  generateFromJsonLd,
  generateTemplate
};
