/**
 * Ontology Definitions
 * Popular ontologies for JSON-LD context generation
 */

export const ontologies = {
  'schema.org': {
    id: 'schema.org',
    name: 'Schema.org',
    description: 'General-purpose vocabulary for web content',
    prefix: 'schema',
    namespace: 'https://schema.org/',
    url: 'https://schema.org',
    context: 'https://schema.org',
    categories: {
      'Person': ['name', 'email', 'telephone', 'jobTitle', 'address', 'birthDate', 'image', 'url', 'sameAs', 'worksFor'],
      'Organization': ['name', 'url', 'logo', 'address', 'telephone', 'email', 'founder', 'employee'],
      'Article': ['headline', 'description', 'author', 'datePublished', 'dateModified', 'publisher', 'image', 'keywords'],
      'Product': ['name', 'description', 'sku', 'brand', 'offers', 'image', 'aggregateRating', 'review'],
      'Event': ['name', 'startDate', 'endDate', 'location', 'organizer', 'performer', 'offers', 'eventStatus'],
      'Place': ['name', 'address', 'geo', 'telephone', 'url', 'openingHours'],
      'CreativeWork': ['name', 'author', 'dateCreated', 'description', 'publisher', 'license']
    },
    commonProperties: [
      { term: 'name', iri: 'https://schema.org/name', type: 'string' },
      { term: 'description', iri: 'https://schema.org/description', type: 'string' },
      { term: 'url', iri: 'https://schema.org/url', type: '@id' },
      { term: 'image', iri: 'https://schema.org/image', type: '@id' },
      { term: 'email', iri: 'https://schema.org/email', type: 'string' },
      { term: 'telephone', iri: 'https://schema.org/telephone', type: 'string' },
      { term: 'address', iri: 'https://schema.org/address', type: 'object' },
      { term: 'dateCreated', iri: 'https://schema.org/dateCreated', type: 'dateTime' },
      { term: 'dateModified', iri: 'https://schema.org/dateModified', type: 'dateTime' },
      { term: 'author', iri: 'https://schema.org/author', type: 'object' }
    ]
  },
  
  'foaf': {
    id: 'foaf',
    name: 'FOAF',
    description: 'Friend of a Friend - describing people and relationships',
    prefix: 'foaf',
    namespace: 'http://xmlns.com/foaf/0.1/',
    url: 'http://xmlns.com/foaf/spec/',
    context: {
      'foaf': 'http://xmlns.com/foaf/0.1/'
    },
    categories: {
      'Person': ['name', 'givenName', 'familyName', 'nick', 'mbox', 'homepage', 'img', 'knows', 'interest'],
      'Organization': ['name', 'homepage', 'member'],
      'Document': ['title', 'primaryTopic', 'topic'],
      'Image': ['depicts', 'thumbnail']
    },
    commonProperties: [
      { term: 'name', iri: 'http://xmlns.com/foaf/0.1/name', type: 'string' },
      { term: 'givenName', iri: 'http://xmlns.com/foaf/0.1/givenName', type: 'string' },
      { term: 'familyName', iri: 'http://xmlns.com/foaf/0.1/familyName', type: 'string' },
      { term: 'mbox', iri: 'http://xmlns.com/foaf/0.1/mbox', type: '@id' },
      { term: 'homepage', iri: 'http://xmlns.com/foaf/0.1/homepage', type: '@id' },
      { term: 'img', iri: 'http://xmlns.com/foaf/0.1/img', type: '@id' },
      { term: 'knows', iri: 'http://xmlns.com/foaf/0.1/knows', type: '@id' },
      { term: 'interest', iri: 'http://xmlns.com/foaf/0.1/interest', type: '@id' }
    ]
  },
  
  'dc': {
    id: 'dc',
    name: 'Dublin Core',
    description: 'Metadata for digital resources',
    prefix: 'dc',
    namespace: 'http://purl.org/dc/elements/1.1/',
    url: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/',
    context: {
      'dc': 'http://purl.org/dc/elements/1.1/',
      'dcterms': 'http://purl.org/dc/terms/'
    },
    categories: {
      'Resource': ['title', 'creator', 'subject', 'description', 'publisher', 'date', 'type', 'format', 'identifier', 'language', 'rights']
    },
    commonProperties: [
      { term: 'title', iri: 'http://purl.org/dc/elements/1.1/title', type: 'string' },
      { term: 'creator', iri: 'http://purl.org/dc/elements/1.1/creator', type: 'string' },
      { term: 'subject', iri: 'http://purl.org/dc/elements/1.1/subject', type: 'string' },
      { term: 'description', iri: 'http://purl.org/dc/elements/1.1/description', type: 'string' },
      { term: 'publisher', iri: 'http://purl.org/dc/elements/1.1/publisher', type: 'string' },
      { term: 'date', iri: 'http://purl.org/dc/elements/1.1/date', type: 'date' },
      { term: 'type', iri: 'http://purl.org/dc/elements/1.1/type', type: 'string' },
      { term: 'format', iri: 'http://purl.org/dc/elements/1.1/format', type: 'string' },
      { term: 'identifier', iri: 'http://purl.org/dc/elements/1.1/identifier', type: 'string' },
      { term: 'language', iri: 'http://purl.org/dc/elements/1.1/language', type: 'string' },
      { term: 'rights', iri: 'http://purl.org/dc/elements/1.1/rights', type: 'string' }
    ]
  },
  
  'skos': {
    id: 'skos',
    name: 'SKOS',
    description: 'Simple Knowledge Organization System',
    prefix: 'skos',
    namespace: 'http://www.w3.org/2004/02/skos/core#',
    url: 'https://www.w3.org/TR/skos-reference/',
    context: {
      'skos': 'http://www.w3.org/2004/02/skos/core#'
    },
    categories: {
      'Concept': ['prefLabel', 'altLabel', 'definition', 'broader', 'narrower', 'related', 'inScheme', 'topConceptOf'],
      'ConceptScheme': ['hasTopConcept', 'prefLabel']
    },
    commonProperties: [
      { term: 'prefLabel', iri: 'http://www.w3.org/2004/02/skos/core#prefLabel', type: 'string' },
      { term: 'altLabel', iri: 'http://www.w3.org/2004/02/skos/core#altLabel', type: 'string' },
      { term: 'definition', iri: 'http://www.w3.org/2004/02/skos/core#definition', type: 'string' },
      { term: 'broader', iri: 'http://www.w3.org/2004/02/skos/core#broader', type: '@id' },
      { term: 'narrower', iri: 'http://www.w3.org/2004/02/skos/core#narrower', type: '@id' },
      { term: 'related', iri: 'http://www.w3.org/2004/02/skos/core#related', type: '@id' },
      { term: 'inScheme', iri: 'http://www.w3.org/2004/02/skos/core#inScheme', type: '@id' }
    ]
  },
  
  'sioc': {
    id: 'sioc',
    name: 'SIOC',
    description: 'Semantically-Interlinked Online Communities',
    prefix: 'sioc',
    namespace: 'http://rdfs.org/sioc/ns#',
    url: 'http://rdfs.org/sioc/spec/',
    context: {
      'sioc': 'http://rdfs.org/sioc/ns#'
    },
    categories: {
      'Post': ['content', 'created_at', 'has_creator', 'has_container', 'reply_of', 'topic'],
      'Forum': ['has_host', 'has_moderator', 'container_of'],
      'UserAccount': ['account_of', 'name', 'avatar']
    },
    commonProperties: [
      { term: 'content', iri: 'http://rdfs.org/sioc/ns#content', type: 'string' },
      { term: 'created_at', iri: 'http://rdfs.org/sioc/ns#created_at', type: 'dateTime' },
      { term: 'has_creator', iri: 'http://rdfs.org/sioc/ns#has_creator', type: '@id' },
      { term: 'has_container', iri: 'http://rdfs.org/sioc/ns#has_container', type: '@id' },
      { term: 'reply_of', iri: 'http://rdfs.org/sioc/ns#reply_of', type: '@id' },
      { term: 'topic', iri: 'http://rdfs.org/sioc/ns#topic', type: '@id' }
    ]
  },

  'geo': {
    id: 'geo',
    name: 'GeoSPARQL',
    description: 'Geographic information and spatial data',
    prefix: 'geo',
    namespace: 'http://www.opengis.net/ont/geosparql#',
    url: 'https://www.ogc.org/standard/geosparql/',
    context: {
      'geo': 'http://www.opengis.net/ont/geosparql#',
      'sf': 'http://www.opengis.net/ont/sf#'
    },
    categories: {
      'Feature': ['hasGeometry', 'hasDefaultGeometry'],
      'Geometry': ['asWKT', 'asGeoJSON', 'dimension', 'coordinateDimension']
    },
    commonProperties: [
      { term: 'hasGeometry', iri: 'http://www.opengis.net/ont/geosparql#hasGeometry', type: '@id' },
      { term: 'asWKT', iri: 'http://www.opengis.net/ont/geosparql#asWKT', type: 'string' },
      { term: 'asGeoJSON', iri: 'http://www.opengis.net/ont/geosparql#asGeoJSON', type: 'string' }
    ]
  },
  
  'prov': {
    id: 'prov',
    name: 'PROV-O',
    description: 'Provenance ontology for data lineage',
    prefix: 'prov',
    namespace: 'http://www.w3.org/ns/prov#',
    url: 'https://www.w3.org/TR/prov-o/',
    context: {
      'prov': 'http://www.w3.org/ns/prov#'
    },
    categories: {
      'Entity': ['wasGeneratedBy', 'wasDerivedFrom', 'wasAttributedTo', 'generatedAtTime'],
      'Activity': ['wasAssociatedWith', 'startedAtTime', 'endedAtTime', 'used'],
      'Agent': ['actedOnBehalfOf']
    },
    commonProperties: [
      { term: 'wasGeneratedBy', iri: 'http://www.w3.org/ns/prov#wasGeneratedBy', type: '@id' },
      { term: 'wasDerivedFrom', iri: 'http://www.w3.org/ns/prov#wasDerivedFrom', type: '@id' },
      { term: 'wasAttributedTo', iri: 'http://www.w3.org/ns/prov#wasAttributedTo', type: '@id' },
      { term: 'generatedAtTime', iri: 'http://www.w3.org/ns/prov#generatedAtTime', type: 'dateTime' },
      { term: 'startedAtTime', iri: 'http://www.w3.org/ns/prov#startedAtTime', type: 'dateTime' },
      { term: 'endedAtTime', iri: 'http://www.w3.org/ns/prov#endedAtTime', type: 'dateTime' }
    ]
  }
};

/**
 * Generate a JSON-LD context from selected ontologies
 * @param {string[]} selectedOntologies - Array of ontology IDs
 * @returns {object} Generated context object
 */
export function generateContext(selectedOntologies) {
  // If only schema.org is selected, return the string URL
  if (selectedOntologies.length === 1 && selectedOntologies[0] === 'schema.org') {
    return 'https://schema.org';
  }

  const context = {};
  
  for (const ontId of selectedOntologies) {
    const ont = ontologies[ontId];
    if (!ont) continue;
    
    // For schema.org when mixed with others
    if (ontId === 'schema.org') {
      context['schema'] = 'https://schema.org/';
      continue;
    }
    
    // For other ontologies, merge contexts
    if (typeof ont.context === 'string') {
      context[ont.prefix] = ont.context;
    } else if (typeof ont.context === 'object') {
      Object.assign(context, ont.context);
    }
  }
  
  return context;
}

/**
 * Generate a sample JSON-LD document from selected ontologies
 * @param {string[]} selectedOntologies - Array of ontology IDs
 * @param {string} [primaryType] - Primary type to use
 * @returns {object} Generated JSON-LD document
 */
export function generateSampleDocument(selectedOntologies, primaryType = null) {
  const context = generateContext(selectedOntologies);
  
  const doc = {
    "@context": context,
    "@id": "https://example.org/resource/1"
  };
  
  // Add type if we have a primary ontology
  if (selectedOntologies.length > 0) {
    const primaryOnt = ontologies[selectedOntologies[0]];
    if (primaryOnt) {
      const types = Object.keys(primaryOnt.categories);
      if (types.length > 0) {
        const typeName = primaryType || types[0];
        doc["@type"] = selectedOntologies[0] === 'schema.org' 
          ? typeName 
          : `${primaryOnt.prefix}:${typeName}`;
        
        // Add sample properties
        const props = primaryOnt.categories[typeName] || [];
        props.slice(0, 3).forEach(prop => {
          const propDef = primaryOnt.commonProperties.find(p => p.term === prop);
          const key = selectedOntologies[0] === 'schema.org' ? prop : `${primaryOnt.prefix}:${prop}`;
          
          if (propDef) {
            switch (propDef.type) {
              case 'string':
                doc[key] = `Example ${prop}`;
                break;
              case '@id':
                doc[key] = `https://example.org/${prop}/1`;
                break;
              case 'dateTime':
              case 'date':
                doc[key] = new Date().toISOString();
                break;
              case 'object':
                doc[key] = { "@type": "Thing", "name": `Example ${prop}` };
                break;
              default:
                doc[key] = `Example ${prop}`;
            }
          }
        });
      }
    }
  }
  
  return doc;
}

export default ontologies;
