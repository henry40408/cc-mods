import type { Recap } from '../types'
import { clockTime } from './format'
import { section } from './ui'
import type { Ui } from './ui'

const MAX_LINES = 6

export const recapCard = (ui: Ui, { at, text }: Recap, now: number) => {
  const { Text } = ui

  return section(ui, {
    color: 'remember',
    title: 'Recap',
    right: clockTime(at, now),
    children: (
      <Text wrap="wrap" maxLines={MAX_LINES}>
        {text}
      </Text>
    ),
  })
}
