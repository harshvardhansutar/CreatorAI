# Creator AI

A lightweight tool that generates YouTube & Instagram metadata (titles,
description, tags, hashtags, hooks, captions, SEO tips, and more) using the
OpenRouter API. Frontend is pure HTML/CSS/vanilla JS; a single Netlify
serverless function keeps the OpenRouter API key off the browser.

## How the key is handled

- Your OpenRouter key lives **only** as a Netlify environment variable
  (`OPENROUTER_API_KEY`) — it is never shipped in the JS bundle.
- The browser calls `/api/generate`, which is proxied to
  `netlify/functions/generate.js`. That function attaches your key
  server-side and forwards the request to OpenRouter.
- Visitors can optionally paste their **own** key in the UI (Settings or the
  left panel) to use instead of yours — useful if you want to let power
  users bring their own key while defaulting everyone else to yours.
- The function includes a basic, best-effort per-IP rate limit (20
  requests/hour) to blunt casual abuse. This resets on cold starts, so for
  real production traffic swap it for a persistent store (Netlify Blobs or
  Upstash Redis) — see the comment at the top of `generate.js`.

## Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-and-drop the folder into
   Netlify's deploy UI).
2. In Netlify: **Site settings → Environment variables** → add
   `OPENROUTER_API_KEY` with your key from [openrouter.ai](https://openrouter.ai).
3. Deploy. Netlify auto-detects `netlify.toml` and picks up the function
   in `netlify/functions/generate.js`.

## Run locally

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev` serves the static site *and* runs the function locally so
`/api/generate` works exactly as it will in production. Set your key first:

```bash
netlify env:set OPENROUTER_API_KEY sk-or-v1-...
```

Opening `index.html` directly (no `netlify dev`) will NOT work anymore,
since `/api/generate` needs the function runtime to respond.

## Use it

1. Type a topic, pick category/tone/language/platform, and click **Generate**.
2. Copy individual sections, regenerate one section, or use **Copy All** /
   **Download .txt / .md** to export everything at once.

## Structure

```
Creator-AI/
├── index.html
├── netlify.toml
├── netlify/functions/generate.js   – serverless proxy, holds the API key
├── css/style.css
├── js/
│   ├── prompts.js   – prompt templates & section list
│   ├── api.js       – calls the proxy (no key in the browser)
│   └── script.js    – UI, parsing, history, templates, export
├── assets/logo.svg
└── README.md
```

## Notes

- History (last 10 generations) and Settings are stored in the visitor's
  browser LocalStorage only.
- The AI is prompted to return Markdown headings (`# YouTube Titles`, etc.)
  which `script.js` parses into the matching cards.
- SEO Score / Clickbait Score bars are lightweight heuristics for visual
  feedback, not a real analytics measurement.
- Watch your OpenRouter spend — since visitors share your key by default,
  consider setting a hard spending cap on the key at openrouter.ai.
