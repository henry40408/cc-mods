import type { Timeline, ToolEntry } from '../../types'
import { currentStatus, isRunning, latestSay } from '../digest'
import type { Status } from '../digest'
import { clockTime, duration } from '../format'
import { STATUS_ORBS } from './drawings'
import { ICONS, entryIcon } from './icons'
import { HUES, tint } from './palette'
import type { Hue } from './palette'
import { card, figure, listRow, picture, rowList } from './parts'
import type { Desk } from './parts'

const SAY_LINES = 3

const STATUS_LOOKS: Record<Status['kind'], { title: string; hue: Hue }> = {
  working: { title: 'Working', hue: 'green' },
  waiting: { title: 'Waiting for you', hue: 'amber' },
  idle: { title: 'Idle', hue: 'gray' },
}

const underTitle = (status: Status, now: number): string => {
  switch (status.kind) {
    case 'waiting':
      return status.detail
    case 'working':
      return `Since ${clockTime(status.since, now)}`
    case 'idle':
      return 'Your turn'
  }
}

const elapsed = ({ Box, Text }: Desk, status: Status, now: number) => {
  if (status.kind !== 'working') return null

  return (
    <Box flexShrink={0}>
      <Text size="title" weight="medium" tabular>
        {duration(now - status.since)}
      </Text>
    </Box>
  )
}

const headline = (ui: Desk, status: Status, now: number) => {
  const { Box, Text } = ui
  const isWaiting = status.kind === 'waiting'

  return (
    <Box flexDirection="row" alignItems="center" columnGap={2}>
      {picture(ui, STATUS_ORBS[status.kind])}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text size="title" weight="semibold">
          {STATUS_LOOKS[status.kind].title}
        </Text>
        <Text
          color={isWaiting ? 'warning' : 'inactive'}
          size="footnote"
          maxLines={SAY_LINES}
        >
          {underTitle(status, now)}
        </Text>
      </Box>
      {elapsed(ui, status, now)}
    </Box>
  )
}

const runningRow = (ui: Desk, entry: ToolEntry, now: number) => {
  const { Text } = ui

  return listRow(ui, {
    key: `running:${entry.id}`,
    icon: ICONS[entryIcon(entry)],
    text: <Text wrap="truncate-end">{entry.text}</Text>,
    trail: figure(ui, duration(now - entry.at)),
  })
}

// Chinese has no italic, so a quote is set apart by a bar at its side instead.
const quote = ({ Box, Text }: Desk, said: string, hue: Hue) => (
  <Box flexDirection="row" columnGap={1} paddingX="xs">
    <Box flexShrink={0} width={0.4} backgroundColor={HUES[hue]} />
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      <Text color="inactive" maxLines={SAY_LINES}>
        {said}
      </Text>
    </Box>
  </Box>
)

/** What the session is doing this moment, on a ground in its status's color. */
export const hero = (ui: Desk, timeline: Timeline, now: number) => {
  const status = currentStatus(timeline)
  const { hue } = STATUS_LOOKS[status.kind]
  const said = latestSay(timeline)

  return card(ui, {
    ground: tint(hue, 12),
    children: [
      headline(ui, status, now),
      rowList(
        ui,
        timeline.entries
          .filter(isRunning)
          .map(entry => runningRow(ui, entry, now)),
      ),
      said === undefined ? null : quote(ui, said, hue),
    ],
  })
}
