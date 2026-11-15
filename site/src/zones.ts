export interface Zones {
  keep: Uint8Array;
  outline: number[];
}

export function focus(score: Float32Array, share: number): Zones {
  const keep = new Uint8Array(score.length);
  const vals: number[] = [];
  for (const v of score) if (!Number.isNaN(v)) vals.push(v);
  vals.sort((a, b) => b - a);
  const cut = share >= 1 || !vals.length ? -Infinity : vals[Math.max(0, Math.ceil(share * vals.length) - 1)];
  for (let i = 0; i < score.length; i++) if (score[i] >= cut) keep[i] = 1;
  return { keep, outline: [] };
}
