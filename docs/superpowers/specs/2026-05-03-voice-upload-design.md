# Voice Upload — Forge Wizard

**Date:** 2026-05-03

## Problem

The forge wizard's voice step only supports mic recording. Users who have a pre-existing voice sample need a way to upload it instead.

## Requirements

- Recording remains the default view.
- Upload is a secondary, discoverable option surfaced via a text link toggle.
- Accepted formats: `audio/*` (server validates; frontend does not restrict beyond MIME category).
- No client-side file size limit; server rejects oversized files.
- Both paths produce the same `Blob` passed to `onComplete` — no downstream changes needed.

## Design

### `VoiceRecorder` changes

Add two props:

```ts
mode: 'record' | 'upload'
onModeChange: (mode: 'record' | 'upload') => void
```

**Record mode** — unchanged UI. Below the recorder panel: a text link `"or upload a file instead"` that calls `onModeChange('upload')`.

**Upload mode** — replace the recorder panel with:
- A styled file input (`<input type="file" accept="audio/*">`) hidden behind a button label.
- On file selection: call `onComplete(file)` immediately and show `<audio src={objectURL} controls>` for preview.
- Below: a text link `"or record instead"` that calls `onModeChange('record')`.

### `create/page.tsx` changes

- Add `voiceMode` state (`'record' | 'upload'`, default `'record'`).
- Pass `mode={voiceMode}` and `onModeChange={setVoiceMode}` to `<VoiceRecorder>`.
- Reset `voiceMode` to `'record'` when navigating back to the voice step (already handled naturally since state persists but mode toggle is explicit).

### Step label

The voice step card label stays `"Record a voice sample"` — the upload path is discovered via the toggle, not advertised in the heading.

## Non-goals

- Drag-and-drop upload zone.
- Format validation on the client.
- Progress indicator for large file reads (file is read instantly via `File` object, no fetch involved at this stage).
