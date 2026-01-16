/**
 * JSON-LD Builder & Validator
 * Main Application Entry Point
 */

import './styles/index.css';

// CodeMirror imports
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

// D3 for graph visualization
import * as d3 from 'd3';

// Services
import jsonldProcessor from './services/JsonLdProcessor.js';
import shaclValidator from './services/ShaclValidator.js';
import shaclGenerator from './services/ShaclGenerator.js';

// Data
import { examples, defaultFrame } from './data/examples.js';
import { ontologies, generateContext, generateSampleDocument } from './data/ontologies.js';

// Utils
import storage from './utils/storage.js';
import share from './utils/share.js';

// ============================================
// State Management
// ============================================
const state = {
  jsonldEditor: null,
  shaclEditor: null,
  frameEditor: null,
  contextEditor: null,
  currentView: 'expanded',
  selectedOntologies: [],
  customOntologies: [], // { prefix: string, namespace: string }
  theme: 'dark',
  isProcessing: false,
  lastError: null,
  contextCollapsed: false
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initEditors();
  initOntologySelector();
  initContextEditor();
  initCustomOntologies();
  initEventListeners();
  initModals();
  loadFromUrl();
  processJsonLd();
  syncContextFromJsonLd();
});

// ============================================
// Theme Management
// ============================================
function initTheme() {
  const prefs = storage.loadPreferences();
  state.theme = prefs.theme || 'dark';
  applyTheme(state.theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  storage.savePreferences({ ...storage.loadPreferences(), theme });
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  
  // Recreate editors with new theme
  const jsonldContent = getJsonLdContent();
  const shaclContent = getShaclContent();
  const frameContent = getFrameContent();
  
  initEditors();
  
  if (jsonldContent) setJsonLdContent(jsonldContent);
  if (shaclContent) setShaclContent(shaclContent);
  if (frameContent) setFrameContent(frameContent);
}

// ============================================
// Editor Initialization
// ============================================
function initEditors() {
  const themeExtension = state.theme === 'dark' ? oneDark : [];
  
  // JSON-LD Editor
  const jsonldContainer = document.getElementById('jsonld-editor');
  jsonldContainer.innerHTML = '';
  
  const savedDoc = storage.loadJsonLd();
  const initialDoc = savedDoc || examples[0].jsonld;
  
  state.jsonldEditor = new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(initialDoc, null, 2),
      extensions: [
        basicSetup,
        json(),
        themeExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debounce(processJsonLd, 500)();
            debounce(() => {
              try {
                const content = update.state.doc.toString();
                storage.saveJsonLd(JSON.parse(content));
              } catch (e) {
                // Invalid JSON, don't save
              }
            }, 1000)();
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    }),
    parent: jsonldContainer
  });

  // SHACL Editor
  const shaclContainer = document.getElementById('shacl-editor');
  shaclContainer.innerHTML = '';
  
  const savedShacl = storage.loadShacl();
  const initialShacl = savedShacl || examples[0].shacl;
  
  state.shaclEditor = new EditorView({
    state: EditorState.create({
      doc: initialShacl,
      extensions: [
        basicSetup,
        themeExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debounce(() => {
              storage.saveShacl(update.state.doc.toString());
            }, 1000)();
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    }),
    parent: shaclContainer
  });

  // Frame Editor
  const frameContainer = document.getElementById('frame-editor');
  frameContainer.innerHTML = '';
  
  const savedFrame = storage.loadFrame();
  const initialFrame = savedFrame || defaultFrame;
  
  state.frameEditor = new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(initialFrame, null, 2),
      extensions: [
        basicSetup,
        json(),
        themeExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debounce(() => {
              if (state.currentView === 'framed') {
                processJsonLd();
              }
              try {
                const content = update.state.doc.toString();
                storage.saveFrame(JSON.parse(content));
              } catch (e) {
                // Invalid JSON
              }
            }, 500)();
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    }),
    parent: frameContainer
  });
}

// ============================================
// Editor Content Helpers
// ============================================
function getJsonLdContent() {
  if (!state.jsonldEditor) return '';
  return state.jsonldEditor.state.doc.toString();
}

function setJsonLdContent(content) {
  if (!state.jsonldEditor) return;
  const doc = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  state.jsonldEditor.dispatch({
    changes: { from: 0, to: state.jsonldEditor.state.doc.length, insert: doc }
  });
}

function getShaclContent() {
  if (!state.shaclEditor) return '';
  return state.shaclEditor.state.doc.toString();
}

function setShaclContent(content) {
  if (!state.shaclEditor) return;
  state.shaclEditor.dispatch({
    changes: { from: 0, to: state.shaclEditor.state.doc.length, insert: content }
  });
}

function getFrameContent() {
  if (!state.frameEditor) return '';
  return state.frameEditor.state.doc.toString();
}

function setFrameContent(content) {
  if (!state.frameEditor) return;
  const doc = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  state.frameEditor.dispatch({
    changes: { from: 0, to: state.frameEditor.state.doc.length, insert: doc }
  });
}

function getContextContent() {
  if (!state.contextEditor) return '';
  return state.contextEditor.state.doc.toString();
}

function setContextContent(content) {
  if (!state.contextEditor) return;
  const doc = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  state.contextEditor.dispatch({
    changes: { from: 0, to: state.contextEditor.state.doc.length, insert: doc }
  });
}

// ============================================
// Context Editor
// ============================================
function initContextEditor() {
  const themeExtension = state.theme === 'dark' ? oneDark : [];
  const contextContainer = document.getElementById('context-editor');
  if (!contextContainer) return;
  
  contextContainer.innerHTML = '';
  
  // Initial context - extract from current JSON-LD or use default
  let initialContext = {};
  try {
    const doc = JSON.parse(getJsonLdContent());
    if (doc['@context']) {
      initialContext = doc['@context'];
    }
  } catch (e) {
    // Use empty context
  }
  
  state.contextEditor = new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(initialContext, null, 2),
      extensions: [
        basicSetup,
        json(),
        themeExtension,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    }),
    parent: contextContainer
  });
  
  // Toggle collapse functionality
  document.getElementById('toggle-context-btn')?.addEventListener('click', toggleContextEditor);
  document.getElementById('extract-context-btn')?.addEventListener('click', syncContextFromJsonLd);
  document.getElementById('apply-context-btn')?.addEventListener('click', applyContextToJsonLd);
  document.getElementById('compress-context-btn')?.addEventListener('click', compressContextToUri);
}

function compressContextToUri() {
  try {
    const contextStr = getContextContent();
    let context;
    
    // Handle both JSON object/array and simple string URL
    const trimmed = contextStr.trim();
    if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      // Treat as string URL
      context = trimmed.replace(/^["']|["']$/g, '');
    } else {
      try {
        context = JSON.parse(contextStr);
      } catch (e) {
        showToast('Invalid context JSON', 'error');
        return;
      }
    }
    
    // Register with JsonLdProcessor
    const urn = jsonldProcessor.registerContext(context);
    
    // Update JSON-LD content with the URN
    let doc;
    try {
      doc = JSON.parse(getJsonLdContent());
    } catch (e) {
      showToast('Invalid JSON-LD document', 'error');
      return;
    }
    
    doc['@context'] = urn;
    setJsonLdContent(doc);
    
    processJsonLd();
    showToast('Context compressed to internal URI', 'success');
  } catch (e) {
    showToast('Failed to compress context: ' + e.message, 'error');
  }
}

function toggleContextEditor() {
  const wrapper = document.getElementById('context-editor-section');
  const chevron = document.querySelector('.chevron-icon');
  
  if (wrapper) {
    state.contextCollapsed = !state.contextCollapsed;
    wrapper.classList.toggle('collapsed', state.contextCollapsed);
  }
  if (chevron) {
    chevron.classList.toggle('rotated', state.contextCollapsed);
  }
}

function syncContextFromJsonLd() {
  try {
    const doc = JSON.parse(getJsonLdContent());
    if (doc['@context']) {
      setContextContent(doc['@context']);
      showToast('Context extracted from JSON-LD', 'success');
    } else {
      showToast('No @context found in JSON-LD', 'warning');
    }
  } catch (e) {
    showToast('Invalid JSON-LD document', 'error');
  }
}

function applyContextToJsonLd() {
  try {
    const contextStr = getContextContent();
    let context;
    
    // Handle both string URLs and objects
    try {
      context = JSON.parse(contextStr);
    } catch (e) {
      // Maybe it's a simple URL string
      context = contextStr.trim().replace(/^["']|["']$/g, '');
    }
    
    const doc = JSON.parse(getJsonLdContent());
    doc['@context'] = context;
    setJsonLdContent(doc);
    processJsonLd();
    showToast('Context applied to JSON-LD', 'success');
  } catch (e) {
    showToast('Failed to apply context: ' + e.message, 'error');
  }
}

// ============================================
// Custom Ontologies
// ============================================
function initCustomOntologies() {
  document.getElementById('add-custom-ontology-btn')?.addEventListener('click', addCustomOntology);
  renderCustomOntologiesList();
}

function addCustomOntology() {
  const prefixInput = document.getElementById('custom-prefix');
  const namespaceInput = document.getElementById('custom-namespace');
  
  if (!prefixInput || !namespaceInput) return;
  
  const prefix = prefixInput.value.trim();
  const namespace = namespaceInput.value.trim();
  
  if (!prefix) {
    showToast('Please enter a prefix', 'warning');
    return;
  }
  
  if (!namespace) {
    showToast('Please enter a namespace URL', 'warning');
    return;
  }
  
  // Check for valid URL format
  if (!namespace.startsWith('http://') && !namespace.startsWith('https://')) {
    showToast('Namespace must be a valid URL', 'warning');
    return;
  }
  
  // Check if prefix already exists
  if (state.customOntologies.some(o => o.prefix === prefix)) {
    showToast('Prefix already exists', 'warning');
    return;
  }
  
  state.customOntologies.push({ prefix, namespace });
  renderCustomOntologiesList();
  
  // Clear inputs
  prefixInput.value = '';
  namespaceInput.value = '';
  
  showToast(`Added ontology: ${prefix}`, 'success');
}

function removeCustomOntology(prefix) {
  state.customOntologies = state.customOntologies.filter(o => o.prefix !== prefix);
  renderCustomOntologiesList();
  showToast(`Removed ontology: ${prefix}`, 'info');
}

function renderCustomOntologiesList() {
  const container = document.getElementById('custom-ontologies-list');
  if (!container) return;
  
  if (state.customOntologies.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = state.customOntologies.map(ont => `
    <div class="custom-ontology-tag" title="${ont.namespace}">
      <span class="prefix">${ont.prefix}:</span>
      <span>${ont.namespace.length > 30 ? ont.namespace.slice(0, 30) + '...' : ont.namespace}</span>
      <button onclick="window.removeCustomOntology('${ont.prefix}')" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Expose to window for inline onclick
window.removeCustomOntology = removeCustomOntology;

// ============================================
// Ontology Selector
// ============================================
function initOntologySelector() {
  const grid = document.getElementById('ontology-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  for (const [id, ont] of Object.entries(ontologies)) {
    const item = document.createElement('div');
    item.className = 'ontology-item';
    item.innerHTML = `
      <input type="checkbox" id="ont-${id}" value="${id}">
      <label for="ont-${id}">${ont.name}</label>
    `;
    
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedOntologies.push(id);
        item.classList.add('selected');
      } else {
        state.selectedOntologies = state.selectedOntologies.filter(o => o !== id);
        item.classList.remove('selected');
      }
    });
    
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    grid.appendChild(item);
  }
}

function generateContextFromOntologies() {
  if (state.selectedOntologies.length === 0 && state.customOntologies.length === 0) {
    showToast('Please select at least one ontology or add a custom one', 'warning');
    return;
  }
  
  // Build context from selected ontologies and custom ones
  let context = {};
  
  // Add custom ontologies first
  for (const ont of state.customOntologies) {
    context[ont.prefix] = ont.namespace;
  }
  
  // Add selected ontologies
  if (state.selectedOntologies.length > 0) {
    const ontContext = generateContext(state.selectedOntologies);
    if (typeof ontContext === 'string') {
      // Schema.org returns a string URL
      if (state.customOntologies.length > 0 || state.selectedOntologies.length > 1) {
        // Mix with other ontologies
        context['schema'] = 'https://schema.org/';
      } else {
        // Just schema.org alone
        context = ontContext;
      }
    } else {
      // Merge object contexts
      context = { ...context, ...ontContext };
    }
  }
  
  // Try to preserve existing document structure
  let doc;
  let isInvalid = false;
  let currentContent = '';
  
  try {
    currentContent = getJsonLdContent();
    if (currentContent.trim()) {
      doc = JSON.parse(currentContent);
    }
  } catch (e) {
    isInvalid = true;
    console.warn('Invalid JSON detected, will preserve content but apply context separately', e);
  }
  
  // CASE 1: Invalid JSON - Preserve content, update context editor only
  if (isInvalid) {
    // Generate context from selection
    let newContext = {};
    if (state.customOntologies.length > 0) {
      for (const ont of state.customOntologies) {
        newContext[ont.prefix] = ont.namespace;
      }
    }
    
    if (state.selectedOntologies.length > 0) {
       const generatedCtx = generateContext(state.selectedOntologies);
       // Handle Schema.org string vs object
       if (typeof generatedCtx === 'string') {
          if (state.customOntologies.length > 0 || state.selectedOntologies.length > 1) {
            newContext['schema'] = 'https://schema.org/';
            newContext['@vocab'] = 'https://schema.org/';
          } else {
             // Just schema.org string
             newContext = generatedCtx;
          }
       } else {
          // Merge object contexts
          if (generatedCtx.schema) {
             generatedCtx['@vocab'] = generatedCtx.schema;
          }
          newContext = { ...newContext, ...generatedCtx };
       }
    }
    
    // Update Context Editor ONLY
    setContextContent(newContext);
    showToast('Invalid JSON detected. Context updated in editor only.', 'warning');
    return; // Stop here, do not overwrite editor
  }
  
  // CASE 2: No content - Generate sample
  if (!doc) {
    doc = generateSampleDocument(state.selectedOntologies);
  }

  // CASE 3: Valid JSON - Merge context
  // Add custom ontologies to the context
  if (state.customOntologies.length > 0 && typeof doc['@context'] === 'object') {
    for (const ont of state.customOntologies) {
      doc['@context'][ont.prefix] = ont.namespace;
    }
  } else if (state.customOntologies.length > 0) {
    // Convert string context to object and add custom ontologies
    const newContext = {};
    if (typeof doc['@context'] === 'string') {
      if (doc['@context'].includes('schema.org')) {
        newContext['schema'] = 'https://schema.org/';
        newContext['@vocab'] = 'https://schema.org/';
      }
    }
    for (const ont of state.customOntologies) {
      newContext[ont.prefix] = ont.namespace;
    }
    doc['@context'] = newContext;
  }
  
  // Start with the base generated context
  if (state.selectedOntologies.length > 0) {
     const generatedCtx = generateContext(state.selectedOntologies);
     
     // specific logic for merging Schema.org string vs object
     if (typeof generatedCtx === 'string' && typeof doc['@context'] !== 'string') {
        if (!doc['@context']) doc['@context'] = {};
        doc['@context']['schema'] = 'https://schema.org/';
        doc['@context']['@vocab'] = 'https://schema.org/';
     } else if (typeof generatedCtx === 'object') {
        if (!doc['@context'] || typeof doc['@context'] === 'string') doc['@context'] = {};
        
        // If we are merging Schema.org, ensure we set it as vocab to support unprefixed terms
        if (generatedCtx.schema) {
          generatedCtx['@vocab'] = generatedCtx.schema;
        }
        
        Object.assign(doc['@context'], generatedCtx);
     } else if (!doc['@context']) {
        doc['@context'] = generatedCtx;
     }
  }

  setJsonLdContent(doc);
  
  // Also update the context editor
  setContextContent(doc['@context']);
  
  processJsonLd();
  showToast('Context generated successfully', 'success');
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  
  // View tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchView(view);
    });
  });
  
  // Format button
  document.getElementById('format-btn')?.addEventListener('click', formatJsonLd);
  
  // Clear button
  document.getElementById('clear-btn')?.addEventListener('click', clearJsonLd);
  
  // Generate context
  document.getElementById('generate-context-btn')?.addEventListener('click', generateContextFromOntologies);
  
  // Validate button
  document.getElementById('validate-btn')?.addEventListener('click', validateWithShacl);
  
  // Generate SHACL
  document.getElementById('generate-shacl-btn')?.addEventListener('click', generateShaclShapes);
  
  // Load SHACL
  document.getElementById('load-shacl-btn')?.addEventListener('click', loadShaclFile);
  
  // Close report - Removed as per request
  // document.getElementById('close-report-btn')?.addEventListener('click', () => {
  //   document.getElementById('validation-report')?.classList.add('hidden');
  // });
  
  // Download validation report
  document.getElementById('download-report-btn')?.addEventListener('click', downloadValidationReport);
  
  // Copy output
  document.getElementById('copy-output-btn')?.addEventListener('click', copyOutput);
  
  // Download output
  document.getElementById('download-output-btn')?.addEventListener('click', downloadOutput);
  
  // Share button
  document.getElementById('share-btn')?.addEventListener('click', shareDocument);
  
  // Examples button
  document.getElementById('examples-btn')?.addEventListener('click', () => {
    openModal('examples-modal');
  });
  
  // Help button
  document.getElementById('help-btn')?.addEventListener('click', () => {
    openModal('help-modal');
    renderHelpContent();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  // Ctrl/Cmd + Shift + F: Format
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
    e.preventDefault();
    formatJsonLd();
  }
  
  // Escape: Close modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
  }
}

// ============================================
// View Switching
// ============================================
function switchView(view) {
  state.currentView = view;
  
  // Update tab active state
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Show/hide frame section
  const frameSection = document.getElementById('frame-section');
  if (frameSection) {
    frameSection.classList.toggle('hidden', view !== 'framed');
  }
  
  // Update output views
  document.querySelectorAll('.output-view').forEach(v => {
    v.classList.remove('active');
  });
  document.getElementById(`output-${view}`)?.classList.add('active');
  
  // Process for the new view
  processJsonLd();
}

// ============================================
// JSON-LD Processing
// ============================================
async function processJsonLd() {
  const content = getJsonLdContent();
  if (!content.trim()) {
    setStatus('ready', 'Ready');
    return;
  }
  
  let doc;
  try {
    doc = JSON.parse(content);
  } catch (e) {
    setStatus('error', `JSON Parse Error: ${e.message}`);
    return;
  }
  
  setStatus('processing', 'Processing...');
  state.isProcessing = true;
  
  try {
    let result;
    
    switch (state.currentView) {
      case 'expanded':
        result = await jsonldProcessor.expand(doc);
        if (result.success) {
          renderJsonOutput('output-expanded', result.data);
        } else {
          showError('output-expanded', result.error);
        }
        break;
        
      case 'compacted':
        result = await jsonldProcessor.compact(doc);
        if (result.success) {
          renderJsonOutput('output-compacted', result.data);
        } else {
          showError('output-compacted', result.error);
        }
        break;
        
      case 'flattened':
        result = await jsonldProcessor.flatten(doc);
        if (result.success) {
          renderJsonOutput('output-flattened', result.data);
        } else {
          showError('output-flattened', result.error);
        }
        break;
        
      case 'framed':
        let frameDoc;
        try {
          frameDoc = JSON.parse(getFrameContent());
        } catch (e) {
          showError('output-framed', 'Invalid frame JSON');
          break;
        }
        result = await jsonldProcessor.frame(doc, frameDoc);
        if (result.success) {
          renderJsonOutput('output-framed', result.data);
        } else {
          showError('output-framed', result.error);
        }
        break;
        
      case 'nquads':
        result = await jsonldProcessor.toNQuads(doc);
        if (result.success) {
          renderTextOutput('output-nquads', result.data);
        } else {
          showError('output-nquads', result.error);
        }
        break;
        
      case 'canonized':
        result = await jsonldProcessor.canonize(doc);
        if (result.success) {
          renderTextOutput('output-canonized', result.data);
        } else {
          showError('output-canonized', result.error);
        }
        break;
        
      case 'table':
        result = await jsonldProcessor.toNQuads(doc);
        if (result.success) {
          const triples = jsonldProcessor.parseNQuads(result.data);
          renderTableOutput('output-table', triples);
        } else {
          showError('output-table', result.error);
        }
        break;
        
      case 'graph':
        result = await jsonldProcessor.toNQuads(doc);
        if (result.success) {
          const triples = jsonldProcessor.parseNQuads(result.data);
          const graphData = jsonldProcessor.extractGraphData(triples);
          renderGraphOutput('output-graph', graphData);
        } else {
          showError('output-graph', result.error);
        }
        break;
    }
    
    setStatus('ready', 'Ready');
  } catch (e) {
    setStatus('error', e.message);
    console.error('Processing error:', e);
  }
  
  state.isProcessing = false;
}

// ============================================
// Output Rendering
// ============================================
function renderJsonOutput(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  const json = JSON.stringify(data, null, 2);
  const highlighted = highlightJson(json);
  container.innerHTML = `<pre>${highlighted}</pre>`;
}

function renderTextOutput(elementId, text) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  container.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
}

function renderTableOutput(elementId, triples) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  if (triples.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
        <p>No triples to display</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="table-container">
      <table class="triples-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Predicate</th>
            <th>Object</th>
            <th>Graph</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  for (const triple of triples) {
    html += `
      <tr>
        <td class="uri">${escapeHtml(triple.subject)}</td>
        <td class="uri">${escapeHtml(triple.predicate)}</td>
        <td class="${triple.object.startsWith('http') ? 'uri' : 'literal'}">${escapeHtml(triple.object)}</td>
        <td>${escapeHtml(triple.graph)}</td>
      </tr>
    `;
  }
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderGraphOutput(elementId, graphData) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  const { nodes, links } = graphData;
  
  if (nodes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p>No graph to display</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '<div class="graph-container"></div>';
  const graphContainer = container.querySelector('.graph-container');
  
  const width = graphContainer.clientWidth || 600;
  const height = graphContainer.clientHeight || 400;
  
  const svg = d3.select(graphContainer)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Add zoom behavior
  const g = svg.append('g');
  
  svg.call(d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));
  
  // Create arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', 'var(--color-text-muted)');
  
  // Create simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(150))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Create links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'graph-link')
    .attr('marker-end', 'url(#arrowhead)');
  
  // Create link labels
  const linkLabel = g.append('g')
    .selectAll('text')
    .data(links)
    .join('text')
    .attr('class', 'graph-link-label')
    .text(d => d.label);
  
  // Create nodes
  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'graph-node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));
  
  node.append('circle')
    .attr('r', d => d.type === 'literal' ? 6 : 10)
    .attr('fill', d => d.type === 'literal' ? 'var(--color-accent-tertiary)' : 'var(--color-accent-primary)');
  
  node.append('text')
    .attr('dx', 15)
    .attr('dy', 4)
    .text(d => d.label);
  
  node.append('title')
    .text(d => d.id);
  
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    linkLabel
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2);
    
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
  
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function showError(elementId, message) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state" style="color: var(--color-error);">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// ============================================
// SHACL Operations
// ============================================
async function validateWithShacl() {
  const shaclContent = getShaclContent();
  if (!shaclContent.trim()) {
    showToast('Please enter SHACL shapes', 'warning');
    return;
  }
  
  let doc;
  try {
    doc = JSON.parse(getJsonLdContent());
  } catch (e) {
    showToast('Invalid JSON-LD document', 'error');
    return;
  }
  
  setStatus('processing', 'Validating...');
  
  const result = await shaclValidator.validate(doc, shaclContent);
  
  if (!result.success) {
    showToast(`Validation error: ${result.error}`, 'error');
    setStatus('error', 'Validation failed');
    return;
  }
  
  // Store report for downloading
  state.lastValidationReport = result.report;
  renderValidationReport(result.report);
  setStatus('ready', 'Ready');
}

function renderValidationReport(report) {
  const reportEl = document.getElementById('validation-report');
  const contentEl = document.getElementById('report-content');
  
  if (!reportEl || !contentEl) return;
  
  reportEl.classList.remove('hidden');
  
  let html = '';
  
  if (report.conforms) {
    html = `
      <div class="report-status conforms">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Data conforms to SHACL shapes
      </div>
    `;
    showToast('Validation passed!', 'success');
  } else {
    html = `
      <div class="report-status violations">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        ${report.results.length} violation(s) found
      </div>
    `;
    
    for (const result of report.results) {
      html += `
        <div class="violation-item">
          <div class="violation-path">${escapeHtml(result.path)}</div>
          <div class="violation-message">${escapeHtml(result.message)}</div>
          ${result.value ? `<div class="violation-message">Value: ${escapeHtml(result.value)}</div>` : ''}
          <span class="violation-severity ${result.severity.toLowerCase()}">${result.severity}</span>
        </div>
      `;
    }
    
    showToast(`Validation failed: ${report.results.length} violation(s)`, 'error');
  }
  
  contentEl.innerHTML = html;
}

async function generateShaclShapes() {
  let doc;
  try {
    doc = JSON.parse(getJsonLdContent());
  } catch (e) {
    showToast('Invalid JSON-LD document', 'error');
    return;
  }
  
  setStatus('processing', 'Generating SHACL...');
  
  const result = await shaclGenerator.generateFromJsonLd(doc);
  
  if (result.success) {
    setShaclContent(result.data);
    showToast('SHACL shapes generated', 'success');
  } else {
    showToast(`Generation failed: ${result.error}`, 'error');
  }
  
  setStatus('ready', 'Ready');
}

async function loadShaclFile() {
  try {
    const file = await storage.importFile('.ttl,.shacl,.txt');
    setShaclContent(file.content);
    showToast(`Loaded ${file.name}`, 'success');
  } catch (e) {
    showToast('Failed to load file', 'error');
  }
}

// ============================================
// Actions
// ============================================
function formatJsonLd() {
  try {
    const content = getJsonLdContent();
    const doc = JSON.parse(content);
    setJsonLdContent(JSON.stringify(doc, null, 2));
    showToast('JSON formatted', 'success');
  } catch (e) {
    showToast('Cannot format invalid JSON', 'error');
  }
}

function clearJsonLd() {
  setJsonLdContent('{\n  \n}');
  processJsonLd();
}

async function copyOutput() {
  const activeView = document.querySelector('.output-view.active');
  if (!activeView) return;
  
  const text = activeView.textContent || '';
  const success = await share.copyToClipboard(text);
  showToast(success ? 'Copied to clipboard' : 'Failed to copy', success ? 'success' : 'error');
}

function downloadOutput() {
  const activeView = document.querySelector('.output-view.active');
  if (!activeView) return;
  
  const text = activeView.textContent || '';
  const ext = state.currentView === 'nquads' || state.currentView === 'canonized' ? 'nq' : 'json';
  storage.downloadFile(text, `jsonld-${state.currentView}.${ext}`);
  showToast('Download started', 'success');
}

async function shareDocument() {
  let doc;
  try {
    doc = JSON.parse(getJsonLdContent());
  } catch (e) {
    showToast('Invalid JSON-LD document', 'error');
    return;
  }
  
  const result = share.generatePermalink(doc);
  
  if (result.success) {
    const success = await share.copyToClipboard(result.url);
    showToast(success ? 'Link copied to clipboard' : 'Failed to copy link', success ? 'success' : 'error');
  } else {
    showToast(result.error, 'error');
  }
}

function downloadValidationReport() {
  if (!state.lastValidationReport) {
    showToast('No validation report available', 'warning');
    return;
  }
  
  const reportJson = JSON.stringify(state.lastValidationReport, null, 2);
  storage.downloadFile(reportJson, 'validation-report.json');
  showToast('Report download started', 'success');
}

// ============================================
// Modals
// ============================================
function initModals() {
  // Close modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.closest('.modal')?.classList.add('hidden');
    });
  });
  
  // Close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal')?.classList.add('hidden');
    });
  });
  
  // Populate examples
  renderExamplesModal();
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.remove('hidden');
}

function renderExamplesModal() {
  const container = document.getElementById('examples-list');
  if (!container) return;
  
  const icons = {
    'user': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    'shopping-bag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
    'users': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'book-open': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'calendar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'code': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };
  
  container.innerHTML = examples.map(ex => `
    <div class="example-item" data-example-id="${ex.id}">
      <div class="example-icon">${icons[ex.icon] || icons['code']}</div>
      <div class="example-info">
        <h4>${ex.name}</h4>
        <p>${ex.description}</p>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.example-item').forEach(item => {
    item.addEventListener('click', () => {
      const exampleId = item.dataset.exampleId;
      loadExample(exampleId);
      document.getElementById('examples-modal')?.classList.add('hidden');
    });
  });
}

function loadExample(exampleId) {
  const example = examples.find(e => e.id === exampleId);
  if (!example) return;
  
  setJsonLdContent(example.jsonld);
  if (example.shacl) {
    setShaclContent(example.shacl);
  }
  
  processJsonLd();
  showToast(`Loaded: ${example.name}`, 'success');
}

function renderHelpContent() {
  const container = document.getElementById('help-content');
  if (!container) return;
  
  container.innerHTML = `
    <div class="help-section">
      <h3>About JSON-LD Builder</h3>
      <p>A comprehensive tool for creating, transforming, and validating JSON-LD documents with SHACL shapes support.</p>
    </div>
    
    <div class="help-section">
      <h3>@context Editor</h3>
      <p>The @context editor allows you to manually edit the JSON-LD context, which is fundamental for defining how terms in your document map to IRIs.</p>
      <ul>
        <li><strong>Extract:</strong> Pull the current @context from your JSON-LD document into the editor</li>
        <li><strong>Apply:</strong> Push your edited context back into the JSON-LD document</li>
        <li>Edit the context directly with full syntax highlighting</li>
        <li>Supports both URL contexts (e.g., "https://schema.org") and object contexts</li>
      </ul>
    </div>
    
    <div class="help-section">
      <h3>Ontology-based Context Generation</h3>
      <p>Quickly generate contexts using popular ontologies:</p>
      <ul>
        <li><strong>Built-in ontologies:</strong> Schema.org, FOAF, Dublin Core, SKOS, SIOC, GeoSPARQL, PROV-O</li>
        <li><strong>Custom ontologies:</strong> Add your own ontologies by specifying a prefix and namespace URL</li>
        <li>Select multiple ontologies and click "Generate" to create a combined context</li>
      </ul>
    </div>
    
    <div class="help-section">
      <h3>JSON-LD Visualizations</h3>
      <ul>
        <li><strong>Expanded:</strong> Shows the document with all terms replaced by their full IRIs</li>
        <li><strong>Compacted:</strong> Applies the context to create a more human-readable form</li>
        <li><strong>Flattened:</strong> Creates a flat graph structure with all nodes at the top level</li>
        <li><strong>Framed:</strong> Reshapes the document according to a frame template</li>
        <li><strong>N-Quads:</strong> Converts to N-Quads format (subject-predicate-object-graph)</li>
        <li><strong>Canonized:</strong> URDNA2015 canonicalization for consistent hashing</li>
        <li><strong>Table:</strong> Displays triples in a sortable table format</li>
        <li><strong>Graph:</strong> Interactive visualization of the RDF graph</li>
      </ul>
    </div>
    
    <div class="help-section">
      <h3>SHACL Validation</h3>
      <p>Use SHACL (Shapes Constraint Language) to define and validate the structure of your JSON-LD data.</p>
      <ul>
        <li>Write SHACL shapes in Turtle syntax</li>
        <li>Click "Validate" to check your JSON-LD against the shapes</li>
        <li>Click "Generate from JSON-LD" to auto-generate shapes from your document</li>
      </ul>
    </div>
    
    <div class="help-section">
      <h3>Keyboard Shortcuts</h3>
      <ul>
        <li><span class="keyboard-shortcut"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd></span> Format JSON</li>
        <li><span class="keyboard-shortcut"><kbd>Esc</kbd></span> Close modals</li>
      </ul>
    </div>
    
    <div class="help-section">
      <h3>Resources</h3>
      <ul>
        <li><a href="https://json-ld.org/" target="_blank">JSON-LD Specification</a></li>
        <li><a href="https://www.w3.org/TR/shacl/" target="_blank">SHACL Specification</a></li>
        <li><a href="https://schema.org/" target="_blank">Schema.org</a></li>
      </ul>
    </div>
  `;
}

// ============================================
// URL Loading
// ============================================
function loadFromUrl() {
  const urlParams = share.parseUrlParams();
  
  if (urlParams.hasParams) {
    if (urlParams.jsonld) {
      setJsonLdContent(urlParams.jsonld);
    }
    if (urlParams.shacl) {
      setShaclContent(typeof urlParams.shacl === 'string' ? urlParams.shacl : JSON.stringify(urlParams.shacl));
    }
    if (urlParams.frame) {
      setFrameContent(urlParams.frame);
    }
    
    // Clear URL params after loading
    share.clearUrlParams();
    showToast('Document loaded from URL', 'info');
  }
}

// ============================================
// Utility Functions
// ============================================
function setStatus(type, message) {
  const statusBar = document.getElementById('status-bar');
  if (!statusBar) return;
  
  const icon = statusBar.querySelector('.status-icon');
  const text = statusBar.querySelector('.status-text');
  
  if (icon) {
    icon.className = `status-icon status-${type}`;
  }
  if (text) {
    text.textContent = message;
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function highlightJson(json) {
  return json
    .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Debounce function
const debounceTimers = new Map();
function debounce(fn, delay) {
  return function(...args) {
    const key = fn.toString();
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
    }
    debounceTimers.set(key, setTimeout(() => {
      fn.apply(this, args);
      debounceTimers.delete(key);
    }, delay));
  };
}
