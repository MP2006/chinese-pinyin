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
│   ├── flashcards/page.tsx   # Flashcard modes (review, browse, learn, match)
│   ├── login/page.tsx        # Login/signup (Google OAuth + email/password)
│   ├── usage/page.tsx        # API usage tracker
│   ├── auth/callback/route.ts # OAuth code exchange
│   └── api/
│       ├── translate/route.ts # Full text translation (Lingva + MyMemory race)
│       ├── define/route.ts    # Word definitions (CC-CEDICT + Vietnamese translation)
│       └── tts/route.ts       # Text-to-speech via msedge-tts
├── components/
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
│   ├── useTTS.ts             # Text-to-speech hook
│   └── useOCR.ts             # OCR hook
├── lib/
│   ├── flashcardStore.ts     # localStorage flashcard CRUD + SM-2 algorithm
│   ├── translate.ts          # Shared translation functions (Lingva + MyMemory)
│   ├── apiUsage.ts           # API call tracking
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

All flashcard sub-components (Viewer, Browse, Learn, Match) receive data as **props** — they don't touch storage directly. Only `flashcards/page.tsx` and `DefinitionPopup.tsx` use the hook.

### SM-2 Spaced Repetition
`computeSM2()` is a pure function in `flashcardStore.ts`. It takes a card's current state + rating and returns new `{ interval, easeFactor, reviewCount, nextReview }`. Used by both the localStorage path and the Supabase path.

### Translation Strategy
`/api/translate` and `/api/define` use a dual-API race (`Promise.any()`) with Lingva and MyMemory. English definitions come from CC-CEDICT (offline, instant); Vietnamese uses the translation APIs.

### CC-CEDICT Dictionary
`src/data/cedict.json` is **generated** (in `.gitignore`). Regenerate with `npm run build:dict`. In API routes, load it with `fs.readFileSync` + lazy init — do NOT use `import` for large JSON to avoid webpack bundling issues.

### Testing
**Vitest** with `@testing-library/react` and `@testing-library/user-event`. Config in `vitest.config.ts`. **189 tests across 18 files.**

- **Default environment**: `node` (fast for pure function tests). Tests needing DOM/localStorage opt in with `// @vitest-environment jsdom` at the top of the file.
- **Setup file**: `src/__test__/setup.ts` — imports jest-dom matchers, runs `cleanup()` after each test, polyfills `crypto.randomUUID`.
- **Test location**: `__test__/` subdirectory next to source (e.g. `src/lib/__test__/flashcardStore.test.ts`). Import the source via `../` relative paths; `@/` aliases work for cross-module imports.
- **Mocking patterns**: `vi.mock()` for modules, `vi.stubGlobal("fetch", vi.fn())` for fetch, `vi.hoisted()` for mocks needed before module-level side effects (e.g. Supabase `createClient()` at import time, or mutable mock state in Editor tests).
- **Fake timers**: Use `vi.useFakeTimers()` / `vi.setSystemTime()` for date-dependent logic (SM-2 scheduling, API usage pruning). Prefer `fireEvent` over `userEvent` when combining with fake timers and `setInterval` (avoids timeout issues).
- **Module-level singletons**: Use `vi.resetModules()` + dynamic `await import()` in `beforeEach` to reset module-level cached state (e.g. TTS route's `ttsClient` variable).
- **Constructor mocks**: Use ES6 classes (not `vi.fn().mockImplementation()`) when mocking classes used with `new` (e.g. `MsEdgeTTS`, `Audio`).

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Client components**: Use `"use client"` directive. All pages except layout are client components.
- **Dark mode**: Toggle via `document.documentElement.classList.toggle("dark")`, persisted in localStorage. Inline script in `<head>` prevents flash.
- **Styling**: Tailwind utility classes only. Dark mode via `dark:` variants. Accent color is teal (`teal-600` light / `teal-400` dark).
- **Testing**: Vitest + Testing Library. Tests in `__test__/` subdirectories. Use `// @vitest-environment jsdom` comment for tests needing DOM/localStorage (default is `node`).
- **`useSearchParams()`** must be wrapped in a `<Suspense>` boundary (Next.js 16 requirement).
- Next.js 16 shows a deprecation warning for `middleware` (recommends `proxy`) — this is non-blocking.

## Environment Variables

Required in `.env.local` (gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
