# QTERMINAL

Bloomberg-terminal-style tracker for QQQ and the NASDAQ-100, with a
Robinhood-tokenized / not-tokenized split baked into the sidebar and heatmap.

## Run it locally

No build step — just serve the folder:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` and click through to the terminal.

## Deploy to GitHub Pages

Push this folder's contents to the root of a repo (or `/docs`), then in
repo Settings → Pages, point Pages at that branch/folder. `index.html` is
the landing page; it links to `terminal.html`.

## What's real vs. mock right now

You picked "free/unofficial sources, no key" — here's the honest state of that:

- **Right now, all prices/volumes/fundamentals are generated**, not fetched.
  `js/market.js` has a deterministic engine so each ticker gets a stable,
  plausible price and then drifts slightly every ~2.5s to feel live.
- There's a real fetch path already wired up (`fetchLiveQuote()` in
  `market.js`), hitting Yahoo Finance's unofficial chart endpoint through
  a public CORS proxy (`api.allorigins.win`), since browsers block direct
  cross-origin calls to Yahoo. It's off by default (`USE_LIVE_FETCH = false`)
  because public CORS proxies are unreliable — they rate-limit, go down,
  and aren't something to depend on.
- **To go live for real**: stand up a tiny serverless endpoint (Cloudflare
  Worker, Vercel Edge Function, or similar) that fetches Yahoo/Stooq
  server-side and returns clean JSON, then point `fetchLiveQuote()` at
  that instead of the public proxy. That's a ~20-line function.
- **The NASDAQ-100 list and sectors** in `js/data.js` are a manually
  compiled snapshot — check it against the official Nasdaq-100 factsheet
  before treating it as authoritative, since the index reconstitutes
  periodically.
- **The `tokenized` flag per ticker** is a placeholder guess, not a live
  lookup against Robinhood's actual Stock Tokens catalog (which runs
  2000+ tickers and changes). Update the flags in `data.js` as you confirm
  them — that's the single source of truth the sidebar dot, heatmap
  border colour, and detail-page tag all read from.
- **Market caps** used to size heatmap tiles in "by market cap" mode are
  rough order-of-magnitude, not live figures.

## File structure

```
index.html        landing page (starfield + press to enter)
terminal.html      app shell (sidebar + main panel)
css/style.css      all styling
js/data.js         NASDAQ-100 constituents, sectors, tokenized flags, market caps
js/market.js       quote/history/fundamentals data layer (mock engine + live-fetch hook)
js/app.js          rendering, routing, heatmap, chart, mobile view switching
```

## Notes on behaviour

- QQQ is pinned at the top of the sidebar and is the default route (`#QQQ`).
- Only the QQQ page shows the heatmap; every ticker page shows the chart
  + earnings/dividends/analyst/news cards.
- Heatmap: grouped by sector, tile colour = day's % change, green border =
  tokenized, grey border = not. Hover for a tooltip, click to navigate.
  Toggle between equal-size tiles and market-cap-sized tiles top right.
- On screens ≤820px, the sidebar and the ticker detail become two separate
  full-screen views with a back button, instead of a side-by-side split.
