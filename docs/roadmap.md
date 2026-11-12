# Dotcatcher roadmap

Plan for our NASA Space Apps 2026 entry (challenge "Planet X and SPHEREx", 14–15 November 2026). Written 12–13 November 2026 from the notes in [`research/`](research) and probes run that day.

How to read the evidence tags:

- **[measured]** we ran it on 12–13 Nov against the real service or real files.
- **[literature]** taken from a paper; values marked *(from memory)* still need checking against the source.
- **[assumed]** our choice or guess; change it if you disagree.

## What changed since the research notes

Four findings from the probes shape everything below.

1. **IRSA publishes no per-image depth.** `spherex.plane.metrics_maglimit` exists but is NULL in all 1,607,635 rows [measured]. We compute depth ourselves from each image's VARIANCE and PSF. Our numbers for one field: 18.3–18.8 AB per visit at 0.75–3.8 µm, 17.4–17.6 at 3.8–4.4 µm, 16.8–17.1 at 4.4–5.0 µm.
2. **A browser can read NASA's image archive directly, but not IRSA's search or JPL.** The S3 archive allows cross-origin reads. IRSA and JPL send no CORS headers, IRSA table queries take 20–150 s (server queueing, so event day won't be faster), and JPL's policy forbids embedding its APIs in a website [measured]. So the site loads its pixels live from NASA, and the slow lookups are done ahead or go through a small caching proxy.
3. **Subtracting two images pixel by pixel doesn't work well enough.** Even at matched wavelength, every star leaves a residual of 0.2–0.3 × its peak signal-to-noise, because SPHEREx's 6.15″ pixels undersample the PSF [measured on 6 pairs]. The detector is therefore forced PSF photometry in the matched reference frame; the difference image is for display.
4. **Planet Nine is 3–7 magnitudes too faint per visit**, not 3–5. With a realistic methane-dark albedo it's 5–7. The calculator is a sensitivity tool ("how far out could SPHEREx have seen *this* planet?"). It can't honestly claim an exclusion map, so the pitch line "which parts of the predicted region it rules out" has to go (see [open decisions](#open-decisions)).

## 1. Product scope

**What it is.** A public website on real SPHEREx data: *every moving dot, explained*. A visitor walks through four patches of sky. In each one they blink between two visits taken at the same wavelength, see what changed, and read why: known asteroid, moving star, glitch, or unexplained. Then they try to hide a planet from SPHEREx and see how far out it would have to be.

**For whom.** First the Space Apps judges and the curious public: no astronomy needed, one link, works on a phone. Second, people who know the data: every label carries its evidence, and every number says where it came from.

### Features

| Rank | Feature | Gap it fills |
|---|---|---|
| **Must** | **M1. Guided tour** of four pre-computed real fields, in plain language, from the landing page | public-friendly on real data |
| **Must** | **M2. Matched-wavelength blink**: science frame, reference frame and difference, with both wavelengths, the mismatch in bandwidths, and both dates on screen | wavelength-matched comparison |
| **Must** | **M3. Every dot labelled**: known asteroid/comet, moving star, glitch or unexplained, each with an evidence card and the list of checks it went through; a per-field tally ("41 changes: 3 asteroids, 1 moving star, 35 glitches, 2 unexplained") | an explanation for every dot |
| **Must** | **M4. Planet X calculator**, in the browser: size or mass, distance, albedo preset → predicted brightness per SPHEREx band against our measured depth, and the maximum distance at which it would be seen | honest, interactive Planet X answer |
| **Must** | **M6. Live pixels from NASA**: every image on screen is read from NASA's public archive in the visitor's browser as they watch, with a "live from NASA" badge; a saved copy takes over if the archive doesn't answer | real data, visibly real |
| **Must** | **M5. Honesty layer**: a "how we know" page with the method, the validation results, the limits, and what is uncertain | credibility with judges |
| Should | **S0. Explore any position, live**: type coordinates or click the sky; a small proxy asks IRSA which images cover it (about a minute, with progress shown), the browser pulls the pixels from NASA and blinks a matched pair; known asteroids come from IMCCE SkyBoT. No star or depth labels in this mode, and the page says so | the most impressive thing a judge can try themselves |
| Should | **S1. Depth along the predicted Planet Nine band**: about 20 sample points, showing the reach for the chosen planet at each | "where could it hide" |
| Should | **S2. Injection test** on one field: fake sources added and recovered, giving a measured detection rate | answers Driftnet's "Limits" page |
| Should | **S3. Track view**: the asteroid's linked detections drawn over JPL's predicted path | makes "known asteroid" visible |
| Should | **S4. Planet X pair search** on the search-region field: look for a source that appears in one pass and reappears at the parallax-shifted position in the next; report the result, expected to be none | a real null result |
| Cut | All-sky index, ML ranking, shift-and-stack search, LLM-written summaries, accounts, reporting candidates to the MPC, CWAVE calibration files | none wins a judging criterion in 48 h |

The should-haves are built in the order S0, S3, S1, S2, S4, and only after checkpoint C4.

### How we beat the strongest three

| Competitor | Their strength | Where we win |
|---|---|---|
| **Driftnet** | Full detect, link, vet, JPL pipeline; live site | Many of its 596 candidates have `known_object_checked: false`; ours all list every check run. It never states the flux gap to Planet Nine; we make it interactive. It sidesteps wavelength; we match per source. Its UI is dense; ours is a guided tour. |
| **Muninn** | Reads FITS in the browser; says plainly it can't find Planet Nine | It has no public URL. It matches by band only; we match by wavelength at the source's pixel. It quotes one depth, 17.60 AB; we measure depth per image and per detector, and its number matches only our 3.8–4.4 µm detector. |
| **spherex-timelapse** | Sky-wide index; recovers Pluto | No Planet X angle, no star or glitch labels, partial wavelength handling. We don't try to match its all-sky coverage. |

We lose on code volume, and on breadth unless S0 ships. The labelled tour is the part that must not fail in front of a judge, so it never waits on a slow service.

## 2. Architecture

```
fields.yaml
  → index     IRSA TAP, one query per field, cached        → cache/tap/
  → resolve   datalink or S3 listing → S3 key per image    → cache/keys.json
  → fetch     S3 byte ranges: header, IMAGE, FLAGS, VARIANCE, WCS-WAVE, one PSF zone
  → wave      wavelength and bandwidth at each source
  → match     per source: reference frames within 0.25 bandwidths, other time
  → detect    per-exposure detection, forced PSF photometry in the reference
  → label     FLAGS → Gaia DR3 → JPL SBIdent → JPL Horizons → unexplained
  → depth     5σ point-source limit per image
  → emit      site/public/data/fields/<id>/{manifest.json, fallback.f32, flags.u8, thumb.png}
  → check     schema check + validation tests → git push → host builds the site
```

| Choice | Decision | Reason | Rejected |
|---|---|---|---|
| Pixels | **Live from NASA's S3 archive, in the browser.** The manifest gives each exposure's S3 URL, byte range and placement; the browser fetches about 1 MB per frame | Real NASA data, visibly live, and S3 is fast (about 1 s) and allows it | Serving only our own copies (kept as the fallback) |
| Search, labels, measurements | **Pre-computed** by a Python pipeline on our laptops during the event | IRSA takes 20–150 s and JPL forbids browser use; a judge shouldn't wait on either | Doing these live on the tour |
| Backend | **One small Vercel function**, used only by explore mode (S0), proxying IRSA's image search with a cache | The only way a browser can reach IRSA | A general backend |
| Front end | **Vite + React + TypeScript**, single page, hash routes | Claude writes it reliably; nothing to configure | Next.js (server rendering adds nothing) |
| Image rendering | **Canvas 2D** from raw float32 arrays, stretched in JS; SVG overlay for markers. Each frame is drawn through the rotation and shift stored in the manifest, so frames from different passes line up | A 128×128 cutout redraws in under 1 ms, so stretch and blink are live and hover shows true values | WebGL (overkill); baked PNGs (no real values) |
| Fallback copy | One `fallback.f32` per field (the same cutouts, saved by the pipeline) plus a `uint8` flag-category mask | If S3 is slow or down the tour still works, and the badge changes to "saved copy" | No fallback |
| Hosting | **Vercel hobby** on the lead builder's account, connected to the GitHub repo | Reachable from this PC, no workflow file to write, preview URL per branch, and it runs the S0 function | GitHub Pages (fallback for the static part only); Cloudflare Pages (untested from this PC) |
| Data location | In the repo under `site/public/data` | About 30 MB for four or five fields | Object storage |
| Pixel access | S3 byte-range reads (`astropy.io.fits.open(url, use_fsspec=True)` and `.section`) | Skips the 4.9 MB PSF cube that every IRSA cutout carries; about 1 s per range | IRSA cutout service (4–13 s, 5 MB, intermittent 503): the fallback |
| Known objects | JPL SBIdent with the spacecraft position, then Horizons | Authoritative, and exact for SPHEREx's orbit | IMCCE SkyBoT (geocentric only): the fallback |

**Live in the browser:** the image pixels (S3 byte ranges), the stretch and blink, and the calculator's arithmetic. Reflected light falls as distance⁻⁴, so the maximum distance is a closed formula. In explore mode also the image search (through the proxy) and SkyBoT.

**Pre-computed:** image lists, S3 keys and byte ranges, frame placement, wavelengths, detections, labels and evidence, per-image depth, the depth table and solar magnitudes for the calculator, the Planet Nine band, and the fallback copies.

The S3 response hides its `Content-Range` header from scripts, so the browser can't discover file layout by itself; that is why byte ranges come from the manifest (tour) or from reading the fixed-size FITS headers in order (explore mode).

**Caching and manners.** Every network result is cached on disk, keyed by a hash of the request, so a rerun costs nothing. IRSA TAP queries run one at a time, all started in the first hour. JPL calls go through a single worker: one request at a time, a gap of at least 1 s, a descriptive User-Agent, never from the browser [JPL fair-use policy].

**The seam between the two streams.** `contract/schema.ts` (zod) defines the files above, and `contract/mock/` holds a hand-built fake field (a few stars, one moving dot, one glitch). Both are fixed in the first hour. After that the site is built against the mock and the pipeline's only obligation is that `npm run check-data` passes.

```
contract/   schema.ts, mock/
pipeline/   stages/*.py, fields.yaml, tests/, cache/ (gitignored)
site/       Vite app; public/data/ holds real artifacts; ?mock=1 uses contract/mock
```

Manifest sketch:

```jsonc
{"id":"ceres","title":"Ceres","mode":"track",
 "grid":{"w":128,"h":128,"scale_arcsec":6.15,"crval":[16.0,-5.4]},
 "epochs":[{"id":"e03","obs_id":"2025W35_1A_0432_4","detector":1,"mjd":60914.2132,
            "lambda_um":0.7437,"bandwidth_um":0.0178,"reference":"e17",
            "dlambda_bandwidths":0.08,"depth_ab_5sig":18.4}],
 "detections":[{"id":"d12","epoch":"e03","x":71.3,"y":40.8,"snr":9.2,"ab_mag":16.8,
   "kind":"new","label":{"class":"asteroid","name":"(1) Ceres",
     "summary":"A known asteroid, 3 arcseconds from where JPL says it should be.",
     "checked":["flags","gaia","sbident","horizons"],
     "evidence":[{"source":"JPL Horizons","sep_arcsec":3.1,"vmag":9.0,"rate_arcsec_h":41}]}}],
 "tour":[{"epochs":["e03","e17"],"focus":"d12","text":"…"}]}
```

Unverified: Vercel's current free-tier limits, in particular whether a hobby function may run long enough for a 20–150 s IRSA query (if not, S0 uses IRSA's asynchronous job interface and polls); whether `use_fsspec` range reads perform as expected on this PC; and S3 reads from a real browser (tested with curl only). All three are checked in the prototype.

## 3. Science method

### 3.1 Cutouts and wavelength matching

1. Query IRSA TAP for every Level 2 image covering the target: `where contains(point('ICRS', ra, dec), o.poly) = 1` [measured].
2. Get each image's S3 key from its datalink `cloud_access` entry, or by listing the S3 prefix `qr2/level2/<week>/`. The key can't be derived from `obs_id`: it contains a processing version that varies [measured].
3. Read the IMAGE header (first 80 KB) and compute the target's detector pixel with the celestial WCS (TAN-SIP).
4. Read wavelength and bandwidth at that pixel from the `WCS-WAVE` lookup: `WCS(header, fobj=hdul, key='W')` on a header copy **with the SIP keywords (`A_*`, `B_*`, `AP_*`, `BP_*`) deleted**. Leaving them in shifts the result by about 10 pixels [measured].
   - Check value: Barnard's Star position (RA 269.452, Dec +4.6934) in `2025W35_1A_0432_4`, detector 1, is pixel (1557.25, 2001.71), 0.74367 µm, bandwidth 0.01777 µm [measured twice, independently].
   - The lookup grid differs per detector (9×9 for D1 and D6, 11×11 for D2 and D5, 9×14 for D3, 13×20 for D4) and is indexed `[y, x]`. Use astropy's table handling; don't hard-code a grid [measured].
   - The table is the same in every exposure of a detector, except that D5 and D6 differ by up to 0.0064 µm between the qr2 and qr3 releases [measured].
5. **`WCS-WAVE` or CWAVE/CBAND?** Use `WCS-WAVE`. IRSA's `spectral_wcs` calibration files (CWAVE and CBAND maps, 33 MB per detector) differ from it by a median 0.0003 µm and 0.0008 µm at the 99th percentile on D1, about 1.5% of a bandwidth [measured]. The worst pixel differs by 0.05 µm, so the "how we know" page says which one we used.
6. **Match rule.** A reference frame matches a source if it covers the same sky position at a different time and its wavelength there is within **0.25 bandwidths**; relax to 0.5 if nothing qualifies, and beyond that call the source "unmatched". At 0.25 a star's flux changes by at most 2%, below the 3–5% photometric floor [measured]. The same detector is not required.
7. **Match per source, never per cutout.** Wavelength changes by one bandwidth every 120 pixels, and frames from different passes are rotated about 180°, so the mismatch between two frames swings by about one bandwidth per 60 pixels [measured]. The viewer shades the part of a cutout where the pair is out of tolerance.
8. **Movers.** Consecutive exposures of a moving object are each at a different wavelength. So each science frame gets its own reference: the same sky position, same wavelength, another time, when the object has moved on.

Matches are plentiful: Barnard's Star has 126 cross-pass pairs within 0.15 bandwidths [measured].

### 3.2 Detection and comparison

1. **Background.** Fit a plane per frame to unflagged pixels with 3σ clipping. The IMAGE plane still contains zodiacal light, and it doubles between passes [measured].
2. **Pixel mask** for fitting: FLAGS bits 0, 1, 2, 6, 9, 10, 11, 15, 17, 19 (about 2% of pixels). Don't mask on SOURCE (bit 21): it is set on 81–99% of pixels in a crowded field [measured].
3. **Candidates.** PSF-fit signal-to-noise ≥ 5 with σ = 1.1 × √VARIANCE (the variance plane is 6–13% too small [measured]); peak pixel ≥ 3σ; at least two pixels in the 3×3 ≥ 1.5σ; peak ÷ 3×3 sum ≤ 0.75.
4. **PSF model.** The PSF extension holds 121 zones on an 11×11 grid, oversampled ×10. Zone index = ⌊y/185.45⌋·11 + ⌊x/185.45⌋ in detector pixels. Integrate it over 10×10 sub-pixels, with no flip or transpose [measured by fit quality].
5. **Forced photometry.** Fit flux, position and background on a 5×5 stamp in the science frame. In the reference frame, fit flux and background at the same sky position. The header WCS alone registers frames to 0.03 pixels [measured].
6. **Change statistic.** χ = ΔF ÷ √(σ_S² + σ_R² + (0.1·F)²). A source is
   - **new** if F_R/F_S < 0.25 and |χ| > 5 and its fit quality is normal for its brightness,
   - **vanished** if the same holds from reference to science,
   - **brightness changed** if |χ| > 5 and the change is under 50%.

   On 943 stars in four matched pairs this gave 0 false "new" sources, and 0.3% of stars above |χ| = 5 [measured].
7. **Photometry.** F[Jy] = amplitude[MJy/sr·px] × 10⁶ × 8.90×10⁻¹⁰ sr; m_AB = 8.90 − 2.5 log₁₀ F.
8. **Display.** Resample the reference onto the science grid with Lanczos-3 and show (S − R) ÷ √(V_S + V_R). Bright stars leave visible residuals; the tour says so rather than hiding them.

**Fallback if matching fails:** call a detection static if any deeper frame at any wavelength shows at least a quarter of its flux at that position. This is Driftnet's approach. It answers "is something there" but can't judge brightness changes.

### 3.3 Linking

- **Within a sequence** (2–4 exposures, 2.1 minutes apart): rates of 12–125″ per hour, positions on a straight line within 3σ. Ignore flux, because each frame is at a different wavelength. Chance alignments are negligible here, about 2×10⁻⁵ per cutout.
- **Across sequences** hours apart: about 3 chance alignments per cutout are expected, so a link needs four or more points or a JPL prediction.
- Expected false tracklets: E ≈ N₁ · ρπ(v_max² − v_min²)Δt² · ρπr², with ρ the density of unexplained detections and r = 3σ_pos.
- A repeat at the same *detector* pixel in consecutive exposures is persistence or a hot pixel, not a mover.
- Position error: about 9″ ÷ signal-to-noise.

### 3.4 Labels, in this order

| # | Label | Rule | Card shows |
|---|---|---|---|
| 1 | **Glitch** | Any pixel of the central 3×3 has TRANSIENT, SUR_ERROR, MISSING_DATA, HOT, NONFUNC, PERSIST or OUTLIER set; or peak ÷ 3×3 > 0.75; or the same detector pixel fires again within 24 h. OVERFLOW or NONLINEAR means saturated: shown as "too bright to measure" | the bits that fired, in plain words |
| 2 | **Known asteroid or comet** | JPL SBIdent, two-pass, once per sequence, with `xobs` = header `X_SC…VZ_SC` and the time from `DATE-AVG`; match within 2 pixels after applying the returned rates. Confirm with Horizons, `CENTER='500@-163182'`; accept within max(1 pixel, 3σ) | name, predicted position, offset, rate, magnitude |
| 3 | **Moving star** | A Gaia DR3 star, moved to the exposure date with proper motion and parallax, matches within max(2″, 3σ_pos) and wouldn't match unmoved; or the measured shift between passes agrees with Gaia | Gaia ID, proper motion, both predicted positions |
| 4 | **Known source, brightness changed** | A catalogue source at the same place in both epochs | both fluxes |
| 5 | **Unexplained** | Everything left | nearest catalogue source, the magnitude limit of the JPL check, flux at every epoch |

Facts behind these rules [all measured]:

- The header position is geocentric ICRF equatorial, in km. It agrees with Horizons for SPHEREx (`-163182`) to 2.09 km, so it goes straight into SBIdent's `xobs`.
- The spacecraft position matters: from a 7,000 km orbit an object shifts 6.5″ (one pixel) at 1.5 au and 195″ at 0.05 au.
- SBIdent takes at least 18 s per call, 30–50 s two-pass. Declination uses an `M` prefix for negatives (`M21-41-45.5`). Rates come back in arcseconds per hour, whatever the docs say.
- Gaia DR3 through IRSA TAP (`gaia_dr3_source`) works in 20–160 s. ESA's own archive was down on 12 Nov.
- The smallest proper motion we can show is about 4″ per year between adjacent passes and 2″ per year across a year, for bright unsaturated stars.

FLAGS bit meanings come from the header comments. Our reading of TRANSIENT as a cosmic-ray hit and OUTLIER as a residual spike is a guess.

### 3.5 Depth per image

m₅ = 8.90 − 2.5 log₁₀(5 · σ_pix · 10⁶ · Ω · √NEA)

σ_pix is the median √VARIANCE × 1.1 over unflagged pixels, Ω = 8.90×10⁻¹⁰ sr, and NEA = 1 ÷ ΣP² for the pixel-integrated PSF, averaged over sub-pixel positions.

Measured in the Barnard's Star field (Galactic latitude 15°, two passes):

| Detector | Wavelength µm | NEA, pixels | 5σ depth, AB |
|---|---|---|---|
| D1 | 0.74–1.13 | 3.3 | 18.30–18.44 |
| D2 | 1.09–1.67 | 3.4 | 18.39–18.51 |
| D3 | 1.62–2.44 | 3.6–3.7 | 18.40–18.78 |
| D4 | 2.40–3.86 | 4.4–4.6 | 18.66–18.77 |
| D5 | 3.79–4.44 | 4.4 | 17.40–17.62 |
| D6 | 4.40–5.03 | 4.6–4.7 | 16.82–17.11 |

These agree within 0.3 mag with the mission's published full-survey depth scaled back to one visit (our scaling, not a published per-visit figure). They ignore source confusion, which is severe near the Galactic plane.

### 3.6 Planet X brightness model

Reflected sunlight only:

```
m_AB(λ) = m_sun(λ) − 2.5·log10 p(λ) − 5·log10(R / 1 au) + 5·log10(r·Δ)
Δ ≈ r   ⇒   m = m0 + 10·log10 r        (twice as far = 3.0 mag fainter)
r_max = 10^((m_lim − δ − m0) / 10)      (δ = 0.3 mag for about 90% completeness)
```

R is the radius, p the geometric albedo, r the distance from the Sun in au. SPHEREx looks 90° from the Sun, so Δ ≈ r and the phase angle is under 0.2°.

Sun at 1 au, AB, averaged over a SPHEREx-width channel [computed from the CALSPEC solar model]:

| λ µm | 0.75 | 0.9 | 1.25 | 1.6 | 2.2 | 3.5 | 4.6 |
|---|---|---|---|---|---|---|---|
| m_sun | −27.04 | −27.07 | −27.02 | −26.90 | −26.41 | −25.54 | −24.84 |

The formula reproduces Neptune's V magnitude to 0.04 mag and Pluto's to 0.2 mag against JPL Horizons, and the Brown et al. 2024 reference planet (V = 22.0) within its albedo range. We re-derived one table entry by hand and it matched.

**Albedo presets**

| Preset | Albedo | Note |
|---|---|---|
| Grey 0.4 (default) | 0.4 at all wavelengths | Optimistic in the infrared; labelled as an upper bound |
| Neptune-like | 0.20 at 0.75 µm, 0.02 at 0.9, 0.017 at 1.25, 0.02 at 1.6, < 0.001 at 2.2, about 0.004–0.01 at 3.6–4.5 | Methane absorption; realistic for a gas-rich planet. Best channel is then 0.75–0.83 µm |
| Dark icy | 0.1 | Typical distant small body |
| Bright icy | 0.6 | Pluto-like surface |

Neptune's albedo is from the Payne et al. 2025 composite spectrum and Spitzer photometry [literature]; its near-infrared albedo varies severalfold between epochs.

**Mass to radius.** Default R = 3.7 R⊕ × (M ÷ 10 M⊕)^0.33, a fit to Linder & Mordasini 2016. Also offered: R = (M ÷ 3 M⊕) R⊕, the convention Brown & Batygin use, which is about 0.9 mag fainter.

**Worked numbers**, J band (1.25 µm) unless stated:

| Planet | Distance, au | Grey 0.4 | Neptune-like at 0.75 µm | Neptune-like at 1.25 µm |
|---|---|---|---|---|
| Brown & Batygin reference, 6.2 M⊕, R = 2.07 R⊕ | 550 | 21.7 | 22.4 | 25.1 |
| Siraj et al. 2025, 4.4 M⊕, R = 2.8 R⊕ | 290 | 18.2 | 18.9 | 21.6 |
| Neptune clone | 300 / 500 / 800 | 17.7 / 19.9 / 21.9 | 18.4 / 20.6 / 22.6 | 21.1 / 23.3 / 25.3 |

Against a per-visit depth of 18.5 AB, a grey Neptune clone is visible to about 365 au and the reference Planet Nine to about 266 au. At its predicted 550 au the reference planet is 3.2 mag too faint at best and 6.6 with a Neptune-like albedo.

**Predictions drawn on the plot** [literature]:

- Brown & Batygin 2021: 6.2 M⊕, semi-major axis 380 au, perihelion 300 au, inclination 16°.
- Brown, Holman & Batygin 2024: Pan-STARRS, ZTF and DES together exclude 78% of the parameter space; what remains is 6.6 M⊕ at about 550 au, V ≈ 22.0.
- Siraj, Chyba & Tremaine 2025: 4.4 M⊕ at 290 au. The one prediction a full-mission SPHEREx stack might reach, if the planet is large and reflective.
- Sky band: the great circle with inclination 16° and node 97°, ±12° wide, densest around RA 45–70°.

**What a null result lets us say.** "A planet of this size and albedo, in this field on this date and closer than r_max, would have been above 5σ in this image." Saying "ruled out" also needs the pair search (S4) to come up empty, because in a single image a planet is one more static dot.

**Motion.** At 300–800 au a planet drifts 4–12″ per day at SPHEREx's viewing angle, so it is still within a day and shifts 9–23′ between passes six months apart. The search is for a pair: present in one pass, absent there in the next, present at the shifted position.

### 3.7 What is uncertain

Ranked by how much it could change what we show.

1. **Crowding.** Blended stars may flood "unexplained". Not yet measured in a clean field against a crowded one. Practice item P4.
2. **Near-infrared albedo of a Planet X.** 3.5–4 mag between grey and Neptune-like. Shown as presets, never hidden.
3. **Saturated stars.** Barnard's Star is saturated (28–56 masked pixels in a 9×9 box) and can't be measured; saturated stars also leave persistence ghosts.
4. **Thermal emission.** Left out. Fortney et al. 2016 models of a warm (50 K), methane-poor planet put about 19 AB at 3–4 µm regardless of distance; applies only above roughly 10 M⊕. Shown as a caveat. The magnitudes were read from a web rendering and the Vega-to-AB offsets are from memory.
5. **Depth away from the one field measured**, and source confusion.
6. **PSF model error** at high signal-to-noise, about 3% of flux; covered by the 10% floor in χ.
7. **SBIdent's time scale** is undocumented; the error is at most 1.5″.
8. **Rules.** The pre-event rule and the demo format were read second-hand (see [`research/rules.md`](research/rules.md)).

## 4. Demo fields

Each field was checked on 12 November with a real IRSA query, each image's own WCS, and the wavelength at the target's pixel [measured by a probe agent; the field verification was cut short, and we did not re-run its numbers by hand, so P1 and P2 re-check them].

"Matched group" means exposures whose wavelength at the target agrees within 0.25 bandwidths. For movers, "matched reference" means another exposure of the same sky position, at least a day away, within the stated tolerance.

| # | Field | Centre (RA, Dec) | Exposures | Matched wavelength | Status |
|---|---|---|---|---|---|
| 1 | **Asteroid: (1) Ceres**, V 8.7, moving 36″/h | follows Ceres; 7.44, −7.83 on MJD 61023.69 | 125 exposures contain it, MJD 61023.7–61041.6 (11–29 Dec 2025) | 124 of 125 have a reference within 0.25 bandwidths, mostly from the June–July 2026 pass, about 194 days later | **Pass** |
| 2 | **Interstellar comet 3I/ATLAS**, model magnitude 15.3, moving 152″/h | follows the comet; 173.81, +2.82 on MJD 61017.01 | 98 exposures contain it, MJD 61017.0–61024.0 (7–14 Dec 2025) | 94 have a reference within 0.5 bandwidths, 49 within 0.25, some only a day apart | **Pass** on coverage; brightness is a model value and it may be too faint to detect |
| 3 | **Moving star: Barnard's Star**, 10.4″ per year | 269.4463, +4.7671 (Aug 2025) | 353 contain it, over three passes | 29 matched groups, 15 of them spanning all three passes; for example 1.017 µm on MJD 60919.1, 61110.6 and 61277.8 | **Pass**, but the star is saturated (OVERFLOW flag on its core pixels) and moves only 1.7 pixels a year: fine to look at, not to measure |
| 4 | **Planet X search region**, on the Brown & Batygin band, Galactic latitude −40° | 51.0, +6.0 | 339 over three passes (Aug 2025, Feb 2026, Aug 2026) | 45 matched groups, 36 spanning three passes; for example 0.82 µm on MJD 60894.9, 61082.3 and 61260.5 | **Pass** |
| 5 | Backup moving star: **Kapteyn's Star**, 8.7″ per year | 77.919, −45.018 | 351 over three passes | 48 matched groups, 41 spanning three passes | **Pass** on coverage; saturation not checked |
| 6 | Backup moving star: **Teegarden's Star**, 5.1″ per year, fainter | 43.270, +16.864 | 326 over three passes | 40 matched groups, but only 8 of them at 0.75–2.4 µm | Coverage passes; saturation flags not checked |

Example evidence rows:

| Field | Science exposure | λ µm | Reference exposure | λ µm | Mismatch, bandwidths | Gap, days |
|---|---|---|---|---|---|---|
| Ceres | `2025W50_2A_0789_1` D3, MJD 61023.692 | 1.7542 | `2026W26_2B_0181_1` D3 | 1.7600 | 0.14 | 194 |
| Ceres | `2025W50_2A_0789_2` D3, MJD 61023.693 | 1.7950 | `2026W26_2B_0181_2` D3 | 1.8010 | 0.14 | 194 |
| Ceres | `2025W50_2A_0789_3` D3, MJD 61023.695 | 1.8373 | `2026W26_2B_0181_3` D3 | 1.8433 | 0.13 | 194 |
| 3I/ATLAS | `2025W50_1A_0002_1` D1, MJD 61017.005 | 0.7501 | `2025W50_1A_0238_2` D1 | 0.7532 | 0.17 | 1.0 |
| Barnard | `2025W35_1A_0146_2` D2, MJD 60912.72 | 1.5535 | `2026W11_2A_0501_4` D2, then `2026W34_1A_0363_2` D2 | 1.5534, 1.5479 | 0.00, 0.15 | 201, 358 |

Queries used:

```sql
-- fixed field
select obs_id, obs_collection, energy_bandpassname, t_min, t_max, access_url
from spherex.obscore o where contains(point('ICRS', 51.0, 6.0), o.poly) = 1

-- mover: everything near its path during the pass, then test each exposure against Horizons
select obs_id, obs_collection, t_min, t_max, s_region, access_url
from spherex.obscore o
where intersects(o.poly, circle('ICRS', 170.0, 4.2, 7.5)) = 1 and t_min between 61012 and 61027
```

Each took 40–100 s. Mover positions come from Horizons with `CENTER='@-163182'` at each exposure's mid-time.

**Not settled:**

- **Ceres saturates slightly**: 1–3 core pixels carry the OVERFLOW flag, so its position is usable but its brightness is not. Backups with the same method: (7) Iris (V 10.2; 144 exposures contain it, MJD 61004–61026; reference matching not finished), (2) Pallas, (15) Eunomia. Every Ceres frame also contains fainter known asteroids, which the JPL check will name.
- **No unsaturated moving star is confirmed yet.** Teegarden's Star is the candidate; check its flags in P5. If none works, Barnard's Star stays as a visual-only stop on the tour.
- **3I/ATLAS detectability.** It is the best story of the five, but at magnitude 15–17 it is near the noise in a single exposure. Brighter by JPL's model: C/2025 K1 (about 12.5, 16–21 Nov 2025; images exist, not analysed) and C/2025 R2 (about 11, but no images found). If it can't be detected, the comet stop is dropped and the tour has three fields.
- The ecliptic-pole deep field was not checked.

## 5. Prototype (13 November)

The prototype is a full attempt at the best version of this idea, built in this repo (to be renamed; the event repo takes the name `dotcatcher`). It is kept, public, and disclosed. The event build is still typed fresh in the new repo, following this roadmap, with no files copied across [assumed: this is what we agreed at the start; say if that changed].

**Rule risk, stated once.** The rule as we read it second-hand says teams may not begin work before the event. A few risky-part tests are easy to defend; a complete prototype rebuilt during the event is much harder, even with disclosure. The safest move is to ask the local organisers before submitting. The disclosure in §6 is written to describe a full prototype accurately.

One day is not enough for everything, so build in the order below and then continue down the event checkpoints (C0–C4 in §6). The first seven steps are the ones that can surprise us. Record findings as notes in `docs/research/`.

Already settled by the 12 Nov probes, so not repeated: the wavelength recipe, the spacecraft-position frame, the depth formula, the star-residual problem and the forced-photometry fix.

| Order | Risk | Goal | Pass | If it fails |
|---|---|---|---|---|
| P1 | **Data plumbing speed.** The whole build stalls if a field takes hours to fetch | Fetch 20 exposures of one field as S3 byte ranges (header, a 128-pixel IMAGE/FLAGS/VARIANCE section, WCS-WAVE, one PSF zone) | Under 5 s per exposure; wavelength check value reproduced | Use the IRSA cutout service with retry; budget 10 s per exposure |
| P2 | **Asteroid recovery, end to end.** The headline demo | For the asteroid field: detect, forced photometry in a matched reference, link | The asteroid is "new" in ≥ 3 exposures, each within 1 pixel of Horizons `@-163182`, and links into one track | Use a brighter or slower asteroid from §4; check the time convention |
| P3 | **JPL SBIdent with the header position** | One two-pass call for a P2 exposure | The asteroid is in the answer within 2 pixels; call finishes in under 60 s | Horizons for named targets, SkyBoT for the rest |
| P4 | **Unexplained count.** If it is dozens per field, the product reads as noise | Run detect and label on one pair in the Planet X field and one in a crowded field | ≤ 5 unexplained per 0.2° cutout in the clean field | Raise the threshold to 7σ; require two exposures; show the expected chance count |
| P5 | **Moving star** | Measure the shift of the unsaturated high-proper-motion star between passes | Shift matches Gaia within 3σ | Show Barnard's Star visually and say it is saturated |
| P6 | **Blink display.** Rotated frames on one grid | Lanczos-3 resample of a matched pair; float stack drawn on a canvas | Gaia stars land within 0.3 pixels of the peaks; empty-sky difference noise is 0.9–1.15σ | Show frames side by side instead of blinking |
| P7 | **Comet.** Extended, so PSF photometry may misbehave | Run detect on one comet exposure | Detected and matched to Horizons within 2 pixels | Label by position only; describe it as fuzzy |

After P7, add **P8**: read one frame's pixels from S3 in a real browser and draw it rotated into place (pass: under 3 s per frame, stars line up with the saved copy), and **P9**: the IRSA proxy on Vercel (pass: an answer or a polling job within the function's time limit). Then follow C0–C4. P1–P4 and P8 matter most.

## 6. Event build

**Timing assumption.** T+0 is kick-off, taken as Saturday 14 November 09:00 local. The plan submits at **T+36** (Sunday 21:00), which is safe whether the window is a full 48 hours or closes at Sunday midnight. Confirm the real deadline and the demo format on the event page; we couldn't load it.

**Roles.** The lead builder owns the repo (`rvyyv-n/dotcatcher`), the Vercel project and every decision, and directs both streams of work: a *Site* Claude session in `site/` and a *Data* Claude session in `pipeline/`, running side by side. The reviewer builds nothing. At each checkpoint the reviewer clicks through the deployed site on a phone and a laptop, tries to break it, checks the numbers on screen against the validation results, and reads the tour text as a newcomer. Problems go to the lead as a short list, most serious first. A change to `contract/` is made in one session and the other is told before it continues.

One person steering two sessions is the bottleneck. When both need attention, Data goes first, because Site can keep working against the mock. Commit and push after every working change. Claude also reviews at each checkpoint, using a separate session that hasn't seen the code.

| Time | Site session | Data session | Checkpoint (reviewer tests here) |
|---|---|---|---|
| T+0–1 | New public repo, Vite scaffold, first Vercel deploy. Write `contract/schema.ts` and the mock field | Start every IRSA TAP and Gaia query for all fields in the background | **C0:** a live URL showing the mock field |
| T+1–4 | Blink viewer on the mock: frames fetched from S3 by byte range, drawn rotated into place, stretch, science / reference / difference, markers | Fetch stage, wavelength (with the check value as a test), matched references | **C1 (T+4):** wavelength test green; one real field's frames load live from NASA on the deployed site |
| T+4–9 | Evidence cards, label filter, per-field tally, tour shell | Detection, forced photometry, new / vanished / changed, glitch labels | **C2 (T+9):** asteroid field live with detections and glitch labels; static-star false-change rate under 1% |
| T+9–13 | Planet X calculator with unit tests against the §3.6 table | JPL queue (SBIdent, Horizons), Gaia propagation, depth per image | **C3 (T+13):** asteroid within 1 pixel of Horizons and labelled; calculator matches the table; depth is 17–19 AB |
| T+13–15 | Tour copy, first pass | Start the batch run of all fields; it stops on any failed validation check | Decide which should-haves survive |
| T+15–22 | Sleep | Sleep | The batch only fetches and computes; nobody changes code unattended |
| T+22–26 | Landing page, tour flow, "how we know" page | Fix batch failures, remaining fields, depth table for the calculator | **C4 (T+26):** all fields live and labelled; calculator on real depth; full click-through works on a phone |
| T+26–30 | S0 explore mode (page and S3 reader), then S3 track view | S0 proxy function, then S1 band depth, S2 injection test, S4 pair search | Stop starting new things at T+29 |
| **T+30** | **Feature freeze** | **Feature freeze** | From here: fixes only |
| T+30–33 | Record the demo video; the reviewer tests in a clean browser | Write-up: description, data sources, disclosure, AI-use statement; README | Unfinished features are removed from the site, not left half-working |
| T+33–36 | Edit the video, upload | Final validation run, numbers on the "how we know" page | **Submit at T+36** |
| T+36–38 | Buffer | Buffer | Check the submitted links from another device |
| T+38–48 | Only if the window is still open: fixes, no features | | |

**If we're behind.** At C1: serve the saved copies and add live loading later. At C2: drop the comet field. At C3: drop all should-haves and Gaia parallax. At C4: ship the fields that pass validation, even if that is two.

**Checks that run on every push** (pipeline `pytest`, site `vitest`, `npm run check-data`):

1. Wavelength check value reproduced to 1e-5 µm.
2. Fewer than 1% of static stars flagged as changed; cross-pass offset under 0.3″.
3. The asteroid recovered within 1 pixel of Horizons in ≥ 3 exposures and labelled.
4. The moving star's shift matches Gaia within 3σ.
5. The calculator reproduces Neptune's V magnitude within 0.1 and the §3.6 table within 0.05.

### Demo script

Space Apps has in past years asked for a 30-second video or a short slide deck [assumed for 2026; confirm]. We record a 30-second cut and a 2-minute walkthrough.

**30 seconds**

| Time | On screen | Voice |
|---|---|---|
| 0–5 | Landing page, real sky | "NASA's SPHEREx photographs the whole sky again and again. Between visits, some dots move." |
| 5–13 | Asteroid field blinking; the label card opens | "Dotcatcher compares only images taken at the same wavelength, then explains each change. This one is the asteroid, three arcseconds from where JPL says it should be." |
| 13–19 | Tally and an unexplained card; the "live from NASA" badge as a new frame loads | "Asteroid, moving star, glitch, or unexplained. Every dot shows the checks it went through, on images loading straight from NASA's archive." |
| 19–27 | Calculator: slider pulled outward until the planet drops below the depth line | "Could SPHEREx see Planet X? Pick a planet. A Neptune out to about 360 times the Earth–Sun distance, yes. The predicted Planet Nine, no: it's twenty times too faint." |
| 27–30 | URL | "Every moving dot, explained. Real data, open source." |

**2 minutes** (live or recorded): the problem and why raw comparisons lie (20 s); asteroid field with blink, card and track (30 s); the moving star (15 s); a glitch and an unexplained dot, and what "unexplained" means (20 s); the calculator with two presets (25 s); the "how we know" page with validation numbers (10 s).

### Disclosure statement

For the submission, edited to match what we actually did:

> Before the event we researched the challenge: we surveyed other teams' public repositories, read the SPHEREx data documentation, and ran test queries against IRSA, JPL and Gaia to learn how the services behave. We chose our demo sky fields and wrote a detailed plan. On 13 November we also built a working prototype of the idea to learn from. We did not copy files from it: everything in this repository was written during the event, following our plan. The prototype, the plan and our research notes are public at [prototype repo URL] so you can compare them. We used Claude (Anthropic) as a coding assistant during the event and for the research beforehand. Data: SPHEREx Level 2 images (NASA/JPL-Caltech, via NASA/IPAC IRSA), JPL Small-Body Identification and Horizons, ESA Gaia DR3.

## 7. Risks and fallbacks

| Risk | Sign | Fallback |
|---|---|---|
| IRSA TAP slow or down | Queries over 5 minutes, or errors | All queries start at T+0 and are cached. Image lists can also come from listing the S3 bucket by week. The site never calls IRSA |
| S3 slow or unreachable from a visitor's network | A frame takes over 5 s | The viewer switches to the saved copy and the badge says so |
| Explore mode (S0) waits too long on IRSA | Over 2 minutes | Show progress and a "try a tour field" link; cache every answer; if the function limit is too short, poll an IRSA async job |
| IRSA cutout service returns 503 | About half of first attempts on 12 Nov | Not on the main path (we read S3). When used, retry after 3 s |
| S3 range reads slow | Over 5 s per exposure | Download whole files (14 s, 70 MB each) for the few exposures a field needs |
| Wavelength matching finds no partner | Source marked "unmatched" | Relax to 0.5 bandwidths, then the any-wavelength static test (§3.2), and label the pair "approximate" on screen |
| Star residuals mistaken for changes | Static-star false rate above 1% | Raise the flux floor in χ from 10% to 15%; ignore sources within 2 pixels of a brighter star |
| Empty field: nothing moves | No "new" detections | The asteroid and comet fields are built around the object's JPL position, so they can't be empty. A quiet Planet X field is the expected, honest result |
| Too many unexplained dots | More than 5 per cutout | 7σ threshold; require two exposures; show the expected number of chance detections next to the tally |
| JPL SBIdent slow or blocked | Calls over 60 s, or errors | Horizons for the named targets; SkyBoT (geocentric, within a pixel for main-belt objects) for the rest |
| Gaia unavailable | TAP errors | IRSA's Gaia copy is primary already; VizieR as a second source (untested) |
| Vercel problem on the day | Deploy fails | GitHub Pages from the same repo |
| A demo object is saturated or on a detector edge | OVERFLOW flags; pixel within 20 of the edge | Each field in §4 lists a backup |
| The pre-event rule is stricter than we think | Organisers object to a full prototype | Ask them before submitting. The disclosure states exactly what we did and the prototype repo is public; the worst case is disqualification, which a smaller practice build would make less likely |
| The lead is overloaded or the reviewer is unavailable | Checkpoints slipping by more than an hour | Pause the Site session and finish Data first; a fresh Claude session does the checkpoint click-through if the reviewer can't; cut to M1–M4 on two fields |

## Open decisions

1. **Pitch wording.** The data can't support "which parts of the predicted region SPHEREx rules out". Proposed: "…and a Planet X calculator shows how far out SPHEREx could have seen any planet you choose."
2. **New name for this prototype repo**, since the event repo takes `dotcatcher`. The disclosure needs its URL.
3. **Whether to ask the organisers about the full prototype** before submitting (see §5).
4. **The real submission deadline and demo format.** Someone needs to read the event page from a device that can load it.
5. **Should-have order.** Explore mode is first, then the track view, with the pair search last. If the Planet X story matters more to you than polish, swap S4 ahead of S2.
