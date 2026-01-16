/**
 * SHACL Validator Service
 * Validates JSON-LD data against SHACL shapes
 */

import { Parser, Store, DataFactory } from 'n3';
import jsonld from 'jsonld';

const { namedNode, literal, blankNode, quad } = DataFactory;

/**
 * Parse Turtle/SHACL shapes into an N3 store
 * @param {string} shacl - SHACL shapes in Turtle format
 * @returns {Promise<Store>} N3 Store with parsed shapes
 */
async function parseShacl(shacl) {
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new Parser({ format: 'text/turtle' });
    
    parser.parse(shacl, (error, quad, prefixes) => {
      if (error) {
        reject(error);
      } else if (quad) {
        store.addQuad(quad);
      } else {
        resolve(store);
      }
    });
  });
}

/**
 * Convert JSON-LD to N3 store
 * @param {object} jsonldDoc - JSON-LD document
 * @returns {Promise<Store>} N3 Store with data
 */
async function jsonldToStore(jsonldDoc) {
  const nquads = await jsonld.toRDF(jsonldDoc, { format: 'application/n-quads' });
  
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new Parser({ format: 'application/n-quads' });
    
    parser.parse(nquads, (error, quad) => {
      if (error) {
        reject(error);
      } else if (quad) {
        store.addQuad(quad);
      } else {
        resolve(store);
      }
    });
  });
}

/**
 * SHACL namespace
 */
const SH = {
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  property: 'http://www.w3.org/ns/shacl#property',
  path: 'http://www.w3.org/ns/shacl#path',
  minCount: 'http://www.w3.org/ns/shacl#minCount',
  maxCount: 'http://www.w3.org/ns/shacl#maxCount',
  datatype: 'http://www.w3.org/ns/shacl#datatype',
  nodeKind: 'http://www.w3.org/ns/shacl#nodeKind',
  minLength: 'http://www.w3.org/ns/shacl#minLength',
  maxLength: 'http://www.w3.org/ns/shacl#maxLength',
  pattern: 'http://www.w3.org/ns/shacl#pattern',
  minInclusive: 'http://www.w3.org/ns/shacl#minInclusive',
  maxInclusive: 'http://www.w3.org/ns/shacl#maxInclusive',
  in: 'http://www.w3.org/ns/shacl#in',
  message: 'http://www.w3.org/ns/shacl#message',
  severity: 'http://www.w3.org/ns/shacl#severity',
  Violation: 'http://www.w3.org/ns/shacl#Violation',
  Warning: 'http://www.w3.org/ns/shacl#Warning',
  Info: 'http://www.w3.org/ns/shacl#Info',
  IRI: 'http://www.w3.org/ns/shacl#IRI',
  BlankNode: 'http://www.w3.org/ns/shacl#BlankNode',
  Literal: 'http://www.w3.org/ns/shacl#Literal'
};

const RDF = {
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'
};

/**
 * Get value from store
 */
function getValue(store, subject, predicate) {
  const quads = store.getQuads(subject, namedNode(predicate), null, null);
  if (quads.length > 0) {
    const obj = quads[0].object;
    return obj.termType === 'Literal' ? obj.value : obj.value;
  }
  return null;
}

/**
 * Get all values from store
 */
function getValues(store, subject, predicate) {
  return store.getQuads(subject, namedNode(predicate), null, null)
    .map(q => q.object.termType === 'Literal' ? q.object.value : q.object.value);
}

/**
 * Parse RDF list
 */
function parseList(store, listNode) {
  const items = [];
  let current = listNode;
  
  while (current && current.value !== RDF.nil) {
    const first = store.getQuads(current, namedNode(RDF.first), null, null);
    if (first.length > 0) {
      items.push(first[0].object.value);
    }
    
    const rest = store.getQuads(current, namedNode(RDF.rest), null, null);
    if (rest.length > 0) {
      current = rest[0].object;
    } else {
      break;
    }
  }
  
  return items;
}

/**
 * Simple SHACL validator
 * Note: This is a simplified implementation. For production use, consider rdf-validate-shacl
 */
export async function validate(jsonldDoc, shaclShapes) {
  try {
    const dataStore = await jsonldToStore(jsonldDoc);
    const shapesStore = await parseShacl(shaclShapes);
    
    const report = {
      conforms: true,
      results: []
    };
    
    // Find all node shapes
    const nodeShapes = shapesStore.getQuads(null, namedNode(RDF.type), namedNode(SH.NodeShape), null);
    
    for (const shapeQuad of nodeShapes) {
      const shape = shapeQuad.subject;
      
      // Get target class
      const targetClass = getValue(shapesStore, shape, SH.targetClass);
      if (!targetClass) continue;
      
      // Find all instances of the target class
      const instances = dataStore.getQuads(null, namedNode(RDF.type), namedNode(targetClass), null);
      
      for (const instanceQuad of instances) {
        const focusNode = instanceQuad.subject;
        
        // Get property shapes
        const propertyShapes = shapesStore.getQuads(shape, namedNode(SH.property), null, null);
        
        for (const propQuad of propertyShapes) {
          const propShape = propQuad.object;
          
          // Get property path
          const path = getValue(shapesStore, propShape, SH.path);
          if (!path) continue;
          
          // Get property values from data
          const values = dataStore.getQuads(focusNode, namedNode(path), null, null);
          
          // Check constraints
          const minCount = getValue(shapesStore, propShape, SH.minCount);
          const maxCount = getValue(shapesStore, propShape, SH.maxCount);
          const datatype = getValue(shapesStore, propShape, SH.datatype);
          const pattern = getValue(shapesStore, propShape, SH.pattern);
          const maxLength = getValue(shapesStore, propShape, SH.maxLength);
          const minLength = getValue(shapesStore, propShape, SH.minLength);
          const message = getValue(shapesStore, propShape, SH.message);
          const inListNode = shapesStore.getQuads(propShape, namedNode(SH.in), null, null);
          
          // minCount check
          if (minCount !== null && values.length < parseInt(minCount)) {
            report.conforms = false;
            report.results.push({
              focusNode: focusNode.value,
              path: path,
              severity: 'Violation',
              message: message || `Minimum count of ${minCount} not met (found ${values.length})`,
              value: null
            });
          }
          
          // maxCount check
          if (maxCount !== null && values.length > parseInt(maxCount)) {
            report.conforms = false;
            report.results.push({
              focusNode: focusNode.value,
              path: path,
              severity: 'Violation',
              message: message || `Maximum count of ${maxCount} exceeded (found ${values.length})`,
              value: null
            });
          }
          
          // Check each value
          for (const valueQuad of values) {
            const value = valueQuad.object;
            const valueStr = value.value;
            
            // Datatype check
            if (datatype && value.termType === 'Literal') {
              if (value.datatype && value.datatype.value !== datatype) {
                report.conforms = false;
                report.results.push({
                  focusNode: focusNode.value,
                  path: path,
                  severity: 'Violation',
                  message: message || `Expected datatype ${datatype}`,
                  value: valueStr
                });
              }
            }
            
            // Pattern check
            if (pattern) {
              const regex = new RegExp(pattern);
              if (!regex.test(valueStr)) {
                report.conforms = false;
                report.results.push({
                  focusNode: focusNode.value,
                  path: path,
                  severity: 'Violation',
                  message: message || `Value does not match pattern ${pattern}`,
                  value: valueStr
                });
              }
            }
            
            // Length checks
            if (minLength !== null && valueStr.length < parseInt(minLength)) {
              report.conforms = false;
              report.results.push({
                focusNode: focusNode.value,
                path: path,
                severity: 'Violation',
                message: message || `Minimum length of ${minLength} not met`,
                value: valueStr
              });
            }
            
            if (maxLength !== null && valueStr.length > parseInt(maxLength)) {
              report.conforms = false;
              report.results.push({
                focusNode: focusNode.value,
                path: path,
                severity: 'Violation',
                message: message || `Maximum length of ${maxLength} exceeded`,
                value: valueStr
              });
            }
            
            // In-list check
            if (inListNode.length > 0) {
              const allowedValues = parseList(shapesStore, inListNode[0].object);
              if (!allowedValues.includes(valueStr)) {
                report.conforms = false;
                report.results.push({
                  focusNode: focusNode.value,
                  path: path,
                  severity: 'Violation',
                  message: message || `Value must be one of: ${allowedValues.join(', ')}`,
                  value: valueStr
                });
              }
            }
          }
        }
      }
    }
    
    return { success: true, report };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Validate SHACL syntax
 */
export async function validateShaclSyntax(shacl) {
  try {
    await parseShacl(shacl);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export default {
  validate,
  validateShaclSyntax
};
