export const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * HOUR,
  seven_day: 7 * DAY,
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (value: number) => String(value).padStart(2, '0')

/** Milliseconds since the epoch, or nothing for a timestamp that does not parse. */
export const parseTime = (iso: string | undefined): number | undefined => {
  if (iso === undefined) return undefined
  const at = Date.parse(iso)

  return Number.isNaN(at) ? undefined : at
}

const units = (large: string, small: string) =>
  small.startsWith('0') ? large : `${large} ${small}`

/** `27m`, `1h 27m`, `3h` or `3d 4h`: two units at most, so it stays short. */
export const timeLeft = (ms: number): string => {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE))
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return units(`${hours}h`, `${minutes % 60}m`)

  return units(`${Math.floor(hours / 24)}d`, `${hours % 24}h`)
}

/** Local `HH:MM`, led by the weekday when that is not today. */
export const resetTime = (at: number, now: number): string => {
  const date = new Date(at)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const isToday = date.toDateString() === new Date(now).toDateString()

  return isToday ? time : `${WEEKDAYS[date.getDay()]} ${time}`
}

/**
 * How much of a limit's window has gone by, 0 to 1. Nothing for a limit whose
 * window has no known length.
 */
export const elapsedShare = (
  kind: string,
  resetsAt: number,
  now: number,
): number | undefined => {
  const length = WINDOW_MS[kind]
  if (length === undefined) return undefined

  return Math.min(1, Math.max(0, 1 - (resetsAt - now) / length))
}
