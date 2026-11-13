# How Space Apps is judged, and what wins

Research notes from 2026-11-13. The rules we act on are in [GUIDELINES.md](../GUIDELINES.md); this file keeps the evidence behind them.

## What the official pages say

Sources: the [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) and the [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), both read 2026-11-13.

**Scoring.** "At every level of judging ... your project will be evaluated on a scale of 1-to-5" on each of the five criteria. The guide gives no weighting. The parts of each definition that matter most for us:

| Criterion | Key words from the guide | What it means for us |
|---|---|---|
| Impact | "addressing a significant problem"; "benefits a large audience" | Say who uses our matches and what they'd test there |
| Creativity | "a novel concept that has not been attempted before or ... an improvement upon existing ideas in a meaningful way" | At least eight other teams build a similarity ranker (see [challenge.md](challenge.md)); our angle has to be different |
| Validity | "grounded in scientific principles"; "usability and user-friendliness ... influence its practicality" | Show how we checked the method, and make the tool easy for a newcomer |
| Relevance | "integrates NASA data, utilizing it as a core component ... rather than a superficial addition" | NASA data must do the main work in the scoring, not decorate it |
| Presentation | "Judges evaluate the demo and full project to compute this score" | The project page and the site count, not just the video |

**Who judges, and when.**

1. Local judges pick the Global Nominees, announced **3 December 2026**.
2. Global Judges score every nominee and pick the Global Finalists, announced **17 December 2026**. Honorable Mentions are named at the same time but win no award.
3. NASA and partner-agency leaders, the executive judges, review every finalist. They give out ten awards, announced **26 January 2027**.

So our live site has to keep working, untouched, for ten weeks after the event.

In 2025, 11,511 projects were submitted ([results page](https://www.spaceappschallenge.org/about/results-and-metrics/)).

**The ten awards.** The three that fit us best:

- **Best Use of Science:** "the best and most valid use of the scientific method."
- **Best Use of Data:** "best makes space data accessible or leverages it to a unique application."
- **Best Mission Concept:** "the most plausible concept and design."

The other seven are Best Use of Technology, Galactic Impact, Most Inspirational, Best Storytelling, Global Connection, Art & Technology and Local Impact.

**The project page form.** It has eight fields:

1. Project Name
2. High-Level Project Summary: what we built, how it addresses the challenge, why it matters.
3. Link to Project Demo
4. Link to Final Project
5. Detailed Project Description: what it does, how it works, its benefits, what we hope to achieve, and the tools we used.
6. Use of Super Intelligence (SI)
7. NASA Data
8. Space Agency Partner Data and Other References

Images (JPG, PNG or GIF up to 10 MB) can be pasted into the page. Videos and documents can only be linked.

**The AI question is hidden from judges.** In the guide's words: "This SI question is for data-collection purposes only, and your response will not be seen by the judges. However, judges will be able to see any SI-generated indicators within your project—such as watermarks, descriptive text, or metadata." So our AI note has to sit in the project itself.

**The demo.**

- The guide says "the majority of judges' evaluation will be based on your project submission". A strong demo "can increase the potential for a high score in the Presentation category".
- The guide's suggested timing for the 30-second video:
  - **0:00:** our names and team name.
  - **0:02:** the challenge we chose.
  - **0:05:** the project's name and tagline.
  - **0:10:** how it works, and how NASA and partner data made it possible.
  - **0:20 to 0:30:** what it could do in the future.
- For slides: at most seven, including the title. They should show the project, the user's experience, and how the data makes it possible.

## What past winners did

Sources: the [2025 global winners](https://www.spaceappschallenge.org/2025/meet-the-2025-global-winners/) and their project pages, and the [2022 winners](https://legacy.spaceappschallenge.org/blog/2022-global-winners/). The 2023 and 2024 project pages are no longer public.

- **Every 2025 winner had a public final-project link**, eight of them live websites (Vercel, Netlify, GitHub Pages, Framer, an own domain). The YouTube demos we could time ran 29–30 seconds.
- **Most 2025 winners named specific NASA datasets with links**, such as the NASA POWER API, GeneLab GLDS-288 and MAST. The weakest data sections were the vague ones, such as "NASA Image and Video Library".
- **No 2025 winner's page had a section on its own limits.** Our challenge asks for exactly that ("where the analogy breaks down"), so a clear one would set us apart.
- **Moon data projects have won before.** Entries to the Moonquake Map challenges won two awards in 2022 and two in 2023. No earlier Earth-analog challenge was found, so there's no past winner to copy.

## What judges of other hackathons say

These are judges' and winners' write-ups, so the evidence is experience, not measurement. Listed with the strongest agreement first:

1. **One narrow, finished thing beats a broad, half-done one.** It should be explainable in one sentence ([a judge's year of notes](https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l), [another judge](https://dev.to/amising6/what-i-learned-after-reviewing-many-ai-and-developer-projects-as-a-hackathon-judge-2g06)).
2. **Show the working product first**, before any backstory. Slides persuade less than a working demo ([judge](https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l), [Hackathon.com](https://tips.hackathon.com/article/creating-the-best-demo-video-for-a-hackathon-what-to-know), [Google Solution Challenge FAQ](https://developers.google.com/community/gdsc-solution-challenge/faq)).
3. **Put the key facts at the top of the page.** Judges skim many entries in a few minutes each ([MLH coach and judge](https://dev.to/jacklyn/how-to-make-your-devpost-submissions-not-suck-37i0), [judge](https://glebbahmutov.com/blog/winning-hackathons/)).
4. **Deploy early, open the link as a stranger would, and keep a recording in case the site fails** ([judge](https://glebbahmutov.com/blog/winning-hackathons/), [ETHDenver judges](https://chaincatcher.com/en/article/2088765)).
5. **Freeze features before the end.** The last hours are for the page and the demo. Late features cause demo-day bugs ([winner's retrospective](https://blogs.reskilll.com/what-i-learned-building-under-pressure-sih-winners-honest-retrospective/), [a losing team's account](https://dev.to/arrrgr/how-to-lose-a-hackathon-in-7-steps-2kf0)).
6. **Say who it's for and admit known limits.** Judges scored that up, and they trusted a stated AI role more than vague claims ([analysis of winners](https://dev.to/jsb-securedme/what-ai-hackathon-winners-actually-have-in-common-1kla), [judge](https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l)).
7. **Keep real data in the main flow.** Mocked data is easy to spot and costs trust ([Browser Use](https://browser-use.com/posts/how-to-win-hackathons)).
8. **Polish until it looks like a normal product, then stop.** Extra polish earned no extra points ([ETHDenver judges](https://chaincatcher.com/en/article/2088765)).
9. **Sleep.** Tired teams end up rewriting their own code ([a losing team's account](https://dev.to/arrrgr/how-to-lose-a-hackathon-in-7-steps-2kf0)).
