/**
 * JSON-LD Processor Service
 * Handles all JSON-LD transformations using jsonld.js
 */

import jsonld from 'jsonld';

// Context registry for internal URNs - Initialize from localStorage
let contextRegistry = new Map();
try {
  const savedRegistry = localStorage.getItem('jsonld_context_registry');
  if (savedRegistry) {
    contextRegistry = new Map(JSON.parse(savedRegistry));
  }
} catch (e) {
  console.warn('Failed to load context registry:', e);
}

/**
 * Save registry to localStorage
 */
function saveRegistry() {
  try {
    localStorage.setItem('jsonld_context_registry', JSON.stringify(Array.from(contextRegistry.entries())));
  } catch (e) {
    console.warn('Failed to save context registry:', e);
  }
}

/**
 * Register a context in the internal registry
 * @param {object} context - The context object
 * @returns {string} The URN for the registered context
 */
export function registerContext(context) {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  const urn = `urn:context:${uuid}`;
  
  // Ensure we are storing a valid remote context structure
  const contextDoc = {
    '@context': context
  };
  
  contextRegistry.set(urn, contextDoc);
  saveRegistry();
  return urn;
}

/**
 * Custom document loader that handles common contexts and internal registry
 */
const customLoader = async (url) => {
  // Check internal registry
  if (url.startsWith('urn:context:') || contextRegistry.has(url)) {
    if (contextRegistry.has(url)) {
      return {
        contextUrl: null,
        document: contextRegistry.get(url),
        documentUrl: url
      };
    } else {
       // It looks like a URN but we don't have it -> 404
       throw new Error(`Context not found in registry: ${url}`);
    }
  }

  // Common contexts cache
  const contexts = {
    'https://schema.org': {
      '@context': {
        '@vocab': 'https://schema.org/',
        'name': 'https://schema.org/name',
        'description': 'https://schema.org/description',
        'url': { '@id': 'https://schema.org/url', '@type': '@id' },
        'image': { '@id': 'https://schema.org/image', '@type': '@id' },
        'email': 'https://schema.org/email',
        'telephone': 'https://schema.org/telephone',
        'address': 'https://schema.org/address',
        'dateCreated': { '@id': 'https://schema.org/dateCreated', '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
        'dateModified': { '@id': 'https://schema.org/dateModified', '@type': 'http://www.w3.org/2001/XMLSchema#dateTime' },
        'datePublished': { '@id': 'https://schema.org/datePublished', '@type': 'http://www.w3.org/2001/XMLSchema#date' },
        'author': 'https://schema.org/author',
        'publisher': 'https://schema.org/publisher',
        'headline': 'https://schema.org/headline',
        'articleBody': 'https://schema.org/articleBody',
        'keywords': 'https://schema.org/keywords',
        'sameAs': { '@id': 'https://schema.org/sameAs', '@type': '@id' }
      }
    }
  };

  if (contexts[url]) {
    return {
      contextUrl: null,
      document: contexts[url],
      documentUrl: url
    };
  }

  // Try to fetch remote context
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/ld+json, application/json'
      }
    });
    const document = await response.json();
    return {
      contextUrl: null,
      document: document,
      documentUrl: url
    };
  } catch (error) {
    console.warn(`Failed to load context from ${url}:`, error);
    // Return minimal context
    return {
      contextUrl: null,
      document: { '@context': {} },
      documentUrl: url
    };
  }
};

// Set custom document loader
jsonld.documentLoader = customLoader;

/**
 * Expand a JSON-LD document
 * Removes context, uses full IRIs
 */
export async function expand(doc) {
  try {
    const expanded = await jsonld.expand(doc);
    return { success: true, data: expanded };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Compact a JSON-LD document with a context
 */
export async function compact(doc, context = null) {
  try {
    const ctx = context || doc['@context'] || {};
    const compacted = await jsonld.compact(doc, ctx);
    return { success: true, data: compacted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Flatten a JSON-LD document
 * Creates a flat graph structure
 */
export async function flatten(doc, context = null) {
  try {
    const flattened = await jsonld.flatten(doc, context);
    return { success: true, data: flattened };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Frame a JSON-LD document
 * Reshapes the document according to a frame
 */
export async function frame(doc, frameDoc) {
  try {
    const framed = await jsonld.frame(doc, frameDoc);
    return { success: true, data: framed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Convert JSON-LD to N-Quads format
 */
export async function toNQuads(doc) {
  try {
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' });
    return { success: true, data: nquads };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Canonize (normalize) a JSON-LD document using URDNA2015
 */
export async function canonize(doc) {
  try {
    const canonized = await jsonld.canonize(doc, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads',
      safe: false
    });
    return { success: true, data: canonized };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse N-Quads into triples array
 * @param {string} nquads - N-Quads string
 * @returns {Array} Array of triple objects
 */
export function parseNQuads(nquads) {
  if (!nquads || typeof nquads !== 'string') {
    return [];
  }

  const triples = [];
  const lines = nquads.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^(<[^>]+>|_:[^\s]+)\s+(<[^>]+>)\s+(<[^>]+>|_:[^\s]+|"[^"]*"(?:\^\^<[^>]+>)?(?:@[a-z-]+)?)\s*(<[^>]+>)?\s*\.$/);
    
    if (match) {
      const [, subject, predicate, object, graph] = match;
      triples.push({
        subject: cleanTerm(subject),
        predicate: cleanTerm(predicate),
        object: cleanTerm(object),
        graph: graph ? cleanTerm(graph) : 'default'
      });
    }
  }

  return triples;
}

/**
 * Clean a term by removing angle brackets
 */
function cleanTerm(term) {
  if (!term) return '';
  if (term.startsWith('<') && term.endsWith('>')) {
    return term.slice(1, -1);
  }
  return term;
}

/**
 * Extract nodes and links for graph visualization
 * @param {Array} triples - Array of triple objects
 * @returns {Object} { nodes, links }
 */
export function extractGraphData(triples) {
  const nodeMap = new Map();
  const links = [];

  for (const triple of triples) {
    // Add subject node
    if (!nodeMap.has(triple.subject)) {
      nodeMap.set(triple.subject, {
        id: triple.subject,
        label: shortenUri(triple.subject),
        type: 'resource'
      });
    }

    // Add object node (if it's a URI or blank node)
    if (triple.object.startsWith('http') || triple.object.startsWith('_:')) {
      if (!nodeMap.has(triple.object)) {
        nodeMap.set(triple.object, {
          id: triple.object,
          label: shortenUri(triple.object),
          type: 'resource'
        });
      }
      
      // Add link
      links.push({
        source: triple.subject,
        target: triple.object,
        label: shortenUri(triple.predicate)
      });
    } else {
      // Literal value - create a node for it
      const literalId = `${triple.subject}-${triple.predicate}-literal`;
      if (!nodeMap.has(literalId)) {
        nodeMap.set(literalId, {
          id: literalId,
          label: triple.object.length > 30 ? triple.object.slice(0, 30) + '...' : triple.object,
          type: 'literal',
          value: triple.object
        });
      }
      
      links.push({
        source: triple.subject,
        target: literalId,
        label: shortenUri(triple.predicate)
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links
  };
}

/**
 * Shorten a URI for display
 */
function shortenUri(uri) {
  const prefixes = {
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
    'http://www.w3.org/2000/01/rdf-schema#': 'rdfs:',
    'http://www.w3.org/2001/XMLSchema#': 'xsd:',
    'https://schema.org/': 'schema:',
    'http://schema.org/': 'schema:',
    'http://xmlns.com/foaf/0.1/': 'foaf:',
    'http://purl.org/dc/elements/1.1/': 'dc:',
    'http://purl.org/dc/terms/': 'dcterms:',
    'http://www.w3.org/2004/02/skos/core#': 'skos:',
    'http://www.w3.org/ns/prov#': 'prov:',
    'http://rdfs.org/sioc/ns#': 'sioc:'
  };

  for (const [namespace, prefix] of Object.entries(prefixes)) {
    if (uri.startsWith(namespace)) {
      return prefix + uri.slice(namespace.length);
    }
  }

  // Return last part of URI
  const parts = uri.split(/[#/]/);
  return parts[parts.length - 1] || uri;
}

/**
 * Validate JSON-LD syntax
 */
export async function validate(doc) {
  try {
    // Try to expand - this will catch syntax errors
    await jsonld.expand(doc);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export default {
  expand,
  compact,
  flatten,
  frame,
  toNQuads,
  canonize,
  parseNQuads,
  extractGraphData,
  validate,
  registerContext
};
