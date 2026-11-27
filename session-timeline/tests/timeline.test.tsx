import { expect, mock, test } from 'claude-code/testing'

import { clockTime } from '../hooks/format'

const PLAN = 'mcp__session-timeline__plan'

const NOW = Date.parse('2026-01-01T10:00:00Z')

const PANE = {
  plugin: 'session-timeline',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'session-timeline',
  props: {
    title: 'Timeline',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** The engine beneath the plugin, for a session whose transcript is `jsonl`. */
/** What the engine draws where the plugin only passes a drawing on. */
const drawNothing = ($: any, e: any) => {
  const { Text } = $.ui.resolve(e)

  return <Text>-</Text>
}

const engine = (on: any, jsonl = '', other = '') => {
  const clock = mock.clock(on, { now: NOW })
  on('command.register', () => ({ value: { command: 'timeline' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', drawNothing)
  on('session.info', () => ({ value: { transcriptPath: '/t.jsonl' } }))
  on('fs.stat', () => ({ value: { size: jsonl.length } }))
  on('classic.SessionStart', () => ({}))
  on('classic.PostCompact', () => ({}))
  on('fs.read', (_: unknown, e: any) => ({
    value: e.path === '/other.jsonl' ? other : jsonl,
  }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('prompt.submit', (_: unknown, e: any) =>
    e.text === 'blocked' ? { drop: 'policy' } : { text: e.text },
  )
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.PermissionRequest', (_: unknown, e: any) =>
    e.tool_input.command === 'allowed-by-hook'
      ? { decision: { behavior: 'allow' } }
      : {},
  )
  on('classic.Stop', () => ({}))

  return clock
}

const start = ($: any) =>
  $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

const append = ($: any, door: string, role: string, content: unknown[]) =>
  $.session.append({
    message: { type: role, role, content },
    door,
    origin: { kind: 'engine' },
    uuid: `${door}-${JSON.stringify(content).length}`,
  })

const call = ($: any, id: string, name: string, input: unknown) =>
  append($, 'response', 'assistant', [{ type: 'tool_use', id, name, input }])

const answer = ($: any, id: string) =>
  append($, 'tool-result', 'user', [
    { type: 'tool_result', tool_use_id: id, content: 'ok' },
  ])

const submit = ($: any, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const screen = async ($: any, bodyColumns = 80): Promise<string> => {
  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, bodyColumns },
  })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()

  return texts.map((found: { text: string }) => found.text).join('\n')
}

test('a turn shows what ran, what runs and the plan', async ($, on) => {
  const clock = engine(on)
  await start($)
  await submit($, 'fix the bug')
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  await call($, 'p1', PLAN, {
    steps: [
      { title: 'find the cause', status: 'done' },
      { title: 'apply the fix', status: 'in_progress' },
      { title: 'run the tests', status: 'pending' },
    ],
  })
  await call($, 'a', 'Read', { file_path: '/x/main.rs' })
  await answer($, 'a')
  await call($, 'b', 'Bash', { command: 'cargo build', description: 'build' })
  await clock.advance(65_000)

  const shown = await screen($)

  expect(shown).toContain('Working\n1m05s')
  expect(shown).toContain('$ Run: build\n$ \n1m05s')
  expect(shown).toContain('1/3 done')
  // 80 columns, less the padding, 'Up next', '1/3 done' and two spaces.
  expect(shown).toContain(`Up next ${'●'.repeat(20)}${'○'.repeat(41)}`)
  expect(shown).toContain('✔ find the cause')
  expect(shown).toContain('◉ apply the fix')
  expect(shown).toContain('○ run the tests')
  expect(shown).toContain('◇ Read main.rs')
  expect(shown).toContain('▲ Finished step: find the cause')
  expect(shown).toContain('fix the bug\n2 actions')
  expect(shown.includes('session-timeline › plan')).toBe(false)
})

// The panel tells local times, which differ with where the tests run.
const timeAfter = (ms: number) => clockTime(NOW + ms, NOW + ms)

const planned = ($: any, id: string, ...steps: [string, string][]) =>
  call($, id, PLAN, {
    steps: steps.map(([title, status]) => ({ title, status })),
  })

test('a plan step tells when and how long', async ($, on) => {
  const clock = engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await planned($, 'p1', ['dig', 'in_progress'], ['fix', 'pending'])
  await clock.advance(130_000)
  await planned($, 'p2', ['dig', 'done'], ['fix', 'in_progress'])
  await clock.advance(45_000)
  await planned($, 'p3', ['dig', 'done'], ['fix', 'in_progress'])

  const shown = await screen($)

  expect(shown).toContain(`\ndig\n${timeAfter(130_000)} · 2m10s\n`)
  expect(shown).toContain(`\nfix\n${timeAfter(130_000)} · 45s\n`)
})

test('a step never seen in progress tells only when', async ($, on) => {
  engine(on)
  await start($)
  await call($, 'p1', PLAN, {
    steps: [
      { title: 'dig', status: 'done', startedAt: 0 },
      { title: 'fix', status: 'pending', startedAt: 0 },
    ],
  })

  const shown = await screen($)

  // Neither a length for the finished step nor any time for the pending one.
  expect(shown).toContain(`\ndig\n${timeAfter(0)}\n○ fix\n○ \nfix\nHistory`)
})

test('steps of one title keep their own times', async ($, on) => {
  const clock = engine(on)
  await start($)
  await planned($, 'p1', ['test', 'in_progress'], ['test', 'pending'])
  await clock.advance(60_000)
  await planned($, 'p2', ['test', 'done'], ['test', 'in_progress'])
  await clock.advance(5_000)
  await planned($, 'p3', ['test', 'done'], ['test', 'done'])

  const shown = await screen($)

  expect(shown).toContain(`${timeAfter(60_000)} · 1m00s`)
  expect(shown).toContain(`${timeAfter(65_000)} · 5s`)
})

test('a step left open stops counting once nothing works', async ($, on) => {
  let redraws = 0
  const clock = engine(on)
  on('ui.invalidate', () => {
    redraws += 1

    return { value: undefined }
  })
  await start($)
  await planned($, 'p1', ['dig', 'in_progress'])
  await clock.advance(2_000)

  expect(redraws).toBe(0)
  expect(await screen($)).toContain(`\ndig\n${timeAfter(0)}\nHistory`)
})

test('a step waiting on background work keeps counting', async ($, on) => {
  let redraws = 0
  const clock = engine(on)
  on('ui.invalidate', () => {
    redraws += 1

    return { value: undefined }
  })
  await start($)
  await planned($, 'p1', ['dig', 'in_progress'])
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      { id: 'b1', type: 'shell', status: 'running', description: 'build' },
    ],
  })
  await clock.advance(2_000)

  expect(redraws).toBe(2)
  expect(await screen($)).toContain(`\ndig\n${timeAfter(0)} · 2s\n`)

  await planned($, 'p2', ['dig', 'done'])
  await clock.advance(2_000)

  expect(redraws).toBe(2)
})

test('the plan tool is answered without asking', async ($, on) => {
  engine(on)
  await start($)

  const result = await $.tool.call({ tool: PLAN, steps: [] })

  expect(result).toEqual({
    result: 'The timeline panel now shows this plan.',
  })
})

test('the prompt asks for a plan only where the tool is', async ($, on) => {
  on('prompt.compose', () => ({ sections: [] }))
  const compose = (tools: string[]) =>
    $.prompt.compose({
      model: 'm',
      promptModel: 'm',
      surfaces: ['terminal'],
      tools,
      outputStyle: null,
      traits: [],
    })

  const asked = await compose(['Read', PLAN])
  const silent = await compose(['Read'])

  expect(asked.sections.length).toBe(1)
  expect(silent.sections.length).toBe(0)
})

test('the end of a turn leaves nothing running', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, 'a', 'Bash', { command: 'sleep 100' })
  await $.turn.complete({
    answer: '',
    durationMs: 1,
    isAborted: true,
    turnId: 't1',
    reason: 'aborted',
  })

  const shown = await screen($)

  expect(shown).toContain('○ Idle, your turn')
  expect(shown).toContain('■ Run: sleep 100')
  expect(shown).toContain('… Earlier')
  expect(shown).toContain('! You interrupted the run')
})

test('a permission dialog shows as waiting on the person', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, 'a', 'Bash', { command: 'rm -rf build' })
  await $.classic.PermissionRequest({
    tool_name: 'Bash',
    tool_input: { command: 'rm -rf build' },
  })

  expect(await screen($)).toContain('⚠ Waiting for you\n')
  expect(await screen($)).toContain('Run: rm -rf build')

  await answer($, 'a')

  expect(await screen($)).toContain('Working')
})

test('background work is listed until it reports', async ($, on) => {
  engine(on)
  await start($)
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      {
        id: 'bg1',
        type: 'shell',
        status: 'running',
        description: 'wait for CI',
      },
    ],
    session_crons: [
      {
        id: 'c1',
        schedule: '30 9 5 3 *',
        recurring: false,
        prompt: 'check the deploy',
      },
    ],
  })

  const before = await screen($)

  expect(before).toContain('◔ Background shell: wait for CI')
  expect(before).toContain('◔ Scheduled 3/5 09:30 · check the deploy')

  await submit(
    $,
    '<task-notification>\n<task-id>bg1</task-id>\n' +
      '<summary>CI passed</summary>\n</task-notification>',
  )
  const after = await screen($)

  expect(after.includes('Background shell')).toBe(false)
  expect(after).toContain('Background report: CI passed')
})

const row = (fields: Record<string, unknown>) =>
  JSON.stringify({ timestamp: '2026-01-01T09:00:00Z', ...fields })

const said = (uuid: string, role: string, content: unknown) =>
  row({ type: role, uuid, message: { role, content } })

test('the history comes back from the transcript', async ($, on) => {
  const transcript = [
    '{"cut off',
    said('u1', 'user', 'write a mod'),
    said('a1', 'assistant', [
      { type: 'text', text: '🤖 Check the API first\n\ndetails' },
    ]),
    said('a2', 'assistant', [
      { type: 'tool_use', id: 'x', name: 'Grep', input: { pattern: 'foo' } },
    ]),
    said('u2', 'user', [
      { type: 'tool_result', tool_use_id: 'x', is_error: true },
    ]),
    row({
      type: 'attachment',
      uuid: 'q1',
      attachment: { type: 'queued_command', prompt: 'also add tests' },
    }),
    row({
      type: 'user',
      uuid: 'side',
      isSidechain: true,
      message: { role: 'user', content: 'subagent content' },
    }),
    said('w', 'user', '<local-command-stdout>noise</local-command-stdout>'),
  ].join('\n')
  engine(on, transcript)

  await start($)
  const shown = await screen($)

  expect(shown).toContain('write a mod')
  expect(shown).toContain('· Check the API first')
  expect(shown).toContain('✗ Search code: foo')
  expect(shown).toContain('✗ 1 failed')
  expect(shown).toContain('also add tests')
  expect(shown.includes('subagent')).toBe(false)
  expect(shown.includes('noise')).toBe(false)
})

test('a streak of lookups shares a row', async ($, on) => {
  engine(on)
  await start($)
  for (const id of ['a', 'b', 'c']) {
    await call($, id, 'Read', { file_path: `/x/${id}.ts` })
    await answer($, id)
  }

  const shown = await screen($)

  expect(shown).toContain('Read several files\n×3')
  expect(shown.includes('b.ts')).toBe(false)
})

test('calls that say different things keep their rows', async ($, on) => {
  engine(on)
  await start($)
  for (const [id, command] of [
    ['a', 'make'],
    ['b', 'make test'],
    ['c', 'make test'],
  ]) {
    await call($, String(id), 'Bash', { command })
    await answer($, String(id))
  }

  const shown = await screen($)

  expect(shown).toContain('Run: make test\n×2')
  expect(shown.endsWith('Run: make')).toBe(true)
})

const ask = ($: any, command: string, extra = {}) =>
  $.classic.PermissionRequest({
    tool_name: 'Bash',
    tool_input: { command },
    ...extra,
  })

test('other calls leave an open dialog showing', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, 'a', 'Read', { file_path: '/x/a.ts' })
  await call($, 'b', 'Bash', { command: 'rm -rf build' })
  await ask($, 'rm -rf build')

  await answer($, 'a')
  await $.session.append({
    message: {
      type: 'user',
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'z', content: 'ok' }],
    },
    door: 'tool-result',
    origin: { kind: 'engine' },
    uuid: 'sub-result',
    agentId: 'agent-1',
  })

  expect(await screen($)).toContain('⚠ Waiting for you')
})

test("a subagent's dialog ends with its result", async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ask($, 'make', { agent_id: 'agent-1' })

  expect(await screen($)).toContain('⚠ Waiting for you')

  await $.session.append({
    message: {
      type: 'user',
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'z', content: 'ok' }],
    },
    door: 'tool-result',
    origin: { kind: 'engine' },
    uuid: 'sub-result',
    agentId: 'agent-1',
  })

  expect(await screen($)).toContain('Working')
})

test('a call seen running is no longer asked about', async ($, on) => {
  const clock = engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, 'a', 'Bash', { command: 'make' })
  await ask($, 'make')
  await clock.advance(2000)

  expect(await screen($)).toContain('⚠ Waiting for you')

  const pill = await $.ui.mount({
    plugin: 'session-timeline',
    surface: 'terminal',
    component: 'ToolProgress',
    requestId: 'a',
    props: { tool_use_id: 'a', kind: 'background_hint', hint: 'ctrl+b' },
  })
  await clock.advance(1000)
  await pill.unmount()

  expect(await screen($)).toContain('Working')
})

test('resuming another conversation shows its history', async ($, on) => {
  engine(
    on,
    said('u1', 'user', 'old request'),
    said('u2', 'user', 'another conversation'),
  )
  await start($)

  await $.classic.SessionStart({
    source: 'resume',
    transcript_path: '/other.jsonl',
  })
  const shown = await screen($)

  expect(shown).toContain('another conversation')
  expect(shown.includes('old request')).toBe(false)
})

const report = (body: string) =>
  `<task-notification>\n${body}\n</task-notification>`

const notify = ($: any, text: string, extra = {}) =>
  $.prompt.submit({
    text,
    wait: false,
    isMeta: true,
    origin: { kind: 'task-notification' },
    ...extra,
  })

test('work a notification starts gets its own chapter', async ($, on) => {
  engine(on)
  await start($)
  await submit($, 'wait for CI')
  await notify($, report('<summary>CI passed</summary>'))
  await call($, 'a', 'Edit', { file_path: '/x/a.ts' })
  await answer($, 'a')

  const shown = await screen($)

  expect(shown).toContain('Background report: CI passed\n1 action\n')
})

test('a report during a turn stays in its chapter', async ($, on) => {
  engine(on)
  await start($)
  await submit($, 'fix a bug')
  await call($, 'a', 'Edit', { file_path: '/x/a.ts' })
  await answer($, 'a')
  await notify($, report('hot reload is on'), { turnId: 't1' })

  const shown = await screen($)

  expect(shown).toContain('fix a bug\n1 action\n')
  expect(shown).toContain('! Background report: hot reload is on')
  expect(shown).toContain('❯ 1 prompt · ◆ 1 action\n')
})

test('machine prompts come back from the transcript', async ($, on) => {
  const meta = (uuid: string, kind: string, content: string) =>
    row({
      type: 'user',
      uuid,
      isMeta: true,
      origin: { kind },
      message: { role: 'user', content },
    })
  const transcript = [
    said('u1', 'user', 'write a mod'),
    meta(
      'n1',
      'task-notification',
      report('<summary>build finished</summary>'),
    ),
    meta('p1', 'peer', '<agent-message>internal note</agent-message>'),
    meta('m1', 'engine', 'injected content'),
    row({
      type: 'attachment',
      uuid: 'q1',
      attachment: {
        type: 'queued_command',
        prompt: '<agent-message>queued note</agent-message>',
        isMeta: true,
        origin: { kind: 'peer' },
      },
    }),
  ].join('\n')
  engine(on, transcript)

  await start($)
  const shown = await screen($)

  expect(shown).toContain('Background report: build finished')
  expect(shown).toContain('Message from another agent')
  expect(shown.includes('internal note')).toBe(false)
  expect(shown.includes('injected')).toBe(false)
  expect(shown.includes('queued note')).toBe(false)
})

test('a dropped prompt is not listed', async ($, on) => {
  engine(on)
  await start($)

  await submit($, 'blocked')

  expect((await screen($)).includes('blocked')).toBe(false)
})

test('a subagent is told the plan is not for it', async ($, on) => {
  engine(on)
  await start($)

  const result = await $.tool.call({
    tool: PLAN,
    steps: [],
    agentId: 'agent-1',
  })

  expect(String((result as { result: unknown }).result)).toContain(
    'Do not call',
  )
})

test('a compaction is noted as it happens', async ($, on) => {
  engine(on)
  await start($)

  await $.classic.PostCompact({ trigger: 'auto', compact_summary: 's' })

  expect(await screen($)).toContain('! Conversation compacted')
})

test('the pane opens unasked only where it docks', async ($, on) => {
  let opened = 0
  on('ui.open', () => {
    opened += 1

    return { value: { isPlaced: true } }
  })
  on('ui.render', drawNothing)
  const draw = async (isFullscreen: boolean) => {
    const band = await $.ui.mount({
      plugin: 'session-timeline',
      surface: 'terminal',
      component: 'AbovePrompt',
      requestId: 'above',
      viewport: { columns: 180, rows: 40, isFullscreen },
      props: {
        hasSurvey: false,
        isCollapsed: false,
        isWorking: false,
        maxRows: 5,
        bodyColumns: 180,
        scroll: { offset: 0, bodyRows: 5 },
        view: {},
      },
    })
    await band.unmount()
  }

  await draw(false)
  expect(opened).toBe(0)

  await draw(true)
  await draw(true)
  expect(opened).toBe(1)
})

test('a request a hook settles is not waited on', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })

  await ask($, 'allowed-by-hook')

  expect((await screen($)).includes('Waiting for you')).toBe(false)
})

test('a turn a channel starts gets its own chapter', async ($, on) => {
  engine(on)
  await start($)

  await $.prompt.submit({
    text: '<channel>body</channel>',
    wait: false,
    isMeta: true,
    origin: { kind: 'channel', server: 'chat' },
  })

  expect(await screen($)).toContain('Channel message')
})

test('a narrow pane drops the words from the totals', async ($, on) => {
  engine(on)
  await start($)
  await submit($, 'fix a bug')
  await call($, 'a', 'Edit', { file_path: '/x/a.ts' })

  const shown = await screen($, 40)

  expect(shown).toContain('❯ 1 · ◆ 1\n')
})

const recapRow = ($: any, text: string) =>
  $.session.append({
    message: {
      type: 'system',
      name: 'away_summary',
      content: [{ type: 'text', text }],
    },
    door: 'notice',
    origin: { kind: 'engine' },
    uuid: 'recap-1',
  })

test('there is no recap card before a recap', async ($, on) => {
  engine(on)
  await start($)
  await submit($, 'fix a bug')

  expect((await screen($)).includes('Recap')).toBe(false)
})

test('an automatic recap is shown without its settings hint', async ($, on) => {
  engine(on)
  await start($)

  await recapRow($, '🤖 The fix is in. (turn off recaps in /config)')
  const shown = await screen($)

  expect(shown).toContain('Recap\n')
  expect(shown).toContain('The fix is in.')
  expect(shown.includes('/config')).toBe(false)
})

test('a recap the person asks for replaces the last one', async ($, on) => {
  engine(on)
  on('command.run', () => ({ text: 'Tests are next (see /docs).' }))
  await start($)
  await recapRow($, 'The fix is in.')

  await $.command.run({
    command: 'recap',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 180 },
  })
  const shown = await screen($)

  expect(shown).toContain('Tests are next (see /docs).')
  expect(shown.includes('The fix is in.')).toBe(false)
})

test('the latest recap comes back from the transcript', async ($, on) => {
  const recapped = (uuid: string, content: string) =>
    row({ type: 'system', subtype: 'away_summary', uuid, content })
  const transcript = [
    recapped('r1', 'first recap'),
    said('u1', 'user', 'go on'),
    recapped('r2', 'second recap (disable recaps in /config)'),
  ].join('\n')
  engine(on, transcript)

  await start($)
  const shown = await screen($)

  expect(shown).toContain('second recap')
  expect(shown.includes('first recap')).toBe(false)
  expect(shown.includes('/config')).toBe(false)
})

test('a pane too narrow for the progress bar still shows the plan', async ($, on) => {
  engine(on)
  await start($)
  await call($, 'p1', PLAN, {
    steps: [{ title: 'find the cause', status: 'done' }],
  })

  const shown = await screen($, 10)

  expect(shown).toContain('1/1 done')
  expect(shown).toContain('find the cause')
})

test('the totals keep their words only while the title fits', async ($, on) => {
  engine(on)
  await start($)
  await submit($, 'fix a bug')
  await call($, 'a', 'Edit', { file_path: '/x/a.ts' })
  await append($, 'tool-result', 'user', [
    { type: 'tool_result', tool_use_id: 'a', is_error: true },
  ])

  // 'History (new → old)', the worded totals and the margin take 58 columns.
  expect(await screen($, 58)).toContain('❯ 1 prompt · ◆ 1 action · ✗ 1 failed')
  expect(await screen($, 57)).toContain('❯ 1 · ◆ 1 · ✗ 1\n')
})

test('a recap that fails leaves the last one showing', async ($, on) => {
  const failures = [
    'Nothing to recap yet — send a message first.',
    'Recap cancelled.',
    "Couldn't generate a recap. Run with --debug for details.",
    '/recap only runs when you ask for it yourself in this session.',
    'API Error: 529 overloaded',
  ]
  let answered = ''
  engine(on)
  on('command.run', () => ({ text: answered }))
  await start($)
  await recapRow($, 'The fix is in.')

  for (const failure of failures) {
    answered = failure
    await $.command.run({
      command: 'recap',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 180 },
    })

    const shown = await screen($)
    expect(shown).toContain('The fix is in.')
    expect(shown.includes(failure)).toBe(false)
  }
})

test('step times come back from the transcript', async ($, on) => {
  const planRow = (id: string, timestamp: string, ...statuses: string[]) =>
    row({
      type: 'assistant',
      uuid: id,
      timestamp,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id,
            name: PLAN,
            input: {
              steps: statuses.map((status, index) => ({
                title: ['dig', 'fix'][index],
                status,
              })),
            },
          },
        ],
      },
    })
  const transcript = [
    planRow('p1', '2026-01-01T09:00:00Z', 'in_progress', 'pending'),
    planRow('p2', '2026-01-01T09:02:00Z', 'done', 'in_progress'),
  ].join('\n')
  engine(on, transcript)

  await start($)
  await $.turn.start({ text: 'go on', turnId: 't1' })
  const finished = Date.parse('2026-01-01T09:02:00Z')

  // The step still open when the session closed tells no time.
  expect(await screen($)).toContain(
    `\ndig\n${clockTime(finished, NOW)} · 2m00s\n◉ fix\n◉ \nfix\nHistory`,
  )
})
