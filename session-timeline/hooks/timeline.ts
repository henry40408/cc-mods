import type { Entry, Step, Timeline, ToolStatus, Upcoming } from '../types'
import { answerAsk, dropAsks } from './asks'
import { PLAN_TOOL, describeCall, firstLine } from './describe'
import { isRunning } from './digest'
import type { TimelineEvent } from './events'
import { counted } from './format'

const MAX_ENTRIES = 300

export const EMPTY_TIMELINE: Timeline = {
  recap: null,
  entries: [],
  plan: [],
  upcoming: [],
  turnStartedAt: null,
  asks: [],
}

type ToolStart = Extract<TimelineEvent, { type: 'toolStart' }>
type ToolEnd = Extract<TimelineEvent, { type: 'toolEnd' }>

const addEntry = (timeline: Timeline, entry: Entry): Timeline => {
  if (timeline.entries.some(held => held.id === entry.id)) return timeline

  return {
    ...timeline,
    entries: [...timeline.entries, entry].slice(-MAX_ENTRIES),
  }
}

const isStep = (value: unknown): value is Step => {
  const step = value as Partial<Step> | null

  return (
    typeof step?.title === 'string' &&
    ['pending', 'in_progress', 'done'].includes(step.status ?? '')
  )
}

const milestoneTexts = (before: Step[], after: Step[]): string[] => {
  const changed = after.filter(
    step =>
      step.status !== 'pending' &&
      !before.some(
        held => held.title === step.title && held.status === step.status,
      ),
  )
  const texts = changed.map(
    step =>
      `${step.status === 'done' ? 'Finished' : 'Started'} step: ${step.title}`,
  )

  return before.length === 0
    ? [`Planned ${counted(after.length, 'step')}`, ...texts]
    : texts
}

const setPlan = (timeline: Timeline, event: ToolStart): Timeline => {
  const { steps } = event.input
  if (!Array.isArray(steps)) return timeline
  const plan = steps.filter(isStep)

  return milestoneTexts(timeline.plan, plan).reduce(
    (held, text, index) =>
      addEntry(held, {
        kind: 'milestone',
        id: `${event.id}:${index}`,
        at: event.at,
        text,
      }),
    { ...timeline, plan },
  )
}

const startTool = (timeline: Timeline, event: ToolStart): Timeline => {
  if (event.tool === PLAN_TOOL) return setPlan(timeline, event)
  const { id, at, tool, input } = event
  const text = describeCall(tool, input)

  return addEntry(timeline, {
    kind: 'tool',
    id,
    at,
    tool,
    text,
    status: 'running',
  })
}

const endTool = (timeline: Timeline, event: ToolEnd): Timeline => {
  const status: ToolStatus = event.isFailed ? 'failed' : 'done'
  const answered = answerAsk(timeline, event.id)
  const entries = answered.entries.map(entry =>
    entry.kind === 'tool' && entry.id === event.id
      ? { ...entry, status, endedAt: event.at }
      : entry,
  )
  const ended = { ...answered, entries }

  // With no call left running, nothing of the main conversation is still being
  // asked about, even a call whose request spelt its input unlike its row.
  return entries.some(isRunning) ? ended : dropAsks(ended, undefined)
}

export const applyEvent = (
  timeline: Timeline,
  event: TimelineEvent,
): Timeline => {
  switch (event.type) {
    case 'toolStart':
      return startTool(timeline, event)
    case 'toolEnd':
      return endTool(timeline, event)
    case 'recap':
      return { ...timeline, recap: { at: event.at, text: event.text } }
    case 'notified': {
      const { id, at, text, taskId, startsTurn } = event
      const upcoming = timeline.upcoming.filter(item => item.id !== taskId)
      const kind = startsTurn ? 'trigger' : 'notice'

      return addEntry({ ...timeline, upcoming }, { kind, id, at, text })
    }
    default: {
      const { type, id, at, text } = event

      return addEntry(timeline, { kind: type, id, at, text })
    }
  }
}

export const applyEvents = (
  timeline: Timeline,
  events: TimelineEvent[],
): Timeline => events.reduce(applyEvent, timeline)

export const stopRunningTools = (timeline: Timeline): Timeline => ({
  ...timeline,
  entries: timeline.entries.map(entry =>
    entry.kind === 'tool' && entry.status === 'running'
      ? { ...entry, status: 'stopped' }
      : entry,
  ),
})

export const startTurn = (timeline: Timeline, at: number): Timeline => ({
  ...dropAsks(timeline, undefined),
  turnStartedAt: at,
})

type TurnEnd = { id: string; at: number; isAborted: boolean }

export const endTurn = (timeline: Timeline, end: TurnEnd): Timeline => {
  const ended = {
    ...dropAsks(stopRunningTools(timeline), undefined),
    turnStartedAt: null,
  }
  if (!end.isAborted) return ended

  return applyEvent(ended, {
    type: 'notice',
    id: end.id,
    at: end.at,
    text: 'You interrupted the run',
  })
}

type PendingWork = {
  background_tasks?: { id: string; type: string; description: string }[]
  session_crons?: {
    id: string
    schedule: string
    recurring: boolean
    prompt: string
  }[]
}

// A one-shot cron spells a single moment as `minute hour day month *`.
const cronTime = (schedule: string, recurring: boolean): string => {
  const [minute = '', hour = '', day = '', month = ''] = schedule.split(' ')
  const isOneMoment = [minute, hour, day, month].every(part =>
    /^\d+$/.test(part),
  )
  if (recurring || !isOneMoment) return schedule

  return `${month}/${day} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

export const upcomingWork = (pending: PendingWork): Upcoming[] => [
  ...(pending.background_tasks ?? []).map(task => ({
    id: task.id,
    text: `Background ${task.type}: ${firstLine(task.description)}`,
  })),
  ...(pending.session_crons ?? []).map(cron => ({
    id: cron.id,
    text: `Scheduled ${cronTime(cron.schedule, cron.recurring)} · ${firstLine(cron.prompt)}`,
  })),
]
