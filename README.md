# cc-mods

Unofficial mods for Claude Code. This project is not affiliated with or endorsed by Anthropic.

[![CI](https://github.com/henry40408/cc-mods/actions/workflows/ci.yml/badge.svg)](https://github.com/henry40408/cc-mods/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/henry40408/cc-mods)](https://github.com/henry40408/cc-mods/releases/latest)
[![License](https://img.shields.io/github/license/henry40408/cc-mods)](LICENSE.txt)
[![Claude Code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhenry40408%2Fcc-mods%2Fmain%2F.github%2Fci%2Fpackage.json&query=%24.devDependencies%5B%22%40anthropic-ai%2Fclaude-code%22%5D&label=Claude%20Code&color=blue)](.github/ci/package.json)
[![Casual Maintenance Intended](https://casuallymaintained.tech/badge.svg)](https://casuallymaintained.tech/)
[![Vibe Coded](https://img.shields.io/badge/vibe_coded-Claude-d97757?logo=anthropic&logoColor=white)](https://claude.com/claude-code)

| Mods |
| --- |
| [`session-timeline`](#session-timeline) shows what the session did and when, what it is doing now, and what comes next. The panel sits beside the transcript; run `/timeline` to open it. |
| [`desktop-statusline`](#desktop-statusline) shows context fill and rate limits above the prompt in the desktop app. |

## Install

At the prompt of a terminal session:

```
/plugin install session-timeline --marketplace henry40408/cc-mods
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```sh
claude plugin install session-timeline --marketplace henry40408/cc-mods
```

In the desktop app, where `/plugin` is not available: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `henry40408/cc-mods`, then **Add plugin**.

These steps name `session-timeline`. To install `desktop-statusline`, use its name instead. Releases up to `v0.2.0` do not include it.

### Follow `main`

Installed as above, a mod follows the `main` branch. To update, run this in a shell, then restart Claude Code or run `/reload-plugins`:

```sh
claude plugin update session-timeline@henry40408
```

### Stay on a release

Add `#<tag>` to the marketplace to stay on that release. Pick a tag from the releases of this repository.

```sh
claude plugin install session-timeline --marketplace 'henry40408/cc-mods#v0.1.0'
```

- The tag applies to the whole marketplace, so every mod from cc-mods stays at that release.
- `claude plugin update` keeps you on the tag. To move to another release, remove the marketplace, which also uninstalls its mods, then install again:

  ```sh
  claude plugin marketplace remove henry40408
  claude plugin install session-timeline --marketplace 'henry40408/cc-mods#v0.2.0'
  ```

- `session-timeline@henry40408@v0.1.0` does not select a release: Claude Code ignores the last part.
- Claude Code shows a commit SHA as the version, not the release number.

### Requirements

These mods need a version of Claude Code that supports mods. CI tests them with the version in the Claude Code badge at the top. CI does not test the desktop app.

The **Working** spinner of `session-timeline` uses Nerd Font glyphs (U+EE06 to U+EE0B). If your terminal has no font with them, you see a placeholder instead.

## session-timeline

In the fullscreen terminal UI, the panel opens on its own when there is room beside the transcript. Run `/timeline` to open it yourself.

| Section | What it shows |
| --- | --- |
| **Working**, **Waiting for you** or **Idle, your turn** | The current state, the calls still running with their elapsed time, and the latest thing Claude said |
| **Recap** | The latest session recap, automatic or from `/recap`. Hidden until there is one |
| **Up next** | Claude's plan with a progress bar and, for each step started or finished, when that was and how long it has taken, plus background tasks and scheduled wakeups |
| **History (new → old)** | What was done, grouped by the prompt that started it, with totals of prompts, actions and failures |

### In the desktop app

The desktop app shows the same information as a page of cards:

- The status card changes color with the state. While Claude works or waits for you, its icon moves.
- The plan has a progress strip with one segment for each step.
- History starts with counts of prompts, actions and failures, then shows one card for each prompt with a strip of the kinds of calls it made. Only the newest card starts open. A button on each card shows or hides its events.
- A panel minimized to a widget shows only the status card.

### What it adds to your session

- A tool named `mcp__session-timeline__plan`, and a short instruction in the system prompt that asks Claude to report its plan. Claude spends a few extra tool calls and tokens on this. The mod answers the call itself, so there is no permission prompt.
- It reads the end of the session transcript to restore the history of a resumed session. It makes no network requests, starts no processes and writes no files.

### Limitations

- Only the main conversation is listed. A subagent's own steps are not, though its permission requests appear under **Waiting for you**.
- The plan comes from the mod's own tool. Task lists made with `TaskCreate` or `TodoWrite` are not read.
- A step's length is measured by the clock from its start, idle time included. A step left in progress shows no length while nothing is at work, and no time at all after a resume.
- A recap from a manual `/recap` is not restored after a resume. A failed `/recap` is recognized by its message, so an unfamiliar error can show up as the recap.
- History shows at most 100 rows.

## desktop-statusline

The desktop app does not run the `statusLine` setting. This mod draws one line above the prompt there instead, and nothing in a terminal.

Each figure is a label, a small bar, a percentage and one more number, all on one row, which wraps if the window has no room for it.

| Figure | What it shows |
| --- | --- |
| **Context** | How full the context is, measured against the window that compaction keeps it in, with the tokens held and the window's size. Hidden until the first response, and again just after a compaction |
| **5h**, **1w**, **spend** | How much of each limit is used, and how long until it resets. Hidden without a subscription, and until the first reading |

How to read the bars:

- The **Context** bar is filled as far as the context is full, and the fill is cut into colored pieces, one for each thing that takes up room: the system prompt, tools, memory files, skills and so on. The conversation itself, once it is big enough to see, is the orange piece. Pieces too small to see are gathered into one grey piece at the end.
- The hatched end of the **Context** bar is the reserve: when the fill reaches it, Claude Code compacts the conversation.
- A limit's bar is filled as far as the limit is used. The small mark that cuts through it shows how much of the limit's time window has gone by. A fill that ends left of the mark is use slower than the clock; a fill that runs past it will reach the limit before the reset if it goes on at the same pace. A spend limit has no window of a known length, so no mark.
- A percentage, and a limit's fill, is green below 50, yellow below 80 and red from there.
- A limit whose reset time has passed with no new reading shows `reset` and an empty bar, not the old figure.

Pointing at a figure tints it and opens a card above it, with the percentage in large type and a longer bar. The **Context** card lists the tokens held, the window's size and every part that takes up room, largest first, each with its tokens and its share of the window. A grey dot marks a part that the bar draws in grey. Claude Code estimates each part, so the shares need not add up to the percentage above them, nor match the widths on the bar exactly. A limit's card shows the clock time of its reset and, for **5h** and **1w**, how much of the time window has gone by. A limit with no reset time has no card.

A narrower window gets shorter bars, then loses the token counts, then the countdowns, and at the narrowest the bars: the labels and percentages always stay.

### What it adds to your session

Nothing the model sees. The mod reads the figures Claude Code already holds, counted locally, and reads the clock once a minute to keep the countdowns right while the session is idle. It makes no network requests, starts no processes and writes no files.

## Development

```sh
claude --plugin-dir ./session-timeline     # load the mod from this folder for one session
claude plugin test ./session-timeline      # run its tests
claude plugin validate ./session-timeline  # check the manifest and hooks
```

## License

[MIT](LICENSE.txt)
