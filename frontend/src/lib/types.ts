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
  limitDailyTasksByPriority: boolean
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
  activeObjectiveId: string | null
  activeObjectiveGoal: string | null
  activeObjectiveOutcome: string | null
  objectiveComplete: boolean
  allObjectivesDone: boolean
  activeObjectiveEmpty: boolean
  priorityRank: number
  dailyTaskLimit: number
  completedTodayCount: number
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

export interface Step {
  id: string
  projectId: string
  objectiveId: string
  text: string
  done: boolean
  completedAt: string | null
  createdAt: string
}

export interface Objective {
  id: string
  projectId: string
  goal: string
  outcome: string
  priority: number
  completed: boolean
  completedAt: string | null
  createdAt: string
}

export interface ObjectiveWithSteps extends Objective {
  active: boolean
  steps: Step[]
}

export interface ProjectWithSteps extends Project {
  objectives: ObjectiveWithSteps[]
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
