/**
 * Context From SHACL Generator Service
 * Generates JSON-LD context documents from SHACL shapes
 * Following the algorithm from SHACL-play
 */

import { Parser, Store, DataFactory } from 'n3';

const { namedNode } = DataFactory;

/**
 * SHACL namespace URIs
 */
const SH = {
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  property: 'http://www.w3.org/ns/shacl#property',
  path: 'http://www.w3.org/ns/shacl#path',
  datatype: 'http://www.w3.org/ns/shacl#datatype',
  nodeKind: 'http://www.w3.org/ns/shacl#nodeKind',
  class: 'http://www.w3.org/ns/shacl#class',
  node: 'http://www.w3.org/ns/shacl#node',
  minCount: 'http://www.w3.org/ns/shacl#minCount',
  maxCount: 'http://www.w3.org/ns/shacl#maxCount',
  pattern: 'http://www.w3.org/ns/shacl#pattern',
  name: 'http://www.w3.org/ns/shacl#name',
  in: 'http://www.w3.org/ns/shacl#in',
  IRI: 'http://www.w3.org/ns/shacl#IRI',
  BlankNode: 'http://www.w3.org/ns/shacl#BlankNode',
  Literal: 'http://www.w3.org/ns/shacl#Literal',
  BlankNodeOrIRI: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI'
};

const RDF = {
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil',
  langString: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
};

const RDFS = {
  Class: 'http://www.w3.org/2000/01/rdf-schema#Class'
};

/**
 * Common XSD datatypes that should be mapped to @type
 */
const XSD_DATATYPES = {
  'http://www.w3.org/2001/XMLSchema#string': 'xsd:string',
  'http://www.w3.org/2001/XMLSchema#integer': 'xsd:integer',
  'http://www.w3.org/2001/XMLSchema#decimal': 'xsd:decimal',
  'http://www.w3.org/2001/XMLSchema#float': 'xsd:float',
  'http://www.w3.org/2001/XMLSchema#double': 'xsd:double',
  'http://www.w3.org/2001/XMLSchema#boolean': 'xsd:boolean',
  'http://www.w3.org/2001/XMLSchema#date': 'xsd:date',
  'http://www.w3.org/2001/XMLSchema#dateTime': 'xsd:dateTime',
  'http://www.w3.org/2001/XMLSchema#time': 'xsd:time',
  'http://www.w3.org/2001/XMLSchema#anyURI': 'xsd:anyURI',
  'http://www.w3.org/2001/XMLSchema#nonNegativeInteger': 'xsd:nonNegativeInteger',
  'http://www.w3.org/2001/XMLSchema#positiveInteger': 'xsd:positiveInteger'
};

/**
 * Parse SHACL Turtle into an N3 store
 */
async function parseShacl(shacl) {
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new Parser({ format: 'text/turtle' });
    const prefixes = {};
    
    parser.parse(shacl, (error, quad, parsedPrefixes) => {
      if (error) {
        reject(error);
      } else if (quad) {
        store.addQuad(quad);
      } else {
        // Parsing complete, capture prefixes
        if (parsedPrefixes) {
          Object.assign(prefixes, parsedPrefixes);
        }
        resolve({ store, prefixes });
      }
    });
  });
}

/**
 * Get a single value from store for a subject and predicate
 */
function getValue(store, subject, predicate) {
  const quads = store.getQuads(subject, namedNode(predicate), null, null);
  return quads.length > 0 ? quads[0].object.value : null;
}

/**
 * Get all values from store for a subject and predicate
 */
function getValues(store, subject, predicate) {
  return store.getQuads(subject, namedNode(predicate), null, null)
    .map(q => q.object.value);
}

/**
 * Get all objects (as nodes) for a subject and predicate
 */
function getObjects(store, subject, predicate) {
  return store.getQuads(subject, namedNode(predicate), null, null)
    .map(q => q.object);
}

/**
 * Get local name from URI
 */
function getLocalName(uri) {
  if (!uri) return '';
  const hashIndex = uri.lastIndexOf('#');
  const slashIndex = uri.lastIndexOf('/');
  const index = Math.max(hashIndex, slashIndex);
  return index >= 0 ? uri.slice(index + 1) : uri;
}

/**
 * Get namespace from URI
 */
function getNamespace(uri) {
  if (!uri) return '';
  const hashIndex = uri.lastIndexOf('#');
  const slashIndex = uri.lastIndexOf('/');
  const index = Math.max(hashIndex, slashIndex);
  return index >= 0 ? uri.slice(0, index + 1) : '';
}

/**
 * Check if a property is an IRI reference based on SHACL constraints
 */
function isIriProperty(store, propShape) {
  const nodeKind = getValue(store, propShape, SH.nodeKind);
  const shClass = getValue(store, propShape, SH.class);
  const shNode = getValue(store, propShape, SH.node);
  
  return nodeKind === SH.IRI || 
         nodeKind === SH.BlankNodeOrIRI ||
         shClass !== null ||
         shNode !== null;
}

/**
 * Check if property can have multiple values (no maxCount or maxCount > 1)
 */
function isMultiValued(store, propShape) {
  const maxCount = getValue(store, propShape, SH.maxCount);
  return maxCount === null || parseInt(maxCount) > 1;
}

/**
 * Extract URI base from pattern if it specifies beginning of URIs
 */
function extractBaseFromPattern(pattern) {
  if (!pattern) return null;
  // Match patterns like ^http://example.org/
  const match = pattern.match(/^\^?(https?:\/\/[^)$\\]+)/);
  return match ? match[1] : null;
}

/**
 * Generate JSON-LD context from SHACL shapes
 * @param {string} shaclShapes - SHACL shapes in Turtle format
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function generateContextFromShacl(shaclShapes, options = {}) {
  try {
    const {
      useContainerSet = true,
      includeXsdPrefix = true,
      customShortnames = {}
    } = options;
    
    const { store, prefixes } = await parseShacl(shaclShapes);
    
    // Initialize context with standard mappings
    const context = {
      '@version': 1.1,
      'id': '@id',
      'type': '@type',
      'graph': '@graph'
    };
    
    // Add XSD prefix if needed
    if (includeXsdPrefix) {
      context['xsd'] = 'http://www.w3.org/2001/XMLSchema#';
    }
    
    // Add prefix mappings from the SHACL file
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (prefix && !prefix.startsWith('_')) {
        context[prefix] = namespace;
      }
    }
    
    // Track processed properties to avoid duplicates
    const processedProperties = new Set();
    
    // Find all NodeShapes
    const nodeShapes = store.getQuads(null, namedNode(RDF.type), namedNode(SH.NodeShape), null);
    
    // Also find shapes that are classes
    const classShapes = store.getQuads(null, namedNode(RDF.type), namedNode(RDFS.Class), null)
      .filter(q => store.getQuads(q.subject, namedNode(SH.property), null, null).length > 0);
    
    const allShapes = [...nodeShapes, ...classShapes];
    
    // Process target classes from NodeShapes
    for (const shapeQuad of allShapes) {
      const shape = shapeQuad.subject;
      
      // Add target class to context
      const targetClasses = getValues(store, shape, SH.targetClass);
      for (const targetClass of targetClasses) {
        const localName = getLocalName(targetClass);
        if (localName && !context[localName]) {
          context[localName] = {
            '@id': targetClass
          };
        }
      }
      
      // If the shape itself is a class, add it
      if (shape.termType === 'NamedNode') {
        const localName = getLocalName(shape.value);
        if (localName && !context[localName]) {
          // Check if this shape is also a class
          const isClass = store.getQuads(shape, namedNode(RDF.type), namedNode(RDFS.Class), null).length > 0;
          if (isClass) {
            context[localName] = {
              '@id': shape.value
            };
          }
        }
      }
      
      // Process property shapes
      const propertyShapeNodes = getObjects(store, shape, SH.property);
      
      for (const propShape of propertyShapeNodes) {
        const path = getValue(store, propShape, SH.path);
        if (!path) continue;
        
        // Skip if already processed
        if (processedProperties.has(path)) continue;
        processedProperties.add(path);
        
        // Determine JSON key (shortname)
        let jsonKey = customShortnames[path] || getLocalName(path);
        
        // Check for custom shortname annotation
        const shName = getValue(store, propShape, SH.name);
        if (shName && !customShortnames[path]) {
          // Use sh:name as JSON key if it looks like a valid identifier
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(shName)) {
            jsonKey = shName;
          }
        }
        
        if (!jsonKey) continue;
        
        // Build property definition
        const propDef = {
          '@id': path
        };
        
        // Determine @type from datatype
        const datatype = getValue(store, propShape, SH.datatype);
        if (datatype) {
          if (datatype === RDF.langString) {
            // For rdf:langString, use @container: @language
            propDef['@container'] = '@language';
          } else if (XSD_DATATYPES[datatype]) {
            propDef['@type'] = XSD_DATATYPES[datatype];
          } else {
            propDef['@type'] = datatype;
          }
        }
        
        // Determine @type from IRI reference
        if (!propDef['@type'] && isIriProperty(store, propShape)) {
          propDef['@type'] = '@id';
        }
        
        // Add @container: @set for multi-valued properties (if not already set)
        if (useContainerSet && !propDef['@container'] && isMultiValued(store, propShape)) {
          propDef['@container'] = '@set';
        }
        
        // Check for pattern that specifies base URI
        const pattern = getValue(store, propShape, SH.pattern);
        if (pattern && propDef['@type'] === '@id') {
          const base = extractBaseFromPattern(pattern);
          if (base) {
            propDef['@context'] = {
              '@base': base
            };
          }
        }
        
        // Simplify if only @id
        if (Object.keys(propDef).length === 1 && propDef['@id']) {
          context[jsonKey] = propDef['@id'];
        } else {
          context[jsonKey] = propDef;
        }
      }
    }
    
    return { 
      success: true, 
      data: {
        '@context': context
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate a formatted JSON-LD context string
 * Returns just the context object content (without the @context wrapper)
 */
export async function generateContextString(shaclShapes, options = {}) {
  const result = await generateContextFromShacl(shaclShapes, options);
  if (result.success) {
    // Return only the inner context object, not the wrapper
    const contextContent = result.data['@context'] || result.data;
    return {
      success: true,
      data: JSON.stringify(contextContent, null, 2)
    };
  }
  return result;
}

/**
 * Validate that a context is well-formed
 */
export function validateContext(context) {
  const errors = [];
  
  if (typeof context !== 'object' || context === null) {
    errors.push('Context must be an object');
    return { valid: false, errors };
  }
  
  const ctx = context['@context'] || context;
  
  for (const [key, value] of Object.entries(ctx)) {
    // Skip JSON-LD keywords
    if (key.startsWith('@')) continue;
    
    // Check for valid key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_:-]*$/.test(key)) {
      errors.push(`Invalid key format: "${key}"`);
    }
    
    // Check value structure
    if (typeof value === 'object' && value !== null) {
      if (!value['@id'] && !value['@type'] && !value['@container'] && !value['@context']) {
        errors.push(`Property "${key}" has no @id, @type, @container, or @context`);
      }
    } else if (typeof value !== 'string') {
      errors.push(`Property "${key}" must be a string or object`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  generateContextFromShacl,
  generateContextString,
  validateContext
};
