import type { HabitsData, HomeData, Project, ProjectsData, SettingsData } from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && data.error) || 'Qualcosa è andato storto.')
  }
  return data as T
}

export const api = {
  home: () => request<HomeData>('/api/home'),
  completeStep: (projectId: string, stepId: string) =>
    request<{ ok: true; nextStepId: string | null; nextStepText: string | null }>('/api/home/complete-step', {
      method: 'POST',
      body: JSON.stringify({ projectId, stepId }),
    }),
  finishProject: (projectId: string) =>
    request<{ ok: true }>('/api/home/finish-project', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  toggleHabit: (habitId: string) =>
    request<{ ok: true; done: boolean; streak: number }>('/api/home/toggle-habit', {
      method: 'POST',
      body: JSON.stringify({ habitId }),
    }),

  addStep: (projectId: string, text: string) =>
    request<{ ok: true }>('/api/steps/add', {
      method: 'POST',
      body: JSON.stringify({ projectId, text }),
    }),
  bulkAddSteps: (projectId: string, bulkText: string) =>
    request<{ ok: true }>('/api/steps/bulk', {
      method: 'POST',
      body: JSON.stringify({ projectId, bulkText }),
    }),
  reorderSteps: (projectId: string, order: string[]) =>
    request<{ ok: true }>('/api/steps/reorder', {
      method: 'POST',
      body: JSON.stringify({ projectId, order }),
    }),
  editStep: (id: string, text: string) =>
    request<{ ok: true }>(`/api/steps/${id}/edit`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  toggleStep: (id: string) => request<{ ok: true }>(`/api/steps/${id}/toggle`, { method: 'POST' }),
  deleteStep: (id: string) => request<{ ok: true }>(`/api/steps/${id}/delete`, { method: 'POST' }),

  projects: () => request<ProjectsData>('/api/projects'),
  addProject: (name: string) =>
    request<{ ok: true; project: Project }>('/api/projects/add', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  reorderProjects: (order: string[]) =>
    request<{ ok: true }>('/api/projects/reorder', {
      method: 'POST',
      body: JSON.stringify({ order }),
    }),

  habits: (params: Record<string, string>) =>
    request<HabitsData>(`/api/habits?${new URLSearchParams(params).toString()}`),

  settings: () => request<SettingsData>('/api/settings'),
  saveSettings: (patch: Partial<{ enforcePriorityOrder: boolean; limitDailyTasksByPriority: boolean }>) =>
    request<{ ok: true }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(patch),
    }),
}
