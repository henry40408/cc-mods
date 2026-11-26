import type { Timeline, ToolEntry } from '../types'
import { currentStatus, isRunning, latestSay } from './digest'
import type { Status } from './digest'
import { duration } from './format'
import { entryLook } from './looks'
import { section, splitRow } from './ui'
import type { Ui } from './ui'

// One frame per redraw, which comes once a second while a turn runs. Ghostty
// draws these quadrants itself, so no font can size them unevenly.
const SPINNER = ['▘', '▝', '▗', '▖']

const headline = (status: Status, now: number) => {
  switch (status.kind) {
    case 'waiting':
      return {
        title: '⚠ Waiting for you',
        color: 'warning',
        elapsed: undefined,
      }
    case 'working': {
      const frame = SPINNER[Math.floor(now / 1000) % SPINNER.length]

      return {
        title: `${frame} Working`,
        color: 'success',
        elapsed: duration(now - status.since),
      }
    }
    case 'idle':
      return {
        title: '○ Idle, your turn',
        color: 'inactive',
        elapsed: undefined,
      }
  }
}

const runningRow = (ui: Ui, entry: ToolEntry, now: number) => {
  const { Text } = ui
  const look = entryLook(entry)

  return splitRow(ui, {
    left: [<Text color={look.color}>{`${look.mark} `}</Text>, entry.text],
    right: duration(now - entry.at),
  })
}

export const nowCard = (ui: Ui, timeline: Timeline, now: number) => {
  const { Text } = ui
  const status = currentStatus(timeline)
  const { title, color, elapsed } = headline(status, now)
  const said = latestSay(timeline)

  return section(ui, {
    color,
    title,
    right: elapsed,
    children: [
      status.kind === 'waiting' ? (
        <Text color="warning" wrap="wrap" maxLines={3}>
          {status.detail}
        </Text>
      ) : null,
      ...timeline.entries
        .filter(isRunning)
        .map(entry => runningRow(ui, entry, now)),
      said === undefined ? null : (
        <Text color="inactive" italic wrap="wrap" maxLines={3}>
          {`“${said}”`}
        </Text>
      ),
    ],
  })
}
