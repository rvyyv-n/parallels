# CLAUDE.md

Our NASA Space Apps 2026 entry for **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars** ([challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)). The event runs 14–15 November 2026.

@docs/guidelines.md

## Layout

- `docs/`: our rules and working guidelines (`guidelines.md`), the challenge in plain words (`challenge.md`), how judging works (`judging-notes.md`), our workflow chart (`workflow.png`) and, once written, the plan, which sets the tech stack and roadmap.
- `assets/`: logo and other images.
- `retired/`: earlier candidate challenges. Reference only; don't edit or build on them.

Code goes where the plan's tech stack puts it.

## How Claude works here

- **Build it the best way you can.** Use whatever setup gets the best result (an orchestrator, subagents, any model, parallel work) and check each result against tests before committing. Bring the team decisions and checkpoint results.
- **The core idea comes from the team** (official AI rule). Building and polishing it is Claude's job. Propose improvements to the idea and the project wherever you see one, without waiting to be asked, and say when an idea is Claude's own.
- **Keep the "How we used AI" note accurate** in the README, the site's footer and the project description, because judges don't see the form's AI answer. Mention AI use only in those places, not throughout. This replaces the global "no AI attribution" rule for this repo only. Still no `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **Plain language** in chat and user-facing text; exact values belong in technical docs.
