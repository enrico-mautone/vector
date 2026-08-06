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

// Mappa lo score continuo (min 3/5=0.6, max 15/1=15) su 1-5 simboli "$".
// Soglie tarate su distribuzione empirica: effort medio (3) con le altre
// componenti medio-alte dà "$$$"; punteggi estremi (effort 1, altre a 5) danno "$$$$$".
export function valueScoreToDollars(score: number): number {
  if (score >= 6) return 5
  if (score >= 4.5) return 4
  if (score >= 3) return 3
  if (score >= 1.8) return 2
  return 1
}
