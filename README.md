# cc-mods

Unofficial mods for Claude Code. This project is not affiliated with or endorsed by Anthropic.

| Mod | What it does |
| --- | --- |
| [session-timeline](#session-timeline) | A side panel that shows what the session did and when, what it is doing now, and what comes next |

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

These mods need a version of Claude Code that supports mods. They are tested with 2.1.332 in the terminal. The desktop app is untested.

## session-timeline

In the fullscreen terminal UI, the panel opens on its own when there is room beside the transcript. Run `/timeline` to open it yourself.

| Section | What it shows |
| --- | --- |
| **Working**, **Waiting for you** or **Idle, your turn** | The current state, the calls still running with their elapsed time, and the latest thing Claude said |
| **Recap** | The latest session recap, automatic or from `/recap`. Hidden until there is one |
| **Up next** | Claude's plan with a progress bar, plus background tasks and scheduled wakeups |
| **History (new → old)** | What was done, grouped by the prompt that started it, with totals of prompts, actions and failures |

### What it adds to your session

- A tool named `mcp__session-timeline__plan`, and a short instruction in the system prompt that asks Claude to report its plan. Claude spends a few extra tool calls and tokens on this. The mod answers the call itself, so there is no permission prompt.
- It reads the end of the session transcript to restore the history of a resumed session. It makes no network requests, starts no processes and writes no files.

### Limitations

- Only the main conversation is listed. A subagent's own steps are not, though its permission requests appear under **Waiting for you**.
- The plan comes from the mod's own tool. Task lists made with `TaskCreate` or `TodoWrite` are not read.
- A recap from a manual `/recap` is not restored after a resume. A failed `/recap` is recognized by its message, so an unfamiliar error can show up as the recap.
- History shows at most 100 rows.

## Development

```sh
claude --plugin-dir ./session-timeline     # load the mod from this folder for one session
claude plugin test ./session-timeline      # run its tests
claude plugin validate ./session-timeline  # check the manifest and hooks
```

## License

[MIT](LICENSE.txt)
