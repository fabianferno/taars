# Voice Upload — Forge Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file upload fallback to the voice step in the forge wizard, with recording remaining the default.

**Architecture:** `VoiceRecorder` gains `mode`/`onModeChange` props; when `mode === 'upload'` it swaps the recorder panel for a styled file input + audio preview. Mode state lives in `create/page.tsx` so it resets naturally on step navigation. No downstream changes needed — both paths produce the same `Blob` via `onComplete`.

**Tech Stack:** React 19, Next.js 15 (app router), TypeScript, Tailwind CSS

---

### Task 1: Extend VoiceRecorder with upload mode

**Files:**
- Modify: `web/src/components/VoiceRecorder.tsx`

- [ ] **Step 1: Add mode props to the interface**

Replace the existing `Props` interface at the top of `web/src/components/VoiceRecorder.tsx`:

```tsx
interface Props {
  onComplete: (blob: Blob) => void;
  maxSeconds?: number;
  mode?: 'record' | 'upload';
  onModeChange?: (mode: 'record' | 'upload') => void;
}
```

- [ ] **Step 2: Destructure the new props**

Replace:
```tsx
export function VoiceRecorder({ onComplete, maxSeconds = 60 }: Props) {
```
With:
```tsx
export function VoiceRecorder({
  onComplete,
  maxSeconds = 60,
  mode = 'record',
  onModeChange,
}: Props) {
```

- [ ] **Step 3: Add upload state and handler**

After the existing `const timerRef` line, add:

```tsx
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedUrl(URL.createObjectURL(file));
    onComplete(file);
  }
```

- [ ] **Step 4: Add upload panel to the return JSX**

Replace the entire `return (...)` block with:

```tsx
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur">
      {mode === 'record' ? (
        <>
          <p className="mb-3 text-sm text-neutral-400">
            Record up to {maxSeconds}s of natural speech. Voice character matters more than what you say.
          </p>
          {recording ? (
            <button
              onClick={stop}
              className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Stop ({secondsLeft}s)
            </button>
          ) : (
            <button
              onClick={start}
              className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
            >
              {recordedUrl ? 'Re-record' : 'Start recording'}
            </button>
          )}
          {recordedUrl && <audio src={recordedUrl} controls className="mt-3 w-full" />}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-400">
            Upload an audio file. Accepted: any format supported by OpenVoice (wav, mp3, m4a, flac, ogg…).
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white">
            {uploadedUrl ? 'Replace file' : 'Choose file'}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {uploadedUrl && <audio src={uploadedUrl} controls className="mt-3 w-full" />}
        </>
      )}

      {onModeChange && (
        <button
          onClick={() => onModeChange(mode === 'record' ? 'upload' : 'record')}
          className="mt-4 block text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {mode === 'record' ? 'or upload a file instead' : 'or record instead'}
        </button>
      )}
    </div>
  );
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors related to `VoiceRecorder.tsx`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/VoiceRecorder.tsx
git commit -m "feat(voice): add upload mode to VoiceRecorder"
```

---

### Task 2: Wire mode state in the forge wizard

**Files:**
- Modify: `web/src/app/create/page.tsx`

- [ ] **Step 1: Add voiceMode state**

In `CreatePage`, after the `const [voiceBlob, setVoiceBlob]` line, add:

```tsx
  const [voiceMode, setVoiceMode] = useState<'record' | 'upload'>('record');
```

- [ ] **Step 2: Pass mode props to VoiceRecorder**

Replace:
```tsx
<VoiceRecorder onComplete={setVoiceBlob} />
```
With:
```tsx
<VoiceRecorder
  onComplete={setVoiceBlob}
  mode={voiceMode}
  onModeChange={setVoiceMode}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/create/page.tsx
git commit -m "feat(forge): wire voice upload mode in wizard"
```

---

### Task 3: Smoke-test in the browser

- [ ] **Step 1: Start the dev server**

```bash
cd web && pnpm dev
```

- [ ] **Step 2: Navigate to /create and reach the voice step**

Confirm the recorder loads as default (mic recording UI visible).

- [ ] **Step 3: Click "or upload a file instead"**

Confirm the panel swaps to the upload UI with a "Choose file" button.

- [ ] **Step 4: Upload an audio file**

Select any audio file. Confirm the `<audio>` preview appears and the "Next" button becomes enabled.

- [ ] **Step 5: Click "or record instead"**

Confirm the panel swaps back to the recorder. The previously uploaded blob is cleared from the preview but `voiceBlob` state still holds it (Next remains enabled) — this is correct; the user can proceed or re-record to replace it.

- [ ] **Step 6: Verify forge still works end-to-end**

With an uploaded file selected, proceed through personality + price and click "Forge". Confirm the minting step begins (voice step is submitted as base64 regardless of origin).
