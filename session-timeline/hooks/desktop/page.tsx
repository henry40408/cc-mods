import type { Folds, Timeline } from '../../types'
import { hero } from './hero'
import { historySection } from './history'
import type { OnFold } from './history'
import type { Desk } from './parts'
import { planSection } from './plan'
import { recapSection } from './recap'

type Page = {
  timeline: Timeline
  now: number
  folds: Folds
  /** The pane is minimized to a widget, which has room for a glance only. */
  isGlance: boolean
  onFold: OnFold
}

/** The whole panel as the desktop app draws it. */
export const desktopPage = (ui: Desk, page: Page) => {
  const { Box } = ui
  const { timeline, now, folds, isGlance, onFold } = page
  if (isGlance) return hero(ui, timeline, now)

  return (
    <Box flexDirection="column" rowGap="lg">
      {hero(ui, timeline, now)}
      {timeline.recap === null ? null : recapSection(ui, timeline.recap, now)}
      {planSection(ui, timeline, now)}
      {historySection(ui, timeline, { now, folds, onFold })}
    </Box>
  )
}
