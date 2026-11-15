import { reduced } from "./format";

export interface Page {
  title(): string;
  mount(el: HTMLElement): void;
  show(q: URLSearchParams): Promise<void> | void;
  hide?(): void;
}

type How = "push" | "replace" | "pop";

const HOLDS: [RegExp, string][] = [
  [/^(checked|first-run|second-run|third-run|run-\d+)$/, "about"],
  [/^(about-h|scoring|challenge|benchmarks|questions|terrain|data|limits|credits)$/, "about"],
  [/^(explore|ledger-h)$/, "find"],
  [/^(card|c-cant)$/, "place"],
  [/^(intro|ch-[a-z]+)$/, ""],
];

const ALIAS: Record<string, string> = { moon: "ch-moon", mars: "ch-mars" };

const HOME_TITLE = "Parallels: Earth's closest parallels to every part of a Moon or Mars base";

let pages: Record<string, () => Page> = {};
let root: HTMLElement;
let changed: (path: string) => void = () => {};
let current = "";
let shown: string | null = null;
let seq = 0;
const made = new Map<string, { page: Page; el: HTMLElement }>();
const last = new Map<string, string>();

function parse(hash: string) {
  const s = hash.replace(/^#\/?/, "");
  const i = s.indexOf("?");
  return { path: i < 0 ? s : s.slice(0, i), q: new URLSearchParams(i < 0 ? "" : s.slice(i + 1)) };
}

export const holder = (id: string) => HOLDS.find(([r]) => r.test(id))?.[1] ?? null;

export const hrefFor = (path: string) => last.get(path) ?? `#/${path}`;

export const at = () => shown;

export function reveal(id: string, smooth: boolean) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  el.scrollIntoView({ behavior: smooth && !reduced() ? "smooth" : "auto", block: "start" });
  if (el.tabIndex >= 0 || el.hasAttribute("tabindex")) el.focus({ preventScroll: true });
  return true;
}

const name = (p: Page) => {
  const t = p.title();
  return t ? `${t} · Parallels` : HOME_TITLE;
};

async function open(hash: string, how: How, anchor?: string) {
  const { path: raw, q } = parse(hash);
  const path = raw in pages ? raw : "";
  anchor ??= ALIAS[raw];
  if (path !== raw) {
    hash = "#/";
    if (how === "pop") how = "replace";
  }
  if (how === "push" && location.hash !== hash) history.pushState(null, "", hash);
  else if (how !== "pop") history.replaceState(null, "", hash);
  current = hash;
  last.set(path, hash);
  const mine = ++seq;
  for (const [p, e] of made)
    if (p !== path && !e.el.hidden) {
      e.el.hidden = true;
      e.page.hide?.();
    }
  let entry = made.get(path);
  if (!entry) {
    const el = document.createElement("div");
    el.className = "page";
    el.dataset.page = path || "home";
    root.append(el);
    const page = pages[path]();
    entry = { page, el };
    made.set(path, entry);
    page.mount(el);
  }
  entry.el.hidden = false;
  shown = path;
  changed(path);
  document.title = name(entry.page);
  scrollTo({ top: 0, behavior: "instant" });
  entry.el.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  await entry.page.show(q);
  if (mine !== seq) return;
  document.title = name(entry.page);
  if (anchor) reveal(anchor, false);
}

export function go(href: string, replace = false): void {
  if (href.startsWith("#/") || href === "#") {
    void open(href === "#" ? "#/" : href, replace ? "replace" : "push");
    return;
  }
  const id = decodeURIComponent(href.replace(/^#/, ""));
  if (!id) return;
  const el = document.getElementById(id);
  const page = el?.closest<HTMLElement>(".page");
  if (el && (!page || !page.hidden)) {
    reveal(id, true);
    return;
  }
  const r = holder(id);
  if (r != null) void open(hrefFor(r), replace ? "replace" : "push", id);
}

export function setQuery(path: string, q: string): void {
  const h = `#/${path}${q ? `?${q}` : ""}`;
  last.set(path, h);
  if (shown === path) {
    history.replaceState(null, "", h);
    current = h;
  }
  changed(shown ?? "");
}

function fromLocation(how: How, force = false) {
  const h = location.hash;
  if (h === current && !force) return;
  if (!h || h === "#" || h.startsWith("#/")) {
    void open(h.startsWith("#/") ? h : "#/", how);
    return;
  }
  const id = decodeURIComponent(h.slice(1));
  const r = holder(id);
  void open(`#/${r ?? ""}`, "replace", id);
}

const OLD = ["t", "f", "yr", "type", "w", "c"];

export function startRouter(el: HTMLElement, routes: Record<string, () => Page>, onChange: (path: string) => void): void {
  root = el;
  pages = routes;
  changed = onChange;
  const s = new URLSearchParams(location.search);
  if (s.has("t")) {
    const q = new URLSearchParams();
    for (const k of OLD) if (s.has(k)) q.set(k, s.get(k)!);
    history.replaceState(null, "", `${location.pathname}#/${s.has("c") ? "place" : "find"}?${q}`);
  }
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.target) return;
    e.preventDefault();
    go(a.getAttribute("href")!);
  });
  addEventListener("popstate", () => fromLocation("pop"));
  addEventListener("hashchange", () => fromLocation("pop"));
  fromLocation("replace", true);
}
