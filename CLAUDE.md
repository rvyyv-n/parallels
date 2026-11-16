# CLAUDE.md

Our NASA Space Apps 2026 entry for **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars** ([challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)). The event runs 14–15 November 2026.

@docs/guidelines.md

## Layout

- `docs/`: our rules and working guidelines (`guidelines.md`), our local event's Challenge Guide (`challenge-guide.pdf`, the main brief: its six benchmarks and seven questions are what we build to), the challenge in plain words (`challenge.md`), how judging works (`judging-notes.md`), our workflow chart (`workflow.png`), and the plans: the team's idea (`team-plan.md`), Claude's method, data, stack and roadmap (`claudes-plan.md`), the brief for the v1 build (`v1-spec.md`) and the data checks made before it (`review-pre-v1.md`).
- `pipeline/`: the Python data pipeline. Raw downloads go in the gitignored `data/`.
- `site/`: the Vite site. Pre-computed files are in `site/public/data/`.
- `assets/`: logo and other images.

## How Claude works here

- **Build it the best way you can.** Use whatever setup gets the best result (an orchestrator, subagents, any model, parallel work) and check each result against tests before committing. Bring the team decisions and checkpoint results.
- **The core idea comes from the team** (official AI rule). Building and polishing it is Claude's job. Propose improvements to the idea and the project wherever you see one, without waiting to be asked, and say when an idea is Claude's own.
- **Keep the "How we used AI" note accurate** in the README, the site's footer and the project description, because judges don't see the form's AI answer. Mention AI use only in those places, not throughout. This replaces the global "no AI attribution" rule for this repo only. Still no `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **Plain language** in chat and user-facing text; exact values belong in technical docs.
- **Use T3 Code to its full potential.** When a chart, diagram, table or picture explains a result better than text, show it inline with T3 Code's tools (`html_preview`, then `html_render`) instead of describing it. This applies to every agent and subagent working here.
