import type { HabitsData, HomeData, LogData, ProjectsData, SettingsData } from './types'

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

  log: () => request<LogData>('/api/log'),
  saveLog: (steps: { stepId: string; minutes: number }[], habits: Record<string, boolean>) =>
    request<{ ok: true }>('/api/log', {
      method: 'POST',
      body: JSON.stringify({ steps, habits }),
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

  habits: (params: Record<string, string>) =>
    request<HabitsData>(`/api/habits?${new URLSearchParams(params).toString()}`),

  settings: () => request<SettingsData>('/api/settings'),
  saveSettings: (enforcePriorityOrder: boolean) =>
    request<{ ok: true }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ enforcePriorityOrder }),
    }),
}
