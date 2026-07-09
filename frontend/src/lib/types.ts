export interface Project {
  id: string
  name: string
  priority: number
  archived?: boolean
}

export interface Habit {
  id: string
  name: string
}

export interface Config {
  projects: Project[]
  habits: Habit[]
  urgencyThresholdDays: number
  enforcePriorityOrder: boolean
}

export interface Quote {
  text: string
  author: string | null
}

export interface ActionProject extends Project {
  doneToday: boolean
  daysSince: number | null
  urgent: boolean
  workable: boolean
  hasBacklog: boolean
  nextStepId: string | null
  nextStepText: string | null
}

export interface HabitStatus extends Habit {
  doneToday: boolean
  streak: number
}

export interface HomeData {
  actionsToday: ActionProject[]
  habitsStatus: HabitStatus[]
  today: string
  quote: Quote | null
  config: Config
}

export interface DisplayStep {
  id: string
  text: string
  checkedToday: boolean
  minutesToday: number | ''
}

export interface LogProject extends Project {
  displaySteps: DisplayStep[]
}

export interface LogData {
  projects: LogProject[]
  config: Config
  todayEntry: { projects: Record<string, { steps: { stepId: string; minutes: number }[] }>; habits: Record<string, boolean> }
  today: string
}

export interface Step {
  id: string
  projectId: string
  text: string
  done: boolean
  createdAt: string
}

export interface ProjectWithSteps extends Project {
  projectSteps: Step[]
}

export interface ProjectsData {
  projects: ProjectWithSteps[]
}

export interface HeatmapCell {
  level: number
  title: string
}

export interface HeatmapRow {
  habit: Habit
  cells: HeatmapCell[]
}

export interface HabitsData {
  view: 'year' | 'month' | 'week'
  columns: { label: string }[]
  rows: HeatmapRow[]
  year?: number
  prevYear?: number
  nextYear?: number
  month?: number
  prevMonth?: string
  nextMonth?: string
  prevWeek?: string
  nextWeek?: string
}

export interface SettingsData {
  config: Config
}
