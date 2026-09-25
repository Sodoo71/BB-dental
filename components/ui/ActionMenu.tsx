"use client";

import { Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type MenuAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
};

export function ActionMenu({ label, actions, disabled = false }: {
  label: string;
  actions: MenuAction[];
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = (restoreFocus = false) => {
    menu.current?.hidePopover();
    if (restoreFocus) trigger.current?.focus();
  };

  const show = (last = false) => {
    const panel = menu.current;
    const button = trigger.current;
    if (!panel || !button) return;
    panel.showPopover();
    const anchor = button.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    const gap = 6;
    const top = anchor.bottom + gap + bounds.height <= window.innerHeight - 8
      ? anchor.bottom + gap
      : anchor.top - gap - bounds.height;
    panel.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
    panel.style.top = `${Math.max(8, top)}px`;
    const items = panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items[last ? items.length - 1 : 0]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      menu.current?.hidePopover();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close(true);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return <>
    <button
      ref={trigger}
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={id}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
      onClick={() => menu.current?.matches(":popover-open") ? close(true) : show()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          show(event.key === "ArrowUp");
        }
      }}
    ><Ellipsis className="h-5 w-5" /></button>
    <div
      ref={menu}
      id={id}
      popover="auto"
      role="menu"
      aria-label={label}
      className="fixed inset-auto m-0 max-h-[calc(100dvh-16px)] w-60 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg"
      onToggle={(event) => setOpen(event.newState === "open")}
      onKeyDown={onMenuKeyDown}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      {actions.map((action) => <button
        key={action.label}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-offset-[-3px] ${action.destructive ? "text-red-600 hover:bg-red-50 focus:bg-red-50" : "text-slate-700 hover:bg-slate-50 focus:bg-slate-50"}`}
        onClick={() => { close(true); action.onSelect(); }}
      >{action.icon}<span>{action.label}</span></button>)}
    </div>
  </>;
}
