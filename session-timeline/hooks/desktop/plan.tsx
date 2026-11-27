import type { Step, StepStatus, Timeline, Upcoming } from '../../types'
import { isAtWork } from '../digest'
import { stepTime } from '../next-card'
import type { Moment } from '../next-card'
import { STEP_NODES } from './drawings'
import { ICONS } from './icons'
import { HUES, tint } from './palette'
import {
  TITLE_LINES,
  bar,
  card,
  figure,
  listRow,
  rowList,
  sectionLabel,
} from './parts'
import type { Desk } from './parts'

const SEGMENT_GROUNDS: Record<StepStatus, string> = {
  done: HUES.green,
  in_progress: HUES.brand,
  pending: tint('gray', 30),
}

/** The plan as one strip, a piece to a step, in the order of the steps. */
const progressStrip = (ui: Desk, plan: Step[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="row" columnGap={0.5} paddingX="xs">
      {plan.map(step =>
        bar(ui, { share: 1, ground: SEGMENT_GROUNDS[step.status] }),
      )}
    </Box>
  )
}

type Place = { index: number; moment: Moment }

const stepRow = (ui: Desk, step: Step, { index, moment }: Place) => {
  const { Text } = ui
  const { title, status } = step
  const time = stepTime(step, moment)

  return listRow(ui, {
    key: `step:${index}`,
    icon: STEP_NODES[status],
    text: (
      <Text
        color={status === 'done' ? 'inactive' : 'text'}
        weight={status === 'in_progress' ? 'semibold' : 'regular'}
        maxLines={TITLE_LINES}
      >
        {title}
      </Text>
    ),
    trail: time === undefined ? null : figure(ui, time),
    ground: status === 'in_progress' ? tint('brand', 14) : undefined,
  })
}

const upcomingRow = (ui: Desk, { id, text }: Upcoming) => {
  const { Text } = ui

  return listRow(ui, {
    key: `upcoming:${id}`,
    icon: ICONS.upcoming,
    text: <Text wrap="truncate-end">{text}</Text>,
  })
}

const progressText = (plan: Step[]): string | undefined => {
  if (plan.length === 0) return undefined
  const done = plan.filter(step => step.status === 'done').length

  return `${done} of ${plan.length} done`
}

/** The steps Claude set out, and what will come back without a prompt. */
export const planSection = (ui: Desk, timeline: Timeline, now: number) => {
  const { Box, Text } = ui
  const { plan, upcoming } = timeline
  const moment = { now, isCounting: isAtWork(timeline) }
  const isEmpty = plan.length === 0 && upcoming.length === 0

  return (
    <Box flexDirection="column" rowGap="sm">
      {sectionLabel(ui, { title: 'PLAN', right: progressText(plan) })}
      {card(ui, {
        children: [
          plan.length === 0 ? null : progressStrip(ui, plan),
          isEmpty ? <Text color="inactive">No plan yet</Text> : null,
          rowList(ui, [
            ...plan.map((step, index) => stepRow(ui, step, { index, moment })),
            ...upcoming.map(item => upcomingRow(ui, item)),
          ]),
        ],
      })}
    </Box>
  )
}
