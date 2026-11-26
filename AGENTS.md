# AGENTS.md

Our NASA Space Apps 2026 entry for **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars** ([challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)). The event runs 14–15 November 2026.

@docs/guidelines.md

## Layout

- `docs/`: our rules and working guidelines (`guidelines.md`), our local event's Challenge Guide (`challenge-guide.pdf`, the main brief: its six benchmarks and seven questions are what we build to), the challenge in plain words (`challenge.md`), how judging works (`judging-notes.md`), the team's core idea (`team-plan.md`), and the completed `v3` build/polish roadmap and QA record (`v3-roadmap.md`, Phases 0–7).
- `PRODUCT.md`: site architecture, Titanium & Oxide visual system, module layout, and design principles.
- `t3.json`: workspace scripts (setup, dev server, pipeline/site tests, site build).
- `pipeline/`: the Python data pipeline. Raw downloads go in the gitignored `data/`.
- `site/`: the Vite site. Pre-computed files are in `site/public/data/`.
- `assets/`: logo and other images.

## Commands & Verify

```powershell
uv sync                          # install Python pipeline dependencies
uv run pytest                    # run pipeline tests
npm --prefix site ci             # install site dependencies
npm --prefix site run dev        # start Vite dev server
npm --prefix site run build      # typecheck and build site
npm --prefix site test           # run Playwright site tests (laptop + focused phone)
npm --prefix site run test:laptop # desktop-only Playwright pass
```

## Working Rules

- **Build to the highest standard.** Use whatever workflow gets the best result (subagents, parallel work) and verify each change against tests before committing. Bring decisions and checkpoint results to the team.
- **The core idea comes from the team** (official Space Apps AI rule). Building and polishing it is the agent's job. Propose improvements to the idea and the project wherever useful, without waiting to be asked, and flag when an idea originates from the agent.
- **Keep the "How we used AI" note accurate** in the README, the site's footer, and the project description, because judges do not see the submission form's AI answer. Mention AI use only in those places, not throughout. This replaces the global "no AI attribution" rule for this repo only. Still never include `Co-Authored-By` trailers or "Generated with" footers in commits or PRs.
- **User-facing copy:** keep site text and submission copy accessible; place exact technical figures and methodology in technical docs.
- **Inline visuals:** when a chart, diagram, table, or picture explains a result better than text, render it inline with T3 Code's `html_preview` and `html_render` tools instead of describing it. This applies to every agent and subagent working here.
