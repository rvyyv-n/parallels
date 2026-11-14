import { useEffect, useState } from "preact/hooks";

export interface View {
  target: string;
  filter: string;
  yearRound: boolean;
  terrain: string | null;
  place: number | null;
  page: "main" | "judges";
}

export const DEFAULT_VIEW: View = {
  target: "moon-south-pole",
  filter: "rover",
  yearRound: false,
  terrain: null,
  place: null,
  page: "main",
};

function parse(hash: string): View {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const place = Number(q.get("p"));
  return {
    target: q.get("t") ?? DEFAULT_VIEW.target,
    filter: q.get("f") ?? DEFAULT_VIEW.filter,
    yearRound: q.get("yr") === "1",
    terrain: q.get("tt"),
    place: q.has("p") && Number.isInteger(place) ? place : null,
    page: q.get("v") === "judges" ? "judges" : "main",
  };
}

function serialise(v: View): string {
  const q = new URLSearchParams();
  if (v.target !== DEFAULT_VIEW.target) q.set("t", v.target);
  if (v.filter !== DEFAULT_VIEW.filter) q.set("f", v.filter);
  if (v.yearRound) q.set("yr", "1");
  if (v.terrain) q.set("tt", v.terrain);
  if (v.place !== null) q.set("p", String(v.place));
  if (v.page === "judges") q.set("v", "judges");
  const s = q.toString();
  return s ? `#${s}` : "";
}

export function useView(): [View, (patch: Partial<View>) => void] {
  const [view, setView] = useState(() => parse(location.hash));

  useEffect(() => {
    const onHash = () => setView(parse(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const update = (patch: Partial<View>) => {
    const next = { ...view, ...patch };
    const hash = serialise(next);
    const url = location.pathname + location.search + hash;
    if ("page" in patch || "place" in patch) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    setView(next);
  };

  return [view, update];
}

export function useAsync<T>(load: () => Promise<T> | undefined, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    const p = load();
    if (!p) {
      setValue(undefined);
      return;
    }
    p.then(
      (v) => live && setValue(() => v),
      (e) => console.error(e),
    );
    return () => {
      live = false;
    };
  }, deps);
  return value;
}

export function scrollToId(id: string) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
