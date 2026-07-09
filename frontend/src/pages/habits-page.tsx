import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { HabitsData } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

const LEVEL_CLASSES = ['bg-muted', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary']

export function HabitsPage() {
  const [view, setView] = useState<'year' | 'month' | 'week'>('year')
  const [param, setParam] = useState<string | undefined>(undefined)
  const [data, setData] = useState<HabitsData | null>(null)

  useEffect(() => {
    const params: Record<string, string> = { view }
    if (param) params[view === 'year' ? 'year' : view === 'month' ? 'month' : 'week'] = param
    api
      .habits(params)
      .then(setData)
      .catch(() => toast.error('Non riesco a caricare Abitudini.'))
  }, [view, param])

  function goPrev() {
    if (!data) return
    if (data.view === 'year') setParam(String(data.prevYear))
    if (data.view === 'month') setParam(data.prevMonth)
    if (data.view === 'week') setParam(data.prevWeek)
  }

  function goNext() {
    if (!data) return
    if (data.view === 'year') setParam(String(data.nextYear))
    if (data.view === 'month') setParam(data.nextMonth)
    if (data.view === 'week') setParam(data.nextWeek)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Costanza nel tempo</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} disabled={!data}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} disabled={!data}>
            <ChevronRight className="size-4" />
          </Button>
          <Tabs
            value={view}
            onValueChange={(v) => {
              setView(v as typeof view)
              setParam(undefined)
            }}
          >
            <TabsList>
              <TabsTrigger value="year">Anno</TabsTrigger>
              <TabsTrigger value="month">Mese</TabsTrigger>
              <TabsTrigger value="week">Settimana</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abitudine</TableHead>
                  {data.columns.map((c, i) => (
                    <TableHead key={i} className="text-center text-xs">
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.habit.id}>
                    <TableCell className="font-medium">{row.habit.name}</TableCell>
                    {row.cells.map((cell, i) => (
                      <TableCell key={i} className="p-1 text-center">
                        <Tooltip>
                          <TooltipTrigger
                            render={<div className={`mx-auto size-5 rounded-sm ${LEVEL_CLASSES[cell.level]}`} />}
                          />
                          <TooltipContent>{cell.title}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
