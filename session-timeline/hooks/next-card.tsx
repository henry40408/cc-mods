import type { Step, Timeline } from '../types'
import { isAtWork } from './digest'
import { clockTime, duration } from './format'
import { STEP_LOOKS } from './looks'
import { section, splitRow } from './ui'
import type { Ui, View } from './ui'

const TITLE = 'Up next'
// The padding on both sides, and a space on either side of the progress bar.
const HEADING_MARGIN = 4

type Progress = { share: number; width: number }

// Not `▰▱`: Maple Mono lacks them, and Ghostty at times drew its stand-ins two
// cells wide.
const progressBar = ({ share, width }: Progress): string => {
  const filled = Math.round(share * width)

  return '●'.repeat(filled) + '○'.repeat(width - filled)
}

// The progress bar takes whatever the title and the count leave of the row.
const heading = (plan: Step[], columns: number) => {
  if (plan.length === 0) return { title: TITLE }
  const done = plan.filter(step => step.status === 'done').length
  const count = `${done}/${plan.length} done`
  const room = columns - HEADING_MARGIN - TITLE.length - count.length
  const share = done / plan.length
  const bar = progressBar({ share, width: Math.max(0, room) })

  return { title: `${TITLE} ${bar}`, right: count }
}

export type Moment = { now: number; isCounting: boolean }

export const stepTime = (
  { status, startedAt, endedAt }: Step,
  { now, isCounting }: Moment,
): string | undefined => {
  const at = status === 'done' ? endedAt : startedAt
  if (at === undefined) return undefined
  // An interrupt, or a plan never closed, leaves a step open. With nothing at
  // work, its length stays hidden rather than grow on its own.
  const until = endedAt ?? (isCounting ? now : undefined)
  // A step done without being seen in progress has no length to tell either.
  if (startedAt === undefined || until === undefined) return clockTime(at, now)

  return `${clockTime(at, now)} · ${duration(until - startedAt)}`
}

const stepRow = (ui: Ui, step: Step, moment: Moment) => {
  const { Text } = ui
  const { title, status } = step
  const { mark, color } = STEP_LOOKS[status]

  return splitRow(ui, {
    left: [
      <Text color={color}>{`${mark} `}</Text>,
      <Text
        bold={status === 'in_progress'}
        color={status === 'done' ? 'inactive' : 'text'}
        strikethrough={status === 'done'}
      >
        {title}
      </Text>,
    ],
    right: stepTime(step, moment),
  })
}

export const nextCard = (ui: Ui, timeline: Timeline, view: View) => {
  const { now, columns } = view
  const { Text } = ui
  const { plan, upcoming } = timeline
  const moment = { now, isCounting: isAtWork(timeline) }
  return section(ui, {
    color: 'claude',
    ...heading(plan, columns),
    children: [
      plan.length === 0 ? <Text color="inactive">No plan yet</Text> : null,
      ...plan.map(step => stepRow(ui, step, moment)),
      ...upcoming.map(item =>
        splitRow(ui, {
          left: [<Text color="merged">◔ </Text>, item.text],
        }),
      ),
    ],
  })
}
