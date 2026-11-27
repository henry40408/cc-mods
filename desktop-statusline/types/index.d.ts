export type Limit = {
  /** `five_hour`, `seven_day` or `spend_limit`. */
  kind: string
  percentUsed: number
  resetsAt?: string
}

/** One thing that occupies the context window, as `/context` names it. */
export type ContextPart = {
  name: string
  tokens: number
}

export type ContextFill = {
  /** Of the compaction window, past 100 when over it. */
  percent: number
  tokens: number
  /** The compaction window, which may be short of the model's. */
  windowTokens: number
  /** In the order `/context` lists them. */
  parts: ContextPart[]
  /** Where auto-compaction fires. Absent while it is off. */
  compactAtTokens?: number
}

export type Figures = {
  /** Absent until the first response, and again just after a compaction. */
  context?: ContextFill
  rateLimits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    'desktop-statusline': {
      figures: Figures | null
      /** The time the band was last drawn for, in `$.clock.now()`'s milliseconds. */
      now: number
    }
  }
}
