# SPHEREx data notes

What competitor repos show about getting and using SPHEREx data. Unverified until we probe each service ourselves.

## Sources

- **IRSA TAP**: `https://irsa.ipac.caltech.edu/TAP/sync`. Tables `spherex.obscore`, `spherex.plane`, `spherex.artifact`. Datalink rows resolve to cutouts.
- **IRSA SIA**: collections `spherex_qr2`, `spherex_qr3` (quick releases).
- **S3**: public bucket `nasa-irsa-spherex`, Level 2 FITS. Files are about 70 MB, so read headers and cutouts with HTTP range requests (Muninn and spherex-timelapse do this in the browser).
- **Known solar-system objects**: JPL SBIdent, with the observer position taken from the `X_SC`/`Y_SC`/`Z_SC` FITS headers rather than Earth's position. Then JPL Horizons for exact positions. Alternatives: IMCCE SkyBoT, IRSA MOST.
- **Stars**: Gaia DR3 (through IRSA TAP or VizieR), AllWISE, CatWISE.

## Wavelength (LVF)

- Each Level 2 image has an alternate WCS (key `W`, `WCS-WAVE`) giving the wavelength at each pixel.
- IRSA recommends its CWAVE/CBAND calibration files over `WCS-WAVE` for science (noted in SPHERALYX-AI `docs/resolucion-calibracion.md`).
- Approach used by planet-x and QuickX: for each epoch, compute the wavelength at the target pixel and keep only frames within about half to one bandwidth of a common reference.

## Depth

- Muninn measured a 5σ depth of 17.60 AB per visit.
- SPHEREx-Blink-3.0 says about V 17, 3–5 magnitudes short of a Planet Nine-like body (predicted V 22–25).

## Verified by our probes (2026-11-12)

- IRSA TAP base URL for pyvo: `https://irsa.ipac.caltech.edu/TAP`. Tables: `spherex.obscore`, `spherex.observation`, `spherex.plane`, `spherex.artifact`, `spherex.provenance_input`.
- Cone/point searches must use the geography column `poly`, not `s_region` (varchar; fails with `st_covers ... does not exist`): `where contains(point('ICRS', ra, dec), o.poly) = 1`.
- `spherex.plane` has per-image depth columns (`metrics_maglimit`, `metrics_fluxdensitylimit`, `quality_flag`), but they are NULL in all 1,607,635 rows. Depth has to be computed from each image's VARIANCE and PSF; see [`../roadmap.md`](../roadmap.md) §3.5. Joins to obscore on `obs_publisher_did`.
- Barnard's Star (RA 269.452, Dec +4.6934): 364 images across `spherex_qr2` and `spherex_qr3`, all six detectors D1–D6, MJD 60902.9–61305.6 (about 13 months). Query took about 20 s.
- Each exposure appears once per detector. `obs_id` like `2025W33_2C_0321_1`; detector bands: D3 1.63–2.435 µm, D6 4.412–5.01 µm.
- `access_url` is a datalink: `https://irsa.ipac.caltech.edu/datalink/links/spherex?ID=ivo://irsa.ipac/spherex_qr2?<obs_id>/<detector>`.

## From this PC

On 2026-11-12, IRSA, JPL SSD API, the ESA Gaia archive, GitHub, Vercel and GitHub Pages all connect. spaceappschallenge.org fails TLS verification.
