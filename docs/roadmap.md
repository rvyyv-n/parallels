# Roadmap

What gets built when, and by whom, for version 2 of the site. What the site is lives in the [plan](plan.md) (part 1, the team's idea; part 2, the spec). This file changes as work is done. A new session starts at the first unticked box.

## How a pass runs

- **The orchestrator** is the second v2 build thread: Claude Fable 5.2 at high effort. It owns this file and the shared files, writes the builders' briefs, joins their work, runs the tests, commits, deploys and tells the team. It writes little feature code itself.
- **Builders** are Claude Opus at medium effort, high for the hard groups. One group each, in its own files, with its unit tests. They don't commit or edit shared files; they hand the orchestrator the lines a shared file needs.
- **Checkers** are Claude Sonnet at medium effort: tests, number checks, the fresh-eyes check.
- At most three builders at once. Effort never below medium or above high.
- **Shared files:** `site/src/app.tsx`, `state.ts`, `styles.css`, `scene/`, `data/store.ts`, `data/load.ts`, `site/index.html`, `vite.config.ts`.
- **A brief** gives the goal, the files the builder may write, the columns and manifest fields it reads, what it exposes, its done check, and the rules: no invented numbers, plain words, the budgets, reduced motion, keyboard use, and the plan's rule on other projects (study approaches, write our own code, copy nothing).
- **After each group:** `npm test`, `npm run build`, `npm run e2e`; commit the group on its own; push; tick the box. **After each pass:** deploy a preview and send the team the link. Screenshots only for a visual check or the README.

Times are the team's local time on Sunday 15 November; the build machine is 3 hours ahead. Freeze at 18:00, submit by 21:59.

## Done

- [x] Data loading by byte range (`data/store.ts`, `data/load.ts`), five distinct places (`data/places.ts`), the match model (`data/match.ts`), 45 unit tests
- [x] 3D scene of Earth, the Moon and Mars from NASA imagery, lit matches, pins, scroll keyframes (`scene/`)
- [x] Intro, "Find a place", "Where it matches", "Where it breaks", "What to test here" (`ui/`)
- [x] The view in the address: base site, filter, year-round, terrain, place, page (`state.ts`)
- [x] Vercel project `parallels-v2` with preview deploys

## Pass 1: evidence and controls (now to 07:00)

**Goal:** every guide benchmark can be found on the site, the method check is on screen, and tests guard the budgets and the numbers.

- [ ] **1A "How we checked it"** · Opus, medium · `ui/Checked.tsx`, `checked.css`, a unit test
  - Fill the empty `#checked` section with a component that reads `loadValidation()`.
  - One chart in SVG, no chart library: the fourth run's test places for the Moon and Jezero, known analogs against ordinary places and plain deserts, with each check's pass mark.
  - Three honest lines from `validation.json`: 1 of 4 first checks passed; 10 of 15 checks pass in the fourth run, 6 not counted; the test places were used four times. The commit that fixed the weights shows as text until the repo is public.
  - Done when every number on it is read from the file and the unit test pins them.
- [ ] **1B "For judges" view** · Opus, medium · `ui/Judges.tsx`, `judges.css`
  - Shown when `view.page === "judges"` (the address already supports it), with a way back.
  - Sections from the manifest: `benchmarks` (the guide's words), `questions`, `datasets` grouped by agency with link, licence and use, `clustering` (summary and agreement), `not_in_version`; stability from `validation.json`; the AI note.
  - Done when all 31 datasets show and each link has a licence.
- [ ] **1C Browser tests** · Sonnet, medium · `site/e2e/`
  - `budgets.spec.ts`: word counts (first screen 120, collapsed match 60, main page 900), any base site and filter in two clicks, no sideways scroll at 390 px, nothing moves with reduced motion.
  - `numbers.spec.ts`: the featured numbers equal the values decoded in Node with `tests/node-source.ts`.
  - `links.spec.ts`: every dataset link answers; no console errors on any chapter.
  - Done when the tests fail only for real faults.
- [ ] **1D Controls and footer** · orchestrator · shared files
  - Terrain chips (`manifest.terrain_types` except "none", with cell counts) and a year-round switch in `Picker`, wired to `view.terrain` and `view.yearRound`; `listPlaces` already filters by both.
  - A clear line when a rare terrain type gives fewer than five places.
  - Terrain type and "new place" tags on each row of the five best places.
  - Footer: team, the AI note, data credits, links to "For judges" and the image credits.
  - Done when a copied address reopens the same view with the same places.

## Pass 2: the idea in full (07:00 to 12:00)

**Goal:** show that each part of a base has its own best place, give newcomers a way in, and let a judge see the ground itself.

- [ ] **2A "Build the whole base"** · Opus, high · `data/base.ts` with a unit test, `ui/Base.tsx`, `base.css`
  - `bestPerChallenge(manifest, target)`: for each scored challenge, the top cell of its `ch:<challenge>` column in the target file, with its region, coordinates and terrain type. A cell that wins two parts is returned once with both parts.
  - The chapter (id `base`, after "What to test here"): one row per part with its pin number, place, and the one trait that matches best there; challenges with only labels are listed as not scored, with the reason.
  - Choosing a part opens that place in the chapters above.
  - Done when the unit test confirms each pin is the maximum of its column on the real data files.
- [ ] **2B 3D terrain close-up** · Opus, high · `terrain/`, `ui/Terrain.tsx`, `terrain.css`
  - `terrain/tiles.ts`: open elevation tiles with no key (Terrarium tiles on AWS Open Data), decoded to heights, for a box about 50 km wide around the place.
  - Imagery draped on the mesh: NASA GIBS first, Sentinel-2 cloudless as the fallback; both credited.
  - `terrain/view.ts`: a three.js mesh with a light whose height can be dragged from a low sun to noon; a "south pole light" setting uses the Moon target's measured `sun_height`.
  - Opens from a button in "What to test here", loads as a separate chunk so the first screen stays within budget, and shows a clear message when tiles are blocked.
  - Done when it opens for both headline places and the page still works offline.
- [ ] **2C Learn page** · Opus, high · `site/learn.html`, `src/learn/`, `scripts/fetch-photos.mjs`, `public/img/learn/`
  - The six sections in the plan, with one view for the Moon and one for Mars (`learn.html?world=moon`).
  - `fetch-photos.mjs`: downloads eight NASA Image Library photos by their NASA id, resizes them with sharp, and adds their credits to `CREDITS.md`. Photos are bundled; the page makes no live calls.
  - The month slider reads `m_best`, `m_freeze` and `m_rain` for the five best places; the weight calculator uses the gravity in `cant_copy`; the analog map places `labels.json` points on the bundled Earth image.
  - Ends with "Find your own place", which opens the main page with that world's base site chosen.
  - Done when every value traces to `dataset/` or a named source, and the page works at 390 px.
- [ ] **2D Scene and selection** · orchestrator · shared files
  - A `base` keyframe and pins for many places at once in the scene; the Learn page entry in `vite.config.ts`.
  - Selection of any cell, not only the five best, so "Build the whole base" can open its places.
  - Motion: count-ups on the intro numbers, text that reveals with the scroll, a fixed top bar.

## Pass 3: tour and hardening (12:00 to 16:00)

**Goal:** the page can play itself, every value can be checked outside the site, and nothing breaks on a phone or an old laptop.

- [ ] **3A Guided tour** · Opus, high · `ui/Tour.tsx`, `tour.css`
  - A list of steps (chapter, view change, caption, seconds) that drives `scrollToId` and `setView`, 30 to 60 seconds, ending on "Build the whole base".
  - Captions, a progress bar, pause and exit; Escape, a wheel, a touch or a key gives control back.
  - `?tour=1` starts it at once, for the video recording.
  - Done when it runs from start to end on a laptop and a phone width, and stops for any user input.
- [ ] **3B Check it yourself** · Opus, medium · `data/sheet.ts` with a unit test, `ui/CheckIt.tsx`
  - A CSV of the place: trait, Earth value, base-site value, units, both datasets, resolution.
  - Links: NASA Worldview framed on the place, and Moon Trek or Mars Trek for the base site.
  - Done when the CSV matches the screen and every link opens.
- [ ] **3C Code review** · Opus, high · read only
  - Bugs, numbers that differ from the data, budget breaks, keyboard and screen-reader gaps.
  - Done when each finding is fixed or listed here.
- [ ] **3D Hardening** · orchestrator · shared files
  - A flat picture map with pins when WebGL is missing; keyboard order; a colour-blind check of gold and blue; smaller textures on phones.
  - Page title, description, share image, icon.

**Extras, only if pass 3 is done before 15:00**

- [ ] "Adjust weights" · Opus, medium · done when a hand-set mix equal to a mission filter gives the same top place
- [ ] Globe layer of the 50 known analogs and 5 caves, each with its source · orchestrator

## Pass 4: present (16:00 to the freeze at 18:00)

**Goal:** everything a judge reads or watches is ready.

- [ ] **4A Demo video** · Opus, medium · `scripts/record-demo.mjs`, `scripts/demo-captions.srt`
  - Playwright records `?tour=1` at 1920×1080; ffmpeg cuts it to 28 seconds and burns in the captions in the official timing. The video file stays out of git.
  - Done when the file is 30 seconds or less and works on mute.
- [ ] **4B Fresh-eyes check** · Sonnet, medium · a model shown only four screenshots says what the site found and where one match breaks
- [ ] **4C README** · Opus, medium · final screenshots in `docs/images/`, the new features, the Status table, the live link and the video; every number matches the data files
- [ ] **4D Project page text** · orchestrator · `docs/project-page.md`: every form field, the NASA Data field with each dataset, link and use, the partner data field, the AI note
- [ ] **4E Public link and repo** · team, then orchestrator · the team picks version 1 or 2 and makes the repo public and renamed; the orchestrator deploys to production and updates every repo link

## Pass 5: ship (18:00 to 21:59, fixes only)

- [ ] Both of us test the live site on a phone and a laptop: try to break it, check numbers against the data, read it as a newcomer
- [ ] Request a FortiGuard web-filter classification for the public link
- [ ] Tag the submitted commit `submitted`
- [ ] Final submission; the success banner shows

## From the team

| What | By |
|---|---|
| Save a complete draft on the project page with version 1's link | 03:30 |
| TEAM RMD member names, for the credits and the video's first caption | 16:00 |
| Version 1 or 2 as the public link; the repo public and its new name | 17:00 |
| Check that the Local Event's deadline is in the same time zone as these times | any time |

## Fallbacks

| Risk | Fallback | Switch by |
|---|---|---|
| "Build the whole base" not solid | a table of the best place per part, inside "What to test here" | 11:00 |
| 3D terrain not solid | leave it out; "What to test here" keeps the zoomed globe | 11:00 |
| Learn page not solid | keep its first three sections only | 11:00 |
| Tour not solid | a short captioned walk-through with "Next" buttons | 14:00 |
| Globe too slow on a phone | the flat picture map on phones | 15:00 |
| Time runs short | cut in this order: the extras, 3D terrain on phones, the Learn page's last two sections, extra motion, the year-round switch, polish on the four unchecked base sites | 15:00 |
| Recorded video fails | record the screen by hand with the same captions; if that fails too, 7 slides or fewer | 19:00 |
| Version 2 not ready, or not better | submit version 1's link | 17:00 |
| Session limit reached | the next session starts at the first unticked box | at once |

Never cut: the picker, the five distinct places, the match and break chapters for the two checked base sites, "Build the whole base" at least as a table, "How we checked it", "For judges", the AI note, the tests, the demo video.
