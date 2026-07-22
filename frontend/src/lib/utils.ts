import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatObjective(goal: string, outcome: string | null | undefined) {
  return `[OBIETTIVO] ${goal} [RISULTATO] ${outcome && outcome.trim() ? outcome : '—'}`
}
