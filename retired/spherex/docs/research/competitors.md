# Competitor survey

Other teams' public GitHub repos for the 2026 "Planet X and SPHEREx" challenge, read on 2026-11-12. About 45 repos match; 22 were inspected. Claims come from reading each repo's README and source. They have not been independently re-verified, so check the cited file before relying on one.

"LVF" = the linear variable filter: SPHEREx sees a given sky position at a different wavelength on each visit, so comparing raw epochs shows fake changes.

## Summary

| Repo | Real data | LVF handled | Auto mover detection | Known-object check | Planet X | Live site |
|---|---|---|---|---|---|---|
| [epsretriever/spherex-planet-x](https://github.com/epsretriever/spherex-planet-x) (Driftnet) | yes | sidesteps it | yes: detect, link, vet, rank | JPL SBIdent + Horizons | honest | [driftnet-sky.vercel.app](https://driftnet-sky.vercel.app) |
| [root3315/muninn](https://github.com/root3315/muninn) | yes | partial (band only) | partial ("Hunter X") | SkyBoT, Gaia, AllWISE | most honest: 17.6 AB vs V 22–25 | none |
| [ShivenKhurana1/spherex-timelapse](https://github.com/ShivenKhurana1/spherex-timelapse) | yes | partial | yes (recovers Pluto) | SkyBoT, Horizons | none | [gradepeach.me](http://gradepeach.me/spherex-timelapse/) |
| [shengdynasty/planet-x](https://github.com/shengdynasty/planet-x) | yes (local server) | yes | yes | JPL sb_ident | honest | [simulated only](https://shengdynasty.github.io/planet-x/) |
| [tya30122009/quickx](https://github.com/tya30122009/quickx) | yes | yes, best | manual | MOST + SBDB | none | none |
| [mateibut/SPHEREx-Blink-3.0](https://github.com/mateibut/SPHEREx-Blink-3.0) | local only | noted, not fixed | yes, false-alarm stats | Gaia, SIMBAD, SkyBoT | honest: 3–5 mag too faint | [synthetic only](https://mateibut.github.io/SPHEREx-Blink-3.0/) |
| [catagfx/SPHEREx-Sky](https://github.com/catagfx/SPHEREx-Sky) | yes | partial | manual | links out only | hypothetical overlay | none |
| [pythonhack000/spherex-blink](https://github.com/pythonhack000/spherex-blink) | yes | partial | no | Gaia, AllWISE | none | [github.io](https://pythonhack000.github.io/spherex-blink/) |
| [lautaromoreyraa/spherex-blink](https://github.com/lautaromoreyraa/spherex-blink) | yes, static | warns only | no | Horizons, SIMBAD, Gaia | Makemake stand-in | none found |
| [Julian1006/spherex-time-machine](https://github.com/Julian1006/spherex-time-machine) | yes, 37 fixed targets | explains it, no fix | no | Horizons | none | github.io (inferred) |
| [franksimonduran/SPHERALYX-AI](https://github.com/franksimonduran/SPHERALYX-AI) | mixed, labelled | gates pairs | synthetic only | Gaia, AllWISE | honest | none |
| [Muhammadsax/Spherex-Streak-Detection-Engine](https://github.com/Muhammadsax/Spherex-Streak-Detection-Engine) | simulated | claimed only | streak CNN, untrained | none | none | none |
| [YashCBtech2024/spherex-scientific-pipeline](https://github.com/YashCBtech2024/spherex-scientific-pipeline) | yes, one field | no | DAOStarFinder | Gaia | none | no UI |

Fake, staged or placeholder data: Razor573/spectralx (staged "Planet X candidate"), sreenath1212/skyshift-spherex (procedural sky; [live](https://skyshift-spherex.vercel.app)), Quantal-Universe/ASTERIA (desktop app, hard-coded targets).

Stubs, README only: kipasangin-kejepit/wanderer (empty; pitch is Gaia/CatWISE cross-check plus reporting), NihalShore/Open-sky-benchmark, bbaadd309/parallax-spherex-observatory, aedrobny/NH2T-Planet-X-and-SPHEREx, rr-codes4/SPHEREX-Sky-Viewer, Gaurigarg892/SphereX_Explorer.

## Strongest three

**Driftnet** (about 31k LOC). Python pipeline reads Level 2 cutouts from the `nasa-irsa-spherex` S3 bucket. It detects sources per exposure at SNR ≥ 5, rejects static sources by forced photometry, and links tracks across ≥ 3 visits at constant rate (0.5–250″/hr). Vetting is rule-based plus an Isolation Forest ranking. A Cloudflare Worker queries JPL SBIdent using SPHEREx's own position, then Horizons. There's an injection/recovery "Limits" page. Weaknesses: many of the 596 committed candidates have `known_object_checked: false`; it never states the flux gap to Planet Nine; LLM-written summaries.

**Muninn** (about 11k LOC, vanilla JS). Reads FITS straight from S3 in the browser with HTTP range requests, including TAN-SIP WCS and the FLAGS plane. Checks SkyBoT, AllWISE and Gaia. States a measured 5σ depth of 17.60 AB per visit against a predicted V 22–25 for Planet Nine, and says plainly it can't find Planet Nine. No public URL; dense expert UI.

**spherex-timelapse** (about 4k LOC, static). Its sky-tiled index of about 1.2M images is rebuilt weekly from IRSA TAP; pixels come from S3 by range request. Compact-source detection on frame minus median sky, then tracklet linking. Claims Pluto recovered at 8.7″/day against JPL's 9.0″/day. No Planet X angle.

## Best idea from each

- Driftnet: the full detect, link, vet, JPL-check chain with an evidence report per candidate, plus injection/recovery to measure sensitivity.
- Muninn: show the instrument's measured depth next to the Planet X prediction, so a null result becomes an upper limit.
- QuickX and planet-x: per epoch, choose frames whose wavelength at the target pixel matches within about one bandwidth, and only difference those.
- SPHEREx-Blink-3.0: judge candidates against the expected number of chance alignments in the field, not a fixed σ cut.
- spherex-timelapse: follow a known mover by cutting each exposure centred on its ephemeris, giving a deep stack with stars removed.
- pythonhack000/spherex-blink: Gaia DR3 stars moved to each observation date, plus AllWISE (2010) as a 15-year baseline frame.
- lautaromoreyraa/spherex-blink: ship pre-computed real-data fields as static files, so the public site needs no backend.
- SPHERALYX-AI: label every view as real, simulated or synthetic.
- Muhammadsax: mask satellite streaks with a soft probability mask instead of deleting pixels.
