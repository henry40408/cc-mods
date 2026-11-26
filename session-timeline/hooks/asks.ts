import type { Ask, Timeline } from '../types'
import { isRunning } from './digest'

export const addAsk = (timeline: Timeline, ask: Ask): Timeline => ({
  ...timeline,
  asks: [...timeline.asks, ask],
})

/** Drops what one loop asked: `undefined` is the main conversation's. */
export const dropAsks = (
  timeline: Timeline,
  agentId: string | undefined,
): Timeline => ({
  ...timeline,
  asks: timeline.asks.filter(ask => ask.agentId !== agentId),
})

/**
 * Drops the ask about a main conversation call now known to be allowed. A
 * permission request names no call id, so the two are matched by their text.
 */
export const answerAsk = (timeline: Timeline, callId: string): Timeline => {
  const call = timeline.entries
    .filter(isRunning)
    .find(entry => entry.id === callId)
  const index = timeline.asks.findIndex(
    ask => ask.agentId === undefined && ask.text === call?.text,
  )
  if (index === -1) return timeline

  return { ...timeline, asks: timeline.asks.toSpliced(index, 1) }
}
