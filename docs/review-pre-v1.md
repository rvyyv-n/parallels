# Review before the v1 build

Written Saturday 14 November 2026, covering `main` at commit `f540557`. Its changes 1–14 were applied to the plans and the spec on 15 November (commit `5442218`), so only its data checks are kept here. The rest is in git history.

The two changes left for after v1: change 15, a source for why each known analog counts as one, is now the `used_for_source` field on every known analog in `pipeline/sites.json`. Change 16, the project page text, is covered by [guidelines §5](guidelines.md#5-the-project-page-and-demo) and the checklist in [§7](guidelines.md#7-before-we-click-submit-for-judging).

## Data holes

Checked on 14 November by opening each link or reading its file header. "Not re-checked" means the value comes from the source named in `pipeline/sites.json` and I did not open that source again.

### Datasets

| Hole | Result | Link, size and notes |
|---|---|---|
| TES thermal inertia (Mars) | **Confirmed** | NASA PDS, dataset `MGS-M-TES-5-TIMAP-V1.0` (Putzig and Mellon, 2007 maps). Night map: [global_ti_night_2007.img](https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img), 51,840,000 bytes. Day map the same size; two masks at 25,920,000 bytes each; the [whole set as a zip](https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001.zip) is 69,628,554 bytes. 7,200 × 3,600 pixels, 20 per degree (about 3 km), pole to pole, 16-bit integers, units J m⁻² K⁻¹ s⁻½. Multiply by the mask to drop filled-in pixels. [Overview page](https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html). |
| Diviner regolith properties (Moon) | **Unresolved for our targets** | The maps exist: [Hayne's project page](https://phayne.github.io/projects/5_lunar-regolith/) links a [Google Drive folder](https://drive.google.com/drive/folders/1DTnMB_fWTUmRcc-abtbiFxXNZZ8dSHXv) (it opens; 128 pixels per degree, 32-bit, sizes not listed). But they cover 70°S to 70°N only, and the Artemis regions are at 84–89°S. Do instead: don't score Moon thermal inertia. Show the paper's Moon-wide average, 55 ± 2 J m⁻² K⁻¹ s⁻½ at 273 K ([Hayne et al. 2017 abstract](https://arxiv.org/abs/1711.00977)), labelled "Moon-wide average; not mapped at the pole". |
| SWIM ice maps (Mars) | **Confirmed, site is back up** | [Products page](https://swim.psi.edu/SWIM4MIMProducts.php), last updated 4 August 2025. Direct files: [0–1 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_0_1.tif) 70,995,807 bytes; [1–5 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_1_5.tif) 70,995,807 bytes; [deeper than 5 m](https://swim.psi.edu/output/SWIM4MIM/Global/Composite/SWIM4MIM_Ci_5.tif) 70,995,794 bytes. 3,000 m pixels, 60°S to 60°N, 0–360°E, no-data value −30. Jezero, Arcadia and Deuteronilus are inside the coverage. Two cautions: the value is "ice consistency" (how far the datasets agree that ice is there), not an amount of ice, and Earth has nothing like it, so it can be a label or map layer but not a score. The page states no licence or DOI; it cites Morgan and Putzig et al. 2025. I did not confirm the value range; read it from the file. |
| MOLA 128 px size | **Confirmed, and not needed** | PDS: [16 height tiles](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/) named `megt…hb.img`, 129,761,280 bytes each, 2,076,180,480 bytes in all (about 2.1 GB). Or one USGS file at 463 m: [Mars_MGS_MOLA_DEM_mosaic_global_463m.tif](https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif), 2,125,771,142 bytes, readable in parts. Better: read small windows straight from the USGS [HRSC–MOLA 200 m file](https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif) (11,384,463,908 bytes) without downloading it. The prototype's code for that worked (kept in the tag `archive/prototype`). |
| MODIS albedo (MCD43C3), "size to check" | **Confirmed, too big: cut** | 205 MB per daily file (NASA's catalogue, latest file). A year is about 75 GB. Do instead: POWER has its own surface albedo, `ALLSKY_SRF_ALB`, in the files we already use. |
| Other sizes in plan §4 | **Confirmed** | From NASA's catalogue: MOD11C3 73.6 MB a month (about 0.9 GB a year, as planned); MOD13C2 100.6 MB a month; MOD10CM 2.0 MB a month; EMIT L3 v002 21.8 MB. The 0.05° land-cover file MCD12C1 is 1,187 MB a year. |
| GLiM rock map | **Confirmed** | [PANGAEA 788537](https://doi.org/10.1594/PANGAEA.788537) is the version already gridded to 0.5°, the same as our grid; CC BY 3.0; one [zip](https://hdl.handle.net/10013/epic.39939.d001) (size not checked). No login. This is the data the prototype's failed Moon check asked for. |
| GRIP4 roads licence | **Not checked** | Cut from the plan, so no time spent. |

### Ground strength stand-in

| World | Result | What to show |
|---|---|---|
| Mars | **Resolved as a label** | Thermal inertia is NASA's own stand-in. Every Mars landing site has had to clear 100–140 J m⁻² K⁻¹ s⁻½ so that the ground is load-bearing and not metres of loose dust ([Golombek et al. 2020](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020JE006502); the InSight site paper, [Golombek et al. 2017](https://sharad.psi.edu/~ibsmith/pubs/Golombek_SSR_2016.pdf), has the same rule in its requirements table). Show each target's TES value against that line. |
| Earth | **Partly resolved** | An Earth thermal-inertia estimate from day–night temperatures is not in TES units unless it's converted, and the plan names no formula. If the build thread finds a published conversion and it gives sensible values for dry sand and bare rock, score thermal inertia once (under Heat swing, as the team plan has it) and read ground strength from it. If not, show both as "not scored" and tell the team: benchmark 4 is then met on minerals and aridity only. One NASA-hosted Earth dataset could back a label: [soil and regolith thickness at 1 km](https://doi.org/10.3334/ORNLDAAC/1304) (ORNL DAAC), which separates bare rock from deep soil. It has no Moon or Mars match, so it can't be scored. |
| Moon | **Unresolved: keep as "not scored"** | No map exists. One study measured it in permanently shadowed ground from boulder tracks ([Sargeant et al. 2020](https://doi.org/10.1029/2019JE006157)). The summaries I found disagree on its numbers, so read the paper before quoting one. |

### Test places with estimated positions

`pipeline/sites.json` has already replaced most of these. The distance is from our point to the coordinates on the named Wikipedia article.

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

- **Gypsum Hill.** A search found four papers giving 79°24′30″N, 90°43′05″W (79.4083, −90.7181), for example [this one](https://aem.asm.org/content/74/22/6898); I read the search results, not the papers. Our point is about 1 km away, which is fine, but its listed source is the island's Wikipedia page. Point it at the paper.
- **Rio Tinto** (37.683, −6.583) and **Emi Koussi** (19.7925, 18.5464) match their articles exactly. **Manicouagan** is 0.7 km from its article's point.
- **Nain anorthosite** stays an estimate: no published point for the rock body, and ours is 4 km from the town.
- **Lut kaluts** (30.53, 58.222) and **Umm Jirsan** (25.5888, 39.757) come from an IUGS page and a 2024 paper. Not re-checked.
- **Mars targets.** Jezero, Arcadia, Deuteronilus, Gale's centre and Arsia's summit all match the plan. **Protonilus Mensae** does not: the plan has 42.19, 48.06 and the article has 43.86, 49.4. Drop it.
