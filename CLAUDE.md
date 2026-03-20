# Hànzì Helper

Chinese language learning tool: type/paste Chinese text, see pinyin + translations, save words as flashcards with spaced repetition.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build — run this to verify changes
npm run lint         # ESLint
npm test             # Run all tests (vitest run)
npm run test:watch   # Run tests in watch mode
npm run build:dict   # Regenerate CC-CEDICT dictionary (src/data/cedict.json)
```

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5**
- **TailwindCSS 4** (via `@tailwindcss/postcss`)
- **Tiptap** rich text editor (dynamic import, no SSR)
- **Supabase** — auth (Google + Email/Password) and PostgreSQL flashcard storage
- **pinyin-pro** — pinyin conversion and word segmentation
- **tesseract.js** — OCR for Chinese characters
- **msedge-tts** — text-to-speech API route

## Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout (AuthProvider wraps everything)
│   ├── page.tsx              # Home — editor + pinyin display + definitions
│   ├── error.tsx             # Global error boundary (Next.js convention)
│   ├── flashcards/page.tsx   # Flashcard modes (review, browse, learn, match)
│   ├── login/page.tsx        # Login/signup (Google OAuth + email/password)
│   ├── usage/page.tsx        # API usage tracker
│   ├── auth/callback/route.ts # OAuth code exchange
│   └── api/
│       ├── translate/route.ts # Full text translation (Lingva + MyMemory race)
│       ├── define/route.ts    # Word definitions (CC-CEDICT + Vietnamese translation)
│       └── tts/route.ts       # Text-to-speech via msedge-tts
├── components/
│   ├── Icons.tsx             # Shared SVG icons (SpeakerIcon, CloseIcon, CheckIcon, etc.)
│   ├── Sidebar.tsx           # Navigation + dark mode + auth UI
│   ├── Editor.tsx            # Tiptap editor (dynamic import)
│   ├── PinyinDisplay.tsx     # Word-level pinyin rendering, clickable words
│   ├── DefinitionPopup.tsx   # Popup for word definitions, save to flashcards
│   ├── SelectionToolbar.tsx  # Text selection actions (TTS, copy)
│   ├── SpeechPractice.tsx    # Pronunciation practice
│   ├── FlashcardViewer.tsx   # Single card review (flip + rate)
│   ├── FlashcardBrowse.tsx   # Browse all cards
│   ├── FlashcardLearn.tsx    # Type-the-answer quiz
│   └── FlashcardMatch.tsx    # Timed matching game
├── contexts/
│   └── AuthContext.tsx       # AuthProvider + useAuth() hook
├── hooks/
│   ├── useFlashcards.ts      # Central flashcard hook (Supabase or localStorage)
│   ├── useWordDefinition.ts  # Word definition lookup with client-side cache
│   ├── useTTS.ts             # Text-to-speech hook
│   └── useOCR.ts             # OCR hook
├── lib/
│   ├── flashcardStore.ts     # localStorage flashcard CRUD + SM-2 algorithm
│   ├── dateUtils.ts          # Shared date utilities (todayStr)
│   ├── concurrency.ts        # pMap — Promise.all with concurrency limit
│   ├── translate.ts          # Shared translation functions (Lingva + MyMemory)
│   ├── apiUsage.ts           # API call tracking
│   ├── rateLimit.ts          # In-memory sliding-window rate limiter
│   ├── compareText.ts        # Text comparison utilities
│   ├── screenCapture.ts      # Screen capture for OCR
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       ├── server.ts         # Server Supabase client (cookies-based)
│       └── types.ts          # FlashcardRow type + DB-to-app mapper
├── __test__/
│   └── setup.ts              # Vitest setup (jest-dom matchers, cleanup, crypto polyfill)
├── middleware.ts              # Supabase session refresh
├── data/
│   └── cedict.json           # CC-CEDICT dictionary (~120K entries, GENERATED — do not edit)
└── types/
    └── speech.d.ts
```

Test files live in `__test__/` subdirectories alongside the code they test (e.g. `src/lib/__test__/flashcardStore.test.ts`).

## Architecture Decisions

### Flashcard Storage
`useFlashcards()` hook abstracts the storage backend:
- **Logged out** → delegates to `flashcardStore.ts` (localStorage)
- **Logged in** → queries Supabase `flashcards` table directly
- **First login** → auto-migrates localStorage cards to Supabase via batch upsert
- **Sync errors** → on Supabase write failure, exposes `syncError` string and reverts optimistic update via `refresh()`. Consumers display a dismissible banner and call `clearSyncError()`.

All flashcard sub-components (Viewer, Browse, Learn, Match) receive data as **props** — they don't touch storage directly. Only `flashcards/page.tsx` and `DefinitionPopup.tsx` use the hook.

### SM-2 Spaced Repetition
`computeSM2()` is a pure function in `flashcardStore.ts`. It takes a card's current state + rating and returns new `{ interval, easeFactor, reviewCount, nextReview }`. Used by both the localStorage path and the Supabase path.

### Translation Strategy
`/api/translate` and `/api/define` use a dual-API race (`Promise.any()`) with Lingva and MyMemory. English definitions come from CC-CEDICT (offline, instant); Vietnamese uses the translation APIs. Multi-line translation uses `pMap` with concurrency of 5 to avoid overwhelming upstream APIs (max 10 outbound HTTP requests at a time, since each line races 2 APIs).

### CC-CEDICT Dictionary
`src/data/cedict.json` is **generated** (in `.gitignore`). Regenerate with `npm run build:dict`. In API routes, load it with `fs.readFileSync` + lazy init — do NOT use `import` for large JSON to avoid webpack bundling issues.

### API Security
- **Rate limiting**: In-memory sliding-window rate limiter (`src/lib/rateLimit.ts`) keyed by client IP. Limits: `/api/translate` 30 req/min, `/api/define` 60 req/min, `/api/tts` 30 req/min. **Note:** Uses a process-local Map that resets on serverless cold starts — effective for local dev and long-running servers; for production serverless, consider Upstash Redis or Vercel WAF.
- **Input length limits**: `/api/translate` max 10K chars / 100 lines, `/api/define` max 50 char word, `/api/tts` max 500 chars.
- **OAuth redirect validation**: `auth/callback` validates the `next` param (must start with `/`, no `//` or `://`) to prevent open redirects.
- **Defense-in-depth**: All Supabase mutation queries in `useFlashcards` include `.eq("user_id", user.id)` alongside RLS.

### Testing
**Vitest** with `@testing-library/react` and `@testing-library/user-event`. Config in `vitest.config.ts`. **220 tests across 24 files.**

- **Default environment**: `node` (fast for pure function tests). Tests needing DOM/localStorage opt in with `// @vitest-environment jsdom` at the top of the file.
- **Setup file**: `src/__test__/setup.ts` — imports jest-dom matchers, runs `cleanup()` after each test, polyfills `crypto.randomUUID`.
- **Test location**: `__test__/` subdirectory next to source (e.g. `src/lib/__test__/flashcardStore.test.ts`). Import the source via `../` relative paths; `@/` aliases work for cross-module imports.
- **Mocking patterns**: `vi.mock()` for modules, `vi.stubGlobal("fetch", vi.fn())` for fetch, `vi.hoisted()` for mocks needed before module-level side effects (e.g. Supabase `createClient()` at import time, or mutable mock state in Editor tests).
- **Fake timers**: Use `vi.useFakeTimers()` / `vi.setSystemTime()` for date-dependent logic (SM-2 scheduling, API usage pruning). Prefer `fireEvent` over `userEvent` when combining with fake timers and `setInterval` (avoids timeout issues).
- **Module-level singletons**: Use `vi.resetModules()` + dynamic `await import()` in `beforeEach` to reset module-level cached state (e.g. TTS route's `ttsClient` variable).
- **Constructor mocks**: Use ES6 classes (not `vi.fn().mockImplementation()`) when mocking classes used with `new` (e.g. `MsEdgeTTS`, `Audio`).
- **Supabase PromiseLike**: Supabase query builder returns `PromiseLike`, not `Promise` — it does NOT support `.catch()`. Use `.then(({ error }) => ...)` only.
- **Module-scope `createClient()`**: Both `AuthContext.tsx`, `login/page.tsx`, and `useFlashcards.ts` call `createClient()` at module scope. Tests for these files must use `vi.hoisted()` to define mocks before the module-level call executes.

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Client components**: Use `"use client"` directive. All pages except layout are client components.
- **Dark mode**: Toggle via `document.documentElement.classList.toggle("dark")`, persisted in localStorage. Inline script in `<head>` prevents flash.
- **Styling**: Tailwind utility classes only. Dark mode via `dark:` variants. Accent color is teal (`teal-600` light / `teal-400` dark).
- **Testing**: Vitest + Testing Library. Tests in `__test__/` subdirectories. Use `// @vitest-environment jsdom` comment for tests needing DOM/localStorage (default is `node`).
- **Shared Icons**: Reusable SVG icons live in `src/components/Icons.tsx` (SpeakerIcon, SpeakerWaveIcon, CloseIcon, CheckIcon, CheckCircleIcon). Each takes an optional `className` prop. Use these instead of inline SVGs for commonly-used icons.
- **Shared utilities**: `todayStr()` in `src/lib/dateUtils.ts`, `pMap()` in `src/lib/concurrency.ts`. Import from these rather than defining locally.
- **`useWordDefinition` hook**: Extracted from `page.tsx` — encapsulates word click handling, definition fetching, and client-side cache. Used by the home page.
- **Error boundary**: `src/app/error.tsx` catches unhandled errors in all pages (Next.js App Router convention).
- **`useSearchParams()`** must be wrapped in a `<Suspense>` boundary (Next.js 16 requirement).
- Next.js 16 shows a deprecation warning for `middleware` (recommends `proxy`) — this is non-blocking.

## Environment Variables

Required in `.env.local` (gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
