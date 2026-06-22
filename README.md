# BTA Sports — Interactive App Prototype

A fully interactive, web-based prototype of the **BTA Sports** mobile app, re-skinned
into the marketing site's dark **Aurora liquid-glass** design system. It's not a static
mockup — every screen is live: drag the lines, build a bet card, optimize a DFS lineup.

Built to be opened in a browser and deployed on **Vercel** as a static site (no build step).

## Highlights

- **Dashboard** — time-aware greeting ("Good morning/afternoon/evening/night, Charlie") and a
  **Bloomberg-style edge ticker** streaming the day's highest-value plays across the top of the
  phone. Edge = BTA model probability − the market's implied probability, computed live from the data.
- **Games** — MLB / NFL / FIFA, team-gradient cards with BTA win-probability bars and edge flags.
  NFL shows the live season countdown. Tap any game to open the Analyzer.
- **Game Analyzer** — moneyline / run line / total with BTA % vs. the market, an **AI Bet Analysis**
  audio player (Powered by Vokal), and **live Move-the-Line sliders** that recompute probability and
  fair odds as you drag.
- **Player Props** — expandable per-player cards with over/under probabilities and live odds.
- **Risk Analyzer** — add selections from anywhere; it models combined win probability, fair odds,
  payout multiple and model edge across every correlated leg. Export to FanDuel.
- **Fantasy IQ** — DraftKings DFS optimizer with a salary cap, lock-and-optimize, and an animated
  greedy build.

## Scoped demo links + secret navigation

There are three experiences, each behind its own hard-to-guess link. Hand someone a link and
they see **only** that experience — there's no visible way to reach the other two.

| Experience | Link (path or query) |
|------------|----------------------|
| Full interactive demo | `/live-9q4x2k`  · or `/?k=live-9q4x2k` |
| Screenshot tour | `/shots-7k2m8w` · or `/?k=shots-7k2m8w` |
| Focused demo (phone only) | `/zen-3x8p5d` · or `/?k=zen-3x8p5d` |

The site root (`/`) and any unknown slug fall back to the full demo.

**Secret navigation (only you):** press **Ctrl/Cmd + Alt + → / ←** to cycle between all three
from any link. Recipients can't move between them — they don't know the keystroke, and nothing
on screen hints at it. (This is obscurity, not authentication: it gates a casual demo, not secrets.)

Change the slugs or the keystroke in the `MODES` map / `wireGallery` keydown handler in `app.js`.

## Run locally

```bash
# any static server works
python3 -m http.server 5173
# then open http://localhost:5173
```

## Deploy to Vercel

```bash
npm i -g vercel    # if needed
vercel             # from this folder — accept the defaults
vercel --prod      # promote to production
```

No framework, no build — Vercel serves the static files directly.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Device frame, status bar, ticker shell, view containers, bottom nav |
| `styles.css` | Full Aurora design system + every screen component |
| `data.js`    | Mock games, props, DFS pool, odds helpers (American ⇄ implied prob) |
| `app.js`     | Routing, live ticker, Move-the-Line, Risk card, Fantasy optimizer |
| `assets/`    | BTA brand marks + favicons (from the marketing site) |

## Notes

All numbers are illustrative demo data modeled on real app screenshots — odds and probabilities
are not live and nothing here takes wagers. BTA Sports is an analytics platform, **not a sportsbook**.
