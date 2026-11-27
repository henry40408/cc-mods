import type { Entry, TextEntry, Timeline, ToolEntry } from '../types'

const MAX_ROWS = 100
// What a row says once it stands for lookups of different things.
const STREAK_TEXTS: Record<string, string> = {
  Read: 'Read several files',
  Grep: 'Search code repeatedly',
  Glob: 'Find files repeatedly',
}
const ASKING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

/**
 * One history row, standing for `count` calls made back to back; `entry` is the
 * newest of them.
 */
export type Run = { entry: Entry; text: string; count: number }

/** What started some work and what was done about it, newest row first. */
export type Chapter = {
  head: TextEntry | undefined
  rows: Run[]
  actions: number
}

export type Status =
  | { kind: 'waiting'; detail: string }
  | { kind: 'working'; since: number }
  | { kind: 'idle' }

export const isRunning = (entry: Entry): entry is ToolEntry =>
  entry.kind === 'tool' && entry.status === 'running'

const isHead = (entry: Entry): entry is TextEntry =>
  entry.kind === 'prompt' || entry.kind === 'trigger'

/** Whether a turn runs, or something is set to come back to the session. */
export const isAtWork = ({ turnStartedAt, upcoming }: Timeline): boolean =>
  turnStartedAt !== null || upcoming.length > 0

export const currentStatus = (timeline: Timeline): Status => {
  const asking = timeline.entries
    .filter(isRunning)
    .find(entry => ASKING_TOOLS.has(entry.tool))
  const waiting = asking?.text ?? timeline.asks[0]?.text
  if (waiting !== undefined) return { kind: 'waiting', detail: waiting }
  if (timeline.turnStartedAt === null) return { kind: 'idle' }

  return { kind: 'working', since: timeline.turnStartedAt }
}

/** What Claude last said in this turn, or in the last one while idle. */
export const latestSay = (timeline: Timeline): string | undefined => {
  const since = timeline.turnStartedAt ?? 0

  return timeline.entries.findLast(
    entry => entry.kind === 'say' && entry.at >= since,
  )?.text
}

export const totals = ({ entries }: Timeline) => ({
  prompts: entries.filter(entry => entry.kind === 'prompt').length,
  actions: entries.filter(entry => entry.kind === 'tool').length,
  failures: entries.filter(
    entry => entry.kind === 'tool' && entry.status === 'failed',
  ).length,
})

const isRepeat = (before: Entry, entry: Entry): boolean =>
  before.kind === 'tool' &&
  entry.kind === 'tool' &&
  before.tool === entry.tool &&
  before.status === 'done' &&
  entry.status === 'done' &&
  (entry.tool in STREAK_TEXTS || before.text === entry.text)

const mergedText = (run: Run, entry: Entry): string => {
  if (run.text === entry.text || entry.kind !== 'tool') return entry.text

  return STREAK_TEXTS[entry.tool] ?? entry.text
}

// A streak of lookups, or one call made again, reads as one thing done. Other
// calls differ in what they say, which sharing a row would hide.
const collapseRepeats = (entries: Entry[]): Run[] =>
  entries.reduce<Run[]>((runs, entry) => {
    const last = runs.at(-1)
    if (last === undefined || !isRepeat(last.entry, entry)) {
      return [...runs, { entry, text: entry.text, count: 1 }]
    }
    const text = mergedText(last, entry)

    return [...runs.slice(0, -1), { entry, text, count: last.count + 1 }]
  }, [])

const splitByHead = (entries: Entry[]): Entry[][] =>
  entries.reduce<Entry[][]>((groups, entry) => {
    const last = groups.at(-1)
    if (last === undefined || isHead(entry)) return [...groups, [entry]]

    return [...groups.slice(0, -1), [...last, entry]]
  }, [])

const toChapter = (group: Entry[]): Chapter => {
  const [first] = group
  const head = first !== undefined && isHead(first) ? first : undefined
  const done = group.filter(entry => entry !== head && !isRunning(entry))

  return {
    head,
    rows: collapseRepeats(done).reverse(),
    actions: group.filter(entry => entry.kind === 'tool').length,
  }
}

const capRows = (chapters: Chapter[]): Chapter[] => {
  let room = MAX_ROWS

  return chapters.flatMap(chapter => {
    if (room <= 0) return []
    const rows = chapter.rows.slice(0, room)
    // A chapter's header takes a row of its own.
    room -= rows.length + 1

    return [{ ...chapter, rows }]
  })
}

/** The history as chapters, newest first. Running calls are shown elsewhere. */
export const chapters = ({ entries }: Timeline): Chapter[] =>
  capRows(splitByHead(entries).map(toChapter).reverse())
