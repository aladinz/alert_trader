# AlertTrader

AlertTrader is a browser-based trading dashboard for daily swing workflows.

It combines:
- live/simulated market data,
- setup scoring,
- watchlist scanning,
- alert quality controls,
- market-session awareness,
- and hard risk guardrails.

The app is a static front-end project (HTML/CSS/JavaScript) with local persistence.

## Features

- Real-time style dashboard with signal card, indicators, history, logs, and controls.
- Symbol input with debounced refresh, Enter key support, and stale-response protection.
- Data feed modes:
  - Finnhub REST + WebSocket (primary)
  - REST polling fallback if WebSocket is unstable
  - Simulated mode when no API key is configured
- Setup scoring panel with factor bars:
  - Trend
  - Pullback
  - HTF Align
  - R:R
  - Volatility
- Factor tooltips with metric details.
- Watchlist scanner with ranked results and one-click symbol load.
- Alert quality controls:
  - minimum score threshold,
  - duplicate throttling,
  - cooldown windows.
- Market-hours awareness:
  - pre-market, regular, after-hours, closed,
  - optional auto session presets.
- Hard risk guardrails:
  - max position size,
  - max daily loss,
  - ATR limit,
  - spread estimate limit,
  - minimum R:R.
- Blocked order output includes specific failing values.
- Local persistence for settings/history/results via `localStorage`.

## Project Structure

- `index.html` - app layout and controls.
- `styles.css` - full dashboard styling.
- `script.js` - app state, logic, data feed, scans, scoring, alerts, guardrails.
- `dataset.json` - portable seed dataset used on first load.

## Requirements

- A modern browser (Chromium, Edge, Firefox).
- Optional: Finnhub API key for live data.

No build step is required.

## Run

You can open `index.html` directly, but using a local static server is recommended.

### Option A: VS Code Live Server
- Open project folder.
- Run Live Server on `index.html`.

### Option B: Python static server
```bash
cd AlertTrader_Strategy
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Initial Data + Persistence

Load order:
1. `dataset.json` is read for initial state.
2. Saved `localStorage` state (if present) overrides dataset state.

Storage key:
- `alerttrader.v1`

Persisted data includes:
- symbol/price state,
- settings,
- signal,
- signal history,
- watchlist results,
- logs.

## Data Feed Operations

### Provider
- Current provider: Finnhub.

### Connect flow
1. Enter API key.
2. Click `Connect Feed`.
3. App preflights REST quote.
4. If REST succeeds, app opens WebSocket and subscribes current symbol.

### Fallback behavior
- If WebSocket disconnects repeatedly, app auto-switches to REST polling mode.

### Symbol safety / anti-mix protections
- REST responses apply only if:
  - request sequence is current,
  - requested symbol still matches active symbol.
- WebSocket trades apply only when tick symbol matches active symbol.

## Symbol Input Behavior

- Symbol input is normalized to uppercase.
- Debounced symbol refresh fetches quote.
- Enter triggers immediate refresh.
- Change/blur also refreshes.

## Setup Scoring Panel

Score output:
- Total score out of 100.
- Grade A/B/C/D.
- Bias (bullish or bearish).

Factor bars include tooltips showing measurement logic and values.

Quality mapping:
- `HIGH` for score >= 72
- `MEDIUM` for score >= 58 and < 72
- `LOW` for score < 58

## Watchlist Scanner

Input:
- comma/newline separated symbols.
- max unique symbols processed: 20.

Behavior:
- with API key: fetches live quote per symbol.
- without API key: uses simulated values.
- computes setup score per symbol.
- sorts descending by score.
- renders top results with `Load` button.

## Alert Quality Controls

Controls:
- `Only alert if Score >= X`
- `Duplicate throttle (sec)`
- `Global cooldown (sec)`

Enforcement order:
1. blocked by guardrails
2. session alerts enabled
3. score threshold (session-adjusted)
4. global cooldown
5. duplicate throttle signature

If suppressed, reason is written to system log.

## Market-Hours Awareness

Modes:
- `Auto (detect)`
- `Pre-market`
- `Regular`
- `After-hours`
- `Closed`

Auto detection uses America/New_York session windows.

Optional session presets adjust:
- risk multiplier,
- score threshold adjustment,
- cooldown multiplier,
- alert enablement (closed session disables alerts).

## Hard Risk Guardrails

Guardrails checked each signal build/recalc:
- Position size <= max position size
- Realized daily loss < max daily loss
- ATR % <= max ATR %
- Estimated spread % <= max spread %
- Signal R:R >= min R:R
- Session open (not closed)

If guardrails fail:
- signal status is blocked,
- copy order is blocked,
- ATP line shows failing guardrail values, e.g.
  - `ATR limit 65.33%/3.50%`
  - `Spread estimate 2.50%/0.35%`

## Latest Signal Card

Displays:
- symbol,
- entry/stop/target,
- shares,
- risk/reward,
- R:R,
- ATP steps.

When blocked:
- badge switches to `BLOCKED`
- ATP line shows block reasons with measured values.

## System Log

Log captures:
- symbol switches,
- feed events,
- scan events,
- alert suppression reasons,
- guardrail blocks,
- copy actions.

## Troubleshooting

### Symbol data appears mixed
Check:
- API key valid.
- active symbol updates in top card.
- feed status panel current mode.

Implemented protections already prevent stale REST and non-matching WS ticks from applying.

### WebSocket keeps disconnecting
Expected behavior:
- app falls back to REST polling mode automatically.

### `401` on quote fetch
- API key invalid/expired/restricted.
- Verify with:
`https://finnhub.io/api/v1/quote?symbol=SPY&token=YOUR_KEY`

### Blocked order with negative target or odd values
- Guardrails may be restricting setup under high volatility.
- Review `Risk Guardrails` panel and limits.

## Security Notes

- API keys are user-entered and saved in browser local storage for convenience.
- Do not share browser profile/storage if key confidentiality is required.
- Never hard-code API keys in source files.

## Notes for Future Enhancements

Potential next additions:
- Guardrail preset profiles (Strict/Standard/Aggressive)
- Multi-provider feed abstraction
- Trade journal + performance analytics
- Watchlist auto-scan scheduler
- Export/import settings and history JSON
