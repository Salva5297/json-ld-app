/**
 * Documentation Generator Service
 * Generates HTML documentation from JSON-LD documents
 * Similar to SHACL-play's doc feature but for JSON-LD
 * Supports Mermaid diagrams and PDF export
 */

import jsonld from 'jsonld';
import jsonldProcessor from './JsonLdProcessor.js';

/**
 * Common namespace prefixes
 */
const PREFIXES = {
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'dcterms': 'http://purl.org/dc/terms/',
  'dc': 'http://purl.org/dc/elements/1.1/',
  'schema': 'https://schema.org/',
  'foaf': 'http://xmlns.com/foaf/0.1/',
  'skos': 'http://www.w3.org/2004/02/skos/core#'
};

/**
 * Extract prefixes from JSON-LD context
 */
function extractPrefixes(context) {
  const prefixes = { ...PREFIXES };
  
  if (Array.isArray(context)) {
    for (const ctx of context) {
      if (typeof ctx === 'object' && ctx !== null) {
        Object.assign(prefixes, extractPrefixesFromObject(ctx));
      }
    }
  } else if (typeof context === 'object' && context !== null) {
    Object.assign(prefixes, extractPrefixesFromObject(context));
  }
  
  return prefixes;
}

function extractPrefixesFromObject(ctx) {
  const prefixes = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (key.startsWith('@')) continue;
    if (typeof value === 'string' && (value.endsWith('/') || value.endsWith('#'))) {
      prefixes[key] = value;
    }
  }
  return prefixes;
}

/**
 * Shorten a URI using prefixes
 */
function shortenUri(uri, prefixes) {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (uri.startsWith(namespace)) {
      return `${prefix}:${uri.slice(namespace.length)}`;
    }
  }
  return uri;
}

/**
 * Get the local name from a URI
 */
function getLocalName(uri) {
  if (!uri) return '';
  const hashIndex = uri.lastIndexOf('#');
  const slashIndex = uri.lastIndexOf('/');
  const index = Math.max(hashIndex, slashIndex);
  return index >= 0 ? uri.slice(index + 1) : uri;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Detect the type of a value for documentation
 */
function getValueType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'xsd:boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'xsd:integer' : 'xsd:decimal';
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'xsd:dateTime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'xsd:date';
    if (/^https?:\/\//.test(value)) return 'IRI';
    if (/^mailto:/.test(value)) return 'IRI (mailto)';
    if (/^urn:/.test(value)) return 'IRI (URN)';
    return 'xsd:string';
  }
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object') {
    if (value['@id']) return 'IRI Reference';
    if (value['@value']) return value['@type'] || 'Literal';
    if (value['@type']) return 'Typed Node';
    return 'Blank Node';
  }
  return 'unknown';
}

/**
 * Analyze a JSON-LD document and extract structure information
 */
async function analyzeDocument(doc) {
  const analysis = {
    title: '',
    description: '',
    types: [],
    entities: [],
    prefixes: {},
    metadata: {}
  };
  
  // Extract context and prefixes
  const context = doc['@context'] || {};
  analysis.prefixes = extractPrefixes(context);
  
  // Get document metadata
  if (doc['@id']) {
    analysis.metadata.id = doc['@id'];
  }
  
  // Try to get title from common properties
  analysis.title = doc.name || doc.title || doc['dc:title'] || doc['dcterms:title'] || 
                   doc['schema:name'] || doc['rdfs:label'] || 
                   (doc['@type'] ? `${Array.isArray(doc['@type']) ? doc['@type'][0] : doc['@type']} Document` : 'JSON-LD Document');
  
  // Try to get description
  analysis.description = doc.description || doc['dc:description'] || doc['dcterms:description'] ||
                         doc['schema:description'] || doc['rdfs:comment'] || '';
  
  // Analyze the structure
  try {
    const expanded = await jsonld.expand(doc);
    analyzeNodes(expanded, analysis);
  } catch (e) {
    // Fallback to direct analysis
    if (Array.isArray(doc)) {
      doc.forEach(node => analyzeNode(node, analysis));
    } else {
      analyzeNode(doc, analysis);
    }
  }
  
  return analysis;
}

function analyzeNodes(nodes, analysis) {
  if (!Array.isArray(nodes)) nodes = [nodes];
  nodes.forEach(node => analyzeNode(node, analysis));
}

function analyzeNode(node, analysis, depth = 0) {
  if (!node || typeof node !== 'object') return;
  
  const entity = {
    id: node['@id'] || null,
    types: [],
    properties: []
  };
  
  // Get types
  const nodeType = node['@type'] || node['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'];
  if (nodeType) {
    const types = Array.isArray(nodeType) ? nodeType : [nodeType];
    entity.types = types.map(t => typeof t === 'object' ? t['@id'] : t).filter(Boolean);
    entity.types.forEach(t => {
      if (!analysis.types.includes(t)) {
        analysis.types.push(t);
      }
    });
  }
  
  // Analyze properties
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@')) continue;
    
    const prop = {
      name: key,
      shortName: getLocalName(key),
      values: [],
      valueType: null,
      isArray: Array.isArray(value),
      count: Array.isArray(value) ? value.length : 1
    };
    
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      prop.valueType = getValueType(v);
      if (typeof v === 'object' && v !== null) {
        if (v['@value']) {
          prop.values.push({ value: v['@value'], type: v['@type'] || 'Literal' });
        } else if (v['@id']) {
          prop.values.push({ value: v['@id'], type: 'IRI' });
        } else {
          prop.values.push({ value: '[Nested Object]', type: 'Object' });
          // Recursively analyze nested objects
          if (depth < 5) {
            analyzeNode(v, analysis, depth + 1);
          }
        }
      } else {
        prop.values.push({ value: v, type: getValueType(v) });
      }
    }
    
    entity.properties.push(prop);
  }
  
  if (entity.types.length > 0 || entity.properties.length > 0) {
    analysis.entities.push(entity);
  }
}

/**
 * Generate a simple overview diagram showing the main structure
 * @param {object} analysis - Document analysis result
 * @param {object} prefixes - Prefix mappings
 * @returns {string} Mermaid diagram code
 */
function generateOverviewDiagram(analysis, prefixes) {
  let diagram = 'flowchart TD\n';
  
  // Root node
  const rootLabel = sanitizeMermaidLabel(analysis.title || 'Document');
  diagram += `  ROOT[/"${rootLabel}"/]\n`;
  diagram += '  style ROOT fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px\n\n';
  
  // Group entities by type
  const typeGroups = new Map();
  for (const entity of analysis.entities) {
    const typeName = entity.types[0] ? getLocalName(entity.types[0]) : 'Unknown';
    if (!typeGroups.has(typeName)) {
      typeGroups.set(typeName, []);
    }
    typeGroups.get(typeName).push(entity);
  }
  
  // Create type nodes (max 8 types)
  let typeIndex = 0;
  for (const [typeName, entities] of typeGroups) {
    if (typeIndex >= 8) {
      diagram += `  MORE_TYPES(("...+${typeGroups.size - 8}"))\n`;
      diagram += '  style MORE_TYPES fill:#94a3b8,stroke:#64748b\n';
      diagram += '  ROOT --> MORE_TYPES\n';
      break;
    }
    
    const typeId = `T${typeIndex}`;
    const safeTypeName = sanitizeMermaidLabel(typeName);
    const count = entities.length;
    
    diagram += `  ${typeId}{{"${safeTypeName} x${count}"}}\n`;
    diagram += `  style ${typeId} fill:#dcfce7,stroke:#22c55e,stroke-width:2px\n`;
    diagram += `  ROOT --> ${typeId}\n`;
    
    typeIndex++;
  }
  
  // Add metadata
  if (analysis.metadata.id) {
    diagram += `\n  META_ID(["ID: ${sanitizeMermaidLabel(shortenUri(analysis.metadata.id, prefixes))}"])\n`;
    diagram += '  style META_ID fill:#e8f4fc,stroke:#3b82f6\n';
    diagram += '  ROOT -.-> META_ID\n';
  }
  
  return diagram;
}

/**
 * Generate a section diagram for a specific part of the document
 * @param {object} entity - The entity to diagram
 * @param {object} prefixes - Prefix mappings
 * @param {number} index - Entity index
 * @returns {string} Mermaid diagram code
 */
function generateSectionDiagram(entity, prefixes, index) {
  let diagram = 'flowchart LR\n';
  
  // Entity node
  const entityLabel = entity.types[0] 
    ? sanitizeMermaidLabel(getLocalName(entity.types[0]))
    : `Entity ${index + 1}`;
  const entityId = entity.id 
    ? sanitizeMermaidLabel(shortenUri(entity.id, prefixes))
    : '_blank';
  
  diagram += `  E0(["${entityLabel}"])\n`;
  diagram += '  style E0 fill:#e8f4fc,stroke:#3b82f6,stroke-width:2px\n';
  
  // Add type badges
  for (let ti = 0; ti < Math.min(entity.types.length, 2); ti++) {
    const typeLabel = sanitizeMermaidLabel(getLocalName(entity.types[ti]));
    diagram += `  T${ti}{{"${typeLabel}"}}\n`;
    diagram += `  style T${ti} fill:#dcfce7,stroke:#22c55e\n`;
    diagram += `  E0 -->|type| T${ti}\n`;
  }
  
  // Add properties (max 6)
  const propsToShow = entity.properties.slice(0, 6);
  for (let pi = 0; pi < propsToShow.length; pi++) {
    const prop = propsToShow[pi];
    const propLabel = sanitizeMermaidLabel(prop.shortName || getLocalName(prop.name));
    const propId = `P${pi}`;
    
    // Get first value
    if (prop.values.length > 0) {
      const v = prop.values[0];
      
      if (v.type === 'IRI' || v.type === 'IRI Reference') {
        const valLabel = sanitizeMermaidLabel(shortenUri(String(v.value), prefixes));
        diagram += `  ${propId}(["${valLabel}"])\n`;
        diagram += `  style ${propId} fill:#e8f4fc,stroke:#3b82f6\n`;
      } else if (v.type === 'Object' || v.type === 'Typed Node') {
        diagram += `  ${propId}(("nested"))\n`;
        diagram += `  style ${propId} fill:#f3e8ff,stroke:#8b5cf6,stroke-dasharray:3 3\n`;
      } else {
        const valLabel = sanitizeMermaidLabel(String(v.value));
        diagram += `  ${propId}["${valLabel}"]\n`;
        diagram += `  style ${propId} fill:#fef3c7,stroke:#f59e0b\n`;
      }
      
      if (prop.isArray && prop.values.length > 1) {
        diagram += `  E0 -->|"${propLabel} x${prop.values.length}"| ${propId}\n`;
      } else {
        diagram += `  E0 -->|${propLabel}| ${propId}\n`;
      }
    }
  }
  
  // More properties indicator
  if (entity.properties.length > 6) {
    const moreCount = entity.properties.length - 6;
    diagram += `  MORE(("...+${moreCount}"))\n`;
    diagram += '  style MORE fill:#94a3b8,stroke:#64748b\n';
    diagram += '  E0 -.-> MORE\n';
  }
  
  return diagram;
}

/**
 * Generate complete RDF diagram with legend
 */
function generateMermaidRdfGraph(analysis, prefixes) {
  // For simple documents, show full graph
  // For complex documents, show overview only
  if (analysis.entities.length <= 3) {
    return generateDetailedRdfGraph(analysis, prefixes);
  } else {
    return generateOverviewDiagram(analysis, prefixes);
  }
}

/**
 * Generate detailed RDF graph for simple documents
 */
function generateDetailedRdfGraph(analysis, prefixes) {
  let diagram = 'flowchart TD\n';
  
  // Track nodes
  const nodeIds = new Map();
  let nodeCounter = 0;
  const createdNodes = new Set();
  
  const getNodeId = (value) => {
    const key = String(value || 'null').substring(0, 100);
    if (!nodeIds.has(key)) {
      nodeIds.set(key, `N${nodeCounter++}`);
    }
    return nodeIds.get(key);
  };
  
  for (const entity of analysis.entities.slice(0, 5)) {
    try {
      const entityId = entity.id || `_blank_${nodeCounter}`;
      const subjectLabel = entity.id 
        ? sanitizeMermaidLabel(shortenUri(entity.id, prefixes))
        : '_blank';
      const subjectId = getNodeId(entityId);
      
      if (!createdNodes.has(subjectId)) {
        createdNodes.add(subjectId);
        if (entity.id && !entity.id.startsWith('_:')) {
          diagram += `  ${subjectId}(["${subjectLabel}"])\n`;
          diagram += `  style ${subjectId} fill:#e8f4fc,stroke:#3b82f6,stroke-width:2px\n`;
        } else {
          diagram += `  ${subjectId}(("${subjectLabel}"))\n`;
          diagram += `  style ${subjectId} fill:#f3e8ff,stroke:#8b5cf6,stroke-dasharray:3 3\n`;
        }
      }
      
      // Types
      for (const type of entity.types.slice(0, 2)) {
        const typeLabel = sanitizeMermaidLabel(shortenUri(type, prefixes));
        const typeId = getNodeId(`type_${type}`);
        if (!createdNodes.has(typeId)) {
          createdNodes.add(typeId);
          diagram += `  ${typeId}{{"${typeLabel}"}}\n`;
          diagram += `  style ${typeId} fill:#dcfce7,stroke:#22c55e\n`;
        }
        diagram += `  ${subjectId} -->|type| ${typeId}\n`;
      }
      
      // Properties (max 4)
      for (const prop of entity.properties.slice(0, 4)) {
        const predLabel = sanitizeMermaidLabel(prop.shortName || getLocalName(prop.name));
        
        if (prop.values.length > 0) {
          const v = prop.values[0];
          const objId = getNodeId(`${entityId}_${prop.name}`);
          
          if (!createdNodes.has(objId)) {
            createdNodes.add(objId);
            
            if (v.type === 'IRI' || v.type === 'IRI Reference') {
              const objLabel = sanitizeMermaidLabel(shortenUri(String(v.value), prefixes));
              diagram += `  ${objId}(["${objLabel}"])\n`;
              diagram += `  style ${objId} fill:#e8f4fc,stroke:#3b82f6\n`;
            } else if (v.type === 'Object' || v.type === 'Typed Node') {
              diagram += `  ${objId}(("nested"))\n`;
              diagram += `  style ${objId} fill:#f3e8ff,stroke:#8b5cf6,stroke-dasharray:3 3\n`;
            } else {
              const litValue = sanitizeMermaidLabel(String(v.value));
              diagram += `  ${objId}["${litValue}"]\n`;
              diagram += `  style ${objId} fill:#fef3c7,stroke:#f59e0b\n`;
            }
          }
          
          diagram += `  ${subjectId} -->|${predLabel}| ${objId}\n`;
        }
      }
    } catch (err) {
      console.warn('Skipping entity:', err.message);
    }
  }
  
  return diagram;
}

/**
 * Generate Mermaid class diagram from analysis (for schema/ontology view)
 * @param {object} analysis - Document analysis result
 * @param {object} prefixes - Prefix mappings
 * @returns {string} Mermaid diagram code
 */
function generateMermaidClassDiagram(analysis, prefixes) {
  const maxClasses = 10;
  const maxPropsPerClass = 10;
  
  let diagram = 'classDiagram\n';
  
  // Track classes and relationships
  const classes = new Map();
  const relationships = [];
  
  // Process entities (limited)
  const entitiesToProcess = analysis.entities.slice(0, 30);
  
  for (const entity of entitiesToProcess) {
    try {
      const typeName = entity.types[0] 
        ? sanitizeMermaidId(getLocalName(entity.types[0])) 
        : 'Entity';
      
      if (!typeName || typeName === 'Unknown') continue;
      
      if (!classes.has(typeName)) {
        classes.set(typeName, {
          properties: new Set()
        });
      }
      
      const classInfo = classes.get(typeName);
      
      // Add properties (limited per class)
      for (const prop of entity.properties.slice(0, 15)) {
        const propName = sanitizeMermaidId(prop.shortName || prop.name);
        if (!propName || propName === 'Unknown') continue;
        
        const propType = getMermaidType(prop.valueType);
        const cardinality = prop.isArray ? ' list' : '';
        const propDef = `${propType}${cardinality} ${propName}`;
        
        classInfo.properties.add(propDef);
        
        // Detect relationships to other classes
        if (prop.valueType === 'IRI Reference' || prop.valueType === 'Typed Node' || prop.valueType === 'Object') {
          for (const v of prop.values.slice(0, 3)) {
            if (v.type === 'Object' || v.type === 'Typed Node') {
              const targetEntity = analysis.entities.find(e => 
                e.id && prop.values.some(pv => pv.value === e.id)
              );
              if (targetEntity && targetEntity.types[0]) {
                const targetType = sanitizeMermaidId(getLocalName(targetEntity.types[0]));
                if (targetType && targetType !== 'Unknown' && targetType !== typeName) {
                  relationships.push({
                    from: typeName,
                    to: targetType,
                    label: propName
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Skip problematic entities
      console.warn('Skipping entity in class diagram:', err.message);
    }
  }
  
  // Generate class definitions (limited)
  let classCount = 0;
  for (const [className, classInfo] of classes) {
    if (classCount >= maxClasses) {
      diagram += `  class MoreClasses["... +${classes.size - maxClasses} more"]\n`;
      break;
    }
    
    diagram += `  class ${className} {\n`;
    const propsArray = Array.from(classInfo.properties);
    for (const prop of propsArray.slice(0, maxPropsPerClass)) {
      diagram += `    ${prop}\n`;
    }
    if (propsArray.length > maxPropsPerClass) {
      diagram += `    ... +${propsArray.length - maxPropsPerClass} more\n`;
    }
    diagram += `  }\n`;
    classCount++;
  }
  
  // Generate relationships (limited)
  const seenRelations = new Set();
  let relCount = 0;
  for (const rel of relationships) {
    if (relCount >= 15) break;
    
    const relKey = `${rel.from}-${rel.to}`;
    if (!seenRelations.has(relKey) && classes.has(rel.to)) {
      seenRelations.add(relKey);
      diagram += `  ${rel.from} --> ${rel.to} : ${rel.label}\n`;
      relCount++;
    }
  }
  
  return diagram;
}

/**
 * Generate Mermaid entity-relationship diagram
 */
function generateMermaidERDiagram(analysis, prefixes) {
  const maxEntities = 8;
  const maxPropsPerEntity = 8;
  
  let diagram = 'erDiagram\n';
  
  // Track unique entity types
  const entityTypes = new Map();
  
  for (const entity of analysis.entities.slice(0, 30)) {
    try {
      const entityName = entity.types[0] 
        ? sanitizeMermaidId(getLocalName(entity.types[0])) 
        : 'ENTITY';
      
      if (!entityName || entityName === 'Unknown') continue;
      
      if (!entityTypes.has(entityName)) {
        entityTypes.set(entityName, new Set());
      }
      
      const props = entityTypes.get(entityName);
      for (const prop of entity.properties.slice(0, 15)) {
        const propName = sanitizeMermaidId(prop.shortName || prop.name);
        if (propName && propName !== 'Unknown') {
          const propType = getMermaidType(prop.valueType);
          props.add(`${propType} ${propName}`);
        }
      }
    } catch (err) {
      // Skip problematic entities
    }
  }
  
  // Generate ER entities (limited)
  let entityCount = 0;
  for (const [entityName, props] of entityTypes) {
    if (entityCount >= maxEntities) break;
    
    diagram += `  ${entityName} {\n`;
    const propsArray = Array.from(props);
    for (const prop of propsArray.slice(0, maxPropsPerEntity)) {
      diagram += `    ${prop}\n`;
    }
    diagram += `  }\n`;
    entityCount++;
  }
  
  return diagram;
}

/**
 * Generate Mermaid flowchart - now delegates to RDF Graph diagram
 * Kept for backwards compatibility
 */
function generateMermaidFlowchart(analysis, prefixes) {
  return generateMermaidRdfGraph(analysis, prefixes);
}

/**
 * Sanitize string for Mermaid ID (alphanumeric only)
 */
function sanitizeMermaidId(str) {
  if (!str) return 'Unknown';
  // Remove all non-alphanumeric characters except underscore
  return str
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30) || 'Unknown';
}

/**
 * Sanitize string for Mermaid label (escape special chars)
 * Mermaid is very sensitive to special characters in labels
 */
function sanitizeMermaidLabel(str) {
  if (!str) return 'Unknown';
  if (typeof str !== 'string') {
    str = String(str);
  }
  return str
    // Remove or replace problematic characters
    .replace(/"/g, "'")
    .replace(/`/g, "'")
    .replace(/\\/g, '/')
    .replace(/[<>{}[\]|#&()]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 40) || 'Value';
}

/**
 * Convert value type to Mermaid-friendly type
 */
function getMermaidType(valueType) {
  if (!valueType) return 'any';
  if (valueType.startsWith('xsd:')) return valueType.replace('xsd:', '');
  if (valueType === 'IRI' || valueType === 'IRI Reference') return 'uri';
  if (valueType === 'Array') return 'list';
  if (valueType === 'Typed Node' || valueType === 'Object') return 'object';
  if (valueType === 'Blank Node') return 'node';
  return valueType.toLowerCase();
}

/**
 * Generate HTML documentation from a JSON-LD document
 * @param {object} jsonldDoc - The JSON-LD document to document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateDocumentation(jsonldDoc, options = {}) {
  try {
    const {
      includeContext = true,
      includeGraph = false,
      language = 'en',
      theme = 'light'
    } = options;
    
    const analysis = await analyzeDocument(jsonldDoc);
    
    // Generate HTML
    let html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(analysis.title)}</title>
  <style>
    :root {
      --primary-color: #6366f1;
      --secondary-color: #8b5cf6;
      --bg-color: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
      --text-color: ${theme === 'dark' ? '#e2e8f0' : '#1e293b'};
      --border-color: ${theme === 'dark' ? '#374151' : '#e2e8f0'};
      --code-bg: ${theme === 'dark' ? '#0f172a' : '#f1f5f9'};
      --table-header-bg: ${theme === 'dark' ? '#1e293b' : '#f8fafc'};
      --link-color: #6366f1;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1, h2, h3, h4 { margin-bottom: 1rem; color: var(--primary-color); }
    h1 { font-size: 2rem; border-bottom: 3px solid var(--primary-color); padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; }
    
    .metadata { 
      background: var(--table-header-bg); 
      padding: 1rem; 
      border-radius: 8px; 
      margin-bottom: 2rem;
      border: 1px solid var(--border-color);
    }
    .metadata p { margin: 0.5rem 0; }
    .metadata .label { font-weight: 600; color: var(--secondary-color); }
    
    .description { 
      font-size: 1.1rem; 
      color: var(--text-color); 
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--code-bg);
      border-radius: 8px;
      border-left: 4px solid var(--primary-color);
    }
    
    .toc {
      background: var(--table-header-bg);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      border: 1px solid var(--border-color);
    }
    .toc h2 { margin-top: 0; border: none; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 0.5rem 0; }
    .toc a { color: var(--link-color); text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    
    .prefixes-table, .properties-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 2rem;
      font-size: 0.9rem;
    }
    
    .prefixes-table th, .prefixes-table td,
    .properties-table th, .properties-table td {
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      text-align: left;
    }
    
    .prefixes-table th, .properties-table th {
      background: var(--table-header-bg);
      font-weight: 600;
      color: var(--secondary-color);
    }
    
    .prefixes-table tr:nth-child(even),
    .properties-table tr:nth-child(even) {
      background: var(--code-bg);
    }
    
    .entity-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--table-header-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    
    .entity-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .type-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: var(--primary-color);
      color: white;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .entity-id {
      font-family: monospace;
      font-size: 0.85rem;
      color: var(--secondary-color);
      word-break: break-all;
    }
    
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: var(--code-bg);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.85em;
    }
    
    .value-type {
      color: var(--secondary-color);
      font-size: 0.8rem;
      font-style: italic;
    }
    
    .cardinality {
      font-weight: 600;
      color: var(--primary-color);
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      font-size: 0.85rem;
      color: var(--text-color);
      opacity: 0.7;
    }
    
    .diagram-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--table-header-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    
    .diagram-container {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
    }
    
    .diagram-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .diagram-tab {
      padding: 0.5rem 1rem;
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .diagram-tab.active {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
    
    .mermaid-source {
      display: none;
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85rem;
      white-space: pre;
    }
    
    .diagram-hidden {
      position: absolute;
      left: -9999px;
      visibility: hidden;
    }
    
    .diagram-visible {
      position: static;
      visibility: visible;
    }
    
    @media print {
      body { padding: 1rem; }
      .toc { break-after: page; }
      .diagram-tabs { display: none; }
      .mermaid-source { display: none !important; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.initialize({ 
        startOnLoad: true, 
        theme: '${theme === 'dark' ? 'dark' : 'default'}',
        securityLevel: 'loose'
      });
      
      // After Mermaid renders, hide the second diagram properly
      setTimeout(function() {
        var classDiv = document.getElementById('diagram-class');
        if (classDiv) {
          classDiv.classList.remove('diagram-hidden');
          classDiv.style.display = 'none';
        }
      }, 500);
    });
    
    function showDiagram(type) {
      document.querySelectorAll('.diagram-content').forEach(function(el) {
        el.style.display = 'none';
        el.classList.remove('diagram-hidden');
      });
      document.querySelectorAll('.diagram-tab').forEach(function(el) {
        el.classList.remove('active');
      });
      var targetDiv = document.getElementById('diagram-' + type);
      if (targetDiv) {
        targetDiv.style.display = 'block';
      }
      var targetTab = document.querySelector('[data-diagram="' + type + '"]');
      if (targetTab) {
        targetTab.classList.add('active');
      }
    }
    
    function toggleSource(id) {
      var source = document.getElementById(id);
      if (source) {
        source.style.display = source.style.display === 'none' ? 'block' : 'none';
      }
    }
    
    function copyMermaidSource(id) {
      var source = document.getElementById(id);
      if (source) {
        navigator.clipboard.writeText(source.textContent);
        alert('Mermaid code copied to clipboard!');
      }
    }
  </script>
</head>
<body>
  <header>
    <h1>${escapeHtml(analysis.title)}</h1>
    ${analysis.description ? `<div class="description">${escapeHtml(analysis.description)}</div>` : ''}
    
    <div class="metadata">
      ${analysis.metadata.id ? `<p><span class="label">Document ID:</span> <code>${escapeHtml(analysis.metadata.id)}</code></p>` : ''}
      <p><span class="label">Types found:</span> ${analysis.types.length}</p>
      <p><span class="label">Entities found:</span> ${analysis.entities.length}</p>
      <p><span class="label">Generated:</span> ${new Date().toISOString()}</p>
    </div>
  </header>
  
  <nav class="toc">
    <h2>Table of Contents</h2>
    <ul>
      <li><a href="#diagrams">Structure Diagrams</a></li>
      <li><a href="#namespaces">Namespaces</a></li>
      <li><a href="#types">Types Overview</a></li>
      ${analysis.entities.map((entity, i) => {
        const entityName = entity.types[0] ? getLocalName(entity.types[0]) : `Entity ${i + 1}`;
        return `<li><a href="#entity-${i}">${escapeHtml(entityName)}</a></li>`;
      }).join('\n      ')}
    </ul>
  </nav>
  
  <section id="diagrams" class="diagram-section">
    <h2>Document Overview</h2>
    <p>High-level structure showing main types and their distribution.</p>
    
    <div class="diagram-container">
      <pre class="mermaid">
${generateOverviewDiagram(analysis, analysis.prefixes)}
      </pre>
    </div>
    
    <h3>RDF Notation Legend</h3>
    <table class="prefixes-table" style="max-width: 400px;">
      <tr><td style="background:#e8f4fc;border:2px solid #3b82f6;border-radius:20px;text-align:center;">Oval</td><td>IRI/Resource</td></tr>
      <tr><td style="background:#fef3c7;border:2px solid #f59e0b;text-align:center;">Rectangle</td><td>Literal Value</td></tr>
      <tr><td style="background:#f3e8ff;border:2px dashed #8b5cf6;border-radius:50%;text-align:center;">Circle</td><td>Blank Node</td></tr>
      <tr><td style="background:#dcfce7;border:2px solid #22c55e;text-align:center;">Hexagon</td><td>rdf:type (Class)</td></tr>
    </table>
  </section>
  
  ${analysis.entities.slice(0, 10).map((entity, i) => {
    const entityName = entity.types[0] ? getLocalName(entity.types[0]) : `Entity ${i + 1}`;
    const entityId = entity.id ? shortenUri(entity.id, analysis.prefixes) : '_blank';
    return `
  <section id="entity-diagram-${i}" class="diagram-section">
    <h3>${escapeHtml(entityName)} - Structure</h3>
    <p class="entity-id">ID: <code>${escapeHtml(entityId)}</code></p>
    <div class="diagram-container">
      <pre class="mermaid">
${generateSectionDiagram(entity, analysis.prefixes, i)}
      </pre>
    </div>
  </section>`;
  }).join('')}
  
  <section id="namespaces">
    <h2>Namespaces</h2>
    <table class="prefixes-table">
      <thead>
        <tr>
          <th>Prefix</th>
          <th>Namespace URI</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(analysis.prefixes).map(([prefix, uri]) => `
        <tr>
          <td><code>${escapeHtml(prefix)}</code></td>
          <td><code>${escapeHtml(uri)}</code></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>
  
  <section id="types">
    <h2>Types Overview</h2>
    <p>The following types are used in this document:</p>
    <ul>
      ${analysis.types.map(type => `
      <li><code>${escapeHtml(shortenUri(type, analysis.prefixes))}</code></li>`).join('')}
    </ul>
  </section>
  
  ${analysis.entities.map((entity, i) => {
    const entityName = entity.types[0] ? getLocalName(entity.types[0]) : `Entity ${i + 1}`;
    return `
  <section id="entity-${i}" class="entity-section">
    <div class="entity-header">
      <h3>${escapeHtml(entityName)}</h3>
      ${entity.types.map(t => `<span class="type-badge">${escapeHtml(getLocalName(t))}</span>`).join(' ')}
    </div>
    ${entity.id ? `<p class="entity-id">ID: <code>${escapeHtml(entity.id)}</code></p>` : ''}
    
    <h4>Properties</h4>
    <table class="properties-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Value Type</th>
          <th>Cardinality</th>
          <th>Value(s)</th>
        </tr>
      </thead>
      <tbody>
        ${entity.properties.map(prop => `
        <tr>
          <td><code>${escapeHtml(prop.shortName || prop.name)}</code></td>
          <td><span class="value-type">${escapeHtml(prop.valueType || 'unknown')}</span></td>
          <td><span class="cardinality">${prop.isArray ? `[${prop.count}]` : '1'}</span></td>
          <td>${prop.values.slice(0, 5).map(v => 
            `<code>${escapeHtml(String(v.value).substring(0, 100))}${String(v.value).length > 100 ? '...' : ''}</code>`
          ).join(', ')}${prop.values.length > 5 ? ` <em>... and ${prop.values.length - 5} more</em>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`;
  }).join('')}
  
  <footer class="footer">
    <p>Documentation generated by JSON-LD Builder &amp; Validator</p>
    <p>Generated on: ${new Date().toLocaleString()}</p>
  </footer>
</body>
</html>`;
    
    return { success: true, data: html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate markdown documentation from a JSON-LD document
 */
export async function generateMarkdownDocumentation(jsonldDoc, options = {}) {
  try {
    const analysis = await analyzeDocument(jsonldDoc);
    
    let md = `# ${analysis.title}\n\n`;
    
    if (analysis.description) {
      md += `> ${analysis.description}\n\n`;
    }
    
    // Metadata
    md += `## Metadata\n\n`;
    if (analysis.metadata.id) {
      md += `- **Document ID:** \`${analysis.metadata.id}\`\n`;
    }
    md += `- **Types found:** ${analysis.types.length}\n`;
    md += `- **Entities found:** ${analysis.entities.length}\n`;
    md += `- **Generated:** ${new Date().toISOString()}\n\n`;
    
    // Table of Contents
    md += `## Table of Contents\n\n`;
    md += `1. [Document Overview](#document-overview)\n`;
    md += `2. [Namespaces](#namespaces)\n`;
    md += `3. [Types Overview](#types-overview)\n`;
    analysis.entities.slice(0, 10).forEach((entity, i) => {
      const entityName = entity.types[0] ? getLocalName(entity.types[0]) : `Entity ${i + 1}`;
      md += `${i + 4}. [${entityName}](#entity-${i + 1})\n`;
    });
    md += `\n`;
    
    // Document Overview with diagram
    md += `## Document Overview\n\n`;
    md += `High-level structure showing main types and their distribution.\n\n`;
    
    md += `### RDF Graph Notation\n\n`;
    md += `| Shape | Meaning |\n`;
    md += `|-------|--------|\n`;
    md += `| 🔵 Rounded box | IRI/Resource (URI) |\n`;
    md += `| 🟡 Rectangle | Literal value |\n`;
    md += `| 🟣 Dashed circle | Blank node |\n`;
    md += `| 🟢 Hexagon | rdf:type (class) |\n`;
    md += `| → Arrow | Property (predicate) |\n\n`;
    
    md += `### Overview Diagram\n\n`;
    md += '```mermaid\n';
    md += generateOverviewDiagram(analysis, analysis.prefixes);
    md += '```\n\n';
    
    // Namespaces
    md += `## Namespaces\n\n`;
    md += `| Prefix | Namespace URI |\n`;
    md += `|--------|---------------|\n`;
    for (const [prefix, uri] of Object.entries(analysis.prefixes)) {
      md += `| \`${prefix}\` | \`${uri}\` |\n`;
    }
    md += `\n`;
    
    // Types Overview
    md += `## Types Overview\n\n`;
    md += `The following types are used in this document:\n\n`;
    for (const type of analysis.types) {
      md += `- \`${shortenUri(type, analysis.prefixes)}\`\n`;
    }
    md += `\n`;
    
    // Entities with individual diagrams
    analysis.entities.slice(0, 10).forEach((entity, i) => {
      const entityName = entity.types[0] ? getLocalName(entity.types[0]) : `Entity ${i + 1}`;
      md += `## Entity ${i + 1}: ${entityName}\n\n`;
      
      if (entity.types.length > 0) {
        md += `**Types:** ${entity.types.map(t => `\`${getLocalName(t)}\``).join(', ')}\n\n`;
      }
      
      if (entity.id) {
        md += `**ID:** \`${entity.id}\`\n\n`;
      }
      
      // Entity diagram
      md += `### Structure Diagram\n\n`;
      md += '```mermaid\n';
      md += generateSectionDiagram(entity, analysis.prefixes, i);
      md += '```\n\n';
      
      md += `### Properties\n\n`;
      md += `| Property | Value Type | Cardinality | Value(s) |\n`;
      md += `|----------|------------|-------------|----------|\n`;
      
      for (const prop of entity.properties) {
        const values = prop.values.slice(0, 3)
          .map(v => String(v.value).substring(0, 50) + (String(v.value).length > 50 ? '...' : ''))
          .join(', ');
        md += `| \`${prop.shortName || prop.name}\` | ${prop.valueType || 'unknown'} | ${prop.isArray ? `[${prop.count}]` : '1'} | ${values} |\n`;
      }
      md += `\n`;
    });
    
    // Show count of remaining entities if truncated
    if (analysis.entities.length > 10) {
      md += `*...and ${analysis.entities.length - 10} more entities not shown.*\n\n`;
    }
    
    // Footer
    md += `---\n\n`;
    md += `*Documentation generated by JSON-LD Builder & Validator on ${new Date().toLocaleString()}*\n`;
    
    return { success: true, data: md };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate PDF-ready HTML documentation with print-optimized styles
 * This generates HTML that can be converted to PDF via browser print
 * @param {object} jsonldDoc - The JSON-LD document to document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generatePdfDocumentation(jsonldDoc, options = {}) {
  try {
    const result = await generateDocumentation(jsonldDoc, { ...options, theme: 'light' });
    
    if (!result.success) {
      return result;
    }
    
    // Add PDF-specific print styles and auto-print script
    const pdfHtml = result.data.replace('</head>', `
  <style>
    @media print {
      body { 
        padding: 0.5in; 
        font-size: 10pt;
        max-width: 100%;
      }
      
      h1 { 
        font-size: 18pt; 
        page-break-after: avoid; 
      }
      h2 { 
        font-size: 14pt; 
        page-break-after: avoid;
        margin-top: 1em;
      }
      h3, h4 { 
        font-size: 12pt; 
        page-break-after: avoid; 
      }
      
      .toc { 
        page-break-after: always; 
      }
      
      .entity-section { 
        page-break-inside: avoid; 
      }
      
      .diagram-section {
        page-break-before: always;
      }
      
      .diagram-tabs, .mermaid-source { 
        display: none !important; 
      }
      
      .diagram-content {
        page-break-inside: avoid;
        min-height: 300px;
      }
      
      /* Show RDF diagram, hide class diagram in print */
      #diagram-rdf {
        display: block !important;
      }
      
      #diagram-class {
        display: none !important;
      }
      
      table { 
        font-size: 9pt;
        page-break-inside: avoid;
      }
      
      code {
        font-size: 8pt;
        word-break: break-all;
      }
      
      .metadata {
        page-break-inside: avoid;
      }
      
      .footer {
        page-break-before: always;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
      }
      
      /* Hide interactive elements */
      button { display: none !important; }
      
      /* Force color printing */
      * { 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    
    @page {
      size: A4;
      margin: 1cm;
    }
  </style>
</head>`);

    return { success: true, data: pdfHtml };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Mermaid diagram code only (for external use)
 */
export async function generateMermaidDiagramsOnly(jsonldDoc, options = {}) {
  try {
    const analysis = await analyzeDocument(jsonldDoc);
    
    const diagrams = {
      rdfGraph: generateMermaidRdfGraph(analysis, analysis.prefixes),
      classDiagram: generateMermaidClassDiagram(analysis, analysis.prefixes),
      flowchart: generateMermaidFlowchart(analysis, analysis.prefixes),
      erDiagram: generateMermaidERDiagram(analysis, analysis.prefixes)
    };
    
    return { success: true, data: diagrams };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  generateDocumentation,
  generateMarkdownDocumentation,
  generatePdfDocumentation,
  generateMermaidDiagramsOnly,
  generateContextDocumentation,
  generateContextMarkdownDocumentation,
  generateContextPdfDocumentation,
  generateContextDiagramsOnly
};

/**
 * Analyze the @context of a JSON-LD document
 * Fetches remote contexts to get full information
 * @param {object} jsonldDoc - The JSON-LD document
 * @param {object} options - Options for analysis
 * @returns {Promise<object>} Context analysis
 */
async function analyzeContext(jsonldDoc, options = {}) {
  const context = jsonldDoc['@context'];
  const result = {
    type: 'unknown',
    prefixes: {},
    terms: [],
    imports: [],
    importedContexts: [], // Detailed info about imported contexts
    baseUri: null,
    vocab: null,
    language: null,
    fetchErrors: []
  };
  
  if (!context) {
    return result;
  }
  
  // Handle array of contexts
  if (Array.isArray(context)) {
    result.type = 'array';
    for (const ctx of context) {
      if (typeof ctx === 'string') {
        result.imports.push(ctx);
        // Fetch remote context
        await fetchAndAnalyzeRemoteContext(ctx, result);
      } else if (typeof ctx === 'object') {
        mergeContextAnalysis(result, analyzeContextObject(ctx));
      }
    }
  } else if (typeof context === 'string') {
    result.type = 'reference';
    result.imports.push(context);
    // Fetch remote context
    await fetchAndAnalyzeRemoteContext(context, result);
  } else if (typeof context === 'object') {
    result.type = 'inline';
    mergeContextAnalysis(result, analyzeContextObject(context));
  }
  
  return result;
}

/**
 * Fetch and analyze a remote context
 * @param {string} url - The context URL
 * @param {object} result - The result object to merge into
 */
async function fetchAndAnalyzeRemoteContext(url, result) {
  try {
    console.log(`Fetching remote context for documentation: ${url}`);
    const remoteDoc = await jsonldProcessor.fetchRemoteContext(url);
    
    if (remoteDoc && remoteDoc['@context']) {
      const remoteContext = remoteDoc['@context'];
      const analysis = analyzeContextObject(remoteContext);
      
      // Store detailed info about this imported context
      result.importedContexts.push({
        url,
        prefixCount: Object.keys(analysis.prefixes).length,
        termCount: analysis.terms.length,
        baseUri: analysis.baseUri,
        vocab: analysis.vocab,
        language: analysis.language,
        prefixes: analysis.prefixes,
        terms: analysis.terms,
        success: true
      });
      
      // Merge the analysis
      mergeContextAnalysis(result, analysis);
      
      console.log(`Successfully analyzed remote context: ${url}`);
    }
  } catch (error) {
    console.warn(`Failed to fetch remote context ${url}:`, error.message);
    result.fetchErrors.push({
      url,
      error: error.message
    });
    result.importedContexts.push({
      url,
      success: false,
      error: error.message
    });
  }
}

/**
 * Analyze a context object
 */
function analyzeContextObject(ctx) {
  const result = {
    prefixes: {},
    terms: [],
    baseUri: null,
    vocab: null,
    language: null
  };
  
  for (const [key, value] of Object.entries(ctx)) {
    if (key === '@base') {
      result.baseUri = value;
    } else if (key === '@vocab') {
      result.vocab = value;
    } else if (key === '@language') {
      result.language = value;
    } else if (key.startsWith('@')) {
      // Other keywords
      continue;
    } else if (typeof value === 'string') {
      // Could be a prefix or a simple term
      if (value.endsWith('/') || value.endsWith('#') || value.endsWith(':')) {
        result.prefixes[key] = value;
      } else {
        result.terms.push({
          term: key,
          expansion: value,
          type: 'simple'
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      const termDef = {
        term: key,
        type: 'expanded',
        id: value['@id'] || null,
        typeCoercion: value['@type'] || null,
        container: value['@container'] || null,
        language: value['@language'] || null,
        reverse: value['@reverse'] || null
      };
      result.terms.push(termDef);
      
      // Check if it's also a prefix
      if (value['@id'] && (value['@id'].endsWith('/') || value['@id'].endsWith('#'))) {
        result.prefixes[key] = value['@id'];
      }
    }
  }
  
  return result;
}

/**
 * Merge context analysis results
 */
function mergeContextAnalysis(target, source) {
  Object.assign(target.prefixes, source.prefixes);
  target.terms.push(...source.terms);
  if (source.baseUri) target.baseUri = source.baseUri;
  if (source.vocab) target.vocab = source.vocab;
  if (source.language) target.language = source.language;
}

/**
 * Generate Mermaid diagram for context structure
 */
function generateContextDiagram(contextAnalysis) {
  let diagram = 'flowchart TD\n';
  
  // Root context node
  diagram += '  CTX[/"@context"/]\n';
  diagram += '  style CTX fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px\n\n';
  
  // Imported contexts with detailed info
  if (contextAnalysis.imports.length > 0) {
    diagram += '  IMPORTS{{"Imported Contexts"}}\n';
    diagram += '  style IMPORTS fill:#dcfce7,stroke:#22c55e\n';
    diagram += '  CTX --> IMPORTS\n\n';
    
    const importedContexts = contextAnalysis.importedContexts || [];
    contextAnalysis.imports.slice(0, 5).forEach((imp, i) => {
      const ctx = importedContexts.find(c => c.url === imp);
      const shortUrl = imp.length > 35 ? '...' + imp.slice(-32) : imp;
      
      if (ctx && ctx.success) {
        // Show detailed info for successfully fetched contexts
        const label = sanitizeMermaidLabel(`${shortUrl}`);
        diagram += `  IMP${i}(["${label}"])\n`;
        diagram += `  style IMP${i} fill:#e8f4fc,stroke:#3b82f6\n`;
        diagram += `  IMPORTS --> IMP${i}\n`;
        
        // Show counts
        if (ctx.prefixCount > 0 || ctx.termCount > 0) {
          diagram += `  IMP${i}_INFO["${ctx.prefixCount} prefixes, ${ctx.termCount} terms"]\n`;
          diagram += `  style IMP${i}_INFO fill:#fef3c7,stroke:#f59e0b\n`;
          diagram += `  IMP${i} --> IMP${i}_INFO\n`;
        }
        if (ctx.vocab) {
          const vocabShort = ctx.vocab.length > 25 ? ctx.vocab.slice(0, 22) + '...' : ctx.vocab;
          diagram += `  IMP${i}_VOCAB["@vocab: ${sanitizeMermaidLabel(vocabShort)}"]\n`;
          diagram += `  style IMP${i}_VOCAB fill:#f3e8ff,stroke:#8b5cf6\n`;
          diagram += `  IMP${i} --> IMP${i}_VOCAB\n`;
        }
      } else {
        // Show error for failed fetches
        const label = sanitizeMermaidLabel(shortUrl);
        diagram += `  IMP${i}(["${label}"])\n`;
        diagram += `  style IMP${i} fill:#fee2e2,stroke:#ef4444\n`;
        diagram += `  IMPORTS --> IMP${i}\n`;
      }
      diagram += '\n';
    });
    
    if (contextAnalysis.imports.length > 5) {
      diagram += `  IMP_MORE(("...+${contextAnalysis.imports.length - 5}"))\n`;
      diagram += '  style IMP_MORE fill:#94a3b8,stroke:#64748b\n';
      diagram += '  IMPORTS --> IMP_MORE\n';
    }
  }
  
  // Prefixes
  const prefixCount = Object.keys(contextAnalysis.prefixes).length;
  if (prefixCount > 0) {
    diagram += '\n  PREFIXES{{"Prefixes x' + prefixCount + '"}}\n';
    diagram += '  style PREFIXES fill:#fef3c7,stroke:#f59e0b\n';
    diagram += '  CTX --> PREFIXES\n';
    
    Object.entries(contextAnalysis.prefixes).slice(0, 6).forEach(([prefix, uri], i) => {
      const label = sanitizeMermaidLabel(`${prefix}: ${uri.length > 25 ? uri.slice(0, 22) + '...' : uri}`);
      diagram += `  PRE${i}["${label}"]\n`;
      diagram += `  style PRE${i} fill:#fef3c7,stroke:#f59e0b\n`;
      diagram += `  PREFIXES --> PRE${i}\n`;
    });
    
    if (prefixCount > 6) {
      diagram += `  PRE_MORE(("...+${prefixCount - 6}"))\n`;
      diagram += '  style PRE_MORE fill:#94a3b8,stroke:#64748b\n';
      diagram += '  PREFIXES --> PRE_MORE\n';
    }
  }
  
  // Terms
  const termCount = contextAnalysis.terms.length;
  if (termCount > 0) {
    diagram += '\n  TERMS{{"Terms x' + termCount + '"}}\n';
    diagram += '  style TERMS fill:#f3e8ff,stroke:#8b5cf6\n';
    diagram += '  CTX --> TERMS\n';
    
    contextAnalysis.terms.slice(0, 6).forEach((term, i) => {
      const label = sanitizeMermaidLabel(term.term);
      diagram += `  TRM${i}(("${label}"))\n`;
      diagram += `  style TRM${i} fill:#f3e8ff,stroke:#8b5cf6,stroke-dasharray:3 3\n`;
      diagram += `  TERMS --> TRM${i}\n`;
    });
    
    if (termCount > 6) {
      diagram += `  TRM_MORE(("...+${termCount - 6}"))\n`;
      diagram += '  style TRM_MORE fill:#94a3b8,stroke:#64748b\n';
      diagram += '  TERMS --> TRM_MORE\n';
    }
  }
  
  // Special keywords
  if (contextAnalysis.baseUri || contextAnalysis.vocab || contextAnalysis.language) {
    diagram += '\n  KEYWORDS{{"Keywords"}}\n';
    diagram += '  style KEYWORDS fill:#fee2e2,stroke:#ef4444\n';
    diagram += '  CTX --> KEYWORDS\n';
    
    if (contextAnalysis.baseUri) {
      diagram += `  BASE["@base: ${sanitizeMermaidLabel(contextAnalysis.baseUri)}"]\n`;
      diagram += '  KEYWORDS --> BASE\n';
    }
    if (contextAnalysis.vocab) {
      const vocabLabel = contextAnalysis.vocab.length > 30 
        ? contextAnalysis.vocab.slice(0, 27) + '...' 
        : contextAnalysis.vocab;
      diagram += `  VOCAB["@vocab: ${sanitizeMermaidLabel(vocabLabel)}"]\n`;
      diagram += '  KEYWORDS --> VOCAB\n';
    }
    if (contextAnalysis.language) {
      diagram += `  LANG["@language: ${sanitizeMermaidLabel(contextAnalysis.language)}"]\n`;
      diagram += '  KEYWORDS --> LANG\n';
    }
  }
  
  return diagram;
}

/**
 * Generate HTML documentation for the @context only
 * @param {object} jsonldDoc - The JSON-LD document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateContextDocumentation(jsonldDoc, options = {}) {
  try {
    const contextAnalysis = await analyzeContext(jsonldDoc);
    const theme = options.theme || 'dark';
    
    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSON-LD Context Documentation</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg-primary: ${theme === 'dark' ? '#0f0f23' : '#f8fafc'};
      --bg-secondary: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
      --bg-tertiary: ${theme === 'dark' ? '#252541' : '#f1f5f9'};
      --text-primary: ${theme === 'dark' ? '#e4e4f0' : '#1e293b'};
      --text-secondary: ${theme === 'dark' ? '#a0a0b8' : '#64748b'};
      --border: ${theme === 'dark' ? '#3a3a5c' : '#e2e8f0'};
      --accent: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    h1 { color: var(--accent); margin-bottom: 1rem; }
    h2 { color: var(--accent); margin: 2rem 0 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h3 { color: var(--text-primary); margin: 1.5rem 0 0.75rem; }
    .metadata { display: grid; gap: 0.5rem; color: var(--text-secondary); }
    .label { font-weight: 600; color: var(--text-primary); }
    section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: var(--bg-tertiary); font-weight: 600; }
    code {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-tertiary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    .mermaid { background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-prefix { background: #fef3c7; color: #92400e; }
    .badge-term { background: #f3e8ff; color: #6b21a8; }
    .badge-import { background: #dcfce7; color: #166534; }
    .badge-keyword { background: #fee2e2; color: #991b1b; }
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📋 JSON-LD Context Documentation</h1>
      <div class="metadata">
        <p><span class="label">Context Type:</span> ${contextAnalysis.type}</p>
        <p><span class="label">Prefixes defined:</span> ${Object.keys(contextAnalysis.prefixes).length}</p>
        <p><span class="label">Terms defined:</span> ${contextAnalysis.terms.length}</p>
        <p><span class="label">Imported contexts:</span> ${contextAnalysis.imports.length}</p>
        <p><span class="label">Generated:</span> ${new Date().toLocaleString()}</p>
      </div>
    </header>
    
    <section id="overview">
      <h2>Context Structure</h2>
      <div class="mermaid">
${generateContextDiagram(contextAnalysis)}
      </div>
    </section>
    
    ${contextAnalysis.imports.length > 0 ? `
    <section id="imports">
      <h2>Imported Contexts</h2>
      <p>External context documents referenced by this context:</p>
      
      ${contextAnalysis.importedContexts.map((ctx, i) => `
      <div class="imported-context" style="margin: 1rem 0; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid ${ctx.success ? 'var(--accent)' : '#ef4444'};">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">
          ${ctx.success ? '✅' : '❌'} Context ${i + 1}: <code style="font-size: 0.875rem;">${escapeHtml(ctx.url.length > 60 ? ctx.url.slice(0, 57) + '...' : ctx.url)}</code>
        </h3>
        ${ctx.success ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; margin-top: 0.5rem;">
          <span><strong>Prefixes:</strong> ${ctx.prefixCount}</span>
          <span><strong>Terms:</strong> ${ctx.termCount}</span>
          ${ctx.vocab ? `<span><strong>@vocab:</strong> <code>${escapeHtml(ctx.vocab.length > 30 ? ctx.vocab.slice(0, 27) + '...' : ctx.vocab)}</code></span>` : ''}
          ${ctx.language ? `<span><strong>@language:</strong> ${ctx.language}</span>` : ''}
        </div>
        ${ctx.prefixCount > 0 ? `
        <details style="margin-top: 0.75rem;">
          <summary style="cursor: pointer; color: var(--accent);">View ${ctx.prefixCount} prefixes from this context</summary>
          <table style="margin-top: 0.5rem; font-size: 0.875rem;">
            <tr><th>Prefix</th><th>Namespace</th></tr>
            ${Object.entries(ctx.prefixes).slice(0, 20).map(([p, u]) => `<tr><td><code>${escapeHtml(p)}</code></td><td><code>${escapeHtml(u)}</code></td></tr>`).join('')}
            ${Object.keys(ctx.prefixes).length > 20 ? `<tr><td colspan="2"><em>...and ${Object.keys(ctx.prefixes).length - 20} more</em></td></tr>` : ''}
          </table>
        </details>` : ''}
        ${ctx.termCount > 0 ? `
        <details style="margin-top: 0.5rem;">
          <summary style="cursor: pointer; color: var(--accent);">View ${ctx.termCount} terms from this context</summary>
          <table style="margin-top: 0.5rem; font-size: 0.875rem;">
            <tr><th>Term</th><th>IRI</th><th>Type</th></tr>
            ${ctx.terms.slice(0, 30).map(t => `<tr><td><code>${escapeHtml(t.term)}</code></td><td><code>${escapeHtml(t.id || t.expansion || '-')}</code></td><td>${t.typeCoercion || '-'}</td></tr>`).join('')}
            ${ctx.terms.length > 30 ? `<tr><td colspan="3"><em>...and ${ctx.terms.length - 30} more</em></td></tr>` : ''}
          </table>
        </details>` : ''}
        ` : `
        <p style="color: #ef4444; margin: 0.5rem 0 0 0;">Failed to fetch: ${escapeHtml(ctx.error || 'Unknown error')}</p>
        `}
      </div>
      `).join('')}
    </section>
    ` : ''}
    
    ${contextAnalysis.baseUri || contextAnalysis.vocab || contextAnalysis.language ? `
    <section id="keywords">
      <h2>Special Keywords</h2>
      <table>
        <thead>
          <tr><th>Keyword</th><th>Value</th><th>Description</th></tr>
        </thead>
        <tbody>
          ${contextAnalysis.baseUri ? `
          <tr>
            <td><code>@base</code></td>
            <td><code>${escapeHtml(contextAnalysis.baseUri)}</code></td>
            <td>Base IRI for relative IRI resolution</td>
          </tr>` : ''}
          ${contextAnalysis.vocab ? `
          <tr>
            <td><code>@vocab</code></td>
            <td><code>${escapeHtml(contextAnalysis.vocab)}</code></td>
            <td>Default vocabulary for terms without explicit IRI</td>
          </tr>` : ''}
          ${contextAnalysis.language ? `
          <tr>
            <td><code>@language</code></td>
            <td><code>${escapeHtml(contextAnalysis.language)}</code></td>
            <td>Default language for string literals</td>
          </tr>` : ''}
        </tbody>
      </table>
    </section>
    ` : ''}
    
    <section id="prefixes">
      <h2>Prefixes / Namespace Mappings</h2>
      ${Object.keys(contextAnalysis.prefixes).length > 0 ? `
      <p>Prefix mappings that enable compact IRIs:</p>
      <table>
        <thead>
          <tr><th>Prefix</th><th>Namespace IRI</th></tr>
        </thead>
        <tbody>
          ${Object.entries(contextAnalysis.prefixes).map(([prefix, uri]) => `
          <tr>
            <td><code>${escapeHtml(prefix)}</code></td>
            <td><code>${escapeHtml(uri)}</code></td>
          </tr>`).join('')}
        </tbody>
      </table>
      ` : '<p class="empty-state">No prefixes defined in this context.</p>'}
    </section>
    
    <section id="terms">
      <h2>Term Definitions</h2>
      ${contextAnalysis.terms.length > 0 ? `
      <p>Terms mapped to IRIs or with expanded definitions:</p>
      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Type</th>
            <th>IRI / @id</th>
            <th>@type</th>
            <th>@container</th>
          </tr>
        </thead>
        <tbody>
          ${contextAnalysis.terms.map(term => `
          <tr>
            <td><code>${escapeHtml(term.term)}</code></td>
            <td><span class="badge badge-term">${term.type}</span></td>
            <td><code>${escapeHtml(term.id || term.expansion || '-')}</code></td>
            <td>${term.typeCoercion ? `<code>${escapeHtml(term.typeCoercion)}</code>` : '-'}</td>
            <td>${term.container ? `<code>${escapeHtml(term.container)}</code>` : '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ` : '<p class="empty-state">No term definitions in this context.</p>'}
    </section>
    
    <footer>
      <p>Context documentation generated by JSON-LD Builder &amp; Validator</p>
      <p>Generated on: ${new Date().toLocaleString()}</p>
    </footer>
  </div>
  
  <script>
    mermaid.initialize({ startOnLoad: true, theme: '${theme === 'dark' ? 'dark' : 'default'}' });
  </script>
</body>
</html>`;

    return { success: true, data: html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate Markdown documentation for the @context only
 * @param {object} jsonldDoc - The JSON-LD document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateContextMarkdownDocumentation(jsonldDoc, options = {}) {
  try {
    const contextAnalysis = await analyzeContext(jsonldDoc);
    
    let md = `# JSON-LD Context Documentation\n\n`;
    
    // Metadata
    md += `## Overview\n\n`;
    md += `- **Context Type:** ${contextAnalysis.type}\n`;
    md += `- **Prefixes defined:** ${Object.keys(contextAnalysis.prefixes).length}\n`;
    md += `- **Terms defined:** ${contextAnalysis.terms.length}\n`;
    md += `- **Imported contexts:** ${contextAnalysis.imports.length}\n`;
    md += `- **Generated:** ${new Date().toISOString()}\n\n`;
    
    // Fetch errors warning
    if (contextAnalysis.fetchErrors && contextAnalysis.fetchErrors.length > 0) {
      md += `> ⚠️ **Warning:** ${contextAnalysis.fetchErrors.length} context(s) could not be fetched. Some information may be incomplete.\n\n`;
    }
    
    // Diagram
    md += `## Context Structure\n\n`;
    md += '```mermaid\n';
    md += generateContextDiagram(contextAnalysis);
    md += '```\n\n';
    
    // Imports with detailed info
    if (contextAnalysis.imports.length > 0) {
      md += `## Imported Contexts\n\n`;
      md += `External context documents referenced by this context:\n\n`;
      
      for (const ctx of contextAnalysis.importedContexts || []) {
        md += `### ${ctx.success ? '✅' : '❌'} ${ctx.url}\n\n`;
        
        if (ctx.success) {
          md += `| Property | Value |\n`;
          md += `|----------|-------|\n`;
          md += `| Prefixes | ${ctx.prefixCount} |\n`;
          md += `| Terms | ${ctx.termCount} |\n`;
          if (ctx.vocab) md += `| @vocab | \`${ctx.vocab}\` |\n`;
          if (ctx.language) md += `| @language | ${ctx.language} |\n`;
          md += `\n`;
          
          if (ctx.prefixCount > 0) {
            md += `<details>\n<summary>Prefixes from this context (${ctx.prefixCount})</summary>\n\n`;
            md += `| Prefix | Namespace |\n`;
            md += `|--------|----------|\n`;
            Object.entries(ctx.prefixes).slice(0, 30).forEach(([p, u]) => {
              md += `| \`${p}\` | \`${u}\` |\n`;
            });
            if (Object.keys(ctx.prefixes).length > 30) {
              md += `\n*...and ${Object.keys(ctx.prefixes).length - 30} more*\n`;
            }
            md += `\n</details>\n\n`;
          }
          
          if (ctx.termCount > 0) {
            md += `<details>\n<summary>Terms from this context (${ctx.termCount})</summary>\n\n`;
            md += `| Term | IRI | Type |\n`;
            md += `|------|-----|------|\n`;
            ctx.terms.slice(0, 30).forEach(t => {
              md += `| \`${t.term}\` | \`${t.id || t.expansion || '-'}\` | ${t.typeCoercion || '-'} |\n`;
            });
            if (ctx.terms.length > 30) {
              md += `\n*...and ${ctx.terms.length - 30} more*\n`;
            }
            md += `\n</details>\n\n`;
          }
        } else {
          md += `> ❌ Failed to fetch: ${ctx.error || 'Unknown error'}\n\n`;
        }
      }
    }
    
    // Keywords
    if (contextAnalysis.baseUri || contextAnalysis.vocab || contextAnalysis.language) {
      md += `## Special Keywords\n\n`;
      md += `| Keyword | Value | Description |\n`;
      md += `|---------|-------|-------------|\n`;
      if (contextAnalysis.baseUri) {
        md += `| \`@base\` | \`${contextAnalysis.baseUri}\` | Base IRI for relative IRI resolution |\n`;
      }
      if (contextAnalysis.vocab) {
        md += `| \`@vocab\` | \`${contextAnalysis.vocab}\` | Default vocabulary for terms |\n`;
      }
      if (contextAnalysis.language) {
        md += `| \`@language\` | \`${contextAnalysis.language}\` | Default language for strings |\n`;
      }
      md += `\n`;
    }
    
    // Prefixes
    md += `## Prefixes / Namespace Mappings\n\n`;
    if (Object.keys(contextAnalysis.prefixes).length > 0) {
      md += `Prefix mappings that enable compact IRIs:\n\n`;
      md += `| Prefix | Namespace IRI |\n`;
      md += `|--------|---------------|\n`;
      for (const [prefix, uri] of Object.entries(contextAnalysis.prefixes)) {
        md += `| \`${prefix}\` | \`${uri}\` |\n`;
      }
      md += `\n`;
    } else {
      md += `*No prefixes defined in this context.*\n\n`;
    }
    
    // Terms
    md += `## Term Definitions\n\n`;
    if (contextAnalysis.terms.length > 0) {
      md += `Terms mapped to IRIs or with expanded definitions:\n\n`;
      md += `| Term | Type | IRI | @type | @container |\n`;
      md += `|------|------|-----|-------|------------|\n`;
      for (const term of contextAnalysis.terms) {
        const iri = term.id || term.expansion || '-';
        const typeCoercion = term.typeCoercion || '-';
        const container = term.container || '-';
        md += `| \`${term.term}\` | ${term.type} | \`${iri}\` | ${typeCoercion !== '-' ? `\`${typeCoercion}\`` : '-'} | ${container !== '-' ? `\`${container}\`` : '-'} |\n`;
      }
      md += `\n`;
    } else {
      md += `*No term definitions in this context.*\n\n`;
    }
    
    // Footer
    md += `---\n\n`;
    md += `*Context documentation generated by JSON-LD Builder & Validator on ${new Date().toLocaleString()}*\n`;
    
    return { success: true, data: md };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate PDF-ready HTML documentation for the @context only
 * @param {object} jsonldDoc - The JSON-LD document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateContextPdfDocumentation(jsonldDoc, options = {}) {
  try {
    const result = await generateContextDocumentation(jsonldDoc, { ...options, theme: 'light' });
    
    if (!result.success) {
      return result;
    }
    
    // Add PDF-specific print styles and auto-print script
    const pdfHtml = result.data.replace('</head>', `
  <style>
    @media print {
      body { 
        background: white !important; 
        color: black !important;
        padding: 0 !important;
      }
      .container { max-width: 100%; }
      section, header {
        background: white !important;
        border: 1px solid #ddd !important;
        page-break-inside: avoid;
      }
      h1, h2, h3 { color: #333 !important; }
      code { background: #f5f5f5 !important; }
      .mermaid { 
        page-break-inside: avoid;
        max-width: 100%;
      }
    }
    
    @page {
      size: A4;
      margin: 1cm;
    }
  </style>
</head>`);

    return { success: true, data: pdfHtml };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate only diagrams for the @context
 * @param {object} jsonldDoc - The JSON-LD document
 * @param {object} options - Generation options
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function generateContextDiagramsOnly(jsonldDoc, options = {}) {
  try {
    const contextAnalysis = await analyzeContext(jsonldDoc);
    
    let md = `# JSON-LD Context Diagrams\n\n`;
    md += `Generated Mermaid diagram for the @context of your JSON-LD document.\n\n`;
    
    // Metadata
    md += `## Overview\n\n`;
    md += `- **Context Type:** ${contextAnalysis.type}\n`;
    md += `- **Prefixes defined:** ${Object.keys(contextAnalysis.prefixes).length}\n`;
    md += `- **Terms defined:** ${contextAnalysis.terms.length}\n`;
    md += `- **Imported contexts:** ${contextAnalysis.imports.length}\n`;
    md += `- **Generated:** ${new Date().toISOString()}\n\n`;
    
    // Legend
    md += `## Diagram Legend\n\n`;
    md += `| Shape | Meaning |\n`;
    md += `|-------|--------|\n`;
    md += `| 🟢 Green hexagon | Imported contexts |\n`;
    md += `| 🟡 Yellow rectangle | Prefixes/Namespaces |\n`;
    md += `| 🟣 Purple circle | Term definitions |\n`;
    md += `| 🔴 Red hexagon | Special keywords (@base, @vocab, @language) |\n`;
    md += `| 🔵 Blue root | @context root node |\n\n`;
    
    // Main diagram
    md += `## Context Structure Diagram\n\n`;
    md += '```mermaid\n';
    md += generateContextDiagram(contextAnalysis);
    md += '```\n\n';
    
    // Footer
    md += `---\n\n`;
    md += `*Context diagrams generated by JSON-LD Builder & Validator on ${new Date().toLocaleString()}*\n`;
    
    return { success: true, data: md };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
