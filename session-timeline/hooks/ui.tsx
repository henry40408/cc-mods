import type { Elements, RenderChildren } from 'claude-code'

/** The two elements the panel is built from, alike on every surface. */
export type Ui = Pick<Elements['terminal'], 'Box' | 'Text'>

/** The moment a card is drawn for, and the columns it has. */
export type View = { now: number; columns: number }

type Split = {
  left: RenderChildren
  right?: RenderChildren
  rightColor?: string
}

/** One line: `left` gives way and truncates, `right` stays at the far edge. */
export const splitRow = (
  { Box, Text }: Ui,
  { left, right, rightColor = 'inactive' }: Split,
) => (
  <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
    <Box flexShrink={1}>
      <Text wrap="truncate-end">{left}</Text>
    </Box>
    {right === undefined ? null : (
      <Box flexShrink={0}>
        <Text color={rightColor}>{right}</Text>
      </Box>
    )}
  </Box>
)

type Section = {
  color: string
  title: string
  right?: string
  children: RenderChildren
}

/** A heading on its own colored line, and what belongs under it. */
export const section = (ui: Ui, { color, title, right, children }: Section) => {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1} backgroundColor={color}>
        {splitRow(ui, {
          left: (
            <Text color="inverseText" bold>
              {title}
            </Text>
          ),
          right,
          rightColor: 'inverseText',
        })}
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {children}
      </Box>
    </Box>
  )
}
