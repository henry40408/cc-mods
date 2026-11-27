import type { Elements } from 'claude-code'

import { GAUGE_HEIGHT, LEVEL_HUES, contextGauge, limitGauge } from './gauges'
import { listParts, paintParts } from './parts'
import type { PaintedPart } from './parts'
import { elapsedShare, parseTime, resetTime, timeLeft } from './time'
import type { ContextFill, Figures, Limit } from '../types'

type Ui = Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>

export type BandInput = {
  figures: Figures
  /** In `$.clock.now()`'s milliseconds. */
  now: number
  /** The band's `bodyColumns`. */
  columns: number
}

type Level = keyof typeof LEVEL_HUES

type Layout = {
  /** Widths in pixels. 0 leaves the bars out. */
  contextBar: number
  limitBar: number
  hasTokens: boolean
  hasCountdown: boolean
}

type Scene = {
  layout: Layout
  now: number
}

type Gauge = {
  source: string
  alt: string
  width: number
}

type Row = {
  name: string
  value: string
  /** Of the compaction window. */
  share?: string
  /** Of the dot that ties the row to its piece of the bar. */
  hue?: string
}

/** What opens above a figure under the pointer, below its label and value. */
type Card = {
  title: string
  note?: string
  gauge?: Gauge
  rows: Row[]
}

type Cluster = {
  key: string
  label: string
  value: string
  valueColor: string
  gauge?: Gauge
  extra?: string
  card?: Card
}

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '1w',
  spend_limit: 'spend',
}

// The engine documents no order, and a figure that changes place is hard to find.
const ORDER = ['five_hour', 'seven_day', 'spend_limit']

const WIDE_COLUMNS = 100
const MEDIUM_COLUMNS = 72
const NARROW_COLUMNS = 52
/** In pixels. The app sizes a card by its content, so the bar sets its width. */
export const CARD_BAR = 240
// Translucent, to read on a light ground and on a dark one.
const HOVER_TINT = '#8b8d9826'

/** Less room gives shorter bars, then fewer words, then no bars at all. */
const layoutFor = (columns: number): Layout => {
  if (columns >= WIDE_COLUMNS) {
    return { contextBar: 96, limitBar: 64, hasTokens: true, hasCountdown: true }
  }

  const base = { hasTokens: false }
  if (columns >= MEDIUM_COLUMNS) {
    return { ...base, contextBar: 64, limitBar: 48, hasCountdown: true }
  }
  if (columns >= NARROW_COLUMNS) {
    return { ...base, contextBar: 40, limitBar: 32, hasCountdown: false }
  }

  return { ...base, contextBar: 0, limitBar: 0, hasCountdown: false }
}

const levelOf = (percent: number): Level => {
  if (percent < 50) return 'success'
  if (percent < 80) return 'warning'

  return 'error'
}

/** `850`, `55k` or `1.2M`. */
export const tokenCount = (tokens: number): string => {
  if (tokens < 1000) return String(tokens)
  if (tokens < 999_500) return `${Math.round(tokens / 1000)}k`

  return `${(tokens / 1_000_000).toFixed(1)}M`
}

const rank = ({ kind }: Limit) => {
  const index = ORDER.indexOf(kind)

  return index === -1 ? ORDER.length : index
}

const labelOf = ({ kind }: Limit) => LABELS[kind] ?? kind

const reserveFrom = ({ compactAtTokens, windowTokens }: ContextFill) =>
  compactAtTokens === undefined ? undefined : compactAtTokens / windowTokens

const contextBar = (context: ContextFill, parts: PaintedPart[], width: number) => {
  if (width === 0) return undefined

  return {
    width,
    alt: `Context ${context.percent}% full`,
    source: contextGauge({
      width,
      percent: context.percent,
      pieces: parts,
      reserveFrom: reserveFrom(context),
    }),
  }
}

/** `14%`, or `<1%` for a share that would round to nothing. */
const shareOf = (tokens: number, windowTokens: number): string => {
  const percent = Math.round((tokens / windowTokens) * 100)

  return percent === 0 ? '<1%' : `${percent}%`
}

// A share is the row's own tokens over the window, as the app's usage card has
// it. The parts are estimates, so the shares need not add up to the headline.
const partRows = (parts: PaintedPart[], windowTokens: number): Row[] =>
  [...parts]
    .sort((a, b) => b.tokens - a.tokens)
    .map(({ name, tokens, hue }) => ({
      name,
      value: tokenCount(tokens),
      share: shareOf(tokens, windowTokens),
      hue,
    }))

const contextCluster = (context: ContextFill, layout: Layout): Cluster => {
  const { percent, tokens, windowTokens } = context
  const parts = paintParts(context.parts)
  const held = tokenCount(tokens)
  const size = tokenCount(windowTokens)

  return {
    key: 'context',
    label: 'Context',
    value: `${percent}%`,
    valueColor: levelOf(percent),
    gauge: contextBar(context, parts, layout.contextBar),
    extra: layout.hasTokens ? `${held}/${size}` : undefined,
    card: {
      title: 'Context',
      note: `${held} of ${size}`,
      gauge: contextBar(context, parts, CARD_BAR),
      rows: partRows(listParts(context.parts), windowTokens),
    },
  }
}

const titleOf = (limit: Limit) => `${labelOf(limit)} limit`

const emptyBar = (limit: Limit, width: number) => {
  if (width === 0) return undefined

  return {
    width,
    alt: `${titleOf(limit)} reset`,
    source: limitGauge({ width, percent: 0, hue: LEVEL_HUES.success }),
  }
}

/** The last reading describes a window that is over: it is not shown as current. */
const resetCluster = (limit: Limit, resetsAt: number, scene: Scene) => ({
  key: `limit-${limit.kind}`,
  label: labelOf(limit),
  value: 'reset',
  valueColor: 'inactive',
  gauge: emptyBar(limit, scene.layout.limitBar),
  card: {
    title: titleOf(limit),
    note: 'no reading since',
    gauge: emptyBar(limit, CARD_BAR),
    rows: [{ name: 'Window reset', value: resetTime(resetsAt, scene.now) }],
  },
})

const limitBar = (limit: Limit, elapsed: number | undefined, width: number) => {
  if (width === 0) return undefined
  const percent = Math.round(limit.percentUsed)

  return {
    width,
    alt: `${titleOf(limit)} ${percent}% used`,
    source: limitGauge({
      width,
      percent,
      hue: LEVEL_HUES[levelOf(percent)],
      elapsed,
    }),
  }
}

/** A limit with no reset time has neither a countdown nor a card. */
const timelessCluster = (limit: Limit, { layout }: Scene) => {
  const percent = Math.round(limit.percentUsed)

  return {
    key: `limit-${limit.kind}`,
    label: labelOf(limit),
    value: `${percent}%`,
    valueColor: levelOf(percent),
    gauge: limitBar(limit, undefined, layout.limitBar),
  }
}

const paceRows = (elapsed: number | undefined): Row[] =>
  elapsed === undefined
    ? []
    : [{ name: 'Window gone', value: `${Math.round(elapsed * 100)}%` }]

const limitCluster = (limit: Limit, scene: Scene): Cluster => {
  const { layout, now } = scene
  const resetsAt = parseTime(limit.resetsAt)
  if (resetsAt === undefined) return timelessCluster(limit, scene)
  if (resetsAt <= now) return resetCluster(limit, resetsAt, scene)

  const elapsed = elapsedShare(limit.kind, resetsAt, now)

  return {
    ...timelessCluster(limit, scene),
    gauge: limitBar(limit, elapsed, layout.limitBar),
    extra: layout.hasCountdown ? timeLeft(resetsAt - now) : undefined,
    card: {
      title: titleOf(limit),
      gauge: limitBar(limit, elapsed, CARD_BAR),
      rows: [
        ...paceRows(elapsed),
        { name: 'Resets', value: resetTime(resetsAt, now) },
      ],
    },
  }
}

const drawGauge = ({ Svg }: Ui, gauge: Gauge | undefined) =>
  gauge === undefined ? null : (
    <Svg
      source={gauge.source}
      alt={gauge.alt}
      width={gauge.width}
      height={GAUGE_HEIGHT}
    />
  )

const drawHeading = ({ Box, Text }: Ui, cluster: Cluster, { title, note }: Card) => (
  <Box
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    columnGap={3}
  >
    <Text size="footnote">
      <Text weight="medium">{title}</Text>
      {note === undefined ? null : <Text color="inactive">{` · ${note}`}</Text>}
    </Text>
    <Text size="heading" weight="semibold" color={cluster.valueColor} tabular>
      {cluster.value}
    </Text>
  </Box>
)

// A column of one width, so the token counts line up above one another.
const drawShare = ({ Box, Text }: Ui, share: string | undefined) =>
  share === undefined ? null : (
    <Box width={4} justifyContent="flex-end">
      <Text size="footnote" color="inactive" tabular>
        {share}
      </Text>
    </Box>
  )

const drawRow = (ui: Ui, { name, value, share, hue }: Row) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="row" justifyContent="space-between" columnGap={3}>
      <Text size="footnote" color="inactive">
        {hue === undefined ? null : <Text color={hue}>{'● '}</Text>}
        {name}
      </Text>
      <Box flexDirection="row" columnGap={1}>
        <Text size="footnote" tabular>
          {value}
        </Text>
        {drawShare(ui, share)}
      </Box>
    </Box>
  )
}

/**
 * The desktop app draws this as a popover in its own style, above the figure.
 * It does so only for a hidden, absolute Box inside a keyed Box, with no hover
 * scope, and it drops the Box's own size, spacing, border and background.
 */
const drawCard = (ui: Ui, cluster: Cluster) => {
  const { card } = cluster
  if (card === undefined) return null
  const { Box } = ui

  return (
    <Box
      position="absolute"
      display="none"
      hover={{ display: 'flex' }}
      flexDirection="column"
      rowGap="xs"
    >
      {drawHeading(ui, cluster, card)}
      <Box>{drawGauge(ui, card.gauge)}</Box>
      {card.rows.map(row => drawRow(ui, row))}
    </Box>
  )
}

const drawCluster = (ui: Ui, cluster: Cluster) => {
  const { Box, Text } = ui
  const { key, label, value, valueColor, gauge, extra, card } = cluster

  return (
    <Box
      key={key}
      hover={card === undefined ? undefined : { backgroundColor: HOVER_TINT }}
      flexDirection="row"
      alignItems="center"
      columnGap={1}
      paddingX={1}
    >
      <Text size="footnote" color="inactive">
        {label}
      </Text>
      {drawGauge(ui, gauge)}
      <Text size="footnote" tabular>
        <Text color={valueColor} weight="medium">
          {value}
        </Text>
        {extra === undefined ? null : <Text color="inactive">{` ${extra}`}</Text>}
      </Text>
      {drawCard(ui, cluster)}
    </Box>
  )
}

const clustersOf = (figures: Figures, scene: Scene): Cluster[] => {
  const limits = [...figures.rateLimits]
    .sort((a, b) => rank(a) - rank(b))
    .map(limit => limitCluster(limit, scene))
  if (figures.context === undefined) return limits

  return [contextCluster(figures.context, scene.layout), ...limits]
}

export const band = (ui: Ui, { figures, now, columns }: BandInput) => {
  const { Box } = ui
  const clusters = clustersOf(figures, { layout: layoutFor(columns), now })

  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
      {clusters.map(cluster => drawCluster(ui, cluster))}
    </Box>
  )
}
