# CLAUDE.md - Atom Bowl

## Project Overview

Atom Bowl is a browser-based Science Bowl (NSB) practice platform. It features a question practice engine, live buzzer rooms, game clock, question bank browser, and Firebase-backed accounts.

## Tech Stack

- **Frontend:** TypeScript (compiled to ES2020 JS), vanilla CSS with custom properties, no framework
- **Backend:** Node.js + Express, Python (`autochecker.py` for answer grading), Ruby (`search.rb` for search), Firebase, Render (Docker)
- **Database/Auth:** Firebase Firestore + Firebase Auth
- **Deployment:** GitHub Pages (static frontend in `docs/`), Docker on Render (backend)

## Project Structure

```
docs/           # Static frontend (GitHub Pages root) - HTML, compiled JS, CSS, data
src/ts/         # TypeScript source (~5K lines, 8 modules)
server/         # Express backend + Python/Ruby integrations
  python/       # autochecker.py - answer grading
  ruby/         # search.rb - question search/filter
```

Key source files:
- `src/ts/common.ts` - Shared utilities
- `src/ts/practice.ts` - Practice engine (largest module)
- `src/ts/account_store.ts` - Auth & account logic
- `src/ts/practice_home.ts` - Practice configuration UI
- `src/ts/question_bank.ts` - Question search/browse
- `src/ts/settings.ts` - Settings UI
- `src/ts/firebase.ts` - Firebase initialization

## Build & Dev Commands

```bash
npm run build          # Compile TypeScript to docs/js/
npm run build:watch    # Watch mode
npm run server         # Start Express server on port 3000
```

TypeScript compiles from `src/ts/` into `docs/js/` with source maps enabled.

## Code Conventions

- IIFE pattern `(() => { ... })()` for module encapsulation
- `atom_*` prefix for localStorage keys (e.g., `atom_settings_v1`, `atom_run`)
- camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- Fetch-based API calls to `/api/grade`, `/api/search`, `/api/health`
- ARIA attributes and semantic HTML for accessibility
- No linter/formatter configured
- No test framework - TypeScript compiler is the main safety net (`noEmitOnError: true`)

## Architecture Notes

- Each page has a dedicated TypeScript module + HTML + CSS file
- State lives in localStorage and Firebase
- API base URL is configurable via query param (`?api=...`) or localStorage
- Backend has graceful fallback: Ruby search falls back to JS implementation
- Backend timeouts: 3s for grading, 6s for search

## What to Code In

- Code in **TypeScript**
- Do not code in JavaScript
- Use `npm run build` to build TypeScript into JavaScript before output
- Code normally for **CSS**, **HTML**, **Python**, and **Ruby**