import type { Timeline } from '../types'
import { chapters, totals } from './digest'
import type { Chapter, Run } from './digest'
import { clockTime, counted, duration } from './format'
import { entryLook } from './looks'
import { section, splitRow } from './ui'
import type { Ui, View } from './ui'

const TITLE = 'History (new → old)'
// The padding on both sides, and the gap between the title and the totals.
const HEADING_MARGIN = 3
const SLOW_TOOL_MS = 5000
// A call's result row can wait on its parallel siblings, which would pass for
// time spent on a quick tool. Only these are slow enough for it to mean much.
const TIMED_TOOLS = new Set(['Bash', 'Agent', 'WebFetch', 'WebSearch'])

export const rowDetail = ({ entry, count }: Run): string | undefined => {
  if (count > 1) return `×${count}`
  if (entry.kind !== 'tool' || !TIMED_TOOLS.has(entry.tool)) return undefined
  const took = (entry.endedAt ?? entry.at) - entry.at

  return took < SLOW_TOOL_MS ? undefined : duration(took)
}

type RailRow = { run: Run; rail: string; now: number }

const historyRow = (ui: Ui, { run, rail, now }: RailRow) => {
  const { Text } = ui
  const { entry } = run
  const look = entryLook(entry)
  const isSay = entry.kind === 'say'

  return splitRow(ui, {
    left: [
      <Text color="inactive">{`${rail} ${clockTime(entry.at, now)} `}</Text>,
      <Text color={look.color}>{`${look.mark} `}</Text>,
      <Text color={isSay ? 'inactive' : 'text'} italic={isSay}>
        {run.text}
      </Text>,
    ],
    right: rowDetail(run),
  })
}

const chapterHeader = (ui: Ui, { head, actions }: Chapter, now: number) => {
  const { Text } = ui
  const right = actions === 0 ? undefined : counted(actions, 'action')
  if (head === undefined) {
    return splitRow(ui, { left: <Text bold>… Earlier</Text>, right })
  }
  const { mark, color } = entryLook(head)

  return splitRow(ui, {
    left: [
      <Text color={color} bold>{`${mark} ${clockTime(head.at, now)} `}</Text>,
      <Text bold>{head.text}</Text>,
    ],
    right,
  })
}

const chapterBlock = (ui: Ui, chapter: Chapter, now: number) => {
  const { Box } = ui

  return (
    <Box flexDirection="column">
      {chapterHeader(ui, chapter, now)}
      {chapter.rows.map((run, index) => {
        const rail = index === chapter.rows.length - 1 ? '╰' : '│'

        return historyRow(ui, { run, rail, now })
      })}
    </Box>
  )
}

const totalsText = (timeline: Timeline, isWorded: boolean): string => {
  const { prompts, actions, failures } = totals(timeline)
  const said = (count: number, noun: string) =>
    isWorded ? counted(count, noun) : `${count}`
  const text = `❯ ${said(prompts, 'prompt')} · ◆ ${said(actions, 'action')}`
  if (failures === 0) return text

  return `${text} · ✗ ${isWorded ? `${failures} failed` : failures}`
}

// The words go when they would crowd the title out of the heading.
const fittingTotals = (timeline: Timeline, columns: number): string => {
  const worded = totalsText(timeline, true)
  const needed = TITLE.length + worded.length + HEADING_MARGIN

  return needed <= columns ? worded : totalsText(timeline, false)
}

export const history = (ui: Ui, timeline: Timeline, { now, columns }: View) =>
  section(ui, {
    color: 'planMode',
    title: TITLE,
    right: fittingTotals(timeline, columns),
    children: chapters(timeline).map(chapter => chapterBlock(ui, chapter, now)),
  })
