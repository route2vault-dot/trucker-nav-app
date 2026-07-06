# CLAUDE.md — Instructions for Claude

Project: **Supreme Trucking Navigation (STN)** — trucker navigation app for the South-Central Freight Corridor (TX, OK, LA, AR, NM). Competitor benchmark: Trucker Path.

## About the user

- **No coding experience.** Explain what you're doing in plain language. Avoid jargon; when a technical term is unavoidable, define it in one sentence.
- The first real user is the user's **dad, an active truck driver**. Usability while driving matters more than features: big buttons, high contrast, minimal taps.
- Decisions should favor **simple and shippable** over elegant and complete.

## Ground rules

1. **Read `docs/MVP-PLAN.md` before building anything.** Build only the current phase; don't jump ahead.
2. **Free tiers only** unless the user explicitly approves a paid service. Check `docs/API-OPTIONS.md` for the chosen providers and their limits.
3. **Keep the stack boring:** plain HTML/CSS/JavaScript + Leaflet for as long as possible. No build tools, no framework, until the plan says so and the user agrees.
4. **One feature at a time.** Finish, verify on a phone-sized screen, then move on.
5. **Verify external endpoints before coding against them.** The 511 endpoints in `docs/SOURCE-MAP.md` were written from general knowledge and must be confirmed live (fetch them) before Phase 1 work starts.
6. **Safety honesty in the UI.** OSM bridge-height data is incomplete. The app must present missing data as "unknown — use caution," never as "clear."
7. **API keys** go in a git-ignored config file, never hardcoded in committed files. Explain to the user how to get each key when the time comes.

## Repo layout

- Planning docs live in `docs/`. App code (when it exists) goes in `app/` per `docs/APP-MAP.md`.
- This folder is **not yet a git repository**. When code work starts, suggest `git init` and set up a `.gitignore` first.

## When resuming a session

1. Read this file, then `docs/MVP-PLAN.md`.
2. Ask the user (or check the plan's checkboxes) to find the current phase.
3. Update the plan's checkboxes as work completes, so progress survives between sessions.
