<p align="center">
  <img src="assets/logo.svg" width="112" alt="Dotcatcher logo: a ring catching a drifting dot">
</p>

<h1 align="center">Dotcatcher</h1>

<p align="center"><b>Every moving dot in the infrared sky, explained.</b></p>

<p align="center">
  NASA Space Apps 2026 · <i>Planet X and SPHEREx</i> · practice project
</p>

<p align="center">
  <a href="#the-idea">The idea</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#progress">Progress</a> ·
  <a href="#repository-layout">Layout</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#data-and-credits">Credits</a>
</p>

> [!NOTE]
> This is a **practice project** for learning SPHEREx data before the hackathon. It is not a competition submission, and no code from here goes into the event build. What we learn goes into [`docs/research`](docs/research).

## The idea

NASA's SPHEREx telescope photographs the whole sky in near-infrared light, again and again. Between visits, some dots move: asteroids, comets, nearby stars drifting across the sky, maybe something nobody has catalogued yet.

Dotcatcher finds those dots and tells you what each one is.

## How it works

| Step | What happens | Why it matters |
|---|---|---|
| **1. Compare fairly** | Only images taken at the same wavelength are compared. | SPHEREx sees each patch of sky at a slightly different wavelength on every visit, so raw comparisons show fake changes. |
| **2. Explain every dot** | Each change is checked against JPL's known asteroids and comets, ESA's Gaia star catalogue, and the telescope's quality flags. | Every dot gets a label: *known asteroid*, *moving star*, *glitch* or *unexplained*. |
| **3. Answer the Planet X question** | Pick a planet's size and distance and see whether SPHEREx could have spotted it, using each image's real depth. | Turns "we found nothing" into a real limit on where Planet X can hide. |

## Progress

- [x] Survey of 22 competing team projects
- [x] SPHEREx image search through IRSA tested
- [ ] Image cutouts and per-pixel wavelengths
- [ ] Known-object checks (JPL, Gaia)
- [ ] Planet X detectability numbers
- [ ] Demo sky fields chosen

## Repository layout

```
assets/            logo
docs/research/     what we've learned so far
requirements.txt   Python dependencies
```

| Research note | Contents |
|---|---|
| [`competitors.md`](docs/research/competitors.md) | What 22 other teams built, and the best idea from each |
| [`gaps-and-pitch.md`](docs/research/gaps-and-pitch.md) | What nobody does yet, and our pitch |
| [`spherex-data-notes.md`](docs/research/spherex-data-notes.md) | How to get SPHEREx data, with tested queries |
| [`rules.md`](docs/research/rules.md) | Space Apps rules on work before the event |

## Getting started

Needs Python 3.13.

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

## Data and credits

| Data | Source |
|---|---|
| SPHEREx images | NASA / JPL-Caltech, served by [NASA/IPAC IRSA](https://irsa.ipac.caltech.edu/) |
| Known asteroids and comets | [JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/) |
| Stars | [ESA Gaia](https://www.cosmos.esa.int/gaia) DR3 |

Dotcatcher is a hackathon project. It is not affiliated with or endorsed by NASA.
