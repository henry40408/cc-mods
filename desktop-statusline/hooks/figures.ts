import type { ContextCategory, SessionUsage } from 'claude-code'

import type { ContextFill, ContextPart, Figures } from '../types'

// Free space, the compaction reserve and schemas loaded on demand fill nothing.
const partsOf = (categories: ContextCategory[]): ContextPart[] =>
  categories
    .filter(({ kind }) => kind === 'used')
    .map(({ name, tokens }) => ({ name, tokens }))

/** Full is the compaction window, which may be short of the model's. */
const contextFill = ({
  tokens,
  breakdown,
}: SessionUsage['context']): ContextFill | undefined => {
  // A share of the model's window instead would read the same and mislead.
  if (tokens === undefined || breakdown === undefined) return undefined

  const windowTokens = breakdown.rawMaxTokens

  return {
    percent: Math.round((tokens / windowTokens) * 100),
    tokens,
    windowTokens,
    parts: partsOf(breakdown.categories),
    compactAtTokens: breakdown.autoCompactThreshold,
  }
}

export const figuresOf = ({ context, rateLimits }: SessionUsage): Figures => ({
  context: contextFill(context),
  rateLimits,
})

export const isEmpty = ({ context, rateLimits }: Figures) =>
  context === undefined && rateLimits.length === 0
