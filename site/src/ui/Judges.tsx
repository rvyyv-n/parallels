import type { Dataset, Manifest } from "../../../dataset/contract";
import { AGENCY_NAMES, byAgency, sentences } from "../data/judges";
import { loadValidation } from "../data/load";
import { percent } from "../data/match";
import { useAsync } from "../state";
import { AI_NOTE, TEAM } from "./notes";
import "./judges.css";

const SECTIONS = [
  ["benchmarks", "Benchmarks"],
  ["questions", "Questions"],
  ["datasets", "Datasets"],
  ["clusters", "Terrain and clusters"],
  ["checks", "Every check"],
  ["stability", "Weights"],
  ["limits", "Not in this version"],
  ["ai", "AI use"],
];

const two = (n: number) => String(n).padStart(2, "0");

function Lead({ text }: { text: string }) {
  const i = text.indexOf(": ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      <b>{text.slice(0, i + 1)}</b> {text.slice(i + 2)}
    </>
  );
}

function DatasetItem({ dataset }: { dataset: Dataset }) {
  return (
    <li class="judges-dataset" data-testid="dataset">
      <p class="judges-dataset-name">
        {dataset.url ? (
          <a class="text-link" href={dataset.url} target="_blank" rel="noreferrer">
            {dataset.name}
          </a>
        ) : (
          dataset.name
        )}
      </p>
      <dl>
        <div>
          <dt>Used for</dt>
          <dd>{dataset.used_for}</dd>
        </div>
        {dataset.archive && (
          <div>
            <dt>Archive</dt>
            <dd>{dataset.archive}</dd>
          </div>
        )}
        <div>
          <dt>Licence</dt>
          <dd data-testid="licence">{dataset.licence}</dd>
        </div>
      </dl>
    </li>
  );
}

function Back({ onBack, testid }: { onBack: () => void; testid?: string }) {
  return (
    <button class="judges-back" data-testid={testid} onClick={onBack}>
      <span aria-hidden="true">←</span> Back to the site
    </button>
  );
}

export function Judges({ manifest, onBack }: { manifest: Manifest; onBack: () => void }) {
  const validation = useAsync(loadValidation, []);
  const run = validation?.more_runs?.[0];
  const groups = byAgency(manifest.datasets);
  const { clustering } = manifest;

  const jump = (e: MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  return (
    <main class="judges" data-testid="judges">
      <div class="judges-col">
        <Back onBack={onBack} testid="judges-back" />
        <header class="judges-head">
          <p class="judges-kicker">
            Parallels <span aria-hidden="true">·</span> {TEAM}
          </p>
          <h1>For judges</h1>
          <p class="judges-intro">Every benchmark and question in the Challenge Guide, every dataset, and our limits. All values come from our data files.</p>
          <p class="judges-meta">
            Method version <span>{manifest.method_version}</span> <i aria-hidden="true">/</i> data built <span>{manifest.generated}</span>
          </p>
          <details class="judges-rule">
            <summary>The scoring rule</summary>
            <p>{manifest.scoring.rule}</p>
          </details>
          <nav class="judges-jump" aria-label="On this page">
            <ol>
              {SECTIONS.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} onClick={(e) => jump(e, id)}>
                    <span>{two(i + 1)}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <section id="benchmarks" class="judges-section">
          <h2>The guide’s six benchmarks</h2>
          <p class="judges-intro">The guide’s own words, how we meet each one, and where to see it.</p>
          <ol class="judges-list">
            {manifest.benchmarks.map((b) => (
              <li key={b.n} class="judges-item" data-testid="benchmark">
                <span class="judges-n">{two(b.n)}</span>
                <div>
                  <blockquote class="judges-quote">{b.guide_words}</blockquote>
                  <p>{b.how}</p>
                  <p class="judges-where">
                    <b>Where to see it</b> {b.where}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="questions" class="judges-section">
          <h2>The guide’s seven questions</h2>
          <ol class="judges-list">
            {manifest.questions.map((q) => (
              <li key={q.n} class="judges-item" data-testid="question">
                <span class="judges-n">{two(q.n)}</span>
                <details class="judges-qa" open>
                  <summary>{q.question}</summary>
                  <p>{q.answer}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section id="datasets" class="judges-section">
          <h2>Every dataset</h2>
          <p class="judges-count">
            <span class="judges-total">
              <b>{manifest.datasets.length.toLocaleString("en")}</b> datasets
            </span>
            {groups.map((g) => (
              <span key={g.agency}>
                {AGENCY_NAMES[g.agency]} <b>{g.datasets.length.toLocaleString("en")}</b>
              </span>
            ))}
          </p>
          {groups.map((g) => (
            <details key={g.agency} class="judges-group" open={g.agency === "NASA"}>
              <summary>
                <h3>{AGENCY_NAMES[g.agency]}</h3>
                <span class="judges-badge">{g.datasets.length.toLocaleString("en")}</span>
              </summary>
              <ul>
                {g.datasets.map((d) => (
                  <DatasetItem key={d.id} dataset={d} />
                ))}
              </ul>
            </details>
          ))}
        </section>

        <section id="clusters" class="judges-section">
          <h2>Terrain types and clusters</h2>
          <div class="judges-table" tabIndex={0} role="region" aria-label="Terrain types">
            <table>
              <thead>
                <tr>
                  <th scope="col">Terrain type</th>
                  <th scope="col">Rule</th>
                  <th scope="col" class="num">
                    Cells
                  </th>
                </tr>
              </thead>
              <tbody>
                {manifest.terrain_types.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">{t.name}</th>
                    <td>{t.rule}</td>
                    <td class="num">{t.cells.toLocaleString("en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="judges-lede">{clustering.summary}</p>
          <dl class="judges-facts">
            <div>
              <dt>Method</dt>
              <dd>{clustering.method}</dd>
            </div>
            <div>
              <dt>Inputs</dt>
              <dd class="judges-inputs">
                {clustering.inputs.map((i) => (
                  <code key={i}>{i}</code>
                ))}
              </dd>
            </div>
          </dl>
          <div class="judges-table" tabIndex={0} role="region" aria-label="Clusters against terrain types">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="num">
                    Cluster
                  </th>
                  <th scope="col" class="num">
                    Cells
                  </th>
                  <th scope="col">Most common type</th>
                  <th scope="col" class="num">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {clustering.agreement.map((a) => (
                  <tr key={a.cluster}>
                    <td class="num">{a.cluster}</td>
                    <td class="num">{a.cells.toLocaleString("en")}</td>
                    <td>{a.top_type}</td>
                    <td class="num">
                      <span class="judges-share">
                        <i aria-hidden="true">
                          <i style={{ width: percent(a.share) }} />
                        </i>
                        {percent(a.share)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="checks" class="judges-section">
          <h2>Every check, pass or miss</h2>
          {run ? (
            <>
              <p class="judges-lede">
                <b>{run.title}.</b> {run.summary}
              </p>
              {run.tests.map((t) => (
                <div class="judges-table" tabIndex={0} role="region" aria-label={t.title} key={t.id}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{t.title}</th>
                        <th scope="col" class="num">
                          Pairs won
                        </th>
                        <th scope="col" class="num">
                          Pass mark
                        </th>
                        <th scope="col">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.checks.map((c) => (
                        <tr key={c.name} data-testid="check">
                          <th scope="row">{c.name}</th>
                          <td class="num">{c.result === null ? "no data" : percent(c.result)}</td>
                          <td class="num">{percent(c.pass_mark)}</td>
                          <td>{c.passed === null ? "not counted" : c.passed ? "= pass" : "≠ miss"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          ) : (
            <p class="judges-wait">{validation ? "Not in the data files." : "Loading…"}</p>
          )}
        </section>

        <section id="stability" class="judges-section">
          <h2>How the top places shift when weights change</h2>
          {validation?.stability ? (
            <ul class="judges-plain">
              {sentences(validation.stability).map((s, i) => (
                <li key={i}>
                  <Lead text={s} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="judges-wait">{validation ? "Not in the data files." : "Loading…"}</p>
          )}
        </section>

        <section id="limits" class="judges-section">
          <h2>Not in this version</h2>
          <dl class="judges-limits">
            {manifest.not_in_version.map((n) => (
              <div key={n.item}>
                <dt>{n.item}</dt>
                <dd>{n.reason}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="ai" class="judges-section">
          <h2>How we used AI</h2>
          <p class="judges-ai" data-testid="ai-note">
            <b>{TEAM}.</b> {AI_NOTE}
          </p>
        </section>

        <div class="judges-end">
          <Back onBack={onBack} />
        </div>
      </div>
    </main>
  );
}
