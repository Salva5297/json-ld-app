# JSON-LD Builder & Validator

A comprehensive web application for creating, transforming, and validating JSON-LD documents with SHACL shapes support.

## Application Overview

The application provides a polished, modern interface with a three-panel layout:

### Layout Structure
- **Left Panel**: JSON-LD input editor, @context editor, ontology selector, and custom ontology input
- **Center Panel**: Visualization tabs for all JSON-LD transformations
- **Right Panel**: SHACL shapes editor with validation controls

---

## Key Features

### 1. @context Editor (NEW)

A dedicated editor for manually editing the JSON-LD @context, which is fundamental for defining how terms map to IRIs.

**Features:**
- **Extract**: Pull the current @context from your JSON-LD document
- **Apply**: Push your edited context back into the JSON-LD
- **Collapsible**: Toggle the editor visibility
- Full JSON syntax highlighting

### 2. Custom Ontology Support (NEW)

Add your own ontologies by specifying a prefix and namespace URL.

**How to use:**
1. Enter a prefix (e.g., "ex")
2. Enter the namespace URL (e.g., "https://example.org/vocab#")
3. Click "Add"
4. The ontology will appear as a tag and be included when generating contexts

### 3. Multiple Ontology Selection (IMPROVED)
Select multiple ontologies (e.g., Schema.org + FOAF) and generate a combined context automatically. The system now correctly merges multiple ontologies into a single context object.

### 4. Context Compression (NEW)
Compress a complex context object into a single internal URI (URN) to keep your JSON-LD input clean.

**How to use:**
1. Click the "Compress context" button (inward arrows icon) in the @context Editor header
2. The `@context` in your input will be replaced by a URN (e.g., `urn:context:uuid...`)
3. The original context is stored internally and fully resolved during processing
4. Visualizations (Expanded, Compacted, etc.) continue to work transparently
5. **Persistence**: Compressed contexts are saved to your browser's local storage, so they survive page reloads.

### 5. Manual Context Modification

You can fully edit the context and apply it back to your JSON-LD document.

**All 8 Visualization Modes:**
| View | Description |
|------|-------------|
| Expanded | Full IRIs, no context |
| Compacted | Human-readable with context |
| Flattened | Flat graph structure |
| Framed | Reshaped by frame document |
| N-Quads | RDF quad serialization |
| Canonized | URDNA2015 normalized |
| Table | Tabular triple display |
| Graph | Interactive network diagram |

### 6. Examples Library

Pre-built examples for quick testing:

**Available Examples:**
- Person (Schema.org)
- Article (Schema.org)
- Product (Schema.org)
- FOAF Profile
- Dublin Core Resource
- Event (Schema.org)
- Custom Vocabulary

### 7. SHACL Validation & Reporting

Validate JSON-LD against SHACL shapes with detailed reports.

**Features:**
- **Turtle syntax editor**: Write or paste SHACL shapes
- **Validate**: Check compliance against current JSON-LD
- **Generate**: Create shapes automatically from JSON-LD structure
- **Download Report**: Export the results as a JSON file
- **Persistent View**: Report remains open for analysis (Close button removed)

### 8. Ontology-Based Context Generation

Quick context generation from popular ontologies:
- Schema.org
- FOAF (Friend of a Friend)
- Dublin Core
- SKOS
- SIOC
- GeoSPARQL
- PROV-O

### 9. Additional Features

- **Dark/Light Theme**: Toggle between themes
- **Sharing**: Generate permalink with encoded document
- **Import/Export**: Download output or load files
- **Keyboard Shortcuts**: Ctrl+Shift+F for formatting
- **Help Documentation**: Built-in help panel
- **Toast Notifications**: User feedback
- **Auto-save**: Documents saved to localStorage

---

## File Structure

```
json-ld-app/
├── index.html                 # Main HTML structure
├── src/
│   ├── main.js               # Application entry point
│   ├── styles/
│   │   └── index.css         # Design system & themes
│   ├── services/
│   │   ├── JsonLdProcessor.js  # JSON-LD transformations
│   │   ├── ShaclValidator.js   # SHACL validation
│   │   └── ShaclGenerator.js   # SHACL generation
│   ├── data/
│   │   ├── examples.js       # Pre-built examples
│   │   └── ontologies.js     # Ontology definitions
│   └── utils/
│       ├── storage.js        # localStorage utilities
│       └── share.js          # Sharing utilities
└── public/
    └── favicon.svg           # App icon
```

---

## Running the Application

```bash
cd json-ld-app
npm install
npm run dev
```

The application will be available at `http://localhost:5173/`

---

## Technologies Used

- **Vite**: Build tool
- **jsonld.js**: JSON-LD processing
- **N3**: RDF/Turtle parsing
- **CodeMirror**: Code editor
- **D3.js**: Graph visualization
- **Vanilla CSS**: Custom design system