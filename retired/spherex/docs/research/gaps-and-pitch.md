# Gaps and pitch

Based on [competitors.md](competitors.md).

## Gaps no competitor fills

1. **Real data, wavelength-matched, on a public site.** Only planet-x and QuickX match wavelengths before differencing. Neither has a working public site on real data.
2. **An explanation for every moving dot.** Known asteroid (JPL), star with proper motion (Gaia), detector artifact (FLAGS plane), or unexplained. Each competitor covers one or two of these, never all four.
3. **An interactive answer to "could SPHEREx have found Planet X?"** Muninn states one number. Nobody lets a visitor set a planet's size, distance and albedo and see whether SPHEREx would detect it, or maps which parts of the predicted Planet Nine region SPHEREx rules out.
4. **Public friendliness on real data.** The strong tools have dense expert UIs; the friendly ones use fake data.

## Pitch

> *"Every moving dot, explained. And how far out could SPHEREx see your Planet X?"* A public site on live NASA images. It compares each patch of sky only between visits at the same wavelength, then labels every change as known asteroid, moving star, glitch or **unexplained**. A Planet X calculator lets you build a planet and see whether SPHEREx could have spotted it.

## Prep before the event (research only)

1. Probe every data source: IRSA search and cutouts, the public S3 copy, JPL SBIdent with the spacecraft position, Gaia. Record working requests and response times.
2. Choose 3–5 demo fields covering a known asteroid, a high-proper-motion star and a comet, each with ≥ 3 visits at matching wavelengths.
3. Work out the Planet X detectability numbers. They should reproduce the "3–5 magnitudes too faint" result for Planet Nine.
4. Architecture and an hour-by-hour task split for the 48 hours.
