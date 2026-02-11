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
