import { useEffect, useState } from "preact/hooks";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CountUp({ value, ms = 1100, delay = 700 }: { value: number; ms?: number; delay?: number }) {
  const [shown, setShown] = useState(() => (reduced() ? value : 0));
  useEffect(() => {
    if (reduced()) return setShown(value);
    let frame = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      <span aria-hidden="true">{shown.toLocaleString("en")}</span>
      <span class="sr">{value.toLocaleString("en")}</span>
    </>
  );
}

const REVEALED = ".after, .foot > div";
const REVEALED_NARROW = '.chapter:not([data-chapter="intro"]) .copy';

export function useReveal() {
  const [watch] = useState(() =>
    typeof IntersectionObserver === "undefined" || reduced()
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              e.target.classList.add("in");
              watch!.unobserve(e.target);
            }
          },
          { rootMargin: "0px 0px -12% 0px" },
        ),
  );
  useEffect(() => {
    if (!watch) return;
    for (const el of document.querySelectorAll(`:is(${REVEALED}, ${REVEALED_NARROW}):not(.reveal)`)) {
      el.classList.add("reveal");
      watch.observe(el);
    }
  });
  useEffect(() => () => watch?.disconnect(), []);
}

export function useScrolled(after = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const check = () => setScrolled(scrollY > after);
    addEventListener("scroll", check, { passive: true });
    check();
    return () => removeEventListener("scroll", check);
  }, []);
  return scrolled;
}
