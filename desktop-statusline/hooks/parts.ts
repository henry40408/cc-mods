import type { ContextPart } from '../types'

export type PaintedPart = ContextPart & { hue: string }

// None is a level's hue: in the context bar a color names a part, not a state.
// The order is chosen so that neighbors on the bar stay apart, color blindness
// included.
export const PART_HUES = [
  '#3b82d6',
  '#d9488f',
  '#8c8a1e',
  '#a8456b',
  '#2ba3a3',
  '#8b6fd6',
] as const

// The conversation is the part that grows, so it keeps one hue of its own
// wherever the engine lists it.
export const MESSAGES_HUE = '#d97757'
export const OTHER_HUE = '#8b8d98'

const MESSAGES = 'Messages'
// A part smaller than this share of the fill is a sliver nobody can read.
const MIN_SHARE = 0.04

// A hue used twice would name two parts, so a part past the last one is grey.
const hueOf = (name: string, index: number): string =>
  name === MESSAGES ? MESSAGES_HUE : (PART_HUES[index] ?? OTHER_HUE)

const totalOf = (parts: ContextPart[]) =>
  parts.reduce((sum, part) => sum + part.tokens, 0)

const smallestSeen = (parts: ContextPart[]) => totalOf(parts) * MIN_SHARE

/** Each part that holds tokens, in the hue of the bar's piece that covers it. */
export const listParts = (parts: ContextPart[]): PaintedPart[] => {
  const smallest = smallestSeen(parts)

  // The hue follows the part's place in the engine's list, so a part keeps
  // its hue when another one empties.
  return parts
    .map((part, index) => ({
      ...part,
      hue: part.tokens < smallest ? OTHER_HUE : hueOf(part.name, index),
    }))
    .filter(part => part.tokens > 0)
}

/** The bar's pieces: the slivers are gathered into one last `Other`. */
export const paintParts = (parts: ContextPart[]): PaintedPart[] => {
  const smallest = smallestSeen(parts)
  const listed = listParts(parts)
  const seen = listed.filter(part => part.tokens >= smallest)
  const rest = totalOf(listed) - totalOf(seen)
  if (rest <= 0) return seen

  return [...seen, { name: 'Other', tokens: rest, hue: OTHER_HUE }]
}
