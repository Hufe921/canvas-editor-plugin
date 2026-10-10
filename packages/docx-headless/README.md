# Headless Word exchange (proposal)

This Node-only package imports/exports bounded DOCX bytes through a neutral typed document model. It does not construct a browser editor, download files, fetch document resources, persist data or decide review records.

`importDocx(bytes)` returns the document, section ranges/layout/stories, named styles, embedded image data and explicit conversion losses. `exportDocx(document, mode, assets, stories, styleDefinitions)` returns a Buffer. `exportDocxSections(input, mode)` preserves independent section stories, page geometry and equal-width columns while rebasing package identities. Modes are `retain-review`, `original` and `final`; projections do not mutate their input.

Native review supports run insertion/deletion/formatting, paragraph insertion/deletion/formatting/split/join and classic body comments. Source author attribution is retained separately as `importedAuthor`; it is not an authenticated application identity. Applications preserve originals, canonical document identity and resolved/history records themselves. Word ignores header/footer comment anchors; exporting them is rejected rather than emitting invalid review.

CRC, byte/entry/expansion bounds, streaming XML complexity limits, relationship validation and source-loss diagnostics run before conversion. Only HTTP(S) external hyperlink relationships are accepted; resources are never fetched. Images must be supplied as verified bytes. Unsupported merged/nested tables, floating content and other advanced source features require explicit conversion handling. Exact Microsoft Word compatibility and a complete print-fidelity corpus are not certified by these unit tests.

Run `pnpm --filter @hufe921/canvas-editor-plugin-docx-headless test`. Provenance and licenses are retained in `PROVENANCE.md` and `LICENSE`. This is an upstream proposal, not a separately maintained application fork.
