# Review before the v1 build

Written Saturday 14 November 2026, about 22:15 local time. Covers `main` at commit `f540557`: every file in `docs/`, `CLAUDE.md`, `README.md`, `PRODUCT.md`, and the prototype in `pipeline/` and `site/`. Nothing in the project was changed. Ideas marked **suggestion** are Claude's, not the team's.

## Verdict

The idea, the honesty rules and the data plan hold together. The timetable, the build order and the prototype do not. Fix three things before the build starts: reset the clock (every fallback time in the plan has already passed), build the Challenge Guide's benchmark items first (three of the six sit in the "stretch" tier), and take every random "sample" number off the public site. The prototype's own check currently fails for both the Moon and Mars, and its notes say real rock and mineral data is what's missing, so that data goes first.

## Proposed changes, most important first

Effort is for the doc edit. Build time is given separately where it matters.

| # | File | Change | Min |
|---|---|---|---|
| 1 | `docs/v1-spec.md:11-13`, `docs/claudes-plan.md:286-322`, `docs/guidelines.md:97` | **Reset the clock.** The spec says "a fully working site today, Saturday" and the plan's fallback times run from Saturday 10:00 to 22:00. The build starts after all of them. New text for spec §1: "A working site on real data by **Sunday 12:00**. The build starts Saturday night and runs overnight. **Feature freeze Sunday 16:00**: after that only fixes, the demo video and the project page. Final submission by **Sunday 21:59**." Replace the plan §9 "Switch by" column with: Earthdata login fails → Saturday 23:30; Vercel trouble → Sunday 00:30; rock trait unworkable → Sunday 03:00; map trouble → Sunday 04:00; validation write-up → Sunday 08:00; zoom too slow → Sunday 10:00; no headline → Sunday 12:00; video fails → Sunday 18:00 (unchanged). The new times are a **suggestion**; the team sets them. | 15 |
| 2 | `docs/guidelines.md:97` | **Still submit a first draft tonight.** `origin/v1` is the same commit as `main`, so if the Vercel address already shows the prototype, fill in the form with that link and the text we have. New text: "Submit a first draft on Saturday night with the prototype link, then improve it." It costs the team about 30 minutes and means a late failure can't leave us with nothing. | 2 (+30 team) |
| 3 | `docs/v1-spec.md:62-64` | **Build the benchmarks before the extras.** Seasons (benchmark 5), terrain types and clustering (2 and 4) and thermal inertia (4) are all in tier 3 "stretch", and mission filters (6) are in no tier at all. New tiers: "1. **Grid and core:** the 0.5° land grid from the POWER files; cold, heat swing, dryness (aridity index), sun height, terrain. 2. **Benchmark items:** rock (GLiM) and Mars minerals (EMIT); seasons; terrain types, clustering and the cave list; mission filters and hand-set weights; bare ground, frozen ground, dust. 3. **Then:** thermal inertia (Mars), UV, the zoom stage, the headline. 4. **Stretch:** more targets, the stability check." | 10 |
| 4 | `docs/v1-spec.md:130-143` (add one line), `pipeline/build.py:40-43` (v1 removes it) | **No sample numbers on the public site.** The prototype makes up placeholder values from a fixed seed for ground strength, rock cover, ground water, feldspar, and clays and sulfates, and shows scores built on them (see `docs/screenshots/prototype-laptop.png`: "58 out of 100, sample"). The hatched tag is honest, but a judge skimming sees invented numbers, and `guidelines.md:44` says never invent a value. Add to spec §10: "No sample or placeholder number is on the production site. A trait without real data on both sides shows 'no data' or 'not scored', with the reason." | 5 |
| 5 | `docs/v1-spec.md:111`, `docs/claudes-plan.md:15,258` | **Stop calling v1 the first validation run.** The prototype already ran the check twice today and changed the method in between (`pipeline/build.py:29-37`). Current result: Moon 67% against a pass mark of 80%; Mars 79% (pass 80%) and 54% (pass 60%). New text for spec line 111: "…before the v1 run. This is the third run: the prototype ran the check twice on 14 November and changed the method in between. The site lists every run and what changed. The held-out half was already looked at in run 2, so we call the result checked, not blind." **Suggestion:** add five to ten known analogs that have never been scored and use only those as the blind check (30 min, each needs a sourced position). | 10 |
| 6 | `docs/claudes-plan.md:55,76,78` | **Fix the dryness formula.** The plan divides rain by POWER's `EVPTRNS`. POWER defines that as the evapotranspiration flux that actually happens, not the potential one, and the API has no potential-evaporation parameter (it rejects `PET`). In a desert, real evaporation is about equal to rain, so the ratio comes out near 1 and the "aridity index below 0.2" rule for arid basins and salt flats would never fire. New text for line 55: "aridity index: POWER rain (PRECTOTCORR) divided by potential evaporation, which we compute from POWER temperatures and latitude (Hargreaves method), marked as computed by us". Test: Yungay must come out below 0.05 and the Iowa point above 0.65. The Hargreaves choice is a **suggestion**. Build: 30 min. | 5 |
| 7 | `docs/team-plan.md:107` (team decides), `docs/v1-spec.md:78` | **One picker, not three.** The team plan says users pick a mission filter and "the challenges below are weighted to match" (line 13), but line 107 says trait scores are combined. The prototype has no filters at all: users pick a challenge. Built as written, v1 would show a target picker, a filter picker, a challenge picker, a terrain filter and weight sliders. Proposed wording for line 107: "**Overall:** each challenge's score combines its traits; the mission filter's weights then combine the challenge scores." On screen, the mission filter is the picker (the guide's own words) and challenges become rows in the scorecard. Two things for the team to settle: (a) **Habitat structure** lists ground strength, Shelter and Heat swing, and only Heat swing can be scored, so the filter would equal Heat swing alone. **Suggestion:** add Surface. (b) Dryness, Industrial sites and Signs of life are in no filter. Say they count only under hand-set weights, or place them. | 10 |
| 8 | `docs/v1-spec.md:29` | **Say what to keep from the prototype.** The plan promises a search of all Earth's land on a 0.5° grid (`team-plan.md:105`) and criticises a rival for ranking "18 hand-picked sites" (`claudes-plan.md:12`). The prototype ranks 64 hand-picked sites against 300 random points, one POWER web request per point (`pipeline/earth.py:29,47`), which can't reach 75,000 cells. New text: "Keep `scoring.py`, `terrain.py`, `planets.py`, the challenge definitions, the scorecard and the validation chart. Replace the Earth side: read the POWER files in bulk instead of one request per point, and score every land cell. The 64 sites become the validation set and the map's 'known analog' markers." | 5 |
| 9 | `docs/claudes-plan.md:54,148,149`, `docs/v1-spec.md:68` | **Settle thermal inertia and ground strength** (details in the data-hole table). Mars: the TES map is confirmed. Moon: the Diviner map stops at 70° latitude and the targets are at 84–89°S, so the Moon gets a label, not a score. Ground strength: no direct data on any of the three worlds. New text for spec line 68: "Ground strength: not scored. On Mars, show the TES thermal inertia against NASA's landing-site rule (above 100–140 means load-bearing ground, not thick dust; Golombek et al. 2020). On the Moon, show 'not mapped at the pole' with the reason." | 10 |
| 10 | `docs/v1-spec.md:116-117`, `README.md:27`, `docs/claudes-plan.md:353` | **Fix the machine facts.** The spec says the Earthdata login is "saved in `~/.netrc` on this PC" with Node 24. This Mac has no `~/.netrc`, no `data/` folder, no `.venv`, Node 26.7, Python 3.13.14 and uv 0.12.1. The README's run commands use Windows paths (`.venv/Scripts/python`). The plan's open question about the Earthdata account is still unticked. Either build on the PC, or save the login here first (5 min, the build thread can ask for it safely) and use `.venv/bin/python`. Without the login, EMIT minerals and every MODIS file download are out. | 5 |
| 11 | new `docs/project-page.md` | **Suggestion: draft the project page text tonight, alongside the build.** `guidelines.md` says the page is most of the score, but no page text exists and the plan leaves it to Sunday. Draft the summary, description, NASA data list and AI note now; fill in results on Sunday. | 45 |
| 12 | `docs/v1-spec.md:19,28` | **Don't hold the pipeline for a design sign-off.** New text for line 19: "The site's interface waits for the user's yes on gates 1 and 2. The data pipeline doesn't depend on the design and starts at once." Cut the second rival scan in line 28 to "Rivals: use plan §1". A fresh look at 22 repos at this hour adds nothing to the result. Both are **suggestions**. | 3 |
| 13 | `README.md:32`, `site/src/main.ts:63` | **Tighten the AI note.** (a) The README says Claude "suggested the mission filters, terrain types, seasons and extra traits". Those come from the Challenge Guide's benchmarks (`team-plan.md:128`). As written, it reads as if AI shaped the idea, which the official rule forbids. New text: "Our local Challenge Guide asks for mission filters, terrain types and seasons. Claude checked our plan against the guide and we added them." (b) The README says Claude drew the logo and labelled it in the file's metadata; the site footer says "Nothing on this site is an AI-made image". The rule (`guidelines.md:26`) wants a visible watermark on AI images. Either keep the logo off the site and the project page, or add a visible "AI-made" mark beside it and change the footer. | 5 |
| 14 | `docs/claudes-plan.md:56-58,113,129,144,208-210` and appendix A | **Bring the plan's data lines up to what the prototype already settled.** Mars terrain: USGS HRSC–MOLA 200 m read by range request, not MOLA 16 or 128 px. Earth terrain: Copernicus GLO-90 everywhere, not SRTM or NASADEM (say plainly that this trait's Earth side is ESA data). Sunlight: time in sunlight is shown, not scored, because every place on Earth averages 50% over a year; sun height is scored. Gale: Curiosity's landing site (−4.59, 137.44), not the crater centre. Arsia: cave opening APC075, not the summit. Appendix A: replace with "positions and sources are in `pipeline/sites.json`", since most of the list has moved (Rio Tinto, Qaidam, Yungay, Lanzarote, Gros Morne, Death Valley and more). | 15 |
| 15 | `docs/claudes-plan.md:57,60,66,130-134,151,161,209`, `docs/v1-spec.md:64` | **Cut what changes no score** (list in the bloat table): GRIP4 roads, MODIS snow, MODIS vegetation index, MODIS albedo, SHARAD, Protonilus Mensae, reverse mode. | 10 |
| 16 | `site/index.html:8`, `site/src/main.ts:26-27`, `site/package.json:2`, `PRODUCT.md:29-30` | **Use the name.** The site still says "Analog Finder (working name)" and `PRODUCT.md` says the name is a placeholder; the README says the name is Parallels. Update `PRODUCT.md` too, since the design step reads it. | 5 |
| 17 | `docs/challenge.md:21,35,39` | **Make three answers match what we really load.** Benchmark 1: name the archives in use (PDS Geosciences, USGS Astrogeology, NASA POWER and Earthdata, Copernicus, plus NASA PGDA). That's five, not three. Question 2: only Odyssey GRS and EMIT are loaded as data; LEND, Mini-RF and LCROSS are published values, so say "cited", not "integrated". Question 6: the guide also names a "weathering index", which we never mention. Add one line saying freeze–thaw months and aridity are our stand-ins for weathering, or that it isn't covered. | 5 |
| 18 | `pipeline/sites.json` | **Suggestion: add an `analog_source` to each known analog.** Question 7 asks for "field expedition datasets from USGS or academic field reports". Each test site has a source for its position but none for why it counts as an analog. One paper or agency page per site answers the question on screen. | 20 |
| 19 | `docs/v1-spec.md:121-128,137-143`, `docs/challenge.md:68-70`, `CLAUDE.md:9,13`, `docs/workflow.html:98` | **Trim the repeats.** Spec §9 repeats guidelines §1–3 and `CLAUDE.md` rule for rule: replace with "The rules in `guidelines.md` §1–3 and `CLAUDE.md` apply." Spec §10's sub-list repeats guidelines §7: keep the pointer only. `challenge.md` "Competition" repeats plan §1: cut. `CLAUDE.md` still says "once written, the plan" and doesn't name `pipeline/` or `site/`. The workflow chart still marks "Give the core idea" as "we are here". | 10 |
| 20 | repo root | **Suggestion: add a `pyproject.toml`.** The plan lists eight Python packages, the README installs a different six, and nothing in the repo pins either. | 5 |

## Data holes

Checked tonight by opening each link or reading its file header. "Not re-checked" means the value comes from the source named in `pipeline/sites.json` and I did not open that source again.

### Datasets

| Hole | Result | Link, size and notes |
|---|---|---|
| TES thermal inertia (Mars) | **Confirmed** | NASA PDS, dataset `MGS-M-TES-5-TIMAP-V1.0` (Putzig and Mellon, 2007 maps). Night map: [global_ti_night_2007.img](https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img), 51,840,000 bytes. Day map the same size; two masks at 25,920,000 bytes each; the [whole set as a zip](https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001.zip) is 69,628,554 bytes. 7,200 × 3,600 pixels, 20 per degree (about 3 km), pole to pole, 16-bit integers, units J m⁻² K⁻¹ s⁻½. Multiply by the mask to drop filled-in pixels. [Overview page](https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html). |
| Diviner regolith properties (Moon) | **Unresolved for our targets** | The maps exist: [Hayne's project page](https://phayne.github.io/projects/5_lunar-regolith/) links a [Google Drive folder](https://drive.google.com/drive/folders/1DTnMB_fWTUmRcc-abtbiFxXNZZ8dSHXv) (it opens; 128 pixels per degree, 32-bit, sizes not listed). But they cover 70°S to 70°N only, and the Artemis regions are at 84–89°S. Do instead: don't score Moon thermal inertia. Show the paper's Moon-wide average, 55 ± 2 J m⁻² K⁻¹ s⁻½ at 273 K ([Hayne et al. 2017 abstract](https://arxiv.org/abs/1711.00977)), labelled "Moon-wide average; not mapped at the pole". |
| SWIM ice maps (Mars) | **Confirmed, site is back up** | [Products page](https://swim.psi.edu/SWIM4MIMProducts.php), last updated 4 August 2025. Direct files: [0–1 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_0_1.tif) 70,995,807 bytes; [1–5 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_1_5.tif) 70,995,807 bytes; [deeper than 5 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_5.tif) 70,995,794 bytes. 3,000 m pixels, 60°S to 60°N, 0–360°E, no-data value −30. Jezero, Arcadia and Deuteronilus are inside the coverage. Two cautions: the value is "ice consistency" (how far the datasets agree that ice is there), not an amount of ice, and Earth has nothing like it, so it can be a label or map layer but not a score. The page states no licence or DOI; it cites Morgan and Putzig et al. 2025. I did not confirm the value range; read it from the file. |
| MOLA 128 px size | **Confirmed, and no longer needed** | PDS: [16 height tiles](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/) named `megt…hb.img`, 129,761,280 bytes each, 2,076,180,480 bytes in all (about 2.1 GB). Or one USGS file at 463 m: [Mars_MGS_MOLA_DEM_mosaic_global_463m.tif](https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif), 2,125,771,142 bytes, readable in parts. The prototype already reads small windows straight from the USGS HRSC–MOLA 200 m file (11,384,463,908 bytes) without downloading it. Keep that. |
| MODIS albedo (MCD43C3), "size to check" | **Confirmed, too big: cut** | 205 MB per daily file (NASA's catalogue, latest file). A year is about 75 GB. Do instead: POWER has its own surface albedo, `ALLSKY_SRF_ALB`, in the files we already use. |
| Other sizes in plan §4 | **Confirmed** | From NASA's catalogue tonight: MOD11C3 73.6 MB a month (about 0.9 GB a year, as planned); MOD13C2 100.6 MB a month; MOD10CM 2.0 MB a month; EMIT L3 v002 21.8 MB. The 0.05° land-cover file MCD12C1 is 1,187 MB a year. |
| GLiM rock map | **Confirmed** | [PANGAEA 788537](https://doi.org/10.1594/PANGAEA.788537) is the version already gridded to 0.5°, the same as our grid; CC BY 3.0; one [zip](https://hdl.handle.net/10013/epic.39939.d001) (size not checked). No login. This is the dataset the prototype's failed Moon check asks for. |
| GRIP4 roads licence | **Not checked** | Proposed for cutting (change 15), so no time spent. |

### Ground strength stand-in

| World | Result | What to show |
|---|---|---|
| Mars | **Resolved as a label** | Thermal inertia is NASA's own stand-in. Every Mars landing site has had to clear 100–140 J m⁻² K⁻¹ s⁻½ so that the ground is load-bearing and not metres of loose dust ([Golombek et al. 2020](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020JE006502); the InSight site paper, [Golombek et al. 2017](https://sharad.psi.edu/~ibsmith/pubs/Golombek_SSR_2016.pdf), has the same rule in its requirements table). Show each target's TES value against that line. |
| Earth | **Partly resolved** | An Earth thermal-inertia estimate from day–night temperatures is not in TES units unless it's converted, and the plan names no formula. If the build thread finds a published conversion and it gives sensible values for dry sand and bare rock, score thermal inertia once (under Heat swing, as the team plan has it) and read ground strength from it. If not, show both as "not scored" and tell the team: benchmark 4 is then met on minerals and aridity only. One NASA-hosted Earth dataset could back a label: [soil and regolith thickness at 1 km](https://doi.org/10.3334/ORNLDAAC/1304) (ORNL DAAC), which separates bare rock from deep soil. It has no Moon or Mars match, so it can't be scored. |
| Moon | **Unresolved: keep as "not scored"** | No map exists. One study measured it in permanently shadowed ground from boulder tracks ([Sargeant et al. 2020](https://doi.org/10.1029/2019JE006157)). The summaries I found disagree on its numbers, so read the paper before quoting one. |

### Test places marked * in appendix A

`pipeline/sites.json` has already replaced most of these. The distance is from our point to the coordinates on the named Wikipedia article, measured tonight.

| Place | Use this position | Result |
|---|---|---|
| Mistastin crater | 55.8863, −63.3283 (central island) | Confirmed: 1.8 km from the article's point |
| Lofoten | 68.10, 13.30 | Confirmed as a point in the islands: the article lists 68.0833, 13.3333. It's a region, so label it "representative point" |
| Black Point lava flow | 35.68, −111.36 | Not re-checked (NASA Earth Observatory page) |
| Cinder Lake crater field | 35.3066, −111.5048 | Not re-checked (USGS drone-survey dataset) |
| Kilbourne Hole | 31.97, −106.97 | Confirmed: 0.5 km |
| Sedan crater | 37.18, −116.05 | Confirmed: 0.5 km |
| Ries crater | 48.88, 10.57 | Confirmed: 0.4 km |
| Lanzarote | 28.99, −13.79 (Timanfaya lava fields; the plan's 29.16, −13.45 is outside them) | Confirmed: 0.6 km |
| Mauna Kea | 19.82, −155.47 | Confirmed: 0.2 km |
| Askja | 65.05, −16.75 | Confirmed: 2.4 km |
| Yungay, Atacama | −24.0804, −69.9412 | Not re-checked (paper PMC6232106) |
| Bockfjorden, Svalbard | 79.43, 13.33 | Confirmed: 4.3 km from the fjord's point, between the two spring groups |
| Tso Kar | 33.30, 77.98 | Confirmed: 0.3 km |
| Puga Valley | 33.22, 78.31 | **Unresolved.** Its source is a GeoNames search page, not a record, and Wikipedia gives no point. Find the geothermal field in a paper, or drop it |
| Kangerlussuaq | 67.00, −50.70 | Confirmed: 1.1 km |
| Makgadikgadi | −20.70, 25.90 | **Unresolved.** 60 km from the article's point (−20.80, 25.33) and not confirmed to be on a pan. Use the article's point or check on a map |
| Argentine Puna | −26, −67 | **Unresolved.** A whole plateau, 285 km from the article's point. The challenge asks for one valley or crater. Replace with a named Puna site from a paper, or drop it |
| Death Valley | 36.2469, −116.8169 (valley floor) | Confirmed: same as the article |
| Craters of the Moon | 43.4617, −113.5627 | Confirmed: same as the article |
| Kīlauea Iki | 19.4139, −155.246 | Not re-checked (Wikidata Q1333175) |
| Bletterbach | 46.35, 11.43 | Confirmed: 0.9 km |
| Six plain deserts | as in `sites.json` | Thar, Rub' al Khali and Kalahari match their article's point exactly. Grand Erg Oriental, Simpson and Great Victoria are 154, 64 and 220 km from theirs. **Suggestion:** move those three to the article's point so every desert has a named source |

Also checked, though not starred:

- **Gypsum Hill.** A search tonight found four papers giving 79°24′30″N, 90°43′05″W (79.4083, −90.7181), for example [this one](https://aem.asm.org/content/74/22/6898); I read the search results, not the papers. Our point is about 1 km away, which is fine, but its listed source is the island's Wikipedia page. Point it at the paper.
- **Rio Tinto** (37.683, −6.583) and **Emi Koussi** (19.7925, 18.5464) match their articles exactly. **Manicouagan** is 0.7 km from its article's point.
- **Nain anorthosite** stays an estimate: no published point for the rock body, and ours is 4 km from the town.
- **Lut kaluts** (30.53, 58.222) and **Umm Jirsan** (25.5888, 39.757) come from an IUGS page and a 2024 paper. Not re-checked.
- **Mars targets.** Jezero, Arcadia, Deuteronilus, Gale's centre and Arsia's summit all match the plan. **Protonilus Mensae** does not: the plan has 42.19, 48.06 and the article has 43.86, 49.4. Drop it; the prototype uses Deuteronilus only.

## Evidence for the changes above

### 1. Do the files agree? Every contradiction found

The team plan wins on ideas. Where the prototype differs from Claude's plan for a stated reason and it works, the prototype wins and the plan gets updated.

| # | Where | What disagrees | Who wins |
|---|---|---|---|
| C1 | `v1-spec.md:11,13`; `claudes-plan.md:288,298,309-322`; `guidelines.md:97` | "Working site today, Saturday", "before the event: download every file" and switch times from Saturday 10:00, against a build starting Saturday night with no data downloaded | The calendar. Change 1 |
| C2 | `v1-spec.md:111`, `claudes-plan.md:15,258` against `pipeline/build.py:29-37` | "Committed before the first run" against two runs already made, with the method changed between them | Honesty rule, `guidelines.md:44`. Change 5 |
| C3 | `team-plan.md:105`, `claudes-plan.md:27` against `pipeline/earth.py:47`, `README.md:11`, `PRODUCT.md:19` | Search all land on a 0.5° grid, against 64 hand-picked sites ranked | Team plan. Change 8 |
| C4 | `team-plan.md:13-19`, `claudes-plan.md:27` against `site/src/main.ts:44-45`, `pipeline/build.py:169` | Mission filters and hand-set weights, against a challenge picker with equal weights and no filters | Team plan. Change 7 |
| C5 | `team-plan.md:13` against `team-plan.md:107` and `claudes-plan.md:104` | Filters weight the challenges, or the traits? | Team decides; proposed wording in change 7 |
| C6 | `team-plan.md:15-17` against `team-plan.md:37,53,62` | Rover mobility lists Dust and Habitat structure lists ground strength and Shelter, but all three are unscored | Team decides. Change 7 |
| C7 | `v1-spec.md:62-64,70` against `v1-spec.md:141` and `CLAUDE.md` ("six benchmarks … are what we build to") | Three benchmarks in the "stretch" tier, against "each benchmark visibly met" | The benchmarks. Change 3 |
| C8 | `team-plan.md:45-46`, `claudes-plan.md:55` against `pipeline/challenges.py:104-111` | Dryness as its own challenge using an aridity index, against raw rainfall used only inside "Signs of life" | Team plan, with the formula fixed. Change 6 |
| C9 | `claudes-plan.md:56`, `v1-spec.md:62`, `challenge.md:34` against `pipeline/challenges.py:196-203` | Sunlight scored, against "not scored: every place on Earth averages 50%" | Prototype; its reason is right. Change 14 |
| C10 | `claudes-plan.md:58,113,144` against `pipeline/planets.py:26`, `README.md:48` | MOLA at 16 and 128 px (about 460 m), against the HRSC–MOLA blend at 200 m | Prototype. Change 14 |
| C11 | `claudes-plan.md:58,112,129`, `guidelines.md:68` against `pipeline/earth.py:42`, `README.md:44` | NASA elevation (SRTM, NASADEM) with Copernicus only near the poles, against Copernicus everywhere | Prototype: one source pole to pole, no login. Say on the site that this trait's Earth side is ESA data. Change 14 |
| C12 | `claudes-plan.md:57,130` against `pipeline/earth.py:34-40`, `README.md:43` | Bare ground from the MODIS vegetation index, against the MODIS land-cover map | Prototype. The vegetation index is fetched (`earth.py:39`) but never scored. Change 15 |
| C13 | `claudes-plan.md:24,189`, `v1-spec.md:72` against `PRODUCT.md:27`, `pipeline/planets.py:44-72` | Two targets (one combined south pole, Jezero), against 14 in a dropdown, three of them with no ground temperatures | Plan for the default view; keep the nine regions' values on the scorecard and put the rest under "more targets" |
| C14 | `claudes-plan.md:208,210` against `pipeline/planets.py:68,70` | Gale's centre and Arsia's summit, against the landing site and a cave opening | Prototype; both reasons are written in the code. Change 14 |
| C15 | `claudes-plan.md:357-423` against `pipeline/sites.json` | Appendix A still has the old starred positions | `sites.json`. Change 14 |
| C16 | `README.md:3,9` against `site/index.html:8`, `site/src/main.ts:26-27`, `site/package.json:2`, `PRODUCT.md:30` | Parallels, against "Analog Finder (working name)" and "name is a placeholder" | README. Change 16 |
| C17 | `README.md:32` against `site/src/main.ts:63` and `guidelines.md:26` | Claude drew the logo, against "nothing on this site is an AI-made image" and the visible-watermark rule | The official rule. Change 13 |
| C18 | `v1-spec.md:116-117`, `README.md:27` against this machine; `v1-spec.md:116` against `claudes-plan.md:353` | Saved login, Node 24 and Windows paths, against a Mac with none of them; "the user has an account" against an unticked open question | The machine. Change 10 |
| C19 | `claudes-plan.md:273` against `README.md:27` | Two different package lists, neither pinned | Whatever v1 uses, written down once. Change 20 |
| C20 | `claudes-plan.md:54,149` against the data | Moon thermal inertia from the Diviner regolith map, which doesn't reach the pole | The data. Change 9 |
| C21 | `challenge.md:35` against `pipeline/planets.py` | LEND, Mini-RF and LCROSS described as data layers, but only GRS is loaded | What's loaded. Change 17 |
| C22 | `claudes-plan.md:209` | Protonilus Mensae's position doesn't match its named source | Drop it. Change 15 |
| C23 | `guidelines.md:96` against `judging-notes.md:86` | "Day 2 keeps building" against "freeze features before the end"; no freeze time anywhere | Set one. Change 1 |
| C24 | `CLAUDE.md:9`, `docs/workflow.html:98` | "Once written, the plan" and "we are here: give the core idea" are both out of date | Change 19 |

No contradictions found on: the submission rules, the demo timing, the three awards, the scoring rule itself (`pipeline/scoring.py` matches plan §3), the "Earth can't copy" table, and the hosting choice.

### 2. Too bloated? Cut, merge or keep

| Item | Verdict | Why |
|---|---|---|
| Random sample values (`pipeline/build.py:40-43`) | **Cut** | They add scores that mean nothing and are the one place the site breaks its own rule |
| GRIP4 roads (`claudes-plan.md:66,161`) | **Cut** | Never scored, licence unchecked, large download. If "how hard to get there" stays, population alone can carry it as a label |
| MODIS snow, MOD10CM (`claudes-plan.md:60,131`) | **Cut** | POWER's frozen months already do this job in the prototype |
| MODIS vegetation index, MOD13C2 (`claudes-plan.md:57,130`) | **Cut** | Fetched by the prototype, used in no score; the land-cover map covers bare ground |
| MODIS albedo, MCD43C3 (`claudes-plan.md:133`) | **Cut** | 205 MB a day; POWER has albedo already |
| SHARAD (`claudes-plan.md:60`) | **Cut** | No file was ever named; GRS scores Mars ice and SWIM can label it |
| SWIM (`claudes-plan.md:151`) | **Keep as a label**, only if Arcadia is built | Can't be scored: Earth has no matching measure |
| Obu permafrost map (`claudes-plan.md:60,79,160`) | **Merge** (suggestion) | Northern Hemisphere only. A POWER rule (yearly mean ground temperature below 0 °C) tags frozen ground on the whole globe from NASA data. Keep Obu as a cross-check if time allows |
| Reverse mode (`claudes-plan.md:42`, `v1-spec.md:64`) | **Cut from v1** | With two or three targets it tells the user almost nothing. Mention it under "what's next" |
| Stability badge (`claudes-plan.md:263`) | **Merge** into "How we checked it" | The 1,000-run test is good science and cheap. A badge on every card is one more thing a newcomer has to decode; one sentence in the check section does the same job |
| 14 targets in one dropdown (`pipeline/planets.py:44-72`) | **Merge** | Default to the south pole and Jezero; the rest behind "more targets" |
| Challenge picker next to mission filters | **Merge** | See change 7 |
| Industrial sites as its own challenge (`team-plan.md:58-61`) | **Keep the idea; suggestion: show it as a line under Surface** | It's scored against ideal flat ground, not against the Moon (`pipeline/challenges.py:214-215`), so it isn't a similarity match like the others. The team's call |
| Second rival scan (`v1-spec.md:28`) | **Cut** | Plan §1 already covers the three serious rivals |
| Spec §9 "Rules to keep" and §10 sub-list (`v1-spec.md:121-128,137-143`) | **Merge** into pointers | Word-for-word repeats of guidelines §1–3, §7 and `CLAUDE.md` |
| `challenge.md` "Competition" (lines 68-70) | **Cut** | Repeats plan §1 and `judging-notes.md:14` |
| `PRODUCT.md` | **Keep, update** | The design step reads it, and four lines are out of date |
| Workflow chart | **Keep, fix the marker** | Still useful as the one-page picture |
| `judging-notes.md` hackathon list (lines 78-90) | **Keep** | Reference only, costs nothing; item 5 (freeze features) is the one to act on |
| `guidelines.md` §4 "What the plan must settle" | **Keep** | One item is still open: the single sentence a judge could repeat. The README has three sentences where one is asked for |
| Zoom stage, headline hunt, clustering, hand-set weights, terrain types, seasons | **Keep** | Each is asked for by the challenge or the guide, and each is grounded in data we have |

### 3. Straying, and what's asked for that we don't cover

**The six benchmarks, as the prototype stands:**

| # | Benchmark | State | What's missing |
|---|---|---|---|
| 1 | At least 3 open archives | **Met** | Already five in use. Say so on the site in the guide's words |
| 2 | Map and index 4 terrain types | **Not met** | No tags yet. Needs GLiM (volcanic and evaporite rock), the fixed aridity index, and a cave list. "Earth caves from papers" (`claudes-plan.md:80`) names no source; only two caves are in `sites.json` (Surtshellir, Umm Jirsan). A handful more, each with a sourced position, would make caves a real fourth type on the map |
| 3 | Dashboard with rankings, coordinates and metadata overlays | **Mostly met** | Rankings and coordinates are there. The map has pins only; the planned colouring of all land supplies the overlay |
| 4 | Weighting and clustering; thermal inertia, minerals, aridity | **Not met** | Weights are all equal, there is no clustering, minerals are sample values, there is no thermal inertia and no aridity index. This is the largest gap, and the one the failed check points at |
| 5 | Seasons in the matching | **Not met** | Nothing yet. Cheap once the POWER monthly values are on the grid. The guide says "within the matching algorithm", so the year-round factor has to touch the score, as the team plan says |
| 6 | Mission filters | **Not met** | See change 7 |

**The seven questions:** 1, 3, 4 and 5 are answered honestly. 2 over-claims (change 17). 6 leaves out the "weathering index" the guide names (change 17). 7 is answered, but the check itself currently fails and the test sites cite no field reports (changes 5 and 18).

**The five judging criteria:**

- **Impact:** covered. "What to test there" on the scorecard is the line that carries it.
- **Creativity:** rests on the headline find. None exists yet, and the fallback (headline the check) only works if the check passes or fails in an interesting, well-explained way.
- **Validity:** the public check is our strongest card and today it fails. That is fine if shown plainly; it is a problem if the wording still says "first run" (change 5).
- **Relevance:** NASA data does the main work on climate, land cover, minerals and both planets. Earth terrain is ESA data and rock is a university map; both are properly credited, and the site should say so in one line.
- **Presentation:** the page is "most of the score" and no page text exists (change 11).

**Drifting from the brief:**

- "How hard it is to get there" isn't asked for anywhere. Keep it to one line, or cut it.
- The railgun example is the team's idea and stays. As its own Moon-only challenge scored against an ideal, it sits outside the similarity question the judges are scoring.
- A second rival scan and a design gate that blocks the pipeline spend the night on things the judges never see (change 12).

**Asked for, not covered, and fine to leave:** Martian valley networks (already under "to consider" in the team plan) and processes as analogs beyond dust and freeze–thaw. Name both under "what's next" on the page.

**Suggestion, not checked in full:** the Moon's "Water" part has no real data layer yet. NASA PDS hosts [Lunar Prospector neutron maps](https://pds-geosciences.wustl.edu/missions/lunarp/reduced_special.html). I confirmed the page lists neutron counting-rate products, but not whether a ready-made hydrogen map is among them. A 15-minute look could turn question 2's answer from "cited" into "loaded".
