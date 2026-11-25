import { reduced } from "./format";

export interface PillRangeOptions {
  gradient?: boolean;
}

export function bindSegmented(group: HTMLElement): () => void {
  const existing = group.querySelector<HTMLElement>(":scope > .seg-thumb");
  const thumb = existing ?? document.createElement("span");
  if (!existing) {
    thumb.className = "seg-thumb seg-instant";
    thumb.setAttribute("aria-hidden", "true");
    group.prepend(thumb);
  }
  group.classList.add("seg-has-thumb");

  let positioned = false;
  let raf = 0;
  let unfreezeRaf = 0;
  let disposed = false;

  const measure = (instant: boolean) => {
    if (disposed || !group.isConnected) return;
    const active = group.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active || active.offsetWidth === 0 || group.offsetWidth === 0) {
      thumb.style.opacity = "0";
      positioned = false;
      return;
    }
    const gr = group.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    if (!gr.width || !ar.width) {
      thumb.style.opacity = "0";
      positioned = false;
      return;
    }
    const x = ar.left - gr.left - group.clientLeft;
    const y = ar.top - gr.top - group.clientTop;
    const snap = instant || !positioned || reduced();
    if (snap) {
      cancelAnimationFrame(unfreezeRaf);
      thumb.classList.add("seg-instant");
    }
    thumb.style.width = `${ar.width}px`;
    thumb.style.height = `${ar.height}px`;
    thumb.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    thumb.style.opacity = "1";
    positioned = true;
    if (snap && !reduced()) {
      unfreezeRaf = requestAnimationFrame(() => {
        unfreezeRaf = 0;
        if (!disposed) thumb.classList.remove("seg-instant");
      });
    }
  };

  const schedule = (instant = false) => {
    if (disposed || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      measure(instant);
    });
  };

  const mo = new MutationObserver((records) => {
    let structural = false;
    for (const r of records) {
      if (r.type === "childList") structural = true;
    }
    if (structural) observeChildren();
    measure(false);
  });
  mo.observe(group, { attributes: true, attributeFilter: ["aria-pressed"], subtree: true, childList: true });

  const ro = new ResizeObserver(() => schedule(true));
  const observeChildren = () => {
    ro.disconnect();
    ro.observe(group);
    for (const child of group.children) {
      if (child !== thumb) ro.observe(child);
    }
  };
  observeChildren();

  measure(true);
  document.fonts?.ready?.then(() => schedule(true));

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(unfreezeRaf);
    mo.disconnect();
    ro.disconnect();
    group.classList.remove("seg-has-thumb");
    if (!existing && thumb.parentNode === group) thumb.remove();
  };
}

export function syncPillRange(input: HTMLInputElement): void {
  const wrap = input.closest<HTMLElement>(".prange");
  if (!wrap) return;
  const min = input.min === "" ? 0 : Number(input.min);
  const max = input.max === "" ? 100 : Number(input.max);
  const val = Number(input.value);
  const span = max - min;
  const ratio = span > 0 && Number.isFinite(val) ? Math.max(0, Math.min(1, (val - min) / span)) : 0;
  wrap.style.setProperty("--ratio", ratio.toFixed(4));
  wrap.classList.toggle("is-disabled", input.disabled);
}

export function bindPillRange(input: HTMLInputElement, opts?: PillRangeOptions): () => void {
  const already = input.parentElement?.classList.contains("prange") ? input.parentElement : null;
  let wrap: HTMLElement;
  if (already) {
    wrap = already;
  } else {
    wrap = document.createElement("span");
    wrap.className = "prange";
    const track = document.createElement("span");
    track.className = "prange-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "prange-fill";
    const knob = document.createElement("span");
    knob.className = "prange-knob";
    track.append(fill, knob);
    input.parentNode?.insertBefore(wrap, input);
    wrap.append(track, input);
  }
  wrap.classList.toggle("prange-grad", !!opts?.gradient);

  const onSync = () => syncPillRange(input);
  const onFocus = () => {
    let vis = true;
    try {
      vis = input.matches(":focus-visible");
    } catch {
      vis = true;
    }
    wrap.classList.toggle("is-focus", vis);
  };
  const onBlur = () => wrap.classList.remove("is-focus");
  const onDown = () => {
    if (!input.disabled) wrap.classList.add("is-active");
  };
  const onUp = () => wrap.classList.remove("is-active");

  input.addEventListener("input", onSync);
  input.addEventListener("change", onSync);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  const mo = new MutationObserver(onSync);
  mo.observe(input, { attributes: true, attributeFilter: ["disabled", "min", "max", "value"] });

  syncPillRange(input);

  return () => {
    mo.disconnect();
    input.removeEventListener("input", onSync);
    input.removeEventListener("change", onSync);
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("pointerdown", onDown);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
    wrap.classList.remove("is-focus", "is-active");
    if (!already && wrap.parentNode) {
      wrap.parentNode.insertBefore(input, wrap);
      wrap.remove();
    }
  };
}
