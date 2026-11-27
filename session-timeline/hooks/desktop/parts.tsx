// What the desktop page is assembled from. The desktop app sets text in a
// proportional face, so nothing here is laid out by counting characters: each
// column is a Box, and the text takes the room the others leave.
import type { Elements, RenderChildren } from 'claude-code'

import type { Picture } from './icons'
import { CARD_GROUND, HOVER_GROUND, NO_BORDER, tint } from './palette'

export type Desk = Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg' | 'Button'>

/** How far a title or a closing line may run before it is cut. */
export const TITLE_LINES = 2
// A share of a line's height: a bar is a thin strip, not a row of text.
const BAR_HEIGHT = 0.3

type Bar = { share: number; ground: string }

/** A piece of a strip, taking `share` parts of its width. */
export const bar = ({ Box }: Desk, { share, ground }: Bar) => (
  <Box
    flexGrow={share}
    height={BAR_HEIGHT}
    borderStyle="round"
    borderColor={NO_BORDER}
    backgroundColor={ground}
    padding={0}
  />
)

type Card = { ground?: string; children: RenderChildren }

/** A rounded block on a ground of its own, with no outline. */
export const card = (
  { Box }: Desk,
  { ground = CARD_GROUND, children }: Card,
) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor={NO_BORDER}
    backgroundColor={ground}
    paddingX="md"
    paddingY="md"
    rowGap="sm"
  >
    {children}
  </Box>
)

type Label = { title: string; right?: string }

/** The small heading over a part of the page. */
export const sectionLabel = ({ Box, Text }: Desk, { title, right }: Label) => (
  <Box
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    columnGap={1}
    paddingX="xs"
  >
    <Text color="inactive" size="caption" weight="semibold">
      {title}
    </Text>
    {right === undefined ? null : (
      <Text color="inactive" size="caption" tabular>
        {right}
      </Text>
    )}
  </Box>
)

export const picture = (
  { Box, Svg }: Desk,
  { source, alt, size, isAnimated = false }: Picture,
) => (
  <Box flexShrink={0}>
    {/* A redraw replaces a plain image, which starts its animation over. The
        app keeps an interactive one's frame for as long as it is unchanged. */}
    <Svg
      source={source}
      alt={alt}
      width={size}
      height={size}
      isInteractive={isAnimated}
    />
  </Box>
)

/** A figure that must stay whole, in digits of one width. */
export const figure = ({ Box, Text }: Desk, text: string) => (
  <Box flexShrink={0}>
    <Text color="inactive" size="caption" tabular>
      {text}
    </Text>
  </Box>
)

export const chip = ({ Box, Text }: Desk, text: string) => (
  <Box
    flexShrink={0}
    borderStyle="round"
    borderColor={NO_BORDER}
    backgroundColor={tint('gray', 18)}
    paddingX="xs"
    paddingY={0}
  >
    <Text size="caption" tabular>
      {text}
    </Text>
  </Box>
)

type Row = {
  /** Sets the row apart from its siblings, so the pointer can light it. */
  key: string
  icon: Picture
  text: RenderChildren
  /** What stays whole at the far edge: chips and figures. */
  trail?: RenderChildren
  ground?: string
}

/** One line of a list: `text` takes the room left over and gives way in it. */
export const listRow = (ui: Desk, { key, icon, text, trail, ground }: Row) => {
  const { Box } = ui

  return (
    <Box
      key={key}
      hover={{ backgroundColor: HOVER_GROUND }}
      flexDirection="row"
      alignItems="center"
      columnGap={1}
      borderStyle="round"
      borderColor={NO_BORDER}
      backgroundColor={ground}
      paddingX="xs"
      paddingY="xs"
    >
      {picture(ui, icon)}
      {/* Without `minWidth`, a long line is cut at the pane's edge. */}
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {text}
      </Box>
      {trail}
    </Box>
  )
}

/** Rows set against each other: the room between them is each row's own. */
export const rowList = ({ Box }: Desk, rows: RenderChildren[]) =>
  rows.length === 0 ? null : <Box flexDirection="column">{rows}</Box>
