import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { addAsk, answerAsk, dropAsks } from './asks'
import { describeCall } from './describe'
import { isAtWork } from './digest'
import {
  compactedEvent,
  promptEvents,
  recapEvents,
  rowEvents,
  transcriptEvents,
} from './events'
import type { TimelineEvent } from './events'
import { history } from './history'
import { nextCard } from './next-card'
import { nowCard } from './now-card'
import { recapCard } from './recap-card'
import {
  EMPTY_TIMELINE,
  applyEvents,
  endTurn,
  forgetOpenStepStarts,
  startTurn,
  stopRunningTools,
  upcomingWork,
} from './timeline'

const PANE = { id: 'session-timeline', title: 'Timeline' }
// `$.fs.read` answers at most 4 MiB; this leaves room for what decoding adds.
const TAIL_BYTES = 3 * 1024 * 1024

const timeline = atom(
  { plugin: 'session-timeline', key: 'timeline' } as const,
  EMPTY_TIMELINE,
  { shape: 'timeline-4' },
)

const PLAN_SPEC = {
  name: 'plan',
  isDeferred: false,
  description:
    "Shows your next steps in the user's session timeline panel. " +
    'Call it before you start any work that takes two or more steps, and ' +
    'again each time a step starts or finishes, or the plan changes. ' +
    'Send the whole list every time. Write short, concrete titles in the ' +
    "user's language.",
  inputSchema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'done'],
            },
          },
          required: ['title', 'status'],
        },
      },
    },
    required: ['steps'],
  },
}

// The tool's description alone does not get a model to report a short plan.
const PLAN_SECTION = {
  id: 'session-timeline:plan',
  scope: 'session',
  text:
    'The user follows this session in a timeline panel. Before you start any ' +
    'task that takes two or more tool calls, call mcp__session-timeline__plan ' +
    'with your steps, and call it again as steps start and finish.',
} as const

const record = ($: EngineInterface, events: TimelineEvent[]) =>
  update($, timeline, held => applyEvents(held, events))

const recordRecap = async ($: EngineInterface, said: string): Promise<void> => {
  const at = await $.clock.now()
  await record($, recapEvents(at, said))
}

const readTail = async ($: EngineInterface, path: string): Promise<string> => {
  const { size } = await $.fs.stat(path)
  const offset = Math.max(0, size - TAIL_BYTES)

  return $.fs.read(path, { offset, length: TAIL_BYTES })
}

// A resumed session, or one this mod joined midway, already has a history.
const restoreHistory = async (
  $: EngineInterface,
  transcriptPath: string,
): Promise<void> => {
  const { entries } = await read($, timeline)
  if (entries.length > 0) return
  try {
    const events = transcriptEvents(await readTail($, transcriptPath))
    await update($, timeline, held =>
      forgetOpenStepStarts(stopRunningTools(applyEvents(held, events))),
    )
  } catch (error) {
    // A new session has no transcript file yet.
    $.ui.log(`no history restored: ${String(error)}`, { to: 'debug' })
  }
}

// A subagent's ask is over once one of its calls has a result, or it is done.
const dropAgentAsks = async (
  $: EngineInterface,
  agentId: string,
): Promise<void> => {
  const { asks } = await read($, timeline)
  if (!asks.some(ask => ask.agentId === agentId)) return
  await update($, timeline, held => dropAsks(held, agentId))
}

// Once a second: settles a call seen running, and moves the elapsed times on.
const tick = async (
  $: EngineInterface,
  runningCallId: string | undefined,
): Promise<void> => {
  const held = await read($, timeline)
  if (runningCallId !== undefined && held.asks.length > 0) {
    await update($, timeline, latest => answerAsk(latest, runningCallId))
  }
  // A step can stay in progress while idle, such as one waiting in background.
  const isStepCounting =
    isAtWork(held) && held.plan.some(step => step.status === 'in_progress')
  if (held.turnStartedAt !== null || isStepCounting) {
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = on => {
  // The ctrl+b hint under a call shows only once it runs, so was allowed. A
  // drawing may not write state: it notes the call here and the tick reads it.
  let runningCallId: string | undefined
  let isPaneOffered = false
  // Two prompts can arrive within one millisecond.
  let promptCount = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'timeline',
      description: 'Open the session timeline panel',
    })
    await $.tool.register(PLAN_SPEC)
    const { transcriptPath } = await $.session.info()
    await restoreHistory($, transcriptPath)
    $.clock.every(1000, () => {
      void tick($, runningCallId)
      runningCallId = undefined
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, timeline, () => EMPTY_TIMELINE)
    }

    return next(e)
  })

  // Resuming another conversation in place starts no new session for the mod.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'resume') {
      await update($, timeline, () => EMPTY_TIMELINE)
      await restoreHistory($, e.transcript_path)
    }

    return next(e)
  })

  // Unasked, the pane opens only where it docks beside the transcript.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!isPaneOffered && e.viewport?.isFullscreen === true) {
      isPaneOffered = true
      void $.ui.open(PANE)
    }

    return next(e)
  })

  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => {
    runningCallId = e.props.tool_use_id

    return next(e)
  })

  on('command.run', { command: 'timeline' }, async $ => {
    const opened = await $.ui.open(PANE)

    return {
      text: opened.isPlaced
        ? 'Timeline panel opened.'
        : `Cannot show the timeline panel: ${opened.reason}`,
    }
  })

  // A recap the person asks for is the command's output, not a recap row.
  on('command.run', { command: 'recap' }, async ($, e, next) => {
    const result = await next(e)
    await recordRecap($, result.text ?? '')

    return result
  })

  // Answering here, ahead of the permission check, spares the person a dialog
  // for a call that only draws. The panel reads the plan from the call's row.
  on('tool.call', { tool: 'mcp__session-timeline__plan' }, ($, e) => ({
    result:
      e.agentId === undefined
        ? 'The timeline panel now shows this plan.'
        : 'The timeline shows only the main conversation. Do not call this tool.',
  }))

  // The panel shows the main conversation, so a subagent has no use for it.
  on('tool.offer', { tool: 'mcp__session-timeline__plan' }, ($, e, next) =>
    e.agentId === undefined ? next(e) : { isOffered: false },
  )

  // A subagent is not offered the tool, so its prompt does not name it.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!e.tools.includes('mcp__session-timeline__plan')) return composed

    return { sections: [...composed.sections, PLAN_SECTION] }
  })

  on('prompt.submit', async ($, e, next) => {
    const at = await $.clock.now()
    const submitted = await next(e)
    if (submitted.drop !== undefined) return submitted
    promptCount += 1
    const events = promptEvents({
      id: `prompt:${at}:${promptCount}`,
      at,
      text: e.text,
      isMeta: e.isMeta,
      origin: e.origin.kind,
      // A prompt sent while a turn runs names that turn.
      startsTurn: e.turnId === undefined,
    })
    await record($, events)

    return submitted
  })

  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (e.agentId !== undefined) {
      if (e.door === 'tool-result') await dropAgentAsks($, e.agentId)
      return stored
    }
    if (e.message.name === 'away_summary') {
      const said = e.message.content.map(block => block.text ?? '').join('\n')
      await recordRecap($, said)
    }
    if (e.door !== 'response' && e.door !== 'tool-result') return stored
    const at = await $.clock.now()
    const { role, content } = e.message
    await record($, rowEvents({ id: e.uuid, at, role, content }))

    return stored
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      await update($, timeline, held => startTurn(held, at))
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await dropAgentAsks($, e.agentId)
      return next(e)
    }
    const at = await $.clock.now()
    const end = { id: `end:${e.turnId}`, at, isAborted: e.isAborted }
    await update($, timeline, held => endTurn(held, end))

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const answered = await next(e)
    // A hook beneath that settled the request leaves no dialog to wait on.
    if (answered.decision !== undefined || answered.block !== undefined) {
      return answered
    }
    const input = (e.tool_input ?? {}) as Record<string, unknown>
    const text = describeCall(e.tool_name, input)
    const ask = { agentId: e.agent_id, text }
    await update($, timeline, held => addAsk(held, ask))

    return answered
  })

  on('classic.PostCompact', async ($, e, next) => {
    if (e.agent_id === undefined) {
      const at = await $.clock.now()
      await record($, [compactedEvent(`compact:${at}`, at)])
    }

    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    const upcoming = upcomingWork(e)
    await update($, timeline, held => ({ ...held, upcoming }))

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE.id }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box } = ui
    const held = await read($, timeline)
    const now = await $.clock.now()
    const view = { now, columns: e.props.bodyColumns }

    return (
      <Box flexDirection="column">
        {nowCard(ui, held, now)}
        {held.recap === null ? null : recapCard(ui, held.recap, now)}
        {nextCard(ui, held, view)}
        {history(ui, held, view)}
      </Box>
    )
  })
}
