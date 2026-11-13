# Guidelines

How we work on our NASA Space Apps 2026 entry. Section 1 is the official rules and can't be changed. The rest are our own choices, and we can change them.

## 1. Official rules we must meet

Source: the Space Apps [Participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) and [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), read 2026-11-13. Check them again on the day; if they differ from this list, the official pages win.

**Timing**
- Submission opens **Saturday 14 November, 9:00** and closes **Sunday 15 November, 23:59**, both in our Local Event's time zone. Anything saved after the deadline isn't judged.
- We can resubmit as often as we like before then. Only the last saved version counts.

**Team**
- 1 to 6 people (at least 2 for the online Universal Event), all registered at the same Local Event. One team per person, one challenge per team.

**What we hand in**
- A project page on spaceappschallenge.org with every required field filled in, all in English.
- **A demo:** a video of **30 seconds or less** (English subtitles if spoken in another language) or a slide deck of **7 slides or fewer**, including the title slide. Going over either limit rules us out of global judging.
- **A link to the final project** that opens without a login, password or permission request. Test every link in a private browser window.
- **At least one NASA dataset or resource**, named on the page. Without it we can't win a global award.
- **A list of everything we used:** data, code, libraries, text and images, even free and open-source ones.

**AI ("Super Intelligence") rules**
- AI may help us build. It must **not** come up with our idea for solving the challenge. The idea and the key design decisions are ours.
- Anything AI made has to be labelled where judges can see it:
  - images and video: a visible watermark;
  - audio: a note in the description and file metadata;
  - code and data: a note in the description and metadata. We do this in the README and [AI-USE.md](AI-USE.md).
- Nothing AI-generated may use or change NASA branding: no NASA logos, flags or mission insignia.
- The submission form asks how we used AI. We answer it from AI-USE.md.

**Other**
- No photos, video, voices or likenesses of anyone under 18.
- Before submitting we tick "Terms and Conditions" and "Confirm All Work is Original".
- Recommended: request a FortiGuard web-filter classification for our site so judges' networks don't block it.

**Judging:** five criteria: **Impact, Creativity, Validity, Relevance, Presentation**. A strong demo mainly raises Presentation; most of the score comes from the project page itself.

## 2. Doing the science honestly

The challenge says this outright, and it's also how we'll stand out:

- **Every match explains itself:** what is similar, how similar (a number with its data source), and where the analogy breaks down.
- **Never invent a value.** If data is missing, show it as missing and lower our confidence; don't guess.
- **Say what Earth can't copy:** low gravity, the Moon's vacuum, Mars's thin air, space radiation.
- **Every number on screen traces back to a named dataset.**
- **Aim for places nobody uses yet.** Antarctica, Atacama, Iceland and Hawaii are fine to compare against, but they shouldn't be our headline.

## 3. Data

**Start with the data NASA provides for this challenge** (the Resources tab on the [challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/), read 2026-11-13; NASA may add more before the event):

| For | Source | What it gives us |
|---|---|---|
| Earth | [NASA Earthdata Search](https://search.earthdata.nasa.gov/) | NASA's main portal for Earth science data |
| Earth | [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Browse NASA satellite imagery interactively |
| Moon and Mars | [NASA Planetary Data System (PDS)](https://pds.nasa.gov/) | NASA's archive of orbiter, lander and rover data |
| Moon | [Lunar Reconnaissance Orbiter (LRO)](https://pds-geosciences.wustl.edu/missions/lro/) | Moon images (LROC), height maps (LOLA), ice hints (LEND, Mini-RF) |
| Moon | [LRO Diviner](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm) | Moon surface temperatures, especially at the poles |
| Earth (Canada) | [RADARSAT Constellation Mission](https://donnees-data.asc-csa.gc.ca/en/dataset/rcm), [RADARSAT-1](https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1) | Radar images that see through cloud and darkness: ice, terrain |
| Earth (Canada) | [SAR Python tutorial](https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial) | How to open and view radar images |
| Earth (Europe) | [Copernicus Data Space](https://dataspace.copernicus.eu/) | Sentinel satellite data for land, ocean and air |
| Earth (Europe) | [ESA Open Science Catalog](https://opensciencedata.esa.int/) | Catalogue of open geoscience datasets |
| Earth (Japan) | [JAXA G-Portal](https://gportal.jaxa.jp/gpr/index/index) | Japanese satellite data: rain, snow, vegetation and more |

At least one NASA source must appear in the final project. The provided sources come first; we add others only where they fill a real gap.

- Open data only. Follow each source's terms and credit it.
- Cache downloads and keep request rates polite. Raw data stays out of git (see `.gitignore`); commit only small processed files the site needs.
- Keep a short note of where each dataset came from and how we used it.

## 4. Roles

- **Lead builder:** owns the repo, hosting and every decision.
- **Reviewer:** builds nothing. At each checkpoint they open the live site on a phone and a laptop, try to break it, compare numbers on screen with the source data, and read the text as a newcomer would. They report problems to the lead as a short list, most serious first.
- **Claude:** builds under the lead's direction; see [CLAUDE.md](CLAUDE.md).

## 5. Working rhythm

- **Keep it working.** Commit and push after every change that works, so any step can be undone.
- **Checkpoints:** the live site is deployed and reviewed at each one. The roadmap sets the times.
- **Feature freeze: Sunday 18:00.** After that, only fixes, the demo and the project page.
- **Submit a first complete draft by Saturday night**, then improve it. Final submission by **Sunday 21:00**, three hours before the deadline.
- If something has been stuck for an hour, cut it or switch to the planned fallback.

## 6. Code of conduct

Follow the [Space Apps Terms and Conditions](https://www.spaceappschallenge.org/legal/). Be kind. Report harassment to the Local Lead or the Space Apps organising team.

## 7. Before we click "Submit for Judging"

- [ ] Every required field is filled in, in English
- [ ] Demo is ≤ 30 s or ≤ 7 slides, publicly viewable
- [ ] Final project link opens in a private window, with no login
- [ ] NASA data is named; every other source is listed
- [ ] AI use is described; AI images are watermarked; no NASA branding in AI output
- [ ] No under-18 likenesses
- [ ] Both checkboxes ticked; the success banner shows after submitting
