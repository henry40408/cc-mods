import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { band } from './band'
import { figuresOf, isEmpty } from './figures'
import { MINUTE } from './time'

const figures = atom(
  { plugin: 'desktop-statusline', key: 'figures' } as const,
  null,
)

const now = atom({ plugin: 'desktop-statusline', key: 'now' } as const, 0)

const tellTime = async ($: EngineInterface) => {
  const time = await $.clock.now()
  await update($, now, () => time)
}

const measure = async ($: EngineInterface) => {
  // The breakdown is asked for the compaction window and what fills it.
  // `summary` counts locally and sends no request.
  const usage = await $.session.usage({ breakdown: 'summary' })
  await tellTime($)
  await update($, figures, () => figuresOf(usage))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await measure($)
    // The band shows how long is left until a reset, which no new measurement
    // comes to correct while the session is idle.
    $.clock.every(MINUTE, () => void tellTime($))

    return next(e)
  })

  // A `/clear`, a resume in place and a compaction start no new session.
  on('classic.SessionStart', async ($, e, next) => {
    await measure($)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await measure($)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // A terminal has the `statusLine` setting for this.
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    const current = await read($, figures)
    if (current === null || isEmpty(current)) return next(e)

    return band($.ui.resolve(e), {
      figures: current,
      now: await read($, now),
      columns: e.props.bodyColumns,
    })
  })
}
