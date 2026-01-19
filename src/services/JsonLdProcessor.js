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

// Cache for fetched remote contexts to avoid repeated requests
const remoteContextCache = new Map();

// List of CORS proxy services to try (in order of preference)
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://cors-anywhere.herokuapp.com/${url}`
];

/**
 * Normalize a context document to ensure it has the proper structure
 * Some contexts are just the context object without the @context wrapper
 * @param {object} doc - The fetched document
 * @param {string} url - The original URL (for logging)
 * @returns {object} Properly structured context document
 */
function normalizeContextDocument(doc, url) {
  if (!doc || typeof doc !== 'object') {
    console.warn(`Invalid context document from ${url}`);
    return { '@context': {} };
  }
  
  // If the document already has @context at root level, it's properly structured
  if (doc['@context'] !== undefined) {
    return doc;
  }
  
  // Check if this looks like a context object (has prefixes or term definitions)
  // Context objects typically have string values (prefixes) or objects with @id/@type
  const keys = Object.keys(doc);
  const looksLikeContext = keys.some(key => {
    const val = doc[key];
    return typeof val === 'string' || 
           (typeof val === 'object' && val !== null && (val['@id'] || val['@type'] || val['@container']));
  });
  
  if (looksLikeContext) {
    console.log(`Wrapping raw context object from ${url}`);
    return { '@context': doc };
  }
  
  // Return as-is if we can't determine the structure
  return doc;
}

/**
 * Fetch a remote document with CORS handling
 * @param {string} url - The URL to fetch
 * @returns {Promise<object>} The fetched document
 */
async function fetchWithCorsRetry(url) {
  // Check cache first
  if (remoteContextCache.has(url)) {
    console.log(`Using cached context for ${url}`);
    return remoteContextCache.get(url);
  }

  console.log(`Fetching remote context: ${url}`);

  // Try direct fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/ld+json, application/json, text/plain, */*'
      },
      mode: 'cors'
    });
    
    if (response.ok) {
      // Always get as text first, then parse - more reliable for various content-types
      const text = await response.text();
      let document;
      
      try {
        document = JSON.parse(text);
      } catch (parseError) {
        console.error(`Failed to parse JSON from ${url}:`, parseError);
        throw parseError;
      }
      
      // Normalize the document structure
      document = normalizeContextDocument(document, url);
      
      remoteContextCache.set(url, document);
      console.log(`Successfully fetched and cached context from ${url}`);
      return document;
    } else {
      console.log(`Direct fetch returned ${response.status} for ${url}`);
    }
  } catch (directError) {
    console.log(`Direct fetch failed for ${url}:`, directError.message, '- trying CORS proxies...');
  }

  // Try CORS proxies
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      console.log(`Trying CORS proxy for ${url}`);
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/ld+json, application/json, text/plain, */*'
        }
      });
      
      if (response.ok) {
        const text = await response.text();
        let document;
        
        try {
          document = JSON.parse(text);
        } catch (e) {
          // Maybe it's wrapped, try to extract JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            document = JSON.parse(jsonMatch[0]);
          } else {
            throw e;
          }
        }
        
        // Normalize the document structure
        document = normalizeContextDocument(document, url);
        
        remoteContextCache.set(url, document);
        console.log(`Successfully fetched ${url} via CORS proxy`);
        return document;
      }
    } catch (proxyError) {
      console.log(`CORS proxy failed for ${url}:`, proxyError.message);
      continue;
    }
  }

  throw new Error(`Failed to fetch context from ${url} - all methods failed (direct and CORS proxies)`);
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

  // Common contexts cache - frequently used contexts
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
    },
    'http://schema.org': {
      '@context': {
        '@vocab': 'https://schema.org/'
      }
    },
    'https://schema.org/': {
      '@context': {
        '@vocab': 'https://schema.org/'
      }
    },
    'http://schema.org/': {
      '@context': {
        '@vocab': 'https://schema.org/'
      }
    }
  };

  // Check common contexts cache
  if (contexts[url]) {
    return {
      contextUrl: null,
      document: contexts[url],
      documentUrl: url
    };
  }

  // Try to fetch remote context with CORS handling
  try {
    const document = await fetchWithCorsRetry(url);
    return {
      contextUrl: null,
      document: document,
      documentUrl: url
    };
  } catch (error) {
    console.error(`Failed to load context from ${url}:`, error);
    // Throw the error instead of returning empty context to make debugging easier
    throw new Error(`Could not load remote context from ${url}: ${error.message}`);
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
 * Returns with @graph structure and embedded objects
 */
export async function frame(doc, frameDoc) {
  try {
    // First expand the document to get full URIs
    const expanded = await jsonld.expand(doc);
    
    // Create a frame that embeds everything and uses expanded URIs
    const expandedFrame = {
      "@embed": "@always"
    };
    
    // Frame the expanded document with embedding
    const framed = await jsonld.frame(expanded, expandedFrame, {
      embed: '@always',
      explicit: false,
      requireAll: false,
      omitDefault: true
    });
    
    // The result should have @graph structure
    // Remove @context since we want expanded URIs
    if (framed['@context']) {
      delete framed['@context'];
    }
    
    // Simplify the structure - remove unnecessary arrays for single values
    const simplify = (obj) => {
      if (Array.isArray(obj)) {
        if (obj.length === 1) {
          return simplify(obj[0]);
        }
        return obj.map(simplify);
      }
      if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key === '@graph') {
            // Keep @graph as array
            result[key] = Array.isArray(value) ? value.map(simplify) : [simplify(value)];
          } else if (key === '@id' || key === '@type' || key === '@value') {
            // Keep these as-is (not arrays)
            result[key] = value;
          } else if (Array.isArray(value) && value.length === 1) {
            // Simplify single-element arrays for properties
            const simplified = simplify(value[0]);
            // If it's just a value wrapper, extract the value
            if (typeof simplified === 'object' && simplified !== null && 
                Object.keys(simplified).length === 1 && simplified['@value'] !== undefined) {
              result[key] = simplified['@value'];
            } else {
              result[key] = simplified;
            }
          } else {
            result[key] = simplify(value);
          }
        }
        return result;
      }
      return obj;
    };
    
    const simplified = simplify(framed);
    
    return { success: true, data: simplified };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Convert JSON-LD to N-Quads format
 * Note: This requires valid RDF-compatible JSON-LD. Common issues:
 * - Invalid URI schemes (must be http:, https:, urn:, etc.)
 * - Properties without proper @id mappings in context
 */
export async function toNQuads(doc) {
  try {
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' });
    return { success: true, data: nquads };
  } catch (error) {
    console.error('toNQuads error:', error);
    // Provide more helpful error messages
    let errorMessage = error?.message || String(error);
    
    if (errorMessage.includes('termType') || errorMessage.includes('null') || errorMessage.includes('Cannot read properties')) {
      errorMessage = `RDF conversion failed. This usually means:\n\n` +
        `• Some @id values use undefined prefixes (e.g., "sdt:" if not defined in @context)\n` +
        `• Some @id values use invalid URI schemes (e.g., "data:" is reserved for data URIs)\n` +
        `• Properties without proper @id mappings in the @context\n` +
        `• Some terms couldn't be resolved to valid URIs\n\n` +
        `Tip: Check your @context defines all prefixes used in @id values.\n` +
        `Use "Expanded" view to see how terms are being resolved.\n\n` +
        `Original error: ${errorMessage}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Canonize (normalize) a JSON-LD document using URDNA2015
 * Note: Same requirements as toNQuads - document must be RDF-compatible
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
    console.error('canonize error:', error);
    // Provide more helpful error messages
    let errorMessage = error?.message || String(error);
    
    if (errorMessage.includes('termType') || errorMessage.includes('null') || errorMessage.includes('Cannot read properties')) {
      errorMessage = `Canonization failed. This usually means:\n\n` +
        `• Some @id values use undefined prefixes (e.g., "sdt:" if not defined in @context)\n` +
        `• Some @id values use invalid URI schemes (e.g., "data:" is reserved for data URIs)\n` +
        `• Properties without proper @id mappings in the @context\n` +
        `• Some terms couldn't be resolved to valid URIs\n\n` +
        `Tip: Check your @context defines all prefixes used in @id values.\n` +
        `Use "Expanded" view to see how terms are being resolved.\n\n` +
        `Original error: ${errorMessage}`;
    }
    
    return { success: false, error: errorMessage };
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

/**
 * Clear the remote context cache
 * Useful when debugging or when contexts have been updated
 */
export function clearContextCache() {
  remoteContextCache.clear();
  console.log('Remote context cache cleared');
}

/**
 * Get the size of the remote context cache
 */
export function getContextCacheSize() {
  return remoteContextCache.size;
}

/**
 * Convert JSON-LD to Turtle format
 * Uses N-Quads as intermediate format and converts to Turtle
 */
export async function toTurtle(doc) {
  try {
    const nquadsResult = await toNQuads(doc);
    if (!nquadsResult.success) {
      return nquadsResult;
    }

    const nquads = nquadsResult.data;
    if (!nquads.trim()) {
      return { success: true, data: '# Empty document - no triples generated' };
    }

    // Common prefixes to detect
    const knownPrefixes = {
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf',
      'http://www.w3.org/2000/01/rdf-schema#': 'rdfs',
      'http://www.w3.org/2001/XMLSchema#': 'xsd',
      'http://www.w3.org/2002/07/owl#': 'owl',
      'https://schema.org/': 'schema',
      'http://schema.org/': 'schema',
      'http://xmlns.com/foaf/0.1/': 'foaf',
      'http://purl.org/dc/terms/': 'dcterms',
      'http://purl.org/dc/elements/1.1/': 'dc',
      'http://www.w3.org/ns/shacl#': 'sh',
      'http://www.w3.org/2004/02/skos/core#': 'skos',
      'http://www.w3.org/ns/prov#': 'prov',
      'https://www.w3.org/2019/wot/td#': 'td',
      'https://www.w3.org/2019/wot/json-schema#': 'jsonschema',
      'https://www.w3.org/2019/wot/hypermedia#': 'hctl',
      'https://www.w3.org/2019/wot/security#': 'wotsec',
      'http://purl.org/goodrelations/v1#': 'gr',
      'http://www.productontology.org/id/': 'pto',
      'urn:sdt:': 'sdt'
    };

    const prefixMap = new Map();
    const triples = [];

    // Parse N-Quads line by line
    const lines = nquads.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    for (const line of lines) {
      const triple = parseNQuadLine(line);
      if (triple) {
        triples.push(triple);
        
        // Collect prefixes from URIs
        if (triple.subject.type === 'uri') {
          collectPrefix(triple.subject.value, knownPrefixes, prefixMap);
        }
        if (triple.predicate.type === 'uri') {
          collectPrefix(triple.predicate.value, knownPrefixes, prefixMap);
        }
        if (triple.object.type === 'uri') {
          collectPrefix(triple.object.value, knownPrefixes, prefixMap);
        }
        if (triple.object.datatype) {
          collectPrefix(triple.object.datatype, knownPrefixes, prefixMap);
        }
      }
    }

    // Function to format a term in Turtle
    const formatTerm = (term) => {
      if (term.type === 'blank') {
        return term.value;
      }
      if (term.type === 'uri') {
        // Try to compact with prefix
        for (const [namespace, prefix] of prefixMap.entries()) {
          if (term.value.startsWith(namespace)) {
            const localName = term.value.slice(namespace.length);
            if (/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(localName)) {
              return `${prefix}:${localName}`;
            }
          }
        }
        return `<${term.value}>`;
      }
      if (term.type === 'literal') {
        let result = '"' + term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
        if (term.language) {
          result += '@' + term.language;
        } else if (term.datatype && term.datatype !== 'http://www.w3.org/2001/XMLSchema#string') {
          // Compact datatype if possible
          let datatypeStr = `<${term.datatype}>`;
          for (const [namespace, prefix] of prefixMap.entries()) {
            if (term.datatype.startsWith(namespace)) {
              const localName = term.datatype.slice(namespace.length);
              if (/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(localName)) {
                datatypeStr = `${prefix}:${localName}`;
                break;
              }
            }
          }
          result += '^^' + datatypeStr;
        }
        return result;
      }
      return String(term.value);
    };

    // Build Turtle output
    let turtle = '';

    // Add prefixes
    for (const [namespace, prefix] of prefixMap.entries()) {
      turtle += `@prefix ${prefix}: <${namespace}> .\n`;
    }
    if (prefixMap.size > 0) {
      turtle += '\n';
    }

    // Group triples by subject
    const subjectGroups = new Map();
    for (const triple of triples) {
      const subjectKey = formatTerm(triple.subject);
      if (!subjectGroups.has(subjectKey)) {
        subjectGroups.set(subjectKey, []);
      }
      subjectGroups.get(subjectKey).push({
        predicate: formatTerm(triple.predicate),
        object: formatTerm(triple.object)
      });
    }

    // Output grouped triples
    for (const [subject, predicates] of subjectGroups.entries()) {
      turtle += `${subject}\n`;
      for (let i = 0; i < predicates.length; i++) {
        const { predicate, object } = predicates[i];
        const separator = i < predicates.length - 1 ? ' ;' : ' .';
        turtle += `    ${predicate} ${object}${separator}\n`;
      }
      turtle += '\n';
    }

    return { success: true, data: turtle.trim() };
  } catch (error) {
    console.error('Turtle conversion error:', error);
    return { success: false, error: `Turtle conversion failed: ${error.message}` };
  }
}

/**
 * Collect prefix from URI if it matches known prefixes
 */
function collectPrefix(uri, knownPrefixes, prefixMap) {
  for (const [namespace, prefix] of Object.entries(knownPrefixes)) {
    if (uri.startsWith(namespace) && !prefixMap.has(namespace)) {
      prefixMap.set(namespace, prefix);
    }
  }
}

/**
 * Parse a single N-Quad line into subject, predicate, object
 */
function parseNQuadLine(line) {
  line = line.trim();
  if (!line || line.startsWith('#')) return null;
  
  // Remove trailing dot and whitespace
  if (line.endsWith('.')) {
    line = line.slice(0, -1).trim();
  }
  
  let pos = 0;
  
  // Parse subject (URI or blank node)
  const subject = parseNQuadTerm(line, pos);
  if (!subject) return null;
  pos = subject.endPos;
  
  // Skip whitespace
  while (pos < line.length && /\s/.test(line[pos])) pos++;
  
  // Parse predicate (URI)
  const predicate = parseNQuadTerm(line, pos);
  if (!predicate) return null;
  pos = predicate.endPos;
  
  // Skip whitespace
  while (pos < line.length && /\s/.test(line[pos])) pos++;
  
  // Parse object (URI, blank node, or literal)
  const object = parseNQuadTerm(line, pos);
  if (!object) return null;
  
  return {
    subject: subject.term,
    predicate: predicate.term,
    object: object.term
  };
}

/**
 * Parse a single term from an N-Quad line
 */
function parseNQuadTerm(line, pos) {
  // Skip whitespace
  while (pos < line.length && /\s/.test(line[pos])) pos++;
  
  if (pos >= line.length) return null;
  
  // URI: <...>
  if (line[pos] === '<') {
    const end = line.indexOf('>', pos + 1);
    if (end === -1) return null;
    return {
      term: { type: 'uri', value: line.slice(pos + 1, end) },
      endPos: end + 1
    };
  }
  
  // Blank node: _:...
  if (line[pos] === '_' && line[pos + 1] === ':') {
    let end = pos + 2;
    while (end < line.length && /[a-zA-Z0-9_.-]/.test(line[end])) end++;
    return {
      term: { type: 'blank', value: line.slice(pos, end) },
      endPos: end
    };
  }
  
  // Literal: "..."
  if (line[pos] === '"') {
    let end = pos + 1;
    let value = '';
    while (end < line.length) {
      if (line[end] === '\\' && end + 1 < line.length) {
        // Escape sequence
        const next = line[end + 1];
        if (next === 'n') value += '\n';
        else if (next === 'r') value += '\r';
        else if (next === 't') value += '\t';
        else if (next === '\\') value += '\\';
        else if (next === '"') value += '"';
        else value += next;
        end += 2;
      } else if (line[end] === '"') {
        end++;
        break;
      } else {
        value += line[end];
        end++;
      }
    }
    
    let language = null;
    let datatype = null;
    
    // Check for language tag: @...
    if (line[end] === '@') {
      const langStart = end + 1;
      let langEnd = langStart;
      while (langEnd < line.length && /[a-zA-Z0-9-]/.test(line[langEnd])) langEnd++;
      language = line.slice(langStart, langEnd);
      end = langEnd;
    }
    // Check for datatype: ^^<...>
    else if (line[end] === '^' && line[end + 1] === '^') {
      end += 2;
      if (line[end] === '<') {
        const dtEnd = line.indexOf('>', end + 1);
        if (dtEnd !== -1) {
          datatype = line.slice(end + 1, dtEnd);
          end = dtEnd + 1;
        }
      }
    }
    
    return {
      term: { type: 'literal', value, language, datatype },
      endPos: end
    };
  }
  
  return null;
}

/**
 * Convert JSON-LD to YAML-LD format
 * YAML-LD is a YAML representation of JSON-LD
 */
export async function toYamlLd(doc) {
  try {
    // Convert JSON to YAML using a proper recursive approach
    const lines = [];
    jsonToYamlLines(doc, 0, lines, false);
    return { success: true, data: lines.join('\n') };
  } catch (error) {
    console.error('YAML-LD conversion error:', error);
    return { success: false, error: `YAML-LD conversion failed: ${error.message}` };
  }
}

/**
 * Quote a YAML string if needed
 */
function yamlQuoteString(value) {
  if (typeof value !== 'string') return String(value);
  
  const needsQuoting = 
    value === '' ||
    value.includes(':') ||
    value.includes('#') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes('\t') ||
    value.includes('"') ||
    value.includes("'") ||
    value.includes('[') ||
    value.includes(']') ||
    value.includes('{') ||
    value.includes('}') ||
    value.includes(',') ||
    value.includes('&') ||
    value.includes('*') ||
    value.includes('!') ||
    value.includes('|') ||
    value.includes('>') ||
    value.includes('%') ||
    value.includes('@') ||
    value.includes('`') ||
    value.startsWith(' ') ||
    value.endsWith(' ') ||
    value.startsWith('-') ||
    value.startsWith('?') ||
    /^[0-9]/.test(value) ||
    ['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'y', 'n', ''].includes(value.toLowerCase());
  
  if (needsQuoting) {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return '"' + escaped + '"';
  }
  return value;
}

/**
 * Quote a YAML key if needed
 */
function yamlQuoteKey(key) {
  if (key.includes(':') || key.includes(' ') || key.startsWith('@') || key.startsWith('#')) {
    return '"' + key.replace(/"/g, '\\"') + '"';
  }
  return key;
}

/**
 * Convert a JSON value to YAML lines
 * @param {any} value - The value to convert
 * @param {number} indent - Current indentation level
 * @param {string[]} lines - Array to push lines to
 * @param {boolean} inlineFirst - Whether the first line should be inline (no indent)
 */
function jsonToYamlLines(value, indent, lines, inlineFirst) {
  const spaces = '  '.repeat(indent);
  const prefix = inlineFirst ? '' : spaces;
  
  if (value === null) {
    lines.push(prefix + 'null');
    return;
  }
  
  if (value === undefined) {
    lines.push(prefix + 'null');
    return;
  }
  
  if (typeof value === 'boolean') {
    lines.push(prefix + (value ? 'true' : 'false'));
    return;
  }
  
  if (typeof value === 'number') {
    lines.push(prefix + String(value));
    return;
  }
  
  if (typeof value === 'string') {
    lines.push(prefix + yamlQuoteString(value));
    return;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(prefix + '[]');
      return;
    }
    
    // Check if all items are simple primitives
    const allSimple = value.every(item => 
      item === null || (typeof item !== 'object')
    );
    
    if (allSimple && value.length <= 3) {
      // Inline array for short simple arrays
      const items = value.map(item => {
        if (item === null) return 'null';
        if (typeof item === 'string') return yamlQuoteString(item);
        return String(item);
      });
      lines.push(prefix + '[' + items.join(', ') + ']');
      return;
    }
    
    // Multi-line array
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        // For objects/arrays, put the first property on the same line as the dash
        if (Array.isArray(item)) {
          lines.push(spaces + '-');
          jsonToYamlLines(item, indent + 1, lines, false);
        } else {
          const keys = Object.keys(item);
          if (keys.length === 0) {
            lines.push(spaces + '- {}');
          } else {
            // First key-value on same line as dash
            const firstKey = keys[0];
            const firstVal = item[firstKey];
            const keyStr = yamlQuoteKey(firstKey);
            
            if (firstVal === null || typeof firstVal !== 'object') {
              const valStr = firstVal === null ? 'null' : 
                typeof firstVal === 'string' ? yamlQuoteString(firstVal) : String(firstVal);
              lines.push(spaces + '- ' + keyStr + ': ' + valStr);
            } else if (Array.isArray(firstVal) && firstVal.length === 0) {
              lines.push(spaces + '- ' + keyStr + ': []');
            } else if (typeof firstVal === 'object' && Object.keys(firstVal).length === 0) {
              lines.push(spaces + '- ' + keyStr + ': {}');
            } else {
              lines.push(spaces + '- ' + keyStr + ':');
              jsonToYamlLines(firstVal, indent + 2, lines, false);
            }
            
            // Rest of keys with extra indent
            for (let i = 1; i < keys.length; i++) {
              const key = keys[i];
              const val = item[key];
              const kStr = yamlQuoteKey(key);
              
              if (val === null || typeof val !== 'object') {
                const vStr = val === null ? 'null' : 
                  typeof val === 'string' ? yamlQuoteString(val) : String(val);
                lines.push(spaces + '  ' + kStr + ': ' + vStr);
              } else if (Array.isArray(val) && val.length === 0) {
                lines.push(spaces + '  ' + kStr + ': []');
              } else if (typeof val === 'object' && Object.keys(val).length === 0) {
                lines.push(spaces + '  ' + kStr + ': {}');
              } else {
                lines.push(spaces + '  ' + kStr + ':');
                jsonToYamlLines(val, indent + 2, lines, false);
              }
            }
          }
        }
      } else {
        const valStr = item === null ? 'null' : 
          typeof item === 'string' ? yamlQuoteString(item) : String(item);
        lines.push(spaces + '- ' + valStr);
      }
    }
    return;
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      lines.push(prefix + '{}');
      return;
    }
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = value[key];
      const keyStr = yamlQuoteKey(key);
      const linePrefix = (i === 0 && inlineFirst) ? '' : spaces;
      
      if (val === null || typeof val !== 'object') {
        const valStr = val === null ? 'null' : 
          typeof val === 'string' ? yamlQuoteString(val) : String(val);
        lines.push(linePrefix + keyStr + ': ' + valStr);
      } else if (Array.isArray(val) && val.length === 0) {
        lines.push(linePrefix + keyStr + ': []');
      } else if (typeof val === 'object' && Object.keys(val).length === 0) {
        lines.push(linePrefix + keyStr + ': {}');
      } else {
        lines.push(linePrefix + keyStr + ':');
        jsonToYamlLines(val, indent + 1, lines, false);
      }
    }
    return;
  }
  
  lines.push(prefix + String(value));
}

export default {
  expand,
  compact,
  flatten,
  frame,
  toNQuads,
  canonize,
  toTurtle,
  toYamlLd,
  parseNQuads,
  extractGraphData,
  validate,
  registerContext,
  clearContextCache,
  getContextCacheSize,
  fetchRemoteContext: fetchWithCorsRetry
};
