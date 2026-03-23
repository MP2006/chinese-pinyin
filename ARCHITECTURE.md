# Hànzì Helper — Architecture

Chinese language learning tool: type/paste Chinese text, see pinyin + translations, save words as flashcards with spaced repetition.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router, Turbopack) | 16 |
| **UI** | React | 19 |
| **Language** | TypeScript | 5 |
| **Styling** | TailwindCSS (PostCSS-first, no config file) | 4 |
| **Rich Text Editor** | Tiptap (StarterKit) | 3 |
| **Auth & Database** | Supabase (Google OAuth + Email/Password, PostgreSQL + RLS) | 2 |
| **Chinese NLP** | pinyin-pro (pinyin conversion + word segmentation) | 3 |
| **Dictionary** | CC-CEDICT (~120K entries, self-hosted JSON) | — |
| **OCR** | PaddleOCR (FastAPI microservice, Docker) | 2.9 |
| **TTS** | msedge-tts (API route) | 2 |
| **Translation** | Lingva (primary) + MyMemory (fallback), sequential | — |
| **Grammar AI** | Google Gemini 2.5 Flash (grammar analysis + correction) | — |
| **Schema Validation** | Zod (runtime validation of Gemini responses) | 3 |
| **Rate Limiting** | Upstash Redis (distributed) / in-memory Map (fallback) | — |
| **Unit Tests** | Vitest + Testing Library + jsdom | 4 |
| **E2E Tests** | Playwright | 1.58 |
| **i18n** | Custom `useTranslation()` hook (no external library) | — |

### Production Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework with App Router & Turbopack |
| `react` / `react-dom` | UI library |
| `@supabase/supabase-js` | Auth & PostgreSQL client |
| `@supabase/ssr` | Server-side Supabase utilities (cookie-based sessions) |
| `@tiptap/react` / `@tiptap/starter-kit` / `@tiptap/pm` | Rich text editor |
| `pinyin-pro` | Pinyin conversion & word segmentation |
| `msedge-tts` | Text-to-speech via Microsoft Edge API |
| `@google/generative-ai` | Google Gemini API client (grammar analysis) |
| `zod` | Runtime schema validation for AI responses |
| `@upstash/redis` / `@upstash/ratelimit` | Distributed rate limiting |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tailwindcss` / `@tailwindcss/postcss` | Utility-first CSS (v4 PostCSS plugin) |
| `vitest` / `@vitest/coverage-v8` | Unit test runner + coverage |
| `@testing-library/react` / `user-event` / `jest-dom` | React component testing |
| `jsdom` | DOM environment for tests |
| `@playwright/test` | E2E testing |
| `eslint` / `eslint-config-next` | Linting |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Tiptap   │  │ PinyinDisplay│  │  Flashcard Components     │  │
│  │ Editor   │  │ (pinyin-pro) │  │  (Viewer/Browse/Learn/    │  │
│  │          │  │              │  │   Match)                   │  │
│  └────┬─────┘  └──────┬───────┘  └────────────┬──────────────┘  │
│       │               │                       │                 │
│  ┌────▼───────────────▼───────────────────────▼──────────────┐  │
│  │                    React Contexts                          │  │
│  │  AuthProvider (user, signOut)                               │  │
│  │  SettingsProvider (lang: "en" | "vi")                       │  │
│  └────┬───────────────┬───────────────────────┬──────────────┘  │
│       │               │                       │                 │
│  ┌────▼─────┐  ┌──────▼───────┐  ┌───────────▼──────────────┐  │
│  │useOCR    │  │useWordDef    │  │useFlashcards             │  │
│  │→/api/ocr │  │→cedict.ts    │  │→Supabase (logged in)     │  │
│  │          │  │ (client-side)│  │→localStorage (logged out) │  │
│  └──────────┘  └──────────────┘  └───────────────────────────┘  │
│                                                                 │
│  Client-side dictionary: /cedict.json (fetched once, cached)    │
│  Client-side translation: browser → Lingva/MyMemory (for vi)    │
└───────────────┬─────────────────────┬───────────────────────────┘
                │                     │
        ┌───────▼───────┐    ┌────────▼────────┐
        │  Next.js API  │    │    Supabase     │
        │   Routes      │    │                 │
        │               │    │  Auth (OAuth +  │
        │ /api/translate │    │   email/pass)   │
        │ /api/define   │    │                 │
        │ /api/tts      │    │  PostgreSQL     │
        │ /api/ocr ─────┼──┐ │  (flashcards   │
        │               │  │ │   table + RLS)  │
        └───────────────┘  │ └─────────────────┘
                           │
                  ┌────────▼────────┐
                  │  PaddleOCR      │
                  │  Microservice   │
                  │  (FastAPI +     │
                  │   Docker)       │
                  │  Port 8100      │
                  └─────────────────┘
```

---

## Data Flows

### Word Definition (client-side, no API call)

```
Click word → useWordDefinition → defineWord() from cedict.ts
  ├─ lang="en" → loadDict() fetches /cedict.json (cached in memory) → lookupEnglish() → instant
  └─ lang="vi" → translateText() → browser → Lingva/MyMemory direct → response
```

- English definitions are instant after the first dictionary load
- Vietnamese definitions bypass the server — browser calls Lingva/MyMemory directly
- Results cached in `wordCacheRef` per word per language

### Translation

```
Type text in editor
  → debounce 300ms
  → collapse multiple newlines (Tiptap outputs \n\n between blocks)
  → POST /api/translate { text, targetLang }
  → server splits on \n, translates each line via Lingva (fallback MyMemory)
  → pMap with concurrency 5
  → joined result displayed with whitespace-pre-line
```

### OCR

```
Drop/paste image into Editor
  → POST /api/ocr (FormData with image)
  → proxy to PaddleOCR microservice (FastAPI)
  → returns bounding boxes + text + confidence
  → extractChineseLines() filters Chinese-only results
  → preview overlay on original image with clickable highlights
  → click line or "Insert all" to add text to editor
```

### Flashcard Storage

```
Logged out:
  → flashcardStore.ts → localStorage CRUD
  → SM-2 spaced repetition via computeSM2() pure function

Logged in:
  → useFlashcards hook → Supabase queries
  → all mutations include .eq("user_id", user.id) defense-in-depth alongside RLS
  → optimistic updates with revert on failure (syncError state)

First login:
  → auto-migrate localStorage cards → Supabase batch upsert
  → flagged via localStorage "flashcards_migrated" key
```

### Authentication

```
Google OAuth:
  → click "Sign in with Google"
  → Supabase redirects to Google consent
  → callback to /auth/callback
  → isSafeRedirect() validates `next` param (no open redirects)
  → session cookie set

Email/Password:
  → login/page.tsx form
  → supabase.auth.signInWithPassword() or signUp()

Session refresh:
  → middleware.ts on every request
  → supabase.auth.getUser() refreshes session cookies
```

---

## Project Structure

```
chinese-pinyin/
├── ocr-service/                    # PaddleOCR microservice
│   ├── main.py                     #   FastAPI app (/recognize endpoint)
│   ├── requirements.txt            #   Python deps (paddleocr, paddlepaddle, etc.)
│   └── Dockerfile                  #   Container with pre-downloaded models
├── docker-compose.yml              # Runs OCR service on port 8100
├── e2e/                            # Playwright E2E tests
│   ├── fixtures/
│   │   ├── api-mocks.ts            #   Mock all API routes + cedict.json + Lingva
│   │   └── test-data.ts            #   Sample text, mock responses, seed cards
│   └── *.spec.ts                   #   Test specs (home, navigation, settings, flashcards)
├── scripts/
│   └── build-dict.mjs              # Downloads CC-CEDICT → parses → writes JSON to src/data + public/
├── public/
│   └── cedict.json                 # Generated dictionary for client-side use (gitignored)
└── src/
    ├── app/
    │   ├── layout.tsx              # Root: AuthProvider → SettingsProvider → Sidebar → {children}
    │   ├── page.tsx                # Home: editor + pinyin display + definition popup + translation
    │   ├── error.tsx               # Global error boundary (Next.js convention)
    │   ├── globals.css             # Design system: CSS custom properties, theme tokens, Tailwind
    │   ├── settings/page.tsx       # Language selection (en/vi)
    │   ├── flashcards/page.tsx     # 4 modes: review, browse, learn, match
    │   ├── login/page.tsx          # Google OAuth + email/password forms
    │   ├── usage/page.tsx          # API call tracking dashboard
    │   ├── auth/callback/route.ts  # OAuth code exchange + redirect validation
    │   └── api/
    │       ├── translate/route.ts  # Multi-line translation (Lingva → MyMemory), 30/min
    │       ├── define/route.ts     # Word definitions (CC-CEDICT + Vietnamese), 60/min
    │       ├── tts/route.ts        # Text-to-speech via msedge-tts, 30/min
    │       ├── ocr/route.ts        # Proxy to PaddleOCR microservice, 10/min
    │       └── analyze-grammar/route.ts # Grammar analysis + correction via Gemini, Zod-validated, 20/min
    ├── components/
    │   ├── Editor.tsx              # Tiptap editor + OCR preview + speech input + formatting toolbar
    │   ├── PinyinDisplay.tsx       # Word-level ruby annotations from Tiptap JSON
    │   ├── DefinitionPopup.tsx     # Click-word popup with definition + save to flashcards
    │   ├── SelectionToolbar.tsx    # Text selection actions (TTS, copy, speech practice, grammar)
    │   ├── GrammarPopover.tsx      # Grammar analysis + correction popover (amber correction card, pinyin)
    │   ├── SpeechPractice.tsx      # Pronunciation practice with speech recognition
    │   ├── Sidebar.tsx             # Navigation + dark mode toggle + auth UI
    │   ├── FlashcardViewer.tsx     # Single card: flip to reveal + rate (SM-2)
    │   ├── FlashcardBrowse.tsx     # Browse all saved cards
    │   ├── FlashcardLearn.tsx      # Type-the-answer quiz mode
    │   ├── FlashcardMatch.tsx      # Timed matching game
    │   └── Icons.tsx               # Shared SVG icons (Speaker, Close, Check, Trash, Plus, etc.)
    ├── contexts/
    │   ├── AuthContext.tsx          # { user, loading, signOut } via useAuth()
    │   └── SettingsContext.tsx      # { lang, setLang } via useSettings(), persisted to localStorage
    ├── hooks/
    │   ├── useFlashcards.ts        # Abstracts Supabase (logged in) vs localStorage (logged out)
    │   ├── useWordDefinition.ts    # Word click → cedict.ts defineWord() → cached result
    │   ├── useOCR.ts               # Image → /api/ocr → PaddleOCR → bounding boxes + text
    │   └── useTTS.ts               # Text-to-speech via /api/tts
    ├── lib/
    │   ├── cedict.ts               # Client-side CC-CEDICT: loadDict(), defineWord(), lookupEnglish()
    │   ├── translate.ts            # Lingva + MyMemory translation (works in browser, no Node APIs)
    │   ├── flashcardStore.ts       # localStorage CRUD + computeSM2() pure function
    │   ├── rateLimit.ts            # Sliding-window rate limiter (Upstash Redis or in-memory)
    │   ├── concurrency.ts          # pMap — Promise.all with concurrency limit
    │   ├── apiUsage.ts             # Client-side API call tracking (localStorage)
    │   ├── dateUtils.ts            # todayStr() utility
    │   ├── compareText.ts          # Text comparison for flashcard quizzes
    │   ├── screenCapture.ts        # readClipboardImage(), getDroppedImage()
    │   └── supabase/
    │       ├── client.ts           # Browser Supabase client (singleton)
    │       ├── server.ts           # Server Supabase client (cookie-based)
    │       └── types.ts            # FlashcardRow type + DB-to-app mapper
    ├── locales/
    │   ├── index.ts                # useTranslation() hook, Translations type
    │   ├── en.ts                   # English strings (source of truth for keys)
    │   └── vi.ts                   # Vietnamese strings
    ├── middleware.ts                # Supabase session refresh on every request
    ├── __test__/
    │   └── setup.ts                # jest-dom matchers, cleanup(), crypto polyfill
    └── data/
        └── cedict.json             # Generated CC-CEDICT (~120K entries, gitignored)
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Flashcard storage** | Supabase (logged in) / localStorage (logged out) | Works offline for anonymous users, seamless migration on first login |
| **Spaced repetition** | SM-2 algorithm as pure function (`computeSM2()`) | Testable, reusable by both storage backends |
| **Translation strategy** | Sequential Lingva → MyMemory (not `Promise.any`) | MyMemory returns romanization instead of translations for Chinese |
| **Word definitions** | Client-side CC-CEDICT + direct Lingva/MyMemory | Zero API calls for English (instant); one fewer network hop for Vietnamese |
| **Definition formatting** | Strip `(annotations)` + limit to 4 meanings | Concise popup — users want translations, not etymology |
| **OCR engine** | PaddleOCR (Docker microservice) over Tesseract.js | Deep learning beats Tesseract on colored, low-contrast, and varied-background CJK text |
| **i18n** | Custom hook, no library | Only 2 languages, simple key-value objects, fully type-safe via `typeof en` |
| **Dark mode** | Inline `<script>` + `.dark` class toggle | Prevents flash of wrong theme before hydration |
| **Editor persistence** | sessionStorage (not localStorage) | Content persists during in-app navigation but clears when tab closes |
| **Rate limiting** | Upstash Redis with in-memory fallback | Works on serverless (Vercel) + local dev without Redis |
| **Pinyin rendering** | `<ruby>` HTML elements with Intl.Segmenter word boundaries | Native browser support, proper word-level grouping for click-to-define |
| **Grammar AI validation** | Zod schema validation for Gemini responses | Replaces manual `isValidAnalysis()` — strict, type-safe, strips extra fields |
| **Grammar correction UX** | Muted amber card (no success badge when correct) | Zero-UI for correct sentences; non-intrusive amber for errors avoids alarming red |
| **Non-pedantic grammar** | Only flag fundamental structural errors | Colloquialisms, slang, omitted pronouns are standard spoken Chinese — not errors |
| **Editor JSON → Pinyin** | Render Tiptap JSONContent directly (not plain text) | Preserves formatting (bold, italic, lists, headings, blockquotes) in pinyin display |

---

## Theming & Design System

### Approach

TailwindCSS 4 with CSS custom properties defined in `globals.css`. No `tailwind.config.js` — uses the PostCSS-first approach via `@tailwindcss/postcss`.

### Color Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--color-primary` | #dc2626 (red-600) | #ef4444 (red-400) |
| `--color-surface-page` | #f9fafb | #111827 |
| `--color-surface-card` | #ffffff | #1f2937 |
| `--color-surface-subtle` | #f3f4f6 | #1f2937 |
| `--color-text-heading` | #111827 | #f9fafb |
| `--color-text-body` | #374151 | #d1d5db |
| `--color-text-muted` | #6b7280 | #9ca3af |
| `--color-border` | #e5e7eb | #374151 |

### Fonts

- **Body**: Inter (Google Fonts, `--font-inter`)
- **Code**: JetBrains Mono (Google Fonts, `--font-jetbrains-mono`)

### Layout

- **Sidebar**: Fixed left, 256px wide (`w-64`), hidden on mobile (slide-in on toggle)
- **Content**: `md:ml-64` to accommodate sidebar, max-width container with horizontal padding
- **Responsive**: Mobile-first, sidebar becomes overlay on small screens

---

## API Routes

| Route | Method | Rate Limit | Purpose |
|-------|--------|------------|---------|
| `/api/translate` | POST | 30/min | Multi-line translation (Lingva primary, MyMemory fallback). Max 10K chars / 100 lines. |
| `/api/define` | POST | 60/min | Word definitions: English from CC-CEDICT, Vietnamese via translation APIs. Max 50 char word. Kept for backward compatibility — client now uses `cedict.ts` directly. |
| `/api/tts` | POST | 30/min | Text-to-speech audio via msedge-tts. Max 500 chars. Returns WAV audio. |
| `/api/ocr` | POST | 10/min | Proxy to PaddleOCR microservice. Accepts FormData with image, returns bounding boxes + text. |
| `/api/analyze-grammar` | POST | 20/min | Grammar analysis + correction via Google Gemini 2.5 Flash. Max 200 chars. Zod-validated response with `isCorrect`, `correction`, `correctionPinyin`, `feedback`. Non-pedantic: only flags fundamental structural errors. |
| `/auth/callback` | GET | — | OAuth code exchange after Google redirect. Validates `next` param against open redirects. |

### Security

- **Rate limiting**: Sliding-window per client IP via `src/lib/rateLimit.ts`. Upstash Redis when env vars set, in-memory Map fallback.
- **Input validation**: Length limits on all API routes.
- **OAuth redirect**: `isSafeRedirect()` requires starting with `/`, rejects `//` and `://`.
- **Defense-in-depth**: All Supabase mutations include `.eq("user_id", user.id)` alongside RLS policies.

---

## Internationalization (i18n)

### Setup

No external library. Two translation files with the same key structure:

- `src/locales/en.ts` — English (source of truth for type inference)
- `src/locales/vi.ts` — Vietnamese

### Type Safety

```ts
export type Translations = typeof en;
// vi.ts satisfies Translations — TypeScript enforces matching keys
```

### Usage

```tsx
const t = useTranslation();
// t.home.title, t.flashcards.cardCount(n), t.sidebar.editor, etc.
```

### How Language Affects the App

`SettingsContext.lang` controls both:
1. **UI language** — all strings rendered via `useTranslation()`
2. **Translation target** — word definitions and full-text translation use this as the target language

---

## Testing

### Unit Tests

- **297 tests** across 29 files, ~97% line coverage
- **Framework**: Vitest + @testing-library/react + @testing-library/user-event
- **Default environment**: `node` (fast for pure function tests)
- **DOM tests**: Opt-in via `// @vitest-environment jsdom` comment at file top
- **Setup file**: `src/__test__/setup.ts` — jest-dom matchers, cleanup(), crypto polyfill

### Key Testing Patterns

| Pattern | When to Use |
|---------|------------|
| `vi.mock()` | Module mocking |
| `vi.hoisted()` | Mocks needed before module-level side effects (Supabase `createClient()`) |
| `vi.resetModules()` + dynamic `import()` | Reset module-level singletons between tests |
| ES6 class mocks | Constructor mocks (`MsEdgeTTS`, `Audio`, `Image`) — `vi.fn()` fails with `new` |
| `fireEvent` over `userEvent` | When combining with fake timers + `setInterval` |
| `vi.stubGlobal("fetch", vi.fn())` | Global fetch mocking |
| Mutable `{ value: ... }` objects | Mock state that changes between tests (Editor `ocrStatus`) |

### E2E Tests

- **Framework**: Playwright
- **Fixtures**: `e2e/fixtures/api-mocks.ts` intercepts all API routes + `cedict.json` + Lingva
- **Test data**: `e2e/fixtures/test-data.ts` provides sample text, mock responses, seed flashcards

### Commands

```bash
npm test                # Run all unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Playwright UI mode
```

---

## Environment Variables

### Required (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Optional

```env
# Distributed rate limiting (falls back to in-memory without these)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# PaddleOCR service URL (defaults to http://localhost:8100)
OCR_SERVICE_URL=http://localhost:8100

# Google Gemini API key (enables grammar analysis + correction)
GEMINI_API_KEY=your-gemini-api-key
```

---

## Commands

```bash
# Development
npm run dev              # Start dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint

# Dictionary
npm run build:dict       # Download CC-CEDICT → generate JSON (src/data + public/)

# OCR Service
docker compose up -d     # Start PaddleOCR service (port 8100)
docker compose down      # Stop OCR service

# Testing
npm test                 # Run all unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E tests
```

---

## Deployment

### Next.js App

Deploy to **Vercel** (or any Node.js host). Set environment variables in the dashboard.

### PaddleOCR Service

Deploy to a scale-to-zero platform to avoid 24/7 costs:

- **Google Cloud Run**: `gcloud run deploy --source ./ocr-service --min-instances 0`
- **Fly.io**: `fly launch` from `ocr-service/` with `auto_stop_machines = true`

Set `OCR_SERVICE_URL` in the Next.js deployment to point to the deployed service URL.

### Database

Supabase managed PostgreSQL with Row Level Security. The `flashcards` table has RLS policies scoped to `auth.uid()`.
