import "./picker.css";
import { esc } from "./format";
import { icon } from "./icons";

export interface PickerOption {
  value: string;
  label: string;
  sub?: string;
  group?: string;
  dot?: "moon" | "mars" | "neutral";
  meta?: string;
  disabled?: boolean;
}

export interface PickerConfig {
  id: string;
  ariaLabel: string;
  options: PickerOption[];
  value: string;
  prefix?: string;
  variant?: "field" | "pill";
  align?: "left" | "right";
  minMenuWidth?: number;
  onChange(value: string): void;
}

export interface PickerHandle {
  readonly trigger: HTMLButtonElement;
  getValue(): string;
  setValue(value: string): void;
  setOptions(options: PickerOption[], value?: string): void;
  setBusy(busy: boolean): void;
  open(): void;
  close(focusTrigger?: boolean): void;
  focus(): void;
  destroy(): void;
}

let activePicker: PickerHandle | null = null;

export function createPicker(host: HTMLElement, cfg: PickerConfig): PickerHandle {
  const variant = cfg.variant ?? "field";
  const align = cfg.align ?? "left";
  let options = cfg.options.slice();
  let value = cfg.value;
  let isOpen = false;
  let activeIdx = -1;
  let typeBuf = "";
  let typeTimer = 0;
  let destroyed = false;

  const listId = `${cfg.id}-listbox`;

  host.classList.add("pk");
  host.dataset.variant = variant;
  host.dataset.open = "false";
  const prefixHtml = cfg.prefix
    ? `<span class="pk-pre" aria-hidden="true">${esc(cfg.prefix)}</span><span class="pk-div" aria-hidden="true"></span>`
    : "";
  host.innerHTML = `<button type="button" id="${esc(cfg.id)}" class="pk-btn" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${esc(
    listId,
  )}" aria-label="${esc(cfg.ariaLabel)}">${prefixHtml}<span class="pk-dot" hidden aria-hidden="true"></span><span class="pk-val"></span>${icon("chevron", "pk-chev")}</button>`;

  const trigger = host.querySelector<HTMLButtonElement>(".pk-btn")!;
  const dotEl = trigger.querySelector<HTMLElement>(".pk-dot")!;
  const valEl = trigger.querySelector<HTMLElement>(".pk-val")!;

  const pop = document.createElement("div");
  pop.id = listId;
  pop.className = "pk-pop";
  pop.dataset.variant = variant;
  pop.setAttribute("role", "listbox");
  pop.setAttribute("aria-label", cfg.ariaLabel);
  pop.hidden = true;
  document.body.append(pop);

  const selectedIndex = () => Math.max(0, options.findIndex((o) => o.value === value));

  const syncTrigger = () => {
    const cur = options.find((o) => o.value === value) ?? options[0];
    trigger.dataset.value = cur?.value ?? "";
    valEl.textContent = cur?.label ?? "";
    if (cur?.dot) {
      dotEl.hidden = false;
      dotEl.dataset.dot = cur.dot;
    } else {
      dotEl.hidden = true;
      delete dotEl.dataset.dot;
    }
  };

  const renderOptions = () => {
    let html = "";
    let lastGroup: string | undefined;
    options.forEach((opt, idx) => {
      if (opt.group && opt.group !== lastGroup) {
        lastGroup = opt.group;
        html += `<div class="pk-grp" role="presentation">${esc(opt.group)}</div>`;
      }
      const isSel = opt.value === value;
      const bodyHtml = opt.sub
        ? `<span class="pk-opt-body"><span class="pk-opt-lbl">${esc(opt.label)}</span><span class="pk-opt-sub">${esc(opt.sub)}</span></span>`
        : `<span class="pk-opt-lbl">${esc(opt.label)}</span>`;
      html += `<button type="button" class="pk-opt${isSel ? " is-selected" : ""}${opt.sub ? " has-sub" : ""}" id="${esc(cfg.id)}-opt-${idx}" role="option" data-idx="${idx}" data-value="${esc(
        opt.value,
      )}" aria-selected="${isSel}"${opt.disabled ? " disabled" : ""} tabindex="-1">${
        opt.dot ? `<i class="pk-dot" data-dot="${esc(opt.dot)}" aria-hidden="true"></i>` : ""
      }${bodyHtml}${opt.meta ? `<span class="pk-opt-meta">${esc(opt.meta)}</span>` : ""}<span class="pk-opt-chk" aria-hidden="true">${
        isSel ? icon("check") : ""
      }</span></button>`;
    });
    pop.innerHTML = html;
  };

  const highlight = (idx: number, scroll = true) => {
    if (!options.length) {
      activeIdx = -1;
      trigger.removeAttribute("aria-activedescendant");
      return;
    }
    let next = ((idx % options.length) + options.length) % options.length;
    if (options[next]?.disabled) {
      for (let step = 1; step < options.length; step++) {
        const cand = (next + step) % options.length;
        if (!options[cand]?.disabled) {
          next = cand;
          break;
        }
      }
    }
    activeIdx = next;
    const btns = pop.querySelectorAll<HTMLButtonElement>(".pk-opt");
    btns.forEach((b, k) => b.classList.toggle("is-active", k === activeIdx));
    const el = btns[activeIdx];
    if (el) {
      trigger.setAttribute("aria-activedescendant", el.id);
      if (scroll) el.scrollIntoView({ block: "nearest" });
    }
  };

  const position = () => {
    if (!isOpen) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;
    const gap = 6;
    const width = Math.min(vw - margin * 2, Math.max(r.width, cfg.minMenuWidth ?? (variant === "pill" ? 196 : r.width)));
    pop.style.width = `${Math.round(width)}px`;

    const spaceBelow = vh - r.bottom - gap - margin;
    const spaceAbove = r.top - gap - margin;
    const flip = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxH = Math.max(120, Math.min(340, flip ? spaceAbove : spaceBelow));
    pop.style.maxHeight = `${Math.floor(maxH)}px`;

    const menuH = Math.min(pop.scrollHeight + 2, maxH);
    const top = flip ? Math.max(margin, r.top - gap - menuH) : Math.min(vh - margin - menuH, r.bottom + gap);
    const rawLeft = align === "right" ? r.right - width : r.left;
    const left = Math.max(margin, Math.min(vw - margin - width, rawLeft));

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.dataset.flip = flip ? "up" : "down";
  };

  const close = (focusTrigger = false) => {
    if (!isOpen) return;
    isOpen = false;
    host.dataset.open = "false";
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    pop.hidden = true;
    if (activePicker === api) activePicker = null;
    if (focusTrigger) trigger.focus({ preventScroll: true });
  };

  const open = () => {
    if (destroyed || isOpen || trigger.disabled) return;
    if (activePicker && activePicker !== api) activePicker.close(false);
    isOpen = true;
    activePicker = api;
    host.dataset.open = "true";
    trigger.setAttribute("aria-expanded", "true");
    renderOptions();
    pop.hidden = false;
    position();
    highlight(selectedIndex(), true);
  };

  const commit = (nextVal: string) => {
    const opt = options.find((o) => o.value === nextVal);
    if (!opt || opt.disabled) return;
    const changed = nextVal !== value;
    value = nextVal;
    syncTrigger();
    close(true);
    if (changed) cfg.onChange(value);
  };

  const findByPrefix = (ch: string) => {
    clearTimeout(typeTimer);
    typeBuf += ch.toLowerCase();
    typeTimer = window.setTimeout(() => {
      typeBuf = "";
    }, 550);
    const start = isOpen && activeIdx >= 0 ? activeIdx : selectedIndex();
    for (let k = 0; k < options.length; k++) {
      const idx = (start + (typeBuf.length === 1 ? 1 : 0) + k) % options.length;
      const o = options[idx];
      if (!o.disabled && o.label.toLowerCase().startsWith(typeBuf)) return idx;
    }
    return -1;
  };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) close(false);
    else open();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) open();
      else highlight(activeIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) open();
      else highlight(activeIdx - 1);
    } else if (e.key === "Home" && isOpen) {
      e.preventDefault();
      highlight(0);
    } else if (e.key === "End" && isOpen) {
      e.preventDefault();
      highlight(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) open();
      else if (activeIdx >= 0 && options[activeIdx]) commit(options[activeIdx].value);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab" && isOpen) {
      close(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const hit = findByPrefix(e.key);
      if (hit >= 0) {
        e.preventDefault();
        if (isOpen) highlight(hit);
        else commit(options[hit].value);
      }
    }
  });

  pop.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  pop.addEventListener("mousemove", (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLButtonElement>(".pk-opt");
    if (!opt || opt.disabled) return;
    const idx = Number(opt.dataset.idx);
    if (Number.isInteger(idx) && idx !== activeIdx) highlight(idx, false);
  });

  pop.addEventListener("click", (e) => {
    e.stopPropagation();
    const opt = (e.target as HTMLElement).closest<HTMLButtonElement>(".pk-opt");
    if (!opt || opt.disabled) return;
    commit(opt.dataset.value ?? "");
  });

  const onDocPointer = (e: PointerEvent) => {
    if (!isOpen) return;
    const t = e.target as Node;
    if (!host.contains(t) && !pop.contains(t)) close(false);
  };

  const onReposition = (e: Event) => {
    if (!isOpen) return;
    if (e.type === "scroll" && e.target === pop) return;
    if (!host.isConnected || !trigger.offsetParent) {
      close(false);
      return;
    }
    position();
  };

  document.addEventListener("pointerdown", onDocPointer, true);
  window.addEventListener("resize", onReposition, { passive: true });
  window.addEventListener("scroll", onReposition, true);

  syncTrigger();

  const api: PickerHandle = {
    trigger,
    getValue: () => value,
    setValue(next) {
      value = next;
      syncTrigger();
      if (isOpen) renderOptions();
    },
    setOptions(nextOpts, nextVal) {
      options = nextOpts.slice();
      if (nextVal !== undefined) value = nextVal;
      syncTrigger();
      if (isOpen) {
        renderOptions();
        position();
      }
    },
    setBusy(busy) {
      if (busy) trigger.setAttribute("aria-busy", "true");
      else trigger.removeAttribute("aria-busy");
    },
    open,
    close,
    focus() {
      trigger.focus({ preventScroll: true });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      close(false);
      clearTimeout(typeTimer);
      document.removeEventListener("pointerdown", onDocPointer, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      pop.remove();
    },
  };

  return api;
}
