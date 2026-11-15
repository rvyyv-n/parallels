import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import "./intro.css";
import "./work.css";
import "./pages/pages.css";
import type { Manifest, Target } from "./contract";
import { manifest } from "./data";
import { esc } from "./format";
import { logo } from "./logo";
import { hrefFor, startRouter } from "./router";
import { createCtx } from "./pages/ctx";
import { homePage } from "./pages/home";
import { finder } from "./pages/find";
import { place } from "./pages/place";
import { about } from "./pages/about";
import { learnPage } from "./pages/learn";

const AI_NOTE =
  "How we used AI: the idea and the key design decisions are our team's. Claude (Anthropic) helped research the challenge, write our planning documents, and write and test the code and data pipeline. Our logo was drawn with AI. We check its work at each checkpoint.";

const NAV = [
  ["", "Home"],
  ["find", "Finder"],
  ["learn", "Learn"],
  ["about", "About"],
];

const app = document.getElementById("app")!;

function shell(m: Manifest) {
  app.innerHTML = `
    ${m.sample ? `<p class="sample" role="note"><b>Sample data.</b> Every number on this page is a made-up test value while the real data is processed. Nothing here is a result yet.</p>` : ""}
    <header class="top">
      <a class="skip" href="#main">Skip to content</a>
      <a class="brand" href="#/" aria-label="Parallels, home">${logo()}<span class="wordmark">Parallels</span></a>
      <p class="tagline">Earth's closest parallels to every part of a Moon or Mars base.</p>
      <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav-list"><span class="menu-i" aria-hidden="true"></span>Menu</button>
      <nav aria-label="Pages"><ul id="nav-list">${NAV.map(([r, n]) => `<li><a href="#/${r}" data-route="${r}">${esc(n)}</a></li>`).join("")}</ul></nav>
    </header>
    <main id="main" tabindex="-1"></main>
    <footer class="foot">
      <p class="brand">${logo()}<span class="wordmark small">Parallels</span></p>
      <p>NASA Space Apps Challenge 2026 entry: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars. Data generated ${esc(m.generated)}.</p>
      <p class="ai" id="ai-note">${esc(AI_NOTE)}</p>
      <p class="small muted">No NASA logos or insignia are used. Imagery credits are in the <a href="#data">Data section of the About page</a>.</p>
    </footer>`;
}

function menu() {
  const top = app.querySelector<HTMLElement>(".top")!;
  const btn = top.querySelector<HTMLButtonElement>("#menu-btn")!;
  const set = (open: boolean) => {
    top.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || btn.getAttribute("aria-expanded") !== "true") return;
    set(false);
    btn.focus();
  });
  document.addEventListener("click", (e) => {
    if (!top.contains(e.target as Node) || (e.target as Element).closest("nav a")) set(false);
  });
  new ResizeObserver(() => document.documentElement.style.setProperty("--top-h", `${Math.ceil(top.offsetHeight)}px`)).observe(top);
  return () => set(false);
}

function site(t: Target | null) {
  if (t) for (const el of app.querySelectorAll<SVGElement>(".logo")) el.dataset.body = t.body;
}

async function main() {
  let m: Manifest;
  try {
    m = await manifest();
  } catch (e) {
    app.innerHTML = `<div class="boot"><img src="${import.meta.env.BASE_URL}favicon.svg" width="28" height="28" alt=""><b>PARALLELS</b></div><p class="fatal" role="alert">The data files could not be loaded (${esc((e as Error).message)}). Please check your connection and reload the page.</p>`;
    return;
  }
  shell(m);
  const close = menu();
  const ctx = createCtx(m, site);
  const finderLink = app.querySelector<HTMLAnchorElement>('.top a[data-route="find"]')!;
  startRouter(
    app.querySelector<HTMLElement>("#main")!,
    {
      "": () => homePage(ctx),
      find: () => finder(ctx),
      place: () => place(ctx),
      learn: () => learnPage(ctx),
      about: () => about(ctx),
    },
    (path) => {
      close();
      finderLink.href = hrefFor("find");
      for (const a of app.querySelectorAll<HTMLElement>(".top nav a")) {
        if (a.dataset.route === path) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
    },
  );
}

main();
