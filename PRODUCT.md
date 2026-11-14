# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site: Vite + TypeScript + MapLibre GL JS, fed by pre-computed JSON from a Python pipeline (`pipeline/`). Chosen in `docs/claudes-plan.md` section 7 and confirmed by the team for the prototype.

## Users

Space Apps judges and curious newcomers first (confirmed 2026-11-14): they open the link cold, on a laptop or phone, and must get a result in under a minute without help. Mission planners and scientists choosing where to test gear come second.

## Product Purpose

No single place on Earth can simulate a Moon or Mars base. The site splits base-building into challenges (surface, resources, heat swing, shelter, light and power, dust, signs of life…) and, for each challenge, ranks the Earth sites best suited to test it against a chosen Moon or Mars target. Source of truth: `docs/team-plan.md`.

## Positioning

Challenge-by-challenge matching, with every match explaining what is similar, how similar (a number with its dataset), and where it breaks, and a public check that known analogs outrank ordinary places.

## Capabilities and Constraints

- Targets: NASA's 9 Artemis III south-pole regions; Mars: Jezero, Arcadia Planitia, Gale, Deuteronilus Mensae, Arsia Mons caves.
- Only what both sides can measure is scored; the rest appears as labels marked "not scored" with the reason.
- Prototype data is mixed: real NASA data where quick, clearly labelled sample values elsewhere. A sample number must never pass as real.
- Name is a placeholder until the team picks one.
- No NASA logos or insignia. AI-use note in the footer.

## Evidence on Hand

Real: NASA POWER climatology, Copernicus GLO-90 terrain, LOLA, Diviner, PGDA, HRSC–MOLA, Odyssey GRS, TES dust cover, published mission values. Everything else is labelled sample. No testimonials, users or endorsements exist; don't invent any.

## Product Principles

- Every number traces to a named dataset or says "sample".
- Show the gap, not just the rank: Earth never reaches lunar cold.
- Say what Earth can't copy: gravity, vacuum or thin air, radiation.
- One clear flow beats many features.

## Accessibility & Inclusion

Readable on a phone in daylight; WCAG AA contrast; keyboard reachable; colour never the only signal (sample values are hatched and labelled).
