# Cron Expression Builder Pro

Build cron expressions visually, read them back in plain English, and preview the next 5 run times — fast, private, and fully offline.

> A premium, zero-dependency cron workbench. Pick minute/hour/day/month/weekday rules with segmented controls or type a raw expression directly — both stay in sync. Get a hand-written, human-readable explanation and a real next-run calculator, all in your browser, with nothing ever leaving your machine.

## Overview

Cron Expression Builder Pro is part of the **Web Utility Suite**. It runs entirely in the browser with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. Five field cards (minute, hour, day-of-month, month, day-of-week) each support four modes — Every, Specific, Range, Step — and stay fully synced with a raw 5-field cron expression input in both directions. An explanation panel translates the current expression into a plain-English sentence, and a next-run panel lists the next 5 times the schedule will actually fire, computed by a purpose-built cron simulator.

## Features

- **Visual field builder** — minute, hour, day-of-month, month, and day-of-week, each with Every / Specific / Range / Step / List (comma-separated) modes, kept in sync with each other and with the raw expression. Month and day-of-week names (January, Monday, …) are used when rendering the plain-English explanation.
- **Two-way raw expression sync** — edit the pickers and the raw `* * * * *` string updates live; paste or type a raw expression and it parses back into the pickers, including `*/n`, `a-b`, `a-b/n`, and comma lists.
- **10 built-in presets** — every minute, every 5/15 minutes, hourly, every 2 hours, daily at midnight, weekdays at 9am, weekly, monthly, and yearly.
- **Plain-English explanation** — written from scratch in JavaScript (no library), correctly reflecting cron's day-of-month/day-of-week **OR** semantics when both are restricted.
- **Next 5 run times** — a hand-written cron-to-next-run simulator (no library) walks forward from now, field by field, with a relative "in N days/hours/minutes" label next to each result (refreshed every 30s) and a safety cap (~4 simulated years) that reports "no matching run time found" for impossible schedules (e.g. day 30 of a fixed February).
- **Inline validation** — each field flags out-of-range values, malformed ranges, and invalid steps without crashing the app; a status badge and error panel surface the problem.
- **Copy** the raw expression to the clipboard.
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

1. Set each field's mode (Every / Specific / Range / Step) using the segmented control on its card — or paste/type a raw cron expression directly into the top bar.
2. Watch the **Explanation** panel update live with a plain-English description of the schedule.
3. Check the **Next 5 run times** panel to see exactly when the schedule will next fire, in your local time.
4. Fix any field flagged with a red error before relying on the result.
5. **Copy** the raw expression once you're happy with it, or pick one of the 10 presets to start from a common schedule.

## Keyboard Shortcuts

| Action                | Shortcut                       |
| ---------------------- | ------------------------------ |
| Copy expression        | <kbd>Ctrl/⌘</kbd> + <kbd>C</kbd> |
| Show shortcuts help    | <kbd>?</kbd>                    |
| Close dialog            | <kbd>Esc</kbd>                  |

## Screenshots

> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap

- [ ] Named schedule presets (`@daily`, `@hourly`, `@weekly`, …)
- [ ] Support for non-standard 6-field crons with seconds
- [ ] Time zone selector for the next-run calculation
- [ ] Export/import a library of saved expressions
- [ ] Visual calendar heatmap of upcoming run times

## License

MIT Licensed. Part of the [Web Utility Suite](../index.html).
