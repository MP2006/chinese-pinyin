# Hanzi Helper

A Chinese language learning app that combines rich text editing, pinyin annotation, translation, pronunciation practice, and spaced repetition flashcards.

Built with Next.js 16, React 19, TailwindCSS 4, and Tiptap.

## Features

### Rich Text Editor
- Full formatting toolbar: bold, italic, strikethrough, headings, lists, blockquotes
- Type or paste Chinese text and see it instantly annotated with pinyin

### Pinyin Annotation
- Automatic character-level pinyin with tone marks (e.g. mā, má, mǎ, mà)
- Word-level segmentation using `Intl.Segmenter` for accurate word boundaries
- Click any word to see its definition and save it to flashcards

### Translation
- Translate full text into English and/or Vietnamese
- Toggle languages on/off with language pills
- Dual-API strategy (Lingva + MyMemory fallback) for reliability
- Concurrency-limited: max 5 lines translated in parallel to avoid overwhelming upstream APIs

### Word Definitions
- Click any Chinese word to open a definition popup
- English definitions from CC-CEDICT dictionary (~120K entries)
- Vietnamese definitions via translation API
- Smart fallback: if a word isn't in the dictionary, it breaks it into sub-words or characters and looks each up
- Save words to flashcards directly from the popup

### Text-to-Speech
- Select text and click the speaker button to hear native Mandarin pronunciation
- Powered by Microsoft Edge TTS (zh-CN-XiaoxiaoNeural voice)
- Speaker buttons also available on flashcards (review, browse, and learn modes)

### Pronunciation Practice
- Select Chinese text and click the mic button to practice speaking
- Speech recognition listens in Mandarin (zh-CN)
- Character-by-character accuracy scoring using Levenshtein distance
- Color-coded feedback: green (correct), red (wrong/missing), orange (extra)
- Retry and "Hear Reference" buttons for iterative practice

### Flashcards
Sync errors (e.g. network failure while saving to Supabase) are caught and displayed as a dismissible banner — optimistic updates are reverted automatically.

Four Quizlet-style study modes accessible from a mode selection hub:

**Review** — Spaced repetition with SM-2 style scheduling
- 3D flip cards (click or Space to reveal)
- Rate cards: Again / Hard / Good / Easy (keys 1-4)
- Progress bar and session summary

**Browse** — View all saved words
- Searchable grid (filters by word, pinyin, or definition)
- Click to flip cards and see definitions
- Speaker button and delete (with confirmation) on each card

**Learn** — Type-the-answer quiz
- Given pinyin + definitions, type the Chinese word
- Immediate green/red feedback with auto-advance on correct
- TTS plays the word on correct answers
- Retry missed cards at the end

**Match** — Timed matching game
- Match 6 Chinese words to their definitions (12 tiles)
- Tiles shake on mismatch, fade out on match
- Timer counts up; shows final time on completion

**Terms in this set** — scrollable word list on the mode selection screen showing all saved words with pinyin and definitions.

### Error Handling
- Global error boundary catches unhandled errors and offers a "Try again" button
- Supabase sync failures revert optimistic UI updates and show user-friendly error messages

### Dark Mode
- Toggle via sidebar icon
- Preference saved to localStorage
- Flash-free: applied before page renders via inline script

## Getting Started

```bash
# Install dependencies
npm install

# Build the CC-CEDICT dictionary
npm run build:dict

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run build:dict` | Generate `src/data/cedict.json` from CC-CEDICT |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## API Security

- **Rate limiting** — In-memory sliding-window limiter per client IP on all API routes (`/api/translate` 30/min, `/api/define` 60/min, `/api/tts` 30/min). Returns `429` with `Retry-After` header when exceeded. Note: resets on serverless cold starts; for production serverless, consider Upstash Redis or Vercel WAF.
- **Input validation** — `/api/translate` max 10,000 chars / 100 lines, `/api/define` max 50 chars, `/api/tts` max 500 chars. Returns `400` if exceeded.
- **OAuth redirect protection** — The `next` parameter in `/auth/callback` is validated to prevent open redirects (must be a relative path, no protocol).
- **Supabase defense-in-depth** — All flashcard mutations filter by `user_id` in addition to Row Level Security.

## Testing

220 tests across 24 test files using [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/).

Tests live in `__test__` subdirectories next to the code they test:

| Directory | What's tested |
|-----------|---------------|
| `src/lib/__test__/` | Pure functions: SM-2 algorithm, text comparison, API usage tracking, translation utils, date utils, concurrency (pMap) |
| `src/lib/supabase/__test__/` | DB-to-app type mapper |
| `src/hooks/__test__/` | `useFlashcards` hook (incl. sync error handling), `useTTS` hook, `useWordDefinition` hook |
| `src/contexts/__test__/` | `AuthContext` (auth provider, sign out, state changes) |
| `src/app/__test__/` | Global error boundary |
| `src/app/api/*/__test__/` | API route handlers (`/api/translate`, `/api/define`, `/api/tts`) |
| `src/app/auth/callback/__test__/` | OAuth callback redirect validation |
| `src/lib/__test__/rateLimit.test.ts` | Rate limiter (sliding window, expiry, independent keys) |
| `src/components/__test__/` | React components (`DefinitionPopup`, `FlashcardViewer`, `FlashcardBrowse`, `FlashcardLearn`, `FlashcardMatch`, `PinyinDisplay`, `Editor`) |

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, TailwindCSS 4
- **Editor**: Tiptap 3
- **Pinyin**: pinyin-pro
- **TTS**: msedge-tts
- **Dictionary**: CC-CEDICT
- **Translation**: Lingva API, MyMemory API
- **Testing**: Vitest, Testing Library
