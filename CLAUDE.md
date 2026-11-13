# CLAUDE.md

Our NASA Space Apps 2026 entry for **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars** ([challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)). The event runs 14–15 November 2026.

@GUIDELINES.md

## Layout

- `analogs/`: the project. Start with `analogs/theidea.md`.
- `retired/`: earlier candidate challenges. Reference only; don't edit or build on them.

## Not decided yet

- **Tech stack.** Don't scaffold a framework or add dependencies until the roadmap picks one.
- **Roadmap.** It will live in `analogs/`. Until it exists, ask before starting anything bigger than research or notes.

## How Claude works here

- **One orchestrator, two workers** for the build: a lead session directs a website worker and a data worker. It checks each result against tests before committing, and brings the team only decisions and checkpoint results, in plain words both teammates can follow. We'll adjust this once the roadmap is done.
- **The solution idea belongs to the team** (official AI rule). Claude researches, explains, lists options with trade-offs and builds what's chosen. It doesn't pick the core approach. When an idea comes from Claude rather than the team, say so.
- **Keep the README's "How we used AI" section accurate** as Claude's role grows; the competition requires it. This replaces the global "no AI attribution" rule for this repo only. Still no `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **Joint build:** both teammates build and must be able to follow every change. Explain each change in a way either of them can pick up.
- **No AI images with NASA branding**, and every AI image or video gets a visible watermark.
- **Every number has a source.** Never fill missing data with a guess; mark it missing.
- **Plain language** in chat and user-facing text; exact values belong in technical docs.
- Commit and push to the current branch (`research`) after every working change.

## Quirks of this PC

- spaceappschallenge.org fails TLS checks here, and WebFetch fails too. `curl -sk` works; the page text is in the embedded Next.js data as escaped HTML (`<`).
- IRSA, JPL, the Gaia archive, GitHub and Vercel all work normally.
