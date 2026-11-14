import "./tour.css";
import { reduced } from "./format";

const STEPS: { at: string; title: string; text: string }[] = [
  { at: ".ledger-col", title: "Earth's top 10", text: "Every patch of Earth's land is scored for this base site and this test. These ten score highest. The ring shows the match out of 100." },
  { at: ".earth-col", title: "The whole map", text: "Brighter land is a closer match. The numbered pins are the top 10. Click any land to open its match." },
  { at: ".mv-cmp", title: "Side by side", text: "The place on Earth beside the Moon or Mars site, drawn at the same ground scale so sizes compare honestly." },
  { at: ".mv-verdict", title: "The verdict", text: "The match score, the trait that ranks lowest, what matches and what breaks." },
  { at: ".mv-chs", title: "Part by part", text: "The score is built from challenges. Open a tile to see each trait against its target, with the dataset it comes from." },
  { at: ".mv-strips", title: "Where the analogy breaks", text: "What is weak at this place, and what no place on Earth can copy: gravity, air and radiation." },
  { at: "#checked", title: "How we checked it", text: "Places already used as analogs should beat ordinary places. Checks that did not pass stay on show." },
];

export function tour(button: HTMLElement): void {
  let n = -1;
  let raf = 0;
  const hole = document.createElement("div");
  hole.className = "tour-hole";
  hole.hidden = true;
  const box = document.createElement("div");
  box.className = "tour-box";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Guided tour");
  box.innerHTML = `<p class="tour-n" aria-hidden="true"></p><div aria-live="polite"><h2 class="tour-t"></h2><p class="tour-p"></p></div>
    <div class="tour-btns"><button type="button" data-tour="back">Back</button><button type="button" data-tour="next" class="tour-next">Next</button><button type="button" data-tour="end" aria-label="Close the tour">Close</button></div>`;
  document.body.append(hole, box);
  const target = () => document.querySelector<HTMLElement>(STEPS[n].at);

  const track = () => {
    raf = 0;
    if (n < 0) return;
    const el = target();
    if (el) {
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, innerHeight);
      hole.style.cssText = `left:${Math.max(r.left, 0)}px;top:${top}px;width:${Math.min(r.right, innerWidth) - Math.max(r.left, 0)}px;height:${Math.max(0, bottom - top)}px`;
    }
    raf = requestAnimationFrame(track);
  };

  const show = (k: number): void => {
    n = k;
    const el = target();
    if (!el) {
      if (k < STEPS.length - 1) show(k + 1);
      else end();
      return;
    }
    box.querySelector(".tour-n")!.textContent = `${k + 1} of ${STEPS.length}`;
    box.querySelector(".tour-t")!.textContent = STEPS[k].title;
    box.querySelector(".tour-p")!.textContent = STEPS[k].text;
    box.querySelector<HTMLButtonElement>('[data-tour="back"]')!.disabled = k === 0;
    box.querySelector('[data-tour="next"]')!.textContent = k === STEPS.length - 1 ? "Finish" : "Next";
    hole.hidden = box.hidden = false;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: el.offsetHeight > innerHeight * 0.7 ? "start" : "center" });
    if (!raf) raf = requestAnimationFrame(track);
  };

  function end() {
    n = -1;
    hole.hidden = box.hidden = true;
    cancelAnimationFrame(raf);
    raf = 0;
    button.focus({ preventScroll: true });
  }

  button.addEventListener("click", () => {
    show(0);
    box.querySelector<HTMLButtonElement>(".tour-next")!.focus({ preventScroll: true });
  });
  box.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]");
    if (!b) return;
    if (b.dataset.tour === "end") end();
    else if (b.dataset.tour === "back") show(Math.max(0, n - 1));
    else if (n === STEPS.length - 1) end();
    else show(n + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (n >= 0 && e.key === "Escape") end();
  });
}
