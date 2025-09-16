# Pump.fun Marbles — Chat-Controlled Races (Demo)

A static demo web app that visualizes a Pump.fun livestream companion game: chat-controlled marbles races. Viewers join by sending `!join <amount>` in chat or via the Join UI. A Solana "Connect Wallet" (Phantom) button is provided for UX parity — this demo does not send transactions.

## Features
- Mock livestream and chat panel
- Chat simulation to visualize engagement
- `!join <amount>` command parsing and Join UI
- Marbles race on canvas with names and dynamic sizes
- Pot total and players count
- Last-race leaderboard display
- Phantom-first Solana wallet connect (demo only)

## Run
- Option 1: Open `index.html` directly in your browser
- Option 2: Serve locally for best results


Then visit `http://localhost:5173`.

## Notes
- This is a front-end-only demo; no real wagers or on-chain actions.
- Replace the mock chat integration with Pump.fun livestream chat when available.
- The race can be started any time; bots will auto-fill if there are too few players.
- Wallet connect uses the injected `window.solana` provider (Phantom). If not installed, the button opens Phantom's site.

## Customization
- Visuals: tweak `styles.css`
- Simulation: customize speeds, lanes, and noise in `app.js`
- Assets: replace SVGs in `assets/`

## Disclaimer
For demonstration purposes only. Not a gambling product; no deposits are accepted.
# Marblez
# Marblez
