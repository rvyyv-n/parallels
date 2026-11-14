# Roadmap

What gets built when, and by whom, for version 2 of the site. What the site is lives in the [plan](plan.md) (part 1, the team's idea; part 2, the spec). This file changes as work is done; the plan changes only when the spec does. A new session starts at the first unticked box.

## Who builds what

- **The orchestrator** is the second v2 build thread: Claude Fable 5.2 at high effort. It owns this roadmap, the shared files, the 3D scene and the story chapters. It writes each builder's brief, joins the results, runs every test, commits, deploys and tells the team. It writes little feature code itself, to save the session limit.
- **Builders** are Claude Opus at medium effort, high for the hard groups. Each builds one group in its own files, with its unit tests. Builders don't commit, and they don't edit shared files: they hand the orchestrator the few lines a shared file needs.
- **Checkers** are Claude Sonnet at medium effort, for mechanical work: running tests, checking numbers against the data, the fresh-eyes check.
- Effort is never below medium or above high. At most three builders run at once.
- Shared files: `site/src/app.tsx`, `state.ts`, `styles.css`, `scene/`, `data/store.ts`, `data/load.ts`, `site/index.html`, `vite.config.ts`.

**A builder's brief** names the group's goal in two sentences, the files it may write, the data columns and manifest fields it reads, what it must expose to the shared files, the check that proves it done, and these rules: no invented numbers, plain words, the budgets, reduced motion, keyboard use, and the plan's rule on other projects (study approaches, write our own code, copy nothing).

**After each group:** the orchestrator joins it, runs `npm test`, `npm run build` and `npm run e2e`, commits the group on its own, pushes and ticks its box. **After each wave:** it deploys a preview and sends the team the link and a few lines on what changed. Screenshots only when a change needs a visual check (a new layout, the phone width, motion) or for the README at the end.

## Sunday 15 November

Times are the team's local time. The build machine's clock is 3 hours ahead. Build until the freeze at 18:00, then fixes only.

**Done**
- [x] Data loading by byte range, distinct top places, the match model, with unit tests
- [x] 3D scene: Earth, Moon and Mars from NASA imagery, lit matches, pins
- [x] Intro, "Find a place", "Where it matches", "Where it breaks", "What to test here"
- [x] Vercel project `parallels-v2` with preview deploys

**Now: the team saves a draft** (before 03:30)
- [ ] Save a complete draft on the project page with version 1's link, so a valid entry exists whatever happens. Resubmitting is allowed, and only the last saved version counts.

**Wave 1: evidence and benchmarks** (to 07:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 1A "How we checked it": honest lines and the fourth-run chart | Opus, medium | `site/src/ui/Checked.tsx`, `checked.css` | every number comes from `validation.json`: 1 of 4, 10 of 15, 6 not counted, used four times |
| [ ] | 1B "For judges" view | Opus, medium | `site/src/ui/Judges.tsx`, `judges.css` | six benchmarks, seven questions, every dataset with link and licence, the clustering summary, stability text, "Not in this version", the AI note |
| [ ] | 1C Playwright tests: budgets, numbers on screen against the data files, links, no console errors | Sonnet, medium | `site/e2e/` | the tests run and fail only for real faults |
| [ ] | 1D Terrain filter, year-round switch, terrain type and "new place" on each place, footer with the AI note and credits, the view held in the address | orchestrator | shared files | the filter shows fewer than five places when a type is rare; a copied address reopens the same view |

**Wave 2: the three big features** (07:00 to 12:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 2A "Build the whole base": the best place for each part of the base, one pin per part | Opus, high | `site/src/data/base.ts` with a unit test, `site/src/ui/Base.tsx`, `base.css` | each pin is the top cell of that `ch:` column; a place that wins two parts shows once with both; parts not scored are listed as labels |
| [ ] | 2B 3D terrain close-up from open elevation and imagery tiles, with a low-sun setting | Opus, high | `site/src/terrain/`, `site/src/ui/Terrain.tsx`, `terrain.css` | opens for both headline places; the page still works when tiles are blocked; tile sources credited |
| [ ] | 2C Learn page for the Moon and Mars, as the plan describes, with its photo-fetch script | Opus, high | `site/learn.html`, `site/src/learn/`, `site/scripts/fetch-photos.mjs`, `site/public/img/learn/` | every value traces to `dataset/` or a named source; works at 390 px; photos credited in `CREDITS.md` |

**Wave 3: the tour, and make it safe** (12:00 to 16:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 3A Self-playing guided tour, 30 to 60 seconds: captions, progress, pause and exit, ending on "Build the whole base" | Opus, high | `site/src/ui/Tour.tsx`, `tour.css` | runs start to end; any click or scroll by the user takes control back |
| [ ] | 3B Independent review of the code for bugs and wrong numbers | Opus, high | read only | findings fixed or listed |
| [ ] | 3C "Check it yourself": NASA Worldview, Moon Trek and Mars Trek links, and a CSV of a place's values with their datasets | Opus, medium | `site/src/data/sheet.ts` with a unit test, `site/src/ui/CheckIt.tsx` | every value in the CSV matches the screen; every link opens |
| [ ] | 3D A flat picture map when 3D is not available, keyboard reach, colour-blind check, download budget on a phone; page title, description, share image and icon | orchestrator | shared files | budget tests pass |

**Extras, only if wave 3 is done before 15:00**

| | Group | Builder | Check |
|---|---|---|---|
| [ ] | "Adjust weights" | Opus, medium | a hand-set mix equal to a mission filter gives the same top place |
| [ ] | Globe layer of the known analogs and caves | orchestrator | 50 known analogs and 5 caves, each with its source |

**Wave 4: present** (16:00 to the freeze at 18:00)

| | Step | Who | Check |
|---|---|---|---|
| [ ] | Demo video: Playwright records the tour at 1920×1080; it is cut to 28 seconds and ffmpeg burns in the captions in the official timing | Opus, medium | the uploaded file is 30 seconds or less; it works on mute |
| [ ] | Fresh-eyes check: a model shown only four screenshots says what the site found and where one match breaks | Sonnet, medium | two correct sentences |
| [ ] | README: final screenshots in `docs/images/`, "Build the whole base" and the Learn page in "What Parallels does", the Status table, the live link and the video | Opus, medium | every number matches the data files |
| [ ] | Project page text in `docs/project-page.md`: every form field, the NASA Data field with each dataset, link and use, the partner data field, the AI note | orchestrator | every box in [guidelines](guidelines.md) section 7 |
| [ ] | The team compares version 1 and version 2 and chooses the public link; the orchestrator deploys it to production | team, then orchestrator | the link opens in a private window on a phone and a laptop |
| [ ] | The team makes the repo public and renames it; the orchestrator updates the remotes and every repo link | team, then orchestrator | the README and the commits behind "rules fixed in git" open in a private window |

**Wave 5: ship** (18:00 to 21:59, fixes only)

| | Step | Who | Check |
|---|---|---|---|
| [ ] | Both of us test the live site on a phone and a laptop: try to break it, check numbers against the data, read it as a newcomer | team | a newcomer gets a result in under a minute without help |
| [ ] | Request a FortiGuard web-filter classification for the public link | team | request sent |
| [ ] | Final roadmap update; tag the submitted commit `submitted` | orchestrator | the tag is pushed |
| [ ] | Final submission | team | the success banner shows |

**Needed from the team:** the TEAM RMD member names for the credits and the video's first caption (by 16:00); the choice of public link (by 17:00); the repo going public and its new name (by 17:00); a check that the Local Event's deadline is in the same time zone as these times.

## Fallbacks

| Risk | Fallback | Switch by |
|---|---|---|
| "Build the whole base" not solid | a table of the best place per part, inside "What to test here" | 11:00 |
| 3D terrain not solid | leave it out; "What to test here" keeps the zoomed globe | 11:00 |
| Learn page not solid | keep its first three sections only | 11:00 |
| Tour not solid | a short captioned walk-through with "Next" buttons | 14:00 |
| Globe too slow on a phone | a flat picture map on phones | 15:00 |
| Time runs short | cut in this order: the extras, 3D terrain on phones, the Learn page's last two sections, extra motion, the year-round switch, polish on the four unchecked base sites | 15:00 |
| Recorded video fails | record the screen by hand with the same captions; if that fails too, 7 slides or fewer | 19:00 |
| Version 2 not ready, or not better | submit version 1's link | the team's call at 17:00 |
| Session limit reached | the next session starts at the first unticked box; groups already started are finished first | at once |

Never cut: the picker, the five distinct places, the match and break chapters for the two checked base sites, "Build the whole base" at least as a table, "How we checked it", "For judges", the AI note, the tests, the demo video.
