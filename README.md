# Hanzi Helper

A Chinese language learning app that combines rich text editing, pinyin annotation, translation, pronunciation practice, AI conversation practice, and spaced repetition flashcards.

Built with Next.js 16, React 19, TailwindCSS 4, Tiptap, and Google Gemini.

## Features

### Rich Text Editor
- Full formatting toolbar: bold, italic, strikethrough, headings, lists, blockquotes
- Type or paste Chinese text and see it instantly annotated with pinyin
- Editor content persists across page navigation (saved to sessionStorage)

### Pinyin Annotation
- Automatic character-level pinyin with tone marks (e.g. mā, má, mǎ, mà)
- Word-level segmentation using `Intl.Segmenter` for accurate word boundaries
- Click any word to see its definition and save it to flashcards

### Translation
- Translate full text into English and/or Vietnamese
- Toggle languages on/off with language pills
- Lingva as primary translation API with MyMemory as fallback for reliability
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

Five study modes accessible from an animated mode selection hub (Motion entrance animations, gradient icon boxes):

**Practice** — AI-generated fill-in-the-blank quiz (see AI section above)

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

**Terms in this set** — scrollable word list on the mode selection screen showing all saved words with difficulty dots, search, hover actions (TTS, delete), and gradient "Add Card" button.

### AI Conversation Practice
- Roleplay scenarios: restaurant, train station, making friends, shopping, hotel, directions
- Adjustable HSK level (1-9) controls vocabulary complexity
- AI generates unique, scenario-specific objectives each session (e.g. "Order two cups of jasmine tea and ask for the bill")
- Vocabulary hints with click-to-reveal Chinese/pinyin tooltips
- Clickable words in AI responses open definition popups (reuses the same `DefinitionPopup` from the editor)
- AI evaluates objective completion and provides English feedback on grammar/vocabulary
- Powered by Google Gemini 3.1 Flash Lite via Vercel AI SDK (`generateObject` with Zod schema)

### Flashcard Practice (AI Quiz)
- AI-generated fill-in-the-blank sentences using saved flashcard words
- Powered by Gemini — generates contextual sentences at appropriate difficulty

### Grammar Analysis & Correction
- Select Chinese text and click "Grammar" to see a full grammatical breakdown
- Powered by Google Gemini 3.1 Flash Lite with Zod schema validation
- Shows sentence pattern, word-by-word structure with roles (Subject, Verb, Object, etc.), and grammar notes
- Detects fundamental grammar errors and shows corrections in a muted amber card with corrected pinyin
- Non-pedantic: does not flag colloquialisms, native slang, or omitted subject pronouns

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

- **Rate limiting** — Sliding-window limiter per client IP on all API routes (`/api/translate` 30/min, `/api/define` 60/min, `/api/tts` 30/min, `/api/ocr` 10/min, `/api/analyze-grammar` 20/min, `/api/practice` 30/min). Returns `429` with `Retry-After` header when exceeded. Supports **Upstash Redis** for distributed rate limiting across serverless instances; falls back to in-memory when env vars are not set.
- **Input validation** — `/api/translate` max 10,000 chars / 100 lines, `/api/define` max 50 chars, `/api/tts` max 500 chars, `/api/analyze-grammar` max 200 chars, `/api/practice` max 50 messages / 500 chars per message. Returns `400` if exceeded.
- **OAuth redirect protection** — The `next` parameter in `/auth/callback` is validated to prevent open redirects (must be a relative path, no protocol).
- **Supabase defense-in-depth** — All flashcard mutations filter by `user_id` in addition to Row Level Security.

## Testing

297 tests across 29 test files using [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/). Overall line coverage: ~97%.

Tests live in `__test__` subdirectories next to the code they test:

| Directory | What's tested |
|-----------|---------------|
| `src/lib/__test__/` | Pure functions: SM-2 algorithm, text comparison, API usage tracking, translation utils, date utils, concurrency (pMap) |
| `src/lib/supabase/__test__/` | DB-to-app type mapper |
| `src/hooks/__test__/` | `useFlashcards` hook (incl. sync error handling), `useTTS` hook, `useWordDefinition` hook |
| `src/contexts/__test__/` | `AuthContext` (auth provider, sign out, state changes) |
| `src/app/__test__/` | Global error boundary |
| `src/app/api/*/__test__/` | API route handlers (`/api/translate`, `/api/define`, `/api/tts`, `/api/analyze-grammar`, `/api/practice`) |
| `src/app/auth/callback/__test__/` | OAuth callback redirect validation |
| `src/lib/__test__/rateLimit.test.ts` | Rate limiter (in-memory sliding window + Upstash Redis path) |
| `src/components/__test__/` | React components (`DefinitionPopup`, `FlashcardViewer`, `FlashcardBrowse`, `FlashcardLearn`, `FlashcardMatch`, `FlashcardPractice`, `PinyinDisplay`, `Editor`, `Icons`, `GrammarPopover`, `SpeechPractice`) |

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, TailwindCSS 4
- **Editor**: Tiptap 3
- **Pinyin**: pinyin-pro
- **TTS**: msedge-tts
- **Dictionary**: CC-CEDICT
- **Translation**: Lingva API, MyMemory API
- **AI**: Google Gemini 3.1 Flash Lite (grammar analysis, conversation practice, flashcard practice)
- **AI SDK**: Vercel AI SDK (`ai` + `@ai-sdk/google`) for structured generation
- **Animations**: Motion (motion/react) for page transitions and micro-interactions
- **Icons**: Lucide React for scenario/mode icons
- **Testing**: Vitest, Testing Library
