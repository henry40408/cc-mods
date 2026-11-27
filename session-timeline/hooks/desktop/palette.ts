/**
 * The colors of the drawings and of what is tinted to match them. An Svg cannot
 * read the theme, so each is a mid-tone that reads on a light ground and on a
 * dark one alike.
 */
export const HUES = {
  green: '#2f9e68',
  amber: '#d98b1f',
  brand: '#d97757',
  blue: '#3b82d6',
  teal: '#1f9aa8',
  pink: '#d9488f',
  violet: '#8b6fd6',
  red: '#e5484d',
  gray: '#8b8d98',
} as const

export type Hue = keyof typeof HUES

/** `hue` at `percent` of its strength, so the ground shows through the rest. */
export const tint = (hue: Hue, percent: number): string => {
  const alpha = Math.round((percent / 100) * 255)

  return HUES[hue] + alpha.toString(16).padStart(2, '0')
}

export const CARD_GROUND = tint('gray', 10)
export const HOVER_GROUND = tint('gray', 16)
// The desktop app rounds only a Box that has a border, so a card with none to
// show still asks for one.
export const NO_BORDER = '#00000000'
