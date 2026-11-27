import type { Entry } from '../../types'
import { HUES } from './palette'
import type { Hue } from './palette'

/** A drawing as an `Svg` element takes it, and its side in CSS pixels. */
export type Picture = {
  source: string
  alt: string
  size: number
  isAnimated?: boolean
}

type Glyph = { hue: Hue; alt: string; strokes: string }

const ICON_SIZE = 20

// Each is drawn on a 20 by 20 grid, in strokes of the tile's own color.
const GLYPHS = {
  shell: {
    hue: 'pink',
    alt: 'Command',
    strokes: '<path d="M6 7l3 3-3 3M10.8 13.4h3.4"/>',
  },
  lookup: {
    hue: 'blue',
    alt: 'Lookup',
    strokes: '<circle cx="9.2" cy="9.2" r="3.4"/><path d="M11.8 11.8l2.6 2.6"/>',
  },
  edit: {
    hue: 'green',
    alt: 'Edit',
    strokes: '<path d="M6 14l.7-2.8 5.5-5.5 2.1 2.1-5.5 5.5z"/>',
  },
  web: {
    hue: 'teal',
    alt: 'Web',
    strokes:
      '<circle cx="10" cy="10" r="4.6"/>' +
      '<ellipse cx="10" cy="10" rx="1.9" ry="4.6"/><path d="M5.4 10h9.2"/>',
  },
  agent: {
    hue: 'violet',
    alt: 'Agent',
    strokes:
      '<path fill="currentColor" stroke-width="1" ' +
      'd="M10 5l1.3 3.7L15 10l-3.7 1.3L10 15l-1.3-3.7L5 10l3.7-1.3z"/>',
  },
  ask: {
    hue: 'amber',
    alt: 'Question',
    strokes:
      '<path d="M7.9 8a2.1 2.1 0 1 1 3.2 1.8c-.8.5-1.1.9-1.1 1.7"/>' +
      '<path d="M10 14.1v.1"/>',
  },
  other: {
    hue: 'gray',
    alt: 'Tool',
    strokes: '<path d="M10 6l4 4-4 4-4-4z"/>',
  },
  failed: {
    hue: 'red',
    alt: 'Failed',
    strokes: '<path d="M7 7l6 6M13 7l-6 6"/>',
  },
  stopped: {
    hue: 'gray',
    alt: 'Stopped',
    strokes: '<rect x="7" y="7" width="6" height="6" rx="1"/>',
  },
  prompt: {
    hue: 'brand',
    alt: 'Prompt',
    strokes: '<path stroke-width="2" d="M8 6l4 4-4 4"/>',
  },
  trigger: {
    hue: 'violet',
    alt: 'Started by itself',
    strokes: '<path d="M13.8 6v3.4a1.6 1.6 0 0 1-1.6 1.6H6.4M8.8 8.4L6.2 11l2.6 2.6"/>',
  },
  say: {
    hue: 'gray',
    alt: 'Claude said',
    strokes:
      '<path d="M5.5 7.1c0-.9.7-1.6 1.6-1.6h5.8c.9 0 1.6.7 1.6 1.6v3.8' +
      'c0 .9-.7 1.6-1.6 1.6H10l-2.6 2v-2h-.3c-.9 0-1.6-.7-1.6-1.6z"/>',
  },
  notice: {
    hue: 'amber',
    alt: 'Notice',
    strokes: '<path d="M10 6v5M10 13.9v.1"/>',
  },
  milestone: {
    hue: 'blue',
    alt: 'Milestone',
    strokes: '<path d="M7 15V5.5h6.4l-1.7 2.3 1.7 2.3H7"/>',
  },
  upcoming: {
    hue: 'violet',
    alt: 'Coming back by itself',
    strokes: '<circle cx="10" cy="10" r="4.6"/><path d="M10 7.3V10l1.8 1.3"/>',
  },
  earlier: {
    hue: 'gray',
    alt: 'Earlier',
    strokes: '<path stroke-width="2" d="M6.5 10h0M10 10h0M13.5 10h0"/>',
  },
} satisfies Record<string, Glyph>

export type IconName = keyof typeof GLYPHS

const TOOL_ICONS: Record<string, IconName> = {
  Bash: 'shell',
  Read: 'lookup',
  Grep: 'lookup',
  Glob: 'lookup',
  ToolSearch: 'lookup',
  Edit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  WebFetch: 'web',
  WebSearch: 'web',
  Agent: 'agent',
  SendMessage: 'agent',
  AskUserQuestion: 'ask',
  ExitPlanMode: 'ask',
}

const tileSource = ({ hue, strokes }: Glyph): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" ` +
  `height="${ICON_SIZE}" viewBox="0 0 20 20" color="${HUES[hue]}" fill="none" ` +
  'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
  'stroke-linejoin="round">' +
  '<rect width="20" height="20" rx="6" fill="currentColor" ' +
  `fill-opacity=".16" stroke="none"/>${strokes}</svg>`

const toPicture = (glyph: Glyph): Picture => ({
  source: tileSource(glyph),
  alt: glyph.alt,
  size: ICON_SIZE,
})

/** A rounded tile for each kind of row, built once: a source never changes. */
export const ICONS = Object.fromEntries(
  Object.entries(GLYPHS).map(([name, glyph]) => [name, toPicture(glyph)]),
) as Record<IconName, Picture>

export const iconHue = (name: IconName): Hue => GLYPHS[name].hue

export const entryIcon = (entry: Entry): IconName => {
  if (entry.kind !== 'tool') return entry.kind
  if (entry.status === 'failed') return 'failed'
  if (entry.status === 'stopped') return 'stopped'

  return TOOL_ICONS[entry.tool] ?? 'other'
}
