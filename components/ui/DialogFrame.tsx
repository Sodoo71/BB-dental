"use client";
import { containModalFocus } from "./modal-focus";
import { useEffect, useRef, type ReactNode } from "react";
export function DialogFrame({ children, onClose, label, size = "max-w-xl" }: { children: ReactNode; onClose: () => void; label: string; size?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} tabIndex={-1} onKeyDown={containModalFocus} aria-label={label} className={`dialog-frame ${size}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>{children}</dialog>;
}
