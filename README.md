<p align="center">
  <img src="assets/logo.svg" width="112" alt="Dotcatcher logo: a ring catching a drifting dot">
</p>

<h1 align="center">Dotcatcher</h1>

<p align="center"><b>Every moving dot in the infrared sky, explained.</b></p>

<p align="center">
  NASA Space Apps 2026 · <i>Planet X and SPHEREx</i> · practice project
</p>

> [!NOTE]
> This is a **practice project** for learning SPHEREx data before the hackathon. It is not a competition submission, and no code from here goes into the event build. What we learn goes into [`docs/research`](docs/research).

## The idea

NASA's SPHEREx telescope photographs the whole sky in near-infrared light, again and again. Between visits, some dots move: asteroids, comets, nearby stars drifting across the sky, maybe something nobody has catalogued yet.

Dotcatcher finds those dots and tells you what each one is.

- **Fair comparisons.** SPHEREx sees each patch of sky at a slightly different wavelength on every visit, so raw images show fake changes. Dotcatcher only compares images taken at the same wavelength.
- **An explanation for every dot.** Each change is checked against JPL's list of known asteroids and comets, ESA's Gaia star catalogue, and the telescope's own quality flags, then labelled as a *known asteroid*, *moving star*, *glitch* or *unexplained*.
- **An honest answer about Planet X.** Pick a planet's size and distance, and see whether SPHEREx could have spotted it, using the real depth of each image.

## What's here

| | |
|---|---|
| [`docs/research/competitors.md`](docs/research/competitors.md) | What 22 other teams built, and the best idea from each |
| [`docs/research/gaps-and-pitch.md`](docs/research/gaps-and-pitch.md) | What nobody does yet, and our pitch |
| [`docs/research/spherex-data-notes.md`](docs/research/spherex-data-notes.md) | How to get SPHEREx data, with tested queries |
| [`docs/research/rules.md`](docs/research/rules.md) | Space Apps rules on work before the event |

## Setup

Needs Python 3.13.

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

## Data and credits

- SPHEREx images: NASA / JPL-Caltech, served by [NASA/IPAC IRSA](https://irsa.ipac.caltech.edu/).
- Known solar-system objects: [JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/).
- Stars: [ESA Gaia](https://www.cosmos.esa.int/gaia) DR3.

Dotcatcher is a hackathon project. It is not affiliated with or endorsed by NASA.
