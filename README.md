# ⚛️ Atom Bowl

# NOTE: The site is back online! Check credits on README.md

**Atom Bowl** is a fast, clean, browser-based question platform designed for **National Science Bowl (NSB)** preparation and it also contains live NSB-like buzzer rooms and game clock settings using Firebase.
It focuses on realism, speed, and accuracy: no fluff, no gimmicks.

Built for students who want to grind questions the way real rounds feel.

🔗 **Live site:** https://atom-bowl.github.io/Atom_Bowl/

---

## 🚀 Features
- 🆕 **New Features from v0.3 update**
  - Buzzer Rooms v1!!!
  - Game Clock
  - Autocorrect
  - Light mode
  - Interrupt
  - AtomScore(R)
  - Practice Engine v0.3
  - Subtopics
  - Question Bank Upgrade 

- 📚 **Real NSB-style questions**
  - Physics
  - Chemistry
  - Biology
  - Earth & Space Science
  - Math

- ⚡ **Instant loading**
  - Pure HTML / CSS / JavaScript
  - No frameworks, no bloat

- 🧩 **Multiple question sets**
  - Clean JSON-based data
  - Easy to expand and maintain

- 🎯 **Practice-focused design**
  - Straight to the question
  - No distractions
  - Built for repetition and speed

---

## Credits
- Question Bank A goes to official DOE questions parsed by @arxenix. @arxenix did not contribute to code, only to sets
- Question Bank B goes to SciBowlDB's official question bank.
- Question Bank C is coming soon from smaller invitationals and niche competitions.

---

## Local + Render Backend

This repo can run in two modes:
- Static GH Pages (no Python/Ruby, browser-only JS)
- Local/hosted Node server (Python/Ruby enabled)

### Run locally
1. Open PowerShell in `C:\Users\sachi\Atom_Bowl`
2. Install deps: `npm install`
3. Start server: `npm run server`
4. Visit: `http://localhost:3000/`

### Render (Docker)
1. Create a new Render Web Service using Docker.
2. Connect this repo.
3. Set the service port to `3000`.
4. Render will build and deploy.

### Tell the GH Pages app where the API lives
The site is now hard-coded to use:
`https://atom-bowl.onrender.com`

You can still override it by opening any page with `?api=...`, e.g.:
`https://atom-bowl.github.io/Atom_Bowl/question_bank.html?api=https://your-app.onrender.com`

That value is stored in localStorage as `atom_api_base` and used for all API calls.
