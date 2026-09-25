"use client";
import { containModalFocus } from "./modal-focus";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={ref} tabIndex={-1} onKeyDown={containModalFocus} aria-label={label} className="drawer-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current && event.clientX > (ref.current?.getBoundingClientRect().right ?? 0)) onClose(); }}>
    <button type="button" aria-label="Цэс хаах" onClick={onClose} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"><X size={20} /></button>
    {children}
  </dialog>;
}
