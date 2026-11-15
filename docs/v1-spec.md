# Parallels v1 spec

The brief for the thread that builds the first full version of Parallels. It sets the goal, the order of work and the decisions already made. It doesn't repeat the plans; it points to them.

**Read first:** [CLAUDE.md](../CLAUDE.md), [guidelines](guidelines.md), [team plan](team-plan.md), [Claude's plan](claudes-plan.md), [challenge](challenge.md), [judging notes](judging-notes.md) and the [Challenge Guide](challenge-guide.pdf).

**When files disagree:** the team plan wins. Claude's plan holds the method, data and checks. This spec wins over both only on the points it settles below.

## 1. Goal

A fully working site **today, Saturday 14 November 2026**, at the Vercel project's production address, running on real data. Sunday is for polish, the demo video and the project page ([plan §8](claudes-plan.md#8-roadmap), steps 7–8).

Today covers roadmap steps 1–6: the first complete draft goes in on Saturday night.

**Ambition.** No limits on design or innovation: build something spectacular that stands out from every rival. Two things are fixed: the science and data follow our docs (the plans, the data we checked, the honesty rules in [guidelines §2](guidelines.md#2-doing-the-science-honestly)), and everything follows best practice (accessible, fast on a phone, tested, no fragile live dependencies). Being easy to use comes first: ambition never costs a newcomer their result in under a minute.

## 2. Before you build

Four gates, in this order. The site's interface waits for the user's yes on gates 1 and 2. The data pipeline doesn't depend on the design and starts at once.

### Gate 1. Setup questions and your approach

- Ask the user what you need to know to start: for example, the production URL, how they want to be reached for approvals, and any limits on time, models or cost.
- Recommend how you'll run the build: tools, which models do which work, how you split it (for example a pipeline track, a site track and a checking track), and how each piece gets tested before it's committed.

### Gate 2. Research and a UI design

- **Our edge:** use [plan §1](claudes-plan.md#1-our-edge).
- **Our earlier draft:** the prototype on `main` is retired and kept as the tag `archive/prototype`. v1 replaces it. Reuse any piece that saves time (`scoring.py`, `terrain.py` and `planets.py` match the plan and have tests), but nothing has to be kept. Two things must not come across: the hand-picked list as the thing being ranked, and the sample values.
- **Recommend one UI design**, as ambitious as it can be while staying clear, that:
  - is easy to understand at a glance;
  - gets a newcomer to a result in under a minute without help;
  - has good onboarding (the first screen explains itself, with no tutorial wall);
  - works on a phone and a laptop;
  - meets every requirement in [guidelines](guidelines.md) and every benchmark and question in the [Challenge Guide](challenge.md#the-six-objectives-and-how-we-meet-them), each easy to spot in the guide's own words;
  - aims to win: see [judging notes](judging-notes.md) and the awards in [plan §10](claudes-plan.md#10-awards-project-page-and-demo).
- Show the user the design (a sketch, mock or clickable stub) and **wait for their yes**.

### Gate 3. Resolve open links and estimated places

For every dataset and test place you'll use:

- **"Link to confirm" and "size to check" items** in [plan §4](claudes-plan.md#4-data): TES thermal inertia, Diviner regolith properties, the MOLA height map and SWIM. [The pre-v1 review](review-pre-v1.md#data-holes) has already resolved these; confirm the links still work and note the licence for each.
- **Test places** in `pipeline/sites.json` (the review's [list of starred places](review-pre-v1.md#data-holes) shows which are settled), and the rough headline candidates in [plan §5](claudes-plan.md#headline-candidates): check each coordinate against a map or a named source.
- **Drop what doesn't resolve** and list what you dropped and why. Don't keep a place or dataset on a guess.

### Gate 4. Weights (before the v1 run)

See section 7. This gate can wait until the pipeline is ready to score; it doesn't block the site.

## 3. Branch and deploy

- Work on branch **`v1`**, cut from `main`. Push after every working step, so any step can be undone.
- The Vercel project (renamed from `dotcatcher` to `parallels`) is connected to the GitHub repo `rvyyv-n/dotcatcher`, with root directory `site`, framework Vite and **`v1` as its production branch**. Each push to `v1` deploys. The Vercel CLI isn't installed and isn't needed: deploys run from the Git connection.
- **Never merge to `main`** (the user does that), never force-push, never delete remote branches. Older branches are kept as tags `archive/prototype` and `archive/research`.
- `research` is retired.

## 4. Scope

Every trait in the [team plan](team-plan.md), built in this order. The data and statistic for each trait are in [plan §3](claudes-plan.md#traits).

1. **Grid and core:** the 0.5° land grid from the POWER files; cold, heat swing, dryness (aridity index), sun height, terrain.
2. **Benchmark items:** rock (GLiM) and Mars minerals (EMIT); seasons; terrain types, clustering and the cave list; mission filters and hand-set weights; bare ground, frozen ground, dust.
3. **Then:** thermal inertia (Mars), UV, the zoom stage, the headline.
4. **Stretch:** more targets, the stability check.

Tiers 1 and 2 are v1; tiers 3 and 4 are Sunday's polish.

Notes:

- **Derived items ride on tiers 1–2:** landing safety (from slope), industrial sites (from the Surface scores), signs of life (from hydrated minerals), rock type (GLiM for the Moon).
- **Ground strength: not scored.** On Mars, show the TES thermal inertia against NASA's landing-site rule (above 100–140 means load-bearing ground, not thick dust; Golombek et al. 2020). On the Moon, show "not mapped at the pole" with the reason.
- **Labels from day one, never scored:** shelter (caves and lava tubes), Moon dust, perchlorates, and the paper lists in [plan §3](claudes-plan.md#traits).
- **Benchmark items come first.** Seasons (#5), terrain types and clustering (#2 and #4) and mission filters (#6) are in tier 2 because each meets a Challenge Guide benchmark. Skipping one leaves a benchmark partly met, so tell the user before you cut it.
- **If an item's data fights back, skip it** and say so on the site, in a short "Not in this version" list with the reason. "How hard it is to get there" is cut from v1 and goes on that list.
- **Targets:** the Moon's south pole and Jezero first ([plan §5](claudes-plan.md#5-targets-and-the-headline-find)). Arcadia Planitia and the other Mars sites are extras, after the main flow works. Reverse mode (click any place on Earth, see its closest target) is only a "what's next" idea.

## 5. What the site shows

As set out in [plan §2](claudes-plan.md#2-the-main-flow), within the UI design approved at gate 2:

- **The main flow:** open on the headline (or the south pole if no headline yet), pick a target and a mission filter, click a spot, read the scorecard. Two clicks to a result. The mission filter is the one picker on screen (plus the target); challenges are rows in the scorecard.
- **The scorecard:** a bar of Earth rank per trait, with the real Earth and target values, their dataset and their resolution beside it. The overall score never appears without the trait bars ([plan §3, Scoring](claudes-plan.md#scoring)).
- **"Earth can't copy":** gravity, air and radiation, from the table in [plan §3](claudes-plan.md#terrain-types-and-clustering).
- **"Where it breaks":** per match, which traits fall short and by how much, in real units.
- **"How we checked it":** the validation chart ([plan §6](claudes-plan.md#6-how-we-check-it)), with misses explained.
- **The seven questions answered** and the **data list** (every dataset by name, with a link and what it's used for).
- **Hand-set weights:** the team plan asks for them. The browser may combine the pre-computed trait ranks with the user's weights; it never recomputes a rank or a value.

## 6. File contract

The pipeline and the site meet only through pre-computed files in `site/public/data/`. Define the layout first, before either side builds on it, and commit it as typed definitions on both sides: `site/src/contract.ts` (TypeScript types) and the schema test in `pipeline/tests/`.

**Per cell, per trait:**

| Field | Meaning |
|---|---|
| value | the Earth value in real units, or "no data" |
| rank | Earth rank, 0–1 ([plan §3](claudes-plan.md#scoring)), or "no data" |
| dataset | an id pointing into the data list, so every number traces to a named dataset |
| resolution | the resolution that value really has |

Plus, per cell: coordinates, terrain type, cluster, seasons, and the overall score for each target and mission filter.

**Target values file:** one entry per target and trait, with the value, statistic, dataset or paper, and resolution. Per-region values for the nine Artemis regions sit here too.

**Other files:** the data list (dataset ids, names, links, licences, uses), the label lists, the validation results, and the "Not in this version" list.

**Layout.** Files in `site/public/data/`, all written by `python -m pipeline.export`:

- `manifest.json`: datasets, traits, challenges, mission filters, terrain types, clustering, targets and their values, the benchmarks and questions, and the "Not in this version" list.
- `cells.bin`: one value per land cell for each grid column, little-endian, each column at the byte offset the manifest gives.
- `target-<id>.bin`: per target, `rank:<trait>` and `ch:<challenge>` as one byte (0-250 is Earth rank 0-1, 255 is no data), and `score:<filter>` and `score:<filter>:yr` as two bytes (0-10000, 65535 is not ranked).
- `labels.json`: known analogs, caves and other labelled points.
- `validation.json`: the test places, pass marks and results.

The browser may combine ranks with the user's weights; it never recomputes a rank or a value.

**Stub first.** Build the site on stub files that follow the contract from the first commit, marked as sample data on screen while you build. No stub or sample value ships on the production site (section 10). The pipeline and the site then run in parallel, and real files replace the stubs without site changes. Keep each file small: about 75,000 land cells, a few MB per target at most ([plan §7](claudes-plan.md#7-tech-stack-and-hosting)); use compact column arrays if plain JSON gets too big.

## 7. Weights and validation

- **You propose** one default weight set per target and mission filter, with a one-line reason per weight, drawn from what the target and the hardware need, never from the test places.
- **The user approves** them before the v1 run.
- **Commit them** in a config file in `pipeline/`, together with the terrain-type thresholds and the fixed held-out split of known analogs, **before** the v1 run. The git history is the proof we didn't tune to pass.
- **Not a blind first run.** A throwaway prototype ran the same test places twice on 14 November, so this isn't a blind first run. The site says so, and shows v1's result against the pass marks set beforehand. Suggestion: add five to ten known analogs that have never been scored, each with a sourced position, and use only those as the blind check.
- Pass marks, the Moon test's two parts, and what to do with misses: [plan §6](claudes-plan.md#6-how-we-check-it). If validation fails, publish the honest result ([plan §9](claudes-plan.md#9-risks-and-fallbacks)).

## 8. Data and machine

- **The user has a NASA Earthdata account.** On the build PC, checked 15 November, `~/.netrc` holds the login (present, not printed). Use it through `earthaccess`; never print, copy or commit the login. If login or downloads fail, switch to the no-login fallback in [plan §9](claudes-plan.md#9-risks-and-fallbacks) by its switch time. Without the login, EMIT minerals and every MODIS file are out.
- **Installed (build PC, 15 November):** Python 3.13.17 with uv 0.13.7; Node 24.16.0 with npm 11.13.0. Not installed: the Vercel CLI. rasterio's GDAL has no HDF4 driver.
- **Stack and tests:** [plan §7](claudes-plan.md#7-tech-stack-and-hosting): pipeline in `pipeline/`, raw downloads in `data/` (gitignored), site in `site/`, pytest and Playwright.
- **Fallback switch times** in [plan §9](claudes-plan.md#9-risks-and-fallbacks) apply as written. If something has been stuck for an hour, cut it or switch.

## 9. Rules to keep

The rules in [guidelines](guidelines.md) §1–3 and [CLAUDE.md](../CLAUDE.md) apply.

## 10. Done means

- The checks for roadmap steps 1–6 in [plan §8](claudes-plan.md#8-roadmap) pass, or a failure is written up honestly on the site.
- The site opens in a private window, with no login, on a phone and a laptop.
- A newcomer gets a result in under a minute without help.
- Every number on screen traces to a named dataset or paper, with its resolution.
- It needs no upkeep until 26 January 2027: no keys, no server, no live data calls, and a bundled background image in case GIBS tiles fail ([plan §7](claudes-plan.md#7-tech-stack-and-hosting)).
- The items in the [guidelines §7](guidelines.md#7-before-we-click-submit-for-judging) checklist that apply to the site are met.
- No sample or placeholder number is on the production site. A trait without real data on both sides shows "no data" or "not scored", with the reason.

Report to the user at each checkpoint with what works, what was cut, and the link to test.
