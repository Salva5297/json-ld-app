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

    // Parse N-Quads and collect prefixes
    const lines = nquads.split('\n').filter(line => line.trim());
    const prefixMap = new Map();
    const triples = [];

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
      'urn:sdt:': 'sdt'
    };

    // Extract URIs and build prefix map
    const uriPattern = /<([^>]+)>/g;
    for (const line of lines) {
      let match;
      while ((match = uriPattern.exec(line)) !== null) {
        const uri = match[1];
        for (const [namespace, prefix] of Object.entries(knownPrefixes)) {
          if (uri.startsWith(namespace) && !prefixMap.has(namespace)) {
            prefixMap.set(namespace, prefix);
          }
        }
      }
    }

    // Function to compact URI using prefixes
    const compactUri = (uri) => {
      for (const [namespace, prefix] of prefixMap.entries()) {
        if (uri.startsWith(namespace)) {
          const localName = uri.slice(namespace.length);
          // Check if local name is valid for prefixed name
          if (/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(localName)) {
            return `${prefix}:${localName}`;
          }
        }
      }
      return `<${uri}>`;
    };

    // Parse each N-Quad line
    for (const line of lines) {
      const match = line.match(/^<([^>]+)>\s+<([^>]+)>\s+(.+?)\s*\.\s*$/);
      if (match) {
        const [, subject, predicate, objectPart] = match;
        let object;

        if (objectPart.startsWith('<') && objectPart.endsWith('>')) {
          // URI object
          object = compactUri(objectPart.slice(1, -1));
        } else if (objectPart.startsWith('"')) {
          // Literal - keep as is
          object = objectPart;
        } else {
          object = objectPart;
        }

        triples.push({
          subject: compactUri(subject),
          predicate: compactUri(predicate),
          object
        });
      }
    }

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
      if (!subjectGroups.has(triple.subject)) {
        subjectGroups.set(triple.subject, []);
      }
      subjectGroups.get(triple.subject).push(triple);
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
 * Convert JSON-LD to YAML-LD format
 * YAML-LD is a YAML representation of JSON-LD
 */
export async function toYamlLd(doc) {
  try {
    // Convert JSON to YAML
    const yaml = jsonToYaml(doc, 0);
    return { success: true, data: yaml };
  } catch (error) {
    console.error('YAML-LD conversion error:', error);
    return { success: false, error: `YAML-LD conversion failed: ${error.message}` };
  }
}

/**
 * Convert a JSON value to YAML string
 */
function jsonToYaml(value, indent) {
  const spaces = '  '.repeat(indent);
  
  if (value === null) {
    return 'null';
  }
  
  if (value === undefined) {
    return '';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (typeof value === 'number') {
    return String(value);
  }
  
  if (typeof value === 'string') {
    // Check if string needs quoting
    if (value.includes('\n') || value.includes(':') || value.includes('#') || 
        value.includes('"') || value.includes("'") || value.startsWith('@') ||
        value.startsWith(' ') || value.endsWith(' ') ||
        /^[0-9]/.test(value) || ['true', 'false', 'null', 'yes', 'no'].includes(value.toLowerCase())) {
      // Use double quotes and escape
      return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    }
    return value;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    
    // Check if all items are simple (not objects/arrays)
    const allSimple = value.every(item => 
      item === null || typeof item !== 'object'
    );
    
    if (allSimple && value.length <= 5) {
      // Inline array for short simple arrays
      const items = value.map(item => jsonToYaml(item, 0));
      return '[' + items.join(', ') + ']';
    }
    
    // Multi-line array
    let result = '';
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        const yaml = jsonToYaml(item, indent + 1);
        const lines = yaml.split('\n');
        result += '\n' + spaces + '- ' + lines[0];
        for (let i = 1; i < lines.length; i++) {
          result += '\n' + spaces + '  ' + lines[i];
        }
      } else {
        result += '\n' + spaces + '- ' + jsonToYaml(item, 0);
      }
    }
    return result;
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    
    let result = '';
    let first = true;
    for (const key of keys) {
      const val = value[key];
      const keyStr = key.includes(':') || key.includes(' ') || key.startsWith('@') 
        ? '"' + key + '"' 
        : key;
      
      if (!first) {
        result += '\n' + spaces;
      }
      first = false;
      
      if (val === null || typeof val !== 'object') {
        result += keyStr + ': ' + jsonToYaml(val, 0);
      } else if (Array.isArray(val) && val.length === 0) {
        result += keyStr + ': []';
      } else if (typeof val === 'object' && Object.keys(val).length === 0) {
        result += keyStr + ': {}';
      } else {
        const yaml = jsonToYaml(val, indent + 1);
        if (yaml.startsWith('\n')) {
          result += keyStr + ':' + yaml;
        } else {
          result += keyStr + ': ' + yaml;
        }
      }
    }
    return result;
  }
  
  return String(value);
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
  getContextCacheSize
};
