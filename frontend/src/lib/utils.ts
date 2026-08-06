import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Project } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatObjective(goal: string, outcome: string | null | undefined) {
  return `${goal} X ${outcome && outcome.trim() ? outcome : '—'}`
}

// WSJF-lite: (valore economico + opportunità + urgenza) / effort.
// Ritorna null finché non tutte e 4 le componenti sono state impostate
// ("non ancora valutato").
export function computeValueScore(p: Pick<Project, 'valueEconomic' | 'valueOpportunity' | 'valueUrgency' | 'valueEffort'>): number | null {
  const { valueEconomic: e, valueOpportunity: o, valueUrgency: u, valueEffort: f } = p
  if (!e || !o || !u || !f) return null
  return (e + o + u) / f
}

// Un simbolo "$" per ogni punto intero di score (arrotondato), minimo 1.
// Score va da 3/5=0.6 a 15/1=15, quindi i simboli non hanno un tetto fisso.
export function valueScoreToDollars(score: number): number {
  return Math.max(1, Math.round(score))
}
