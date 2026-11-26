import { firstLine, plainText } from './describe'

export type TimelineEvent =
  | {
      type: 'prompt' | 'trigger' | 'say' | 'notice'
      id: string
      at: number
      text: string
    }
  | {
      type: 'notified'
      id: string
      at: number
      text: string
      taskId: string
      startsTurn: boolean
    }
  | {
      type: 'toolStart'
      id: string
      at: number
      tool: string
      input: Record<string, unknown>
    }
  | { type: 'toolEnd'; id: string; at: number; isFailed: boolean }
  | { type: 'recap'; at: number; text: string }

type Block = {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  is_error?: boolean
}

/** A conversation row, as `session.append` and the transcript file spell it. */
export type Row = {
  id: string
  at: number
  role: string | undefined
  content: string | readonly Block[]
  isMeta?: boolean
  origin?: string
  /** True for a prompt folded into a turn that was already running. */
  isQueued?: boolean
}

/** A prompt as it entered, typed by the person or made by the engine. */
export type Prompt = {
  id: string
  at: number
  text: string
  startsTurn: boolean
  isMeta?: boolean
  origin?: string
}

// Rows the engine writes under the user's role that the person never typed.
const ENGINE_WRAPPERS = /^<(local-command|system-reminder|bash-std)/

const tagged = (text: string, tag: string): string =>
  text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? ''

// A notification need not carry a summary; what it does say then stands for it.
const notificationText = (text: string): string => {
  const said = tagged(text, 'summary') || text.replace(/<[^>]*>/g, '')

  return `Background report: ${firstLine(said)}`
}

// Prompts nobody typed that can start a turn of their own.
const TRIGGER_TEXTS: Record<string, string> = {
  'scheduled-trigger': 'Scheduled trigger',
  peer: 'Message from another agent',
  'peer-send-message': 'Message from another agent',
  coordinator: 'Message from the coordinator',
  'projects-relay': 'Message from the coordinator',
  channel: 'Channel message',
  'slack-ping': 'Slack ping',
  observer: 'Observer report',
  'observer-activity': 'Activity digest',
  'auto-continuation': 'Automatic continuation',
  plugin: 'Message from a mod',
  unclassified: 'Message you did not type',
}

export const compactedEvent = (id: string, at: number): TimelineEvent => ({
  type: 'notice',
  id,
  at,
  text: 'Conversation compacted',
})

// The engine ends an automatic recap with how to turn recaps off.
const RECAP_HINT = /\s*\([^()]*\/config\)\s*$/

// A manual /recap answers a failure as plain text too, and a plugin is told
// nothing else that sets it apart. An API error worded otherwise gets through.
const RECAP_FAILURES = [
  'Nothing to recap yet',
  'Recap cancelled',
  "Couldn't generate a recap",
  '/recap only runs when',
  'API Error',
]

export const recapEvents = (at: number, said: string): TimelineEvent[] => {
  const text = plainText(said.replace(RECAP_HINT, ''))
  const isFailure = RECAP_FAILURES.some(start => text.startsWith(start))

  return text === '' || isFailure ? [] : [{ type: 'recap', at, text }]
}

const typedText = (text: string): string => {
  if (text.startsWith('<command-')) {
    return `${tagged(text, 'command-name')} ${tagged(text, 'command-args')}`
  }
  if (text.startsWith('<bash-input>')) {
    return `! ${tagged(text, 'bash-input')}`
  }

  return text
}

const typedEvents = (prompt: Prompt): TimelineEvent[] => {
  const { id, at, text, startsTurn } = prompt
  if (ENGINE_WRAPPERS.test(text)) return []
  if (text.startsWith('[Request interrupted')) {
    return [{ type: 'notice', id, at, text: 'You interrupted the run' }]
  }
  if (text.startsWith('<task-notification>')) {
    const taskId = tagged(text, 'task-id')
    const said = notificationText(text)

    return [{ type: 'notified', id, at, taskId, startsTurn, text: said }]
  }
  const line = firstLine(typedText(text))

  return line === '' ? [] : [{ type: 'prompt', id, at, text: line }]
}

const triggerEvents = (prompt: Prompt): TimelineEvent[] => {
  const { id, at, origin = '', startsTurn } = prompt
  const text = TRIGGER_TEXTS[origin]
  if (!startsTurn || text === undefined) return []

  return [{ type: 'trigger', id, at, text }]
}

export const promptEvents = (prompt: Prompt): TimelineEvent[] => {
  const isReport =
    prompt.origin === 'task-notification' ||
    prompt.text.startsWith('<task-notification>')

  return !prompt.isMeta || isReport
    ? typedEvents(prompt)
    : triggerEvents(prompt)
}

const blockEvents = (
  row: Row,
  block: Block,
  index: number,
): TimelineEvent[] => {
  const { at } = row
  if (block.type === 'tool_use' && block.id && block.name) {
    const input = (block.input ?? {}) as Record<string, unknown>

    return [{ type: 'toolStart', id: block.id, at, tool: block.name, input }]
  }
  const text = firstLine(block.text ?? '')
  if (block.type !== 'text' || text === '') return []

  return [{ type: 'say', id: `${row.id}:${index}`, at, text }]
}

const rowPrompt = (row: Row, text: string): TimelineEvent[] => {
  const { id, at, isMeta, origin, isQueued } = row

  return promptEvents({ id, at, text, isMeta, origin, startsTurn: !isQueued })
}

const userEvents = (row: Row): TimelineEvent[] => {
  const { at, content } = row
  if (typeof content === 'string') return rowPrompt(row, content)
  const results = content.filter(block => block.type === 'tool_result')
  if (results.length === 0) {
    const text = content.map(block => block.text ?? '').join('\n')

    return rowPrompt(row, text)
  }

  return results.map(block => ({
    type: 'toolEnd',
    id: block.tool_use_id ?? '',
    at,
    isFailed: block.is_error === true,
  }))
}

export const rowEvents = (row: Row): TimelineEvent[] => {
  if (row.role === 'user') return userEvents(row)
  if (row.role !== 'assistant' || typeof row.content === 'string') return []

  return row.content.flatMap((block, index) => blockEvents(row, block, index))
}

type TranscriptRecord = {
  type?: string
  subtype?: string
  content?: string
  uuid?: string
  timestamp?: string
  isSidechain?: boolean
  isMeta?: boolean
  isCompactSummary?: boolean
  origin?: { kind?: string }
  message?: { role?: string; content?: Row['content'] }
  attachment?: {
    type?: string
    prompt?: Row['content']
    isMeta?: boolean
    origin?: { kind?: string }
  }
}

const parseRecord = (line: string): TranscriptRecord | undefined => {
  try {
    return JSON.parse(line) ?? undefined
  } catch {
    // The first line of a tail read and a line still being written are partial.
    return undefined
  }
}

// A prompt that arrived while a turn ran is kept as an attachment of its own.
const queuedRow = (record: TranscriptRecord, id: string, at: number): Row => {
  const { prompt = '', isMeta, origin } = record.attachment ?? {}

  return {
    id,
    at,
    role: 'user',
    content: prompt,
    isMeta,
    origin: origin?.kind,
    isQueued: true,
  }
}

const recordEvents = (record: TranscriptRecord): TimelineEvent[] => {
  if (record.isSidechain) return []
  const id = record.uuid ?? ''
  const at = Date.parse(record.timestamp ?? '')
  if (record.isCompactSummary) return [compactedEvent(id, at)]
  if (record.subtype === 'away_summary') {
    return recapEvents(at, record.content ?? '')
  }
  if (record.attachment?.type === 'queued_command') {
    return userEvents(queuedRow(record, id, at))
  }
  if (record.type !== 'user' && record.type !== 'assistant') return []
  const { role, content = '' } = record.message ?? {}
  const { isMeta, origin } = record

  return rowEvents({ id, at, role, content, isMeta, origin: origin?.kind })
}

export const transcriptEvents = (jsonl: string): TimelineEvent[] =>
  jsonl.split('\n').flatMap(line => {
    const record = parseRecord(line)

    return record === undefined ? [] : recordEvents(record)
  })
