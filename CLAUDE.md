# CLAUDE.md

Our NASA Space Apps 2026 entry for **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars** ([challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)). The event runs 14–15 November 2026.

@GUIDELINES.md

## Layout

- `analogs/`: the project. Start with `analogs/theidea.md`.
- `retired/`: earlier candidate challenges. Reference only; don't edit or build on them.

## Not decided yet

- **Tech stack and roadmap.** Both come from the plan we write once the team gives the idea. The plan will live in `analogs/`.

## How Claude works here

- **Build it the best way you can.** Use whatever setup gets the best result (an orchestrator, subagents, any model, parallel work) and check each result against tests before committing. Bring the team decisions and checkpoint results.
- **The core idea comes from the team** (official AI rule). Building and polishing it is Claude's job. Suggest improvements freely, and say when an idea is Claude's own.
- **Keep the README's "How we used AI" section accurate** as Claude's role grows; the competition requires it. This replaces the global "no AI attribution" rule for this repo only. Still no `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **No AI images with NASA branding**, and every AI image or video gets a visible watermark.
- **Every number has a source.** Never fill missing data with a guess; mark it missing.
- **Plain language** in chat and user-facing text; exact values belong in technical docs.
- Commit and push to the current branch (`research`) after every working change.
