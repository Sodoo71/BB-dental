import type { KeyboardEvent } from "react";

/** Move focus among visible native day buttons; Enter/Space still choose the day. */
export function calendarKeyNavigation(
  event: KeyboardEvent<HTMLElement>,
  offset: number,
) {
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  );
  const target = (event.target as HTMLElement).closest("button");
  const index = buttons.findIndex((button) => button === target);
  if (index < 0) return;
  const weekday = (index + offset) % 7;
  const next = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - 7,
    ArrowDown: index + 7,
    Home: Math.max(0, index - weekday),
    End: Math.min(buttons.length - 1, index + 6 - weekday),
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  buttons[next]?.focus();
}
