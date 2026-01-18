/**
 * JSON-LD Examples Library
 * Pre-built examples for common use cases
 */

export const examples = [
  {
    id: 'person',
    name: 'Person (Schema.org)',
    description: 'A person profile using Schema.org vocabulary',
    icon: 'user',
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://example.org/person/john-doe",
      "name": "John Doe",
      "jobTitle": "Software Engineer",
      "email": "john.doe@example.org",
      "telephone": "+1-555-123-4567",
      "url": "https://johndoe.example.org",
      "image": "https://example.org/photos/john.jpg",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Main Street",
        "addressLocality": "San Francisco",
        "addressRegion": "CA",
        "postalCode": "94102",
        "addressCountry": "US"
      },
      "worksFor": {
        "@type": "Organization",
        "name": "Tech Company Inc.",
        "url": "https://techcompany.example.org"
      },
      "sameAs": [
        "https://twitter.com/johndoe",
        "https://linkedin.com/in/johndoe",
        "https://github.com/johndoe"
      ]
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

schema:PersonShape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "A person must have a name" ;
    ] ;
    sh:property [
        sh:path schema:email ;
        sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$" ;
        sh:message "Email must be a valid email address" ;
    ] .`
  },
  {
    id: 'article',
    name: 'Article (Schema.org)',
    description: 'A blog article with author and publisher',
    icon: 'file-text',
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": "https://example.org/articles/intro-to-jsonld",
      "headline": "Introduction to JSON-LD",
      "description": "Learn how to use JSON-LD for structured data on the web",
      "datePublished": "2024-01-15",
      "dateModified": "2024-01-20",
      "author": {
        "@type": "Person",
        "name": "Jane Smith",
        "url": "https://example.org/authors/jane"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Tech Blog",
        "logo": {
          "@type": "ImageObject",
          "url": "https://example.org/logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://example.org/articles/intro-to-jsonld"
      },
      "image": [
        "https://example.org/images/jsonld-hero.jpg"
      ],
      "keywords": ["JSON-LD", "Linked Data", "Semantic Web", "SEO"]
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

schema:ArticleShape a sh:NodeShape ;
    sh:targetClass schema:Article ;
    sh:property [
        sh:path schema:headline ;
        sh:minCount 1 ;
        sh:maxLength 110 ;
        sh:message "Article must have a headline (max 110 characters)" ;
    ] ;
    sh:property [
        sh:path schema:datePublished ;
        sh:minCount 1 ;
        sh:datatype xsd:date ;
        sh:message "Article must have a publication date" ;
    ] ;
    sh:property [
        sh:path schema:author ;
        sh:minCount 1 ;
        sh:message "Article must have an author" ;
    ] .`
  },
  {
    id: 'product',
    name: 'Product (Schema.org)',
    description: 'An e-commerce product with offers',
    icon: 'shopping-bag',
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://example.org/products/widget-pro",
      "name": "Widget Pro 2024",
      "description": "The ultimate widget for professionals. Features advanced capabilities and premium build quality.",
      "sku": "WIDGET-PRO-2024",
      "brand": {
        "@type": "Brand",
        "name": "WidgetCorp"
      },
      "image": [
        "https://example.org/images/widget-front.jpg",
        "https://example.org/images/widget-side.jpg"
      ],
      "offers": {
        "@type": "Offer",
        "url": "https://example.org/products/widget-pro",
        "priceCurrency": "USD",
        "price": "299.99",
        "priceValidUntil": "2024-12-31",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "256"
      },
      "review": [
        {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5"
          },
          "author": {
            "@type": "Person",
            "name": "Happy Customer"
          },
          "reviewBody": "Best widget I've ever used!"
        }
      ]
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

schema:ProductShape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:message "Product must have a name" ;
    ] ;
    sh:property [
        sh:path schema:offers ;
        sh:minCount 1 ;
        sh:message "Product must have at least one offer" ;
    ] .

schema:OfferShape a sh:NodeShape ;
    sh:targetClass schema:Offer ;
    sh:property [
        sh:path schema:price ;
        sh:minCount 1 ;
        sh:message "Offer must have a price" ;
    ] ;
    sh:property [
        sh:path schema:priceCurrency ;
        sh:minCount 1 ;
        sh:pattern "^[A-Z]{3}$" ;
        sh:message "Price currency must be a 3-letter ISO code" ;
    ] .`
  },
  {
    id: 'foaf-profile',
    name: 'FOAF Profile',
    description: 'Friend of a Friend profile with social connections',
    icon: 'users',
    jsonld: {
      "@context": {
        "foaf": "http://xmlns.com/foaf/0.1/",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
      },
      "@id": "https://example.org/people/alice",
      "@type": "foaf:Person",
      "foaf:name": "Alice Williams",
      "foaf:givenName": "Alice",
      "foaf:familyName": "Williams",
      "foaf:mbox": "mailto:alice@example.org",
      "foaf:homepage": "https://alice.example.org",
      "foaf:img": "https://example.org/photos/alice.jpg",
      "foaf:knows": [
        {
          "@id": "https://example.org/people/bob",
          "@type": "foaf:Person",
          "foaf:name": "Bob Johnson"
        },
        {
          "@id": "https://example.org/people/carol",
          "@type": "foaf:Person",
          "foaf:name": "Carol Davis"
        }
      ],
      "foaf:interest": [
        "https://dbpedia.org/resource/Semantic_Web",
        "https://dbpedia.org/resource/Linked_data"
      ]
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

foaf:PersonShape a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:minCount 1 ;
        sh:message "Person must have a name" ;
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:pattern "^mailto:" ;
        sh:message "Email must be a mailto: URI" ;
    ] .`
  },
  {
    id: 'dublin-core',
    name: 'Dublin Core Resource',
    description: 'Digital resource with Dublin Core metadata',
    icon: 'book-open',
    jsonld: {
      "@context": {
        "dc": "http://purl.org/dc/elements/1.1/",
        "dcterms": "http://purl.org/dc/terms/",
        "xsd": "http://www.w3.org/2001/XMLSchema#"
      },
      "@id": "https://example.org/documents/report-2024",
      "@type": "dcterms:Text",
      "dc:title": "Annual Research Report 2024",
      "dc:creator": "Research Department",
      "dc:subject": ["Research", "Annual Report", "Data Analysis"],
      "dc:description": "Comprehensive annual report covering research activities and findings for the year 2024.",
      "dc:publisher": "Example Organization",
      "dc:date": {
        "@value": "2024-01-01",
        "@type": "xsd:date"
      },
      "dc:type": "Report",
      "dc:format": "application/pdf",
      "dc:language": "en",
      "dc:rights": "© 2024 Example Organization. All rights reserved.",
      "dcterms:license": "https://creativecommons.org/licenses/by/4.0/",
      "dcterms:issued": {
        "@value": "2024-01-15",
        "@type": "xsd:date"
      }
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

dcterms:ResourceShape a sh:NodeShape ;
    sh:targetClass dcterms:Text ;
    sh:property [
        sh:path dc:title ;
        sh:minCount 1 ;
        sh:message "Resource must have a title" ;
    ] ;
    sh:property [
        sh:path dc:creator ;
        sh:minCount 1 ;
        sh:message "Resource must have a creator" ;
    ] .`
  },
  {
    id: 'event',
    name: 'Event (Schema.org)',
    description: 'A conference event with location and schedule',
    icon: 'calendar',
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Event",
      "@id": "https://example.org/events/tech-conf-2024",
      "name": "TechConf 2024",
      "description": "The premier technology conference bringing together innovators from around the world.",
      "startDate": "2024-09-15T09:00:00-07:00",
      "endDate": "2024-09-17T18:00:00-07:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": {
        "@type": "Place",
        "name": "Convention Center",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "500 Convention Way",
          "addressLocality": "San Francisco",
          "addressRegion": "CA",
          "postalCode": "94103",
          "addressCountry": "US"
        }
      },
      "organizer": {
        "@type": "Organization",
        "name": "TechConf Inc.",
        "url": "https://techconf.example.org"
      },
      "performer": [
        {
          "@type": "Person",
          "name": "Dr. Sarah Tech",
          "jobTitle": "AI Researcher"
        }
      ],
      "offers": {
        "@type": "Offer",
        "url": "https://example.org/events/tech-conf-2024/tickets",
        "price": "499",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "validFrom": "2024-03-01"
      },
      "image": "https://example.org/events/techconf-banner.jpg"
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

schema:EventShape a sh:NodeShape ;
    sh:targetClass schema:Event ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:message "Event must have a name" ;
    ] ;
    sh:property [
        sh:path schema:startDate ;
        sh:minCount 1 ;
        sh:message "Event must have a start date" ;
    ] ;
    sh:property [
        sh:path schema:location ;
        sh:minCount 1 ;
        sh:message "Event must have a location" ;
    ] .`
  },
  {
    id: 'custom-vocab',
    name: 'Custom Vocabulary',
    description: 'Example with a custom @context definition',
    icon: 'code',
    jsonld: {
      "@context": {
        "@vocab": "https://example.org/vocab/",
        "name": "https://schema.org/name",
        "description": "https://schema.org/description",
        "created": {
          "@id": "https://schema.org/dateCreated",
          "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
        },
        "tags": {
          "@id": "https://example.org/vocab/tags",
          "@container": "@set"
        },
        "priority": {
          "@id": "https://example.org/vocab/priority",
          "@type": "http://www.w3.org/2001/XMLSchema#integer"
        },
        "assignee": {
          "@id": "https://example.org/vocab/assignee",
          "@type": "@id"
        },
        "status": "https://example.org/vocab/status"
      },
      "@id": "https://example.org/tasks/task-001",
      "@type": "Task",
      "name": "Implement JSON-LD support",
      "description": "Add JSON-LD parsing and validation to the application",
      "created": "2024-01-10T10:30:00Z",
      "tags": ["backend", "feature", "high-priority"],
      "priority": 1,
      "status": "in-progress",
      "assignee": "https://example.org/users/developer-1"
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <https://example.org/vocab/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:TaskShape a sh:NodeShape ;
    sh:targetClass ex:Task ;
    sh:property [
        sh:path <https://schema.org/name> ;
        sh:minCount 1 ;
        sh:maxLength 200 ;
        sh:message "Task must have a name (max 200 chars)" ;
    ] ;
    sh:property [
        sh:path ex:priority ;
        sh:datatype xsd:integer ;
        sh:minInclusive 1 ;
        sh:maxInclusive 5 ;
        sh:message "Priority must be between 1 and 5" ;
    ] ;
    sh:property [
        sh:path ex:status ;
        sh:in ("pending" "in-progress" "completed" "cancelled") ;
        sh:message "Status must be one of: pending, in-progress, completed, cancelled" ;
    ] .`
  },
  {
    id: 'semantic-digital-twin',
    name: 'Semantic Digital Twin (WoT + External Contexts)',
    description: 'Complex example with multiple external contexts (W3C WoT, custom SDT vocabulary). Demonstrates Thing Description for Digital Twins with physical entities, virtual entities, data sources and connections.',
    icon: 'cpu',
    jsonld: {
      "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        "https://raw.githubusercontent.com/Salva5297/SemanticDT_TD/refs/heads/main/context/dt.td.context.jsonld",
        "https://w3c.github.io/wot-discovery/context/discovery-core.jsonld",
        {
          "sdt": "urn:sdt:"
        }
      ],
      "securityDefinitions": {
        "nosec_sc": {
          "scheme": "nosec"
        }
      },
      "security": ["nosec_sc"],
      "id": "urn:sdt:SDT/5a5957c2-d1ae-4d7f-8716-2b0425a69a6d",
      "@type": "SDT",
      "title": "Construction Information Resource Thing Description",
      "description": "Construction Information Resource in project b3fe643d-f9f2-4e14-bf3c-95343d63c850",
      "properties": {},
      "actions": {},
      "events": {},
      "links": [],
      "pe": [
        {
          "@id": "urn:sdt:SDT/5a5957c2-d1ae-4d7f-8716-2b0425a69a6d/pe/1",
          "@type": "Physical Entity",
          "title": "Physical Entity 1",
          "description": "Physical Entity 1 description.",
          "components": [
            {
              "@id": "sdt:a5ab8de2-96d1-4ebc-8216-f777f5c1aa83",
              "@type": "Sensor",
              "title": "Name of the Sensor Thing Description.",
              "description": "Description of the Sensor Thing Description.",
              "href": "https://example.org/td/a5ab8de2-96d1-4ebc-8216-f777f5c1aa83"
            },
            {
              "@id": "sdt:6388d1bc-06db-41cc-af64-298cc9728c27",
              "@type": "Actuator",
              "title": "Name of the Actuator Thing Description.",
              "description": "Description of the Actuator Thing Description.",
              "href": "https://example.org/td/6388d1bc-06db-41cc-af64-298cc9728c27"
            }
          ]
        }
      ],
      "ve": [
        {
          "@id": "urn:sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d/ve/1",
          "@type": "Virtual Entity",
          "title": "Virtual Entity 1",
          "description": "Virtual Entity 1 description.",
          "models": [
            {
              "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:onto",
              "@type": "Ontology_Model",
              "title": "Ontology",
              "description": "Description of the Ontology",
              "aggregates": ["https://example.org/def/onto#"],
              "formats": [
                {
                  "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:format:ttl",
                  "@type": "Format",
                  "title": "Turtle",
                  "description": "Contains Ontology X Extension in Turtle Format.",
                  "href": "https://example.org/onto.ttl",
                  "extension": "ttl"
                },
                {
                  "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:format:json-ld",
                  "@type": "Format",
                  "title": "JSON-LD",
                  "description": "Contains Ontology X Extension in JSON-LD Format.",
                  "href": "https://example.org/onto.json",
                  "extension": "json-ld"
                }
              ]
            },
            {
              "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:shacl",
              "@type": "SHACL_Shapes_Model",
              "title": "SHACL Shapes",
              "description": "SHACL Shapes used to validate the Knowledge Graph information of the DT",
              "aggregates": ["https://example.org/shapes.ttl"],
              "formats": [
                {
                  "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:shacl:ttl",
                  "@type": "Format",
                  "title": "Turtle",
                  "description": "Contains SHACL Shapes Extension in Turtle Format.",
                  "href": "https://example.org/shapes.ttl",
                  "extension": "ttl"
                }
              ]
            }
          ]
        }
      ],
      "dd": [
        {
          "@id": "urn:sdt:SDT/5a5957c2-d1ae-4d7f-8716-2b0425a69a6d/dd/1",
          "@type": "Digital Twin Data",
          "title": "Digital Twin Data 1",
          "description": "Digital Twin Data 1 description.",
          "data": [
            {
              "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:triplestore",
              "@type": "Triplestore",
              "title": "Ontotext GraphDB Triplestore",
              "description": "Ontotext GraphDB Triplestore used to store knowledge graphs.",
              "href": "https://triplestore.example.org/sparql",
              "default-graph": "https://triplestore.example.org/statements/default-graph",
              "extension": "rdf",
              "internal": "true"
            },
            {
              "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:ifc_file:12345",
              "@type": "File",
              "title": "IFC File 1234",
              "description": "IFC File with identifier '1234', that contains the construction information of SDT1.",
              "href": "https://dtp.example.org/files/building.ifc",
              "extension": "ifc",
              "internal": "false"
            }
          ]
        }
      ],
      "cn": [
        {
          "@id": "urn:sdt:SDT/5a5957c2-d1ae-4d7f-8716-2b0425a69a6d/cn/1",
          "@type": "Digital Twin Connection",
          "title": "Digital Twin Connection 1",
          "description": "Digital Twin Connection 1 description.",
          "connections": [
            {
              "@id": "sdt:5a5957c2-d1ae-4d7f-8716-2b0425a69a6d:service:1",
              "@type": "Digital_Twin_Service",
              "title": "Service 1",
              "description": "Service 1 of the SDT",
              "href": "https://service1.example.org/execute_job",
              "function": "client",
              "internal": "true"
            }
          ],
          "sdt_connections": [
            {
              "@id": "sdt:f5f94ac4-d2d0-48e0-a7fb-c9ceeea1a31d",
              "@type": "SDT",
              "title": "Semantic Digital Twin f5f94ac4-d2d0-48e0-a7fb-c9ceeea1a31d",
              "description": "Connected Semantic Digital Twin",
              "href": "https://example.org/td/f5f94ac4-d2d0-48e0-a7fb-c9ceeea1a31d"
            }
          ]
        }
      ],
      "registration": {
        "created": "2023-12-05T22:15:54.213Z",
        "modified": "2023-12-05T22:15:54.213Z"
      }
    },
    shacl: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix td: <https://www.w3.org/2019/wot/td#> .
@prefix sdt: <urn:sdt:> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

sdt:SDTShape a sh:NodeShape ;
    sh:targetClass sdt:SDT ;
    sh:property [
        sh:path td:title ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "SDT must have a title" ;
    ] ;
    sh:property [
        sh:path td:hasSecurityConfiguration ;
        sh:minCount 1 ;
        sh:message "SDT must have security configuration" ;
    ] .`
  }
];

export const defaultFrame = {
  "@context": "https://schema.org",
  "@type": "Person"
};

export default examples;
