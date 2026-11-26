export type ToolStatus = 'running' | 'done' | 'failed' | 'stopped'

export type TextEntry = {
  /** A `trigger` is something nobody typed that started a turn. */
  kind: 'prompt' | 'trigger' | 'say' | 'notice' | 'milestone'
  id: string
  at: number
  text: string
}

export type ToolEntry = {
  kind: 'tool'
  id: string
  at: number
  text: string
  tool: string
  status: ToolStatus
  endedAt?: number
}

export type Entry = TextEntry | ToolEntry

export type StepStatus = 'pending' | 'in_progress' | 'done'

export type Step = { title: string; status: StepStatus }

/** Work that will happen without a new prompt: a background task or a cron. */
export type Upcoming = { id: string; text: string }

/** A call a permission dialog is asking about. */
export type Ask = { agentId?: string; text: string }

/** The latest summary Claude Code wrote of where the session stands. */
export type Recap = { at: number; text: string }

export type Timeline = {
  recap: Recap | null
  entries: Entry[]
  plan: Step[]
  upcoming: Upcoming[]
  turnStartedAt: number | null
  asks: Ask[]
}

declare module 'claude-code' {
  interface PluginState {
    'session-timeline': { timeline: Shaped<Timeline> }
  }
}
