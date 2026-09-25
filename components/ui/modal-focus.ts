import type { KeyboardEvent } from "react";
/** Keep Tab inside modal content, including the boundary before browser chrome. */
export function containModalFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length > 0 && !element.closest('[inert], [hidden]'));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (active === last || active === dialog)) { event.preventDefault(); first.focus(); }
}
