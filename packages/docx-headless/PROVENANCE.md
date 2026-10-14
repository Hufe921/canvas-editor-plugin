# Source provenance

This proposal ports the neutral MIT Word exchange implementation from ChefTaco/Proser, `ProserFactory/vendor/canvas-docx-codec`, version 1.0.0-proser.2. Its original upstream base is the public canvas-editor-plugin DOCX source at commit 4741a9f8885d57fde1704d39a7aa930aeadc51e6. Hufe copyright and MIT notice are retained in LICENSE. No AGPL ProserModule code, application databases, model providers, authentication or persistence implementation is included.

The Node runtime uses @xmldom/xmldom, saxes, yauzl, yazl and Zod. The original browser plugin and its JSZip/Color/docx dependency graph are not linked into this package.
