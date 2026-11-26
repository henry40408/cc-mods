export const PLAN_TOOL = 'mcp__session-timeline__plan'

const MAX_TEXT = 200

type Input = Record<string, unknown>

const cleanLine = (line: string): string => {
  const cleaned = line
    .replace(/<\/?pasted_content[^>]*>|\*\*|`|🤖|🏁/g, '')
    .replace(/^[\s#>*-]+/, '')
    .trim()

  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : ''
}

/** The first line that says something, without its Markdown decoration. */
export const firstLine = (text: string): string =>
  (text.split('\n').map(cleanLine).find(Boolean) ?? '').slice(0, MAX_TEXT)

/** All of it on one line, without its Markdown decoration. */
export const plainText = (text: string): string =>
  text.split('\n').map(cleanLine).filter(Boolean).join(' ')

const field = (input: Input, key: string): string => {
  const value = input[key]

  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

const fileName = (input: Input, key = 'file_path'): string =>
  field(input, key).split('/').pop() ?? ''

const firstQuestion = (input: Input): string => {
  const [first] = Array.isArray(input.questions) ? input.questions : []

  return typeof first?.question === 'string' ? first.question : ''
}

const describeShell = (input: Input): string => {
  const verb = input.run_in_background === true ? 'Run in background' : 'Run'

  return `${verb}: ${field(input, 'description') || field(input, 'command')}`
}

const DESCRIBERS: Record<string, (input: Input) => string> = {
  Bash: describeShell,
  Read: input => `Read ${fileName(input)}`,
  Edit: input => `Edit ${fileName(input)}`,
  Write: input => `Write ${fileName(input)}`,
  NotebookEdit: input => `Edit ${fileName(input, 'notebook_path')}`,
  Grep: input => `Search code: ${field(input, 'pattern')}`,
  Glob: input => `Find files: ${field(input, 'pattern')}`,
  WebFetch: input => `Fetch page: ${field(input, 'url')}`,
  WebSearch: input => `Search web: ${field(input, 'query')}`,
  Agent: input => `Start agent: ${field(input, 'description')}`,
  Skill: input => `Use skill: ${field(input, 'skill')}`,
  ToolSearch: input => `Load tools: ${field(input, 'query')}`,
  SendMessage: input => `Message ${field(input, 'to')}`,
  AskUserQuestion: input => `Asks you: ${firstQuestion(input)}`,
  ExitPlanMode: () => 'Plan ready for your approval',
  TaskCreate: input => `Create task: ${field(input, 'subject')}`,
  TaskUpdate: input => {
    const status = field(input, 'status').replaceAll('_', ' ')

    return `Update task #${field(input, 'taskId')}${status && `: ${status}`}`
  },
  ScheduleWakeup: input => `Schedule wake-up: ${field(input, 'reason')}`,
}

const describeOther = (tool: string): string =>
  tool.replace(/^mcp__/, '').replaceAll('__', ' › ')

/** One line a person understands for a tool call. */
export const describeCall = (tool: string, input: Input): string =>
  firstLine(DESCRIBERS[tool]?.(input) ?? describeOther(tool))
