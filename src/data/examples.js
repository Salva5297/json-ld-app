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
  }
];

export const defaultFrame = {
  "@context": "https://schema.org",
  "@type": "Person"
};

export default examples;
