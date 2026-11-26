export const pad = (value: number): string => String(value).padStart(2, '0')

/** `HH:MM`, with the date in front for any day but today. */
export const clockTime = (at: number, now: number): string => {
  const date = new Date(at)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === new Date(now).toDateString()) return time

  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${time}`
}

export const counted = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

export const duration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${pad(seconds % 60)}s`

  return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}m`
}
