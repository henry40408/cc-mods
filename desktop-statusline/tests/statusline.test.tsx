import { expect, mock, test } from 'claude-code/testing'

import { CARD_BAR } from '../hooks/band'
import {
  MESSAGES_HUE,
  OTHER_HUE,
  PART_HUES,
  listParts,
  paintParts,
} from '../hooks/parts'
import { resetTime } from '../hooks/time'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const RESET = '2026-01-01T14:00:00Z'
const WEEK_RESET = '2026-01-04T18:00:00Z'
// 1h 27m before the five-hour reset: 71% of that window is gone.
const NOW = Date.parse(RESET) - 87 * MINUTE

const category = (name: string, tokens: number, kind = 'used') => ({
  name,
  tokens,
  kind,
  color: 'inactive',
  isDeferred: kind === 'deferred',
})

const USAGE = {
  startedAt: 0,
  context: {
    tokens: 55_000,
    window: 1_000_000,
    percent: 6,
    breakdown: {
      rawMaxTokens: 220_000,
      autoCompactThreshold: 187_000,
      categories: [
        category('System prompt', 4_000),
        category('System tools', 14_000),
        category('MCP tools (deferred)', 30_000, 'deferred'),
        category('Memory files', 0),
        category('Messages', 31_000),
        category('Free space', 132_000, 'free'),
        category('Autocompact buffer', 33_000, 'buffer'),
      ],
    },
  },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 62.4, resetsAt: RESET },
    { kind: 'seven_day', percentUsed: 85, resetsAt: WEEK_RESET },
  ],
}

const BAND = {
  plugin: 'desktop-statusline',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 110,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const bandOf = (bodyColumns: number) => ({
  ...BAND,
  props: { ...BAND.props, bodyColumns },
})

/** The engine beneath the plugin, answering `usage.current` when asked. */
const engine = (on: any, current: any = USAGE) => {
  const usage = { current }
  // As the engine does, the breakdown comes only to a caller that asks, and
  // `summary` is the one that sends no request.
  on('session.usage', (_: unknown, e: any) => {
    const { context, ...rest } = usage.current
    const { breakdown, ...unbroken } = context
    const isAsked = e.breakdown === 'summary'

    return { value: { ...rest, context: isAsked ? context : unbroken } }
  })
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.measure', (_: unknown, e: any) => ({ changed: e.changed }))
  on('classic.SessionStart', () => ({}))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return usage
}

/** A started session at `NOW`, and the clock that moves it on. */
const begin = async ($: any, on: any, current?: any) => {
  const clock = mock.clock(on, { now: NOW })
  const usage = engine(on, current)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  return { clock, usage }
}

const shown = async (ui: any) =>
  (await ui.findAll({ type: 'Text' })).map((found: any) => found.text)

/** The bars on the row itself, without those in the hover cards. */
const gauges = async (ui: any) =>
  (await ui.findAll({ type: 'Svg' }))
    .map((found: any) => found.props)
    .filter(({ width }: any) => width !== CARD_BAR)

/** Every element of a drawn tree: `findAll` does not carry `hover`. */
const elementsOf = (node: any): any[] =>
  typeof node === 'string'
    ? []
    : [node, ...(node.children ?? []).flatMap(elementsOf)]

const wordsOf = (node: any): string =>
  typeof node === 'string' ? node : (node.children ?? []).map(wordsOf).join('')

const isCard = (node: any) => node.props?.display === 'none'

/** The words of each card, line by line. */
const cards = async (ui: any) =>
  elementsOf(await ui.drawn())
    .filter(isCard)
    .map(card => card.children.map(wordsOf).filter(Boolean))

test('the band shows context and limits', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(BAND)

  const texts = await shown(ui)
  expect(texts).toContain('Context')
  // 55k of the 220k compaction window, not of the model's 1M.
  expect(texts).toContain('25% 55k/220k')
  expect(texts).toContain('62% 1h 27m')
  expect(texts).toContain('85% 3d 5h')
  await ui.unmount()
})

test('a percentage is colored by how full it is', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(BAND)

  const colors = Object.fromEntries(
    (await ui.findAll({ type: 'Text' })).map((found: any) => [
      found.text,
      found.props.color,
    ]),
  )
  expect(colors['25%']).toBe('success')
  expect(colors['62%']).toBe('warning')
  expect(colors['85%']).toBe('error')
  await ui.unmount()
})

test('each figure has a bar', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(BAND)

  expect((await gauges(ui)).map(({ alt }: any) => alt)).toEqual([
    'Context 25% full',
    '5h limit 62% used',
    '1w limit 85% used',
  ])
  await ui.unmount()
})

test('the context bar has a piece for each part that holds tokens', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(BAND)

  const [context] = await gauges(ui)
  const hues = [...PART_HUES, MESSAGES_HUE].filter(hue =>
    context.source.includes(hue),
  )
  // The deferred schemas fill nothing, and the memory files hold no tokens.
  expect(hues).toEqual([PART_HUES[0], PART_HUES[1], MESSAGES_HUE])
  expect(context.source).toContain('hatch')
  await ui.unmount()
})

test('parts too small to see are drawn as one', async ($, on) => {
  const categories = [
    category('Skills', 900),
    category('Memory files', 800),
    category('Messages', 53_300),
  ]
  const breakdown = { ...USAGE.context.breakdown, categories }
  const context = { ...USAGE.context, breakdown }
  await begin($, on, { ...USAGE, context })
  const ui = await $.ui.mount(BAND)

  const [gauge] = await gauges(ui)
  expect(gauge.source).toContain(MESSAGES_HUE)
  // The last piece, after the one for the messages.
  expect(gauge.source).toContain(`fill="${OTHER_HUE}"/></g></g></svg>`)
  expect(gauge.source).not.toContain(PART_HUES[0])
  await ui.unmount()
})

test('the card names every part of the grey piece, with its share', async ($, on) => {
  const names = ['Skills', 'Memory files', 'MCP tools', 'Custom agents']
  const categories = [
    ...names.map((name, index) => category(name, 900 - index * 100)),
    category('Messages', 52_000),
  ]
  const breakdown = { ...USAGE.context.breakdown, categories }
  const context = { ...USAGE.context, breakdown }
  await begin($, on, { ...USAGE, context })
  const ui = await $.ui.mount(BAND)

  const [card] = await cards(ui)
  expect(card).toEqual([
    'Context · 55k of 220k25%',
    '● Messages52k24%',
    '● Skills900<1%',
    '● Memory files800<1%',
    '● MCP tools700<1%',
    '● Custom agents600<1%',
  ])
  const dots = elementsOf(await ui.drawn()).filter(
    node => wordsOf(node) === '● ',
  )
  expect(dots.map(dot => dot.props.color)).toEqual([
    MESSAGES_HUE,
    ...names.map(() => OTHER_HUE),
  ])
  await ui.unmount()
})

test('each of six parts beside the conversation has a hue of its own', async () => {
  const names = [
    'System prompt',
    'System tools',
    'MCP tools',
    'Custom agents',
    'Memory files',
    'Skills',
    'Messages',
  ]
  const painted = paintParts(names.map(name => ({ name, tokens: 1_000 })))

  expect(new Set(painted.map(({ hue }) => hue)).size).toBe(names.length)
})

test('a part past the last hue keeps a grey piece of its own', async () => {
  const names = [
    'System prompt',
    'System tools',
    'MCP tools',
    'Custom agents',
    'Memory files',
    'Skills',
    'Slash commands',
  ]
  const parts = names.map(name => ({ name, tokens: 1_000 }))
  const painted = paintParts(parts)

  expect(painted.map(({ name }) => name)).toEqual(names)
  expect(painted.at(-1)?.hue).toBe(OTHER_HUE)
  expect(listParts(parts)).toEqual(painted)
})

test('a context over its window says by how much', async ($, on) => {
  const context = { ...USAGE.context, tokens: 230_000 }
  await begin($, on, { ...USAGE, context })
  const ui = await $.ui.mount(BAND)

  expect(await shown(ui)).toContain('105% 230k/220k')
  await ui.unmount()
})

test('a cleared conversation leaves no old context behind', async ($, on) => {
  const { usage } = await begin($, on)
  const ui = await $.ui.mount(BAND)

  usage.current = { ...USAGE, context: { window: 1_000_000 } }
  await $.classic.SessionStart({ source: 'clear' })

  const texts = await shown(ui)
  expect(texts).not.toContain('Context')
  expect(texts).toContain('62% 1h 27m')
  await ui.unmount()
})

test('a reset on another day is named by its weekday', async () => {
  const now = new Date(2026, 0, 1, 12, 33).getTime()

  expect(resetTime(new Date(2026, 0, 1, 14, 0).getTime(), now)).toBe('14:00')
  expect(resetTime(new Date(2026, 0, 4, 18, 5).getTime(), now)).toBe('Sun 18:05')
})

test('a limit bar marks how much of its window is gone', async ($, on) => {
  const rateLimits = [...USAGE.rateLimits, { kind: 'spend_limit', percentUsed: 12 }]
  await begin($, on, { ...USAGE, rateLimits })
  const ui = await $.ui.mount(BAND)

  const [, fiveHour, , spend] = await gauges(ui)
  // 71% of 64 pixels.
  expect(fiveHour.source).toContain('<rect x="44.69" y="0.5"')
  // A spend limit has no window of a known length.
  expect(spend.source).not.toContain('mask')
  await ui.unmount()
})

test('the limits keep one order, however they are listed', async ($, on) => {
  await begin($, on, { ...USAGE, rateLimits: [...USAGE.rateLimits].reverse() })
  const ui = await $.ui.mount(BAND)

  const texts = await shown(ui)
  expect(texts.indexOf('5h')).toBeLessThan(texts.indexOf('1w'))
  await ui.unmount()
})

test('a new measurement redraws the band', async ($, on) => {
  const { usage } = await begin($, on)
  const ui = await $.ui.mount(BAND)

  const rateLimits = [{ kind: 'five_hour', percentUsed: 70 }]
  usage.current = { ...USAGE, rateLimits }
  await $.session.measure({
    context: { window: 1_000_000 },
    rateLimits,
    changed: ['rateLimits'],
  })

  expect(await shown(ui)).toContain('70%')
  await ui.unmount()
})

test('the time left counts down with no new measurement', async ($, on) => {
  const { clock } = await begin($, on)
  const ui = await $.ui.mount(BAND)

  await clock.advance(MINUTE)

  expect(await shown(ui)).toContain('62% 1h 26m')
  await ui.unmount()
})

test('a limit whose window is over is not shown as current', async ($, on) => {
  const { clock } = await begin($, on)
  const ui = await $.ui.mount(BAND)

  await clock.advance(2 * HOUR)

  const texts = await shown(ui)
  expect(texts).toContain('reset')
  expect(texts).not.toContain('62%')
  expect(texts).toContain('85% 3d 3h')
  const [, fiveHour] = await cards(ui)
  expect(fiveHour).toEqual([
    '5h limit · no reading sincereset',
    `Window reset${resetTime(Date.parse(RESET), NOW + 2 * HOUR)}`,
  ])
  await ui.unmount()
})

test('a narrower band has shorter bars and fewer words', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(bandOf(60))

  expect((await gauges(ui)).map(({ width }: any) => width)).toEqual([40, 32, 32])
  const texts = await shown(ui)
  expect(texts).toContain('25%')
  expect(texts).toContain('62%')
  await ui.unmount()
})

test('the narrowest band is words alone', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(bandOf(40))

  expect(await gauges(ui)).toEqual([])
  expect(await shown(ui)).toContain('85%')
  await ui.unmount()
})

for (const columns of [140, 80, 40]) {
  test(`at ${columns} columns each figure holds a card`, async ($, on) => {
    await begin($, on)
    const ui = await $.ui.mount(bandOf(columns))

    expect(await cards(ui)).toEqual([
      [
        'Context · 55k of 220k25%',
        '● Messages31k14%',
        '● System tools14k6%',
        '● System prompt4k2%',
      ],
      [
        '5h limit62%',
        'Window gone71%',
        `Resets${resetTime(Date.parse(RESET), NOW)}`,
      ],
      [
        '1w limit85%',
        'Window gone54%',
        `Resets${resetTime(Date.parse(WEEK_RESET), NOW)}`,
      ],
    ])
    // The cards have room for bars even where the row does not.
    const bars = await ui.findAll({ type: 'Svg' })
    expect(bars.filter(({ props }: any) => props.width === CARD_BAR)).toHaveLength(3)
    await ui.unmount()
  })
}

// The desktop app makes a popover only of a hidden, absolute Box inside a keyed
// Box, with no hover scope on it.
test('the desktop app can lift each card into a popover', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(BAND)

  const anchors = elementsOf(await ui.drawn()).filter(
    node => node.children?.some(isCard),
  )
  expect(anchors).toHaveLength(3)
  for (const anchor of anchors) {
    expect(anchor.hover.scope).toBeUndefined()
    expect(anchor.hover.backgroundColor).toBeDefined()
    const card = anchor.children.find(isCard)
    expect(card.props.position).toBe('absolute')
    expect(card.hover).toEqual({ display: 'flex' })
  }
  const keyed = await Promise.all(
    ['context', 'limit-five_hour', 'limit-seven_day'].map(key =>
      ui.find({ key }),
    ),
  )
  expect(keyed.filter(Boolean)).toHaveLength(3)
  await ui.unmount()
})

test('a limit with no reset time opens nothing', async ($, on) => {
  const rateLimits = [{ kind: 'spend_limit', percentUsed: 12 }]
  await begin($, on, { ...USAGE, context: { window: 200_000 }, rateLimits })
  const ui = await $.ui.mount(BAND)

  const elements = elementsOf(await ui.drawn())
  expect(elements.filter(({ hover }) => hover !== undefined)).toEqual([])
  expect(await shown(ui)).toContain('12%')
  await ui.unmount()
})

test('limits are drawn before the first response', async ($, on) => {
  await begin($, on, { ...USAGE, context: { window: 200_000 } })
  const ui = await $.ui.mount(BAND)

  const texts = await shown(ui)
  expect(texts).not.toContain('Context')
  expect(texts).toContain('62% 1h 27m')
  await ui.unmount()
})

test('context is drawn without a subscription', async ($, on) => {
  await begin($, on, { ...USAGE, rateLimits: [] })
  const ui = await $.ui.mount(BAND)

  expect((await gauges(ui)).length).toBe(1)
  expect(await shown(ui)).toContain('25% 55k/220k')
  await ui.unmount()
})

test('figures the engine lacks are left out', async ($, on) => {
  await begin($, on, {
    startedAt: 0,
    context: { window: 200_000 },
    rateLimits: [],
  })
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Box' })).toBeUndefined()
  await ui.unmount()
})

test('the terminal is left alone', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await shown(ui)).toEqual(['engine'])
  await ui.unmount()
})

test('a survey is given the band', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
  })

  expect(await shown(ui)).toEqual(['engine'])
  await ui.unmount()
})
