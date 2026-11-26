import type { Entry, StepStatus, ToolEntry } from '../types'

/** A glyph one cell wide and the theme color it is drawn in. */
export type Look = { mark: string; color: string }

const SHELL: Look = { mark: '$', color: 'bashBorder' }
const LOOKUP: Look = { mark: '◇', color: 'ide' }
const EDIT: Look = { mark: '✎', color: 'success' }
const WEB: Look = { mark: '◍', color: 'suggestion' }
const AGENT: Look = { mark: '✦', color: 'merged' }
const ASK: Look = { mark: '?', color: 'warning' }
const OTHER: Look = { mark: '◆', color: 'planMode' }

const TOOL_LOOKS: Record<string, Look> = {
  Bash: SHELL,
  Read: LOOKUP,
  Grep: LOOKUP,
  Glob: LOOKUP,
  ToolSearch: LOOKUP,
  Edit: EDIT,
  Write: EDIT,
  NotebookEdit: EDIT,
  WebFetch: WEB,
  WebSearch: WEB,
  Agent: AGENT,
  SendMessage: AGENT,
  AskUserQuestion: ASK,
  ExitPlanMode: ASK,
}

const TEXT_LOOKS = {
  prompt: { mark: '❯', color: 'claude' },
  trigger: { mark: '↻', color: 'merged' },
  say: { mark: '·', color: 'inactive' },
  notice: { mark: '!', color: 'warning' },
  milestone: { mark: '★', color: 'remember' },
} as const

export const STEP_LOOKS: Record<StepStatus, Look> = {
  done: { mark: '✔', color: 'success' },
  in_progress: { mark: '◉', color: 'claude' },
  pending: { mark: '○', color: 'inactive' },
}

const toolLook = ({ tool, status }: ToolEntry): Look => {
  if (status === 'failed') return { mark: '✗', color: 'error' }
  if (status === 'stopped') return { mark: '■', color: 'inactive' }

  return TOOL_LOOKS[tool] ?? OTHER
}

export const entryLook = (entry: Entry): Look =>
  entry.kind === 'tool' ? toolLook(entry) : TEXT_LOOKS[entry.kind]
