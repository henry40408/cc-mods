import type { Step, Timeline } from '../types'
import { STEP_LOOKS } from './looks'
import { section, splitRow } from './ui'
import type { Ui } from './ui'

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

const stepRow = (ui: Ui, { title, status }: Step) => {
  const { Text } = ui
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
  })
}

export const nextCard = (ui: Ui, timeline: Timeline, columns: number) => {
  const { Text } = ui
  const { plan, upcoming } = timeline
  return section(ui, {
    color: 'claude',
    ...heading(plan, columns),
    children: [
      plan.length === 0 ? <Text color="inactive">No plan yet</Text> : null,
      ...plan.map(step => stepRow(ui, step)),
      ...upcoming.map(item =>
        splitRow(ui, {
          left: [<Text color="merged">◔ </Text>, item.text],
        }),
      ),
    ],
  })
}
