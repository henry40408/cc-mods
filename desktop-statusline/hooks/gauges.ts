// An Svg is drawn as an image and cannot read the theme, so every color here is
// a mid-tone that reads on a light ground and on a dark one alike.
export const LEVEL_HUES = {
  success: '#2f9e68',
  warning: '#d98b1f',
  error: '#e5484d',
} as const

const NEUTRAL = '#8b8d98'

export const GAUGE_HEIGHT = 14
const BAR_TOP = 3
const BAR_HEIGHT = 8
const RADIUS = BAR_HEIGHT / 2
// A sliver thinner than this is not seen as a fill.
const MIN_FILL = 3
const PIECE_GAP = 1
const NOTCH_GAP = 4.5
const NOTCH_WIDTH = 1.5

export type Piece = {
  tokens: number
  hue: string
}

export type ContextGauge = {
  width: number
  percent: number
  /** What the fill is cut into, left to right. */
  pieces: Piece[]
  /** Where the compaction reserve starts, 0 to 1 of the bar. */
  reserveFrom?: number
}

export type LimitGauge = {
  width: number
  percent: number
  hue: string
  /** How much of the window's time has gone by, 0 to 1. */
  elapsed?: number
}

const px = (value: number) => String(Math.round(value * 100) / 100)

const bar = (x: number, width: number, paint: string) =>
  `<rect x="${px(x)}" y="${BAR_TOP}" width="${px(width)}" ` +
  `height="${BAR_HEIGHT}" ${paint}/>`

const capsule = (id: string, width: number) =>
  `<clipPath id="${id}"><rect y="${BAR_TOP}" width="${px(width)}" ` +
  `height="${BAR_HEIGHT}" rx="${RADIUS}"/></clipPath>`

const frame = (width: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" ` +
  `height="${GAUGE_HEIGHT}" viewBox="0 0 ${width} ${GAUGE_HEIGHT}" fill="none">` +
  `${capsule('bar', width)}${body}</svg>`

const track = (width: number) =>
  bar(0, width, `fill="${NEUTRAL}" fill-opacity=".28"`)

const fillWidth = (width: number, percent: number) => {
  if (percent <= 0) return 0

  return Math.max(MIN_FILL, (width * Math.min(percent, 100)) / 100)
}

/** The fill cut into its pieces, a hairline of track between two. */
const cut = (pieces: Piece[], filled: number): string => {
  const total = pieces.reduce((sum, piece) => sum + piece.tokens, 0)
  if (total <= 0) return bar(0, filled, `fill="${NEUTRAL}"`)

  const widths = pieces.map(piece => (filled * piece.tokens) / total)

  return pieces
    .map(({ hue }, index) => {
      const x = widths.slice(0, index).reduce((sum, width) => sum + width, 0)
      const isLast = index === pieces.length - 1
      const width = (widths[index] ?? 0) - (isLast ? 0 : PIECE_GAP)

      return bar(x, Math.max(0, width), `fill="${hue}"`)
    })
    .join('')
}

const reserve = (width: number, from: number | undefined) => {
  if (from === undefined || from <= 0 || from >= 1) return ''

  return (
    '<pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" ' +
    `patternTransform="rotate(45)"><rect width="1.2" height="3" ` +
    `fill="${NEUTRAL}"/></pattern>` +
    bar(width * from, width * (1 - from), 'fill="url(#hatch)"')
  )
}

export const contextGauge = (gauge: ContextGauge): string => {
  const { width, percent, pieces, reserveFrom } = gauge
  const filled = fillWidth(width, percent)

  return frame(
    width,
    capsule('fill', filled) +
      `<g clip-path="url(#bar)">${track(width)}${reserve(width, reserveFrom)}` +
      `<g clip-path="url(#fill)">${cut(pieces, filled)}</g></g>`,
  )
}

/** A gap cut through the bar with a taller mark in it, so it shows on any fill. */
const notch = (width: number, elapsed: number) => {
  const edge = NOTCH_GAP / 2
  const x = Math.min(width - edge, Math.max(edge, width * elapsed))

  return {
    mask:
      `<mask id="gap"><rect width="${width}" height="${GAUGE_HEIGHT}" ` +
      `fill="#fff"/><rect x="${px(x - edge)}" width="${NOTCH_GAP}" ` +
      `height="${GAUGE_HEIGHT}" fill="#000"/></mask>`,
    mark:
      `<rect x="${px(x - NOTCH_WIDTH / 2)}" y="0.5" width="${NOTCH_WIDTH}" ` +
      `height="${GAUGE_HEIGHT - 1}" rx="${NOTCH_WIDTH / 2}" fill="${NEUTRAL}"/>`,
  }
}

export const limitGauge = ({ width, percent, hue, elapsed }: LimitGauge) => {
  const filled = bar(
    0,
    fillWidth(width, percent),
    `rx="${RADIUS}" fill="${hue}"`,
  )
  const body = `${track(width)}${filled}`
  if (elapsed === undefined) {
    return frame(width, `<g clip-path="url(#bar)">${body}</g>`)
  }

  const { mask, mark } = notch(width, elapsed)

  return frame(
    width,
    `${mask}<g clip-path="url(#bar)"><g mask="url(#gap)">${body}</g></g>${mark}`,
  )
}
