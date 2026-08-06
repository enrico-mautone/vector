import type { Project } from '@/lib/types'
import { computeValueScore, valueScoreToDollars } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function ProjectValueBadge({ project }: { project: Project }) {
  const score = computeValueScore(project)
  if (score === null) {
    return (
      <span className="text-xs text-muted-foreground" title="Non ancora valutato">
        —
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="font-mono text-sm text-emerald-600" />}>
        {'$'.repeat(valueScoreToDollars(score))}
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div>Valore economico: {project.valueEconomic}/5</div>
          <div>Opportunità: {project.valueOpportunity}/5</div>
          <div>Urgenza: {project.valueUrgency}/5</div>
          <div>Sforzo: {project.valueEffort}/5</div>
          <div className="mt-1 font-medium">Score: {score.toFixed(1)}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
