import type { Recap } from '../../types'
import { clockTime } from '../format'
import { card, sectionLabel } from './parts'
import type { Desk } from './parts'

const MAX_LINES = 6

export const recapSection = (ui: Desk, { at, text }: Recap, now: number) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" rowGap="sm">
      {sectionLabel(ui, { title: 'RECAP', right: clockTime(at, now) })}
      {card(ui, { children: <Text maxLines={MAX_LINES}>{text}</Text> })}
    </Box>
  )
}
