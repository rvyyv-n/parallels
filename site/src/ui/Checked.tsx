import { useEffect, useRef, useState } from "preact/hooks";
import { checked, type Check, type Checked as Data, type Strip } from "../data/checked";
import { loadValidation } from "../data/load";
import { percent } from "../data/match";
import { useAsync } from "../state";
import "./checked.css";

const HEAD = 30;
const ROW = 66;
const MID = 41;
const GAP = 26;
const AXIS = 40;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function dodge(xs: number[], r: number): number[] {
  const placed: { x: number; y: number }[] = [];
  return xs.map((x) => {
    const y = [0, -1, 1, -2, 2, -3, 3, -4, 4].map((k) => k * r * 1.15).find((y) => placed.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= (2 * r) ** 2)) ?? 0;
    placed.push({ x, y });
    return y;
  });
}

function layout(data: Data) {
  let y = 0;
  const panels = data.panels.map((p) => {
    const top = y;
    y += HEAD + p.strips.length * ROW + GAP;
    return { ...p, top, rows: p.strips.map((s, i) => ({ strip: s, y: top + HEAD + i * ROW })) };
  });
  return { panels, height: y - GAP + AXIS };
}

function StripRow({ strip, y, x, r }: { strip: Strip; y: number; x: (s: number) => number; r: number }) {
  const dots = [...strip.dots].sort((a, b) => a.score - b.score);
  const dy = dodge(dots.map((d) => x(d.score)), r);
  const mid = y + MID;
  return (
    <g class={strip.analog ? "checked-strip is-analog" : "checked-strip"}>
      <text class="checked-group" x={x(0)} y={y + 10}>
        {strip.label}
        {strip.missing.length > 0 && (
          <tspan class="checked-nodata" dx="10">
            {strip.missing.length} no data
            <title>{strip.missing.join(", ")}: no data, not placed</title>
          </tspan>
        )}
      </text>
      <line class="checked-base" x1={x(0)} x2={x(1)} y1={mid} y2={mid} />
      {dots.map((d, i) => (
        <circle key={d.name} class="checked-dot" cx={x(d.score)} cy={mid + dy[i]} r={r}>
          <title>
            {d.name}: {d.score.toFixed(2)}
          </title>
        </circle>
      ))}
    </g>
  );
}

function CheckResult({ check, top }: { check: Check; top: number }) {
  return (
    <li class={check.passed ? "checked-check is-pass" : "checked-check is-miss"} data-testid="checked-check" style={{ top: `${top}%` }}>
      <span class="sr">{check.name}: </span>
      <b class="checked-result">{percent(check.result)}</b>
      <span class="checked-verdict">
        <span aria-hidden="true">{check.passed ? "=" : "≠"}</span> {check.passed ? "pass" : "miss"}
      </span>
      <span class="checked-mark">pass mark {percent(check.passMark)}</span>
    </li>
  );
}

function Chart({ data }: { data: Data }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, []);

  const { panels, height } = layout(data);
  const r = width < 320 ? 3.6 : 4.5;
  const x = (s: number) => r + 2 + s * (width - 2 * r - 4);
  const placed = data.panels.reduce((n, p) => n + p.strips.reduce((m, s) => m + s.dots.length, 0), 0);
  const label = `Strip chart of ${placed} test places, each placed by its score against its base site, from 0 to 1. In each test, known analogs sit in the top row, ordinary places and plain deserts below. The results are listed beside the chart.`;

  return (
    <div class="checked-plot">
      <div class="checked-svg" ref={box}>
        <svg role="img" aria-label={label} data-testid="checked-chart" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
          {panels.map((p) => (
            <g key={p.id}>
              <text class="checked-title" x={x(0)} y={p.top + 18}>
                {p.title}
              </text>
              {TICKS.map((t) => (
                <line key={t} class="checked-grid" x1={x(t)} x2={x(t)} y1={p.top + HEAD + 18} y2={p.top + HEAD + p.strips.length * ROW} />
              ))}
              {p.rows.map((row) => (
                <StripRow key={row.strip.group} strip={row.strip} y={row.y} x={x} r={r} />
              ))}
            </g>
          ))}
          <g class="checked-axis">
            {[0, 0.5, 1].map((t) => (
              <text key={t} x={x(t)} y={height - AXIS + 14} text-anchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>
                {t}
              </text>
            ))}
            <text class="checked-axis-label" x={x(1)} y={height - 4} text-anchor="end">
              Score against the base site →
            </text>
          </g>
        </svg>
      </div>
      <div class="checked-side">
        <p class="checked-side-head" style={{ top: `${(18 / height) * 100}%` }}>
          Pairs the analogs win
        </p>
        <ul class="checked-checks">
          {panels.flatMap((p) =>
            p.checks.map((c) => {
              const row = p.rows.find((w) => w.strip.group === c.group)!;
              return <CheckResult key={`${p.id}-${c.group}`} check={c} top={((row.y + MID) / height) * 100} />;
            }),
          )}
        </ul>
      </div>
    </div>
  );
}

export function Checked({ onJudges }: { onJudges: () => void }) {
  const validation = useAsync(loadValidation, []);
  const data = validation && checked(validation);

  return (
    <section class="after" id="checked" data-testid="checked" aria-labelledby="checked-h">
      <div class="checked">
        <div class="checked-intro">
          <h2 id="checked-h">How we checked it</h2>
          {data && (
            <>
              <ul class="checked-lines" data-testid="checked-lines">
                <li>
                  <b>
                    {data.first.passed} of {data.first.total}
                  </b>
                  <span>checks passed in the first run, weights fixed in advance.</span>
                </li>
                <li>
                  <b>
                    {data.fourth.passed} of {data.fourth.total}
                  </b>
                  <span>pass in the fourth run; {data.fourth.uncounted} had too few sites to judge.</span>
                </li>
                <li>
                  <b>{data.uses} runs</b>
                  <span>on these places, so no later change is judged on them.</span>
                </li>
              </ul>
              <p class="checked-commits">
                Weights fixed at <code>{data.weightsCommit}</code> · fourth run <code>{data.configCommit}</code>
              </p>
            </>
          )}
        </div>
        {data && (
          <figure class="checked-figure">
            <Chart data={data} />
            <figcaption>
              Every check, challenge by challenge:{" "}
              <button class="text-link" onClick={onJudges}>
                For judges
              </button>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
