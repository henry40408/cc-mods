import type { Folds, Timeline } from '../../types'
import { allChapters, totals } from '../digest'
import type { Chapter, Run } from '../digest'
import { clockTime, counted } from '../format'
import { rowDetail } from '../history'
import { ICONS, entryIcon, iconHue } from './icons'
import type { IconName } from './icons'
import { CARD_GROUND, HUES, NO_BORDER, tint } from './palette'
import {
  TITLE_LINES,
  bar,
  card,
  chip,
  figure,
  listRow,
  rowList,
  sectionLabel,
} from './parts'
import type { Desk } from './parts'

/** Asks to fold or unfold a chapter. A press runs outside the drawing. */
export type OnFold = (id: string, isOpenByDefault: boolean) => Promise<unknown>

type HistoryView = { now: number; folds: Folds; onFold: OnFold }

type Tile = { count: number; label: string; isAlarming?: boolean }

const statTile = (
  { Box, Text }: Desk,
  { count, label, isAlarming = false }: Tile,
) => (
  <Box
    flexDirection="column"
    flexGrow={1}
    // With no width of their own, the tiles share the row in equal parts.
    width="0%"
    minWidth={0}
    borderStyle="round"
    borderColor={NO_BORDER}
    backgroundColor={isAlarming ? tint('red', 14) : CARD_GROUND}
    paddingX="md"
    paddingY="sm"
  >
    <Text
      color={isAlarming ? 'error' : 'text'}
      size="title"
      weight="semibold"
      tabular
    >
      {String(count)}
    </Text>
    <Text color="inactive" size="caption" wrap="truncate-end">
      {label}
    </Text>
  </Box>
)

const statTiles = (ui: Desk, timeline: Timeline) => {
  const { Box } = ui
  const { prompts, actions, failures } = totals(timeline)

  return (
    <Box flexDirection="row" columnGap={1}>
      {statTile(ui, { count: prompts, label: 'Prompts' })}
      {statTile(ui, { count: actions, label: 'Actions' })}
      {statTile(ui, {
        count: failures,
        label: 'Failed',
        isAlarming: failures > 0,
      })}
    </Box>
  )
}

type Share = { icon: IconName; count: number }

/** How many calls of each kind a chapter's rows stand for, most first. */
const toolMix = (rows: Run[]): Share[] => {
  const counts = new Map<IconName, number>()
  for (const { entry, count } of rows) {
    if (entry.kind !== 'tool') continue
    const icon = entryIcon(entry)
    counts.set(icon, (counts.get(icon) ?? 0) + count)
  }

  return [...counts]
    .map(([icon, count]) => ({ icon, count }))
    .sort((one, other) => other.count - one.count)
}

/** One strip, each kind of call as wide as its share, in its icon's color. */
const mixStrip = (ui: Desk, mix: Share[]) => {
  const { Box } = ui

  return (
    <Box flexDirection="row" columnGap={0.3} paddingX="xs">
      {mix.map(({ icon, count }) =>
        bar(ui, { share: count, ground: HUES[iconHue(icon)] }),
      )}
    </Box>
  )
}

const chapterId = ({ head }: Chapter): string => head?.id ?? 'earlier'

const chapterTitle = (ui: Desk, chapter: Chapter, now: number) => {
  const { Text } = ui
  const { head } = chapter

  return listRow(ui, {
    key: `head:${chapterId(chapter)}`,
    icon: head === undefined ? ICONS.earlier : ICONS[head.kind],
    text: (
      <Text weight="semibold" maxLines={TITLE_LINES}>
        {head?.text ?? 'Earlier'}
      </Text>
    ),
    trail: head === undefined ? null : figure(ui, clockTime(head.at, now)),
  })
}

const failedCount = (rows: Run[]): number =>
  rows.filter(({ entry }) => entry.kind === 'tool' && entry.status === 'failed')
    .length

type Fold = { isOpen: boolean; onPress: () => Promise<unknown> }

const foldButton = ({ Button, Text }: Desk, chapter: Chapter, fold: Fold) => {
  if (chapter.rows.length === 0) return null
  const shown = counted(chapter.rows.length, 'event')

  return (
    <Button
      key={`fold:${chapterId(chapter)}`}
      plain
      dimColor
      onPress={fold.onPress}
    >
      <Text size="caption">
        {fold.isOpen ? 'Hide events' : `Show ${shown}`}
      </Text>
    </Button>
  )
}

const chapterFacts = (ui: Desk, chapter: Chapter, fold: Fold) => {
  const { Box, Text } = ui
  const failed = failedCount(chapter.rows)

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      columnGap={1}
      paddingX="xs"
    >
      <Text color="inactive" size="caption">
        {counted(chapter.actions, 'action')}
        {failed === 0 ? null : (
          <Text color="error">{` · ${failed} failed`}</Text>
        )}
      </Text>
      {foldButton(ui, chapter, fold)}
    </Box>
  )
}

const eventRow = (ui: Desk, run: Run, now: number) => {
  const { Text } = ui
  const { entry } = run
  const detail = rowDetail(run)

  return listRow(ui, {
    key: `row:${entry.id}`,
    icon: ICONS[entryIcon(entry)],
    text: (
      <Text
        color={entry.kind === 'say' ? 'inactive' : 'text'}
        size="footnote"
        wrap="truncate-end"
      >
        {run.text}
      </Text>
    ),
    trail: [
      detail === undefined ? null : chip(ui, detail),
      figure(ui, clockTime(entry.at, now)),
    ],
  })
}

/** A folded chapter still tells how it ended: the last thing Claude said. */
const closingWords = ({ Box, Text }: Desk, rows: Run[]) => {
  const said = rows.find(({ entry }) => entry.kind === 'say')
  if (said === undefined) return null

  return (
    <Box paddingX="xs">
      <Text color="inactive" size="footnote" maxLines={TITLE_LINES}>
        {said.text}
      </Text>
    </Box>
  )
}

const chapterCard = (ui: Desk, chapter: Chapter, fold: Fold, now: number) => {
  const mix = toolMix(chapter.rows)

  return card(ui, {
    children: [
      chapterTitle(ui, chapter, now),
      mix.length === 0 ? null : mixStrip(ui, mix),
      chapterFacts(ui, chapter, fold),
      fold.isOpen
        ? rowList(
            ui,
            chapter.rows.map(run => eventRow(ui, run, now)),
          )
        : closingWords(ui, chapter.rows),
    ],
  })
}

/** What was done, a card to a prompt, newest first; only the newest is open. */
export const historySection = (
  ui: Desk,
  timeline: Timeline,
  { now, folds, onFold }: HistoryView,
) => {
  const { Box } = ui
  // A folded chapter draws no rows, so each can keep its card and its counts.
  const cards = allChapters(timeline).map((chapter, index) => {
    const id = chapterId(chapter)
    const isOpenByDefault = index === 0
    const fold = {
      isOpen: folds[id] ?? isOpenByDefault,
      onPress: () => onFold(id, isOpenByDefault),
    }

    return chapterCard(ui, chapter, fold, now)
  })

  return (
    <Box flexDirection="column" rowGap="sm">
      {sectionLabel(ui, { title: 'HISTORY', right: 'Newest first' })}
      {statTiles(ui, timeline)}
      {cards}
    </Box>
  )
}
