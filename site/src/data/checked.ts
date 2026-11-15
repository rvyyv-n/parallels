import type { Validation, ValidationTest } from "../../../dataset/contract";

const HEADLINE: [string, string][] = [
  ["fourth-mars", "Mars · Jezero"],
  ["fourth-moon-polar", "Moon · south pole"],
  ["fourth-moon-terrain", "Moon · terrain only"],
];
const COMPARED = ["ordinary", "desert"];

export interface Dot {
  name: string;
  score: number;
}

export interface Strip {
  group: string;
  label: string;
  analog: boolean;
  dots: Dot[];
  missing: string[];
}

export interface Check {
  name: string;
  group: string;
  result: number;
  passMark: number;
  passed: boolean;
}

export interface Panel {
  id: string;
  title: string;
  strips: Strip[];
  checks: Check[];
}

export interface Checked {
  first: { passed: number; total: number };
  fourth: { passed: number; total: number; uncounted: number };
  uses: number;
  weightsCommit: string;
  configCommit: string;
  panels: Panel[];
}

function panel(test: ValidationTest, title: string): Panel {
  const strips = test.groups.map((g) => {
    const places = test.places.filter((p) => p.group === g.id);
    return {
      group: g.id,
      label: COMPARED.includes(g.id) ? g.name : "Known analogs",
      analog: !COMPARED.includes(g.id),
      dots: places.filter((p) => p.score !== null).map((p) => ({ name: p.name, score: p.score! })),
      missing: places.filter((p) => p.score === null).map((p) => p.name),
    };
  });
  const checks = test.checks
    .filter((c) => c.result !== null && c.passed !== null)
    .map((c) => ({
      name: c.name,
      group: strips.find((s) => !s.analog && c.name.toLowerCase().includes(s.label.toLowerCase()))!.group,
      result: c.result!,
      passMark: c.pass_mark,
      passed: c.passed!,
    }));
  return { id: test.id, title, strips, checks };
}

export function checked(v: Validation): Checked {
  const run = v.more_runs![0];
  const first = v.tests.flatMap((t) => t.checks);
  const fourth = run.tests.flatMap((t) => t.checks);
  return {
    first: { passed: first.filter((c) => c.passed === true).length, total: first.length },
    fourth: {
      passed: fourth.filter((c) => c.passed === true).length,
      total: fourth.filter((c) => c.passed !== null).length,
      uncounted: fourth.filter((c) => c.passed === null).length,
    },
    uses: 1 + (v.second_run ? 1 : 0) + (v.third_run ? 1 : 0) + v.more_runs!.length,
    weightsCommit: v.weights_commit,
    configCommit: run.config_commit,
    panels: HEADLINE.map(([id, title]) => panel(run.tests.find((t) => t.id === id)!, title)),
  };
}
