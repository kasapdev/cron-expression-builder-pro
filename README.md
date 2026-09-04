# Cron Expression Builder Pro

Build, parse and validate cron expressions visually — with a live human-readable explanation and a next-5-run-times preview.

> A premium, zero-dependency cron workbench. Pick each of the five fields with Every / Specific / Range / Step / List controls, or type a raw expression directly — both stay perfectly in sync. Every keystroke re-parses the schedule, explains it in plain English, and lists the next five times it will actually fire, all computed from scratch in the browser with nothing ever leaving your machine.

## Overview

Cron Expression Builder Pro is part of the **Web Utility Suite**. It runs entirely in the browser with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. Five field-picker cards (Minute, Hour, Day-of-month, Month, Day-of-week) drive a raw 5-field expression input, and vice versa: edit or paste any valid cron string and the pickers instantly reflect it. A hand-written parser, explainer, and next-run calculator power the whole thing — no cron library involved.

## Features

- **Five field pickers** (Minute, Hour, Day-of-month, Month, Day-of-week), each with an **Every / Specific / Range / Step / List** segmented sub-mode and the right input for the job (number spinner or named `<select>` for months/weekdays).
- **Bidirectional sync** — changing a picker rewrites the raw expression; editing or pasting into the raw field re-parses it and updates every picker to match.
- **Hand-written cron parser** supporting `*`, `*/n`, `a`, `a-b`, `a-b/n`, `a/n`, and comma-separated combinations of all of the above (e.g. `1-5,10,*/15`).
- **Live human-readable explanation** generated from scratch in plain JS — e.g. *"At 09:00, on weekdays."* or *"At every 15 minutes past every hour, every day."*
- **Next 5 run times**, computed by a hand-written day-by-day forward search that respects standard cron day-of-month/day-of-week **OR** semantics (when both fields are restricted, a date matches if it satisfies *either* one) and shows a friendly empty state for impossible schedules (e.g. day 30 of February).
- **Presets dropdown** — every minute, every 5/15 minutes, hourly, every 2 hours, daily at midnight, weekdays at 9am, weekly on Monday, monthly on the 1st, yearly on Jan 1.
- **Validation** — malformed or out-of-range expressions are clearly flagged in an error panel; the explanation and next-run list hide until the expression is valid again.
- **Copy** the raw expression to the clipboard in one click.
- **Auto-persist** — your last expression is saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px, accessible, and keyboard-driven.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/cron-expression-builder-pro.git
cd cron-expression-builder-pro
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Pick a **preset** from the dropdown, or build your own schedule using the five field cards — switch each field's mode between **Every**, **Specific**, **Range**, **Step**, and **List**.
2. Watch the **raw expression** field update live, or type/paste a cron string directly into it — press **Apply** (or <kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd>) to commit it explicitly.
3. Read the **Explanation** panel for a plain-English description of the schedule.
4. Check the **Next 5 runs** panel to see exactly when the schedule will fire next, with a relative "in N minutes/hours/days" label.
5. If the expression is invalid, the **error panel** explains why — fix the field count or an out-of-range value and the explanation/runs reappear automatically.
6. **Copy** the raw expression whenever you need it elsewhere.

## Keyboard Shortcuts

| Action                | Shortcut                       |
| ---------------------- | ------------------------------ |
| Apply raw expression   | <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd> |
| Copy expression        | <kbd>Ctrl/⌘</kbd> + <kbd>C</kbd> |
| Show shortcuts help    | <kbd>?</kbd>                    |
| Close dialog           | <kbd>Esc</kbd>                  |

## Screenshots

> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap

- [ ] Timezone-aware next-run calculation (currently uses the browser's local time)
- [ ] Named month/weekday tokens in the raw expression (`JAN`, `MON`, etc.)
- [ ] Support for `@yearly` / `@daily` / `@hourly` shorthand nicknames
- [ ] Export a schedule summary (crontab line + explanation) as a shareable snippet
- [ ] Visual weekly calendar heatmap of upcoming runs

## License

MIT Licensed. Part of the [Web Utility Suite](https://github.com/kasapdev/web-utility-suite).
