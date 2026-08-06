import { Route, Routes, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { HomePage } from '@/pages/home-page'
import { ProjectsPage } from '@/pages/projects-page'
import { HabitsPage } from '@/pages/habits-page'
import { SettingsPage } from '@/pages/settings-page'
import { SignInPage } from '@/pages/signin-page'
import { useAuth } from '@/lib/auth'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Oggi', subtitle: 'Dove punta la giornata' },
  '/projects': { title: 'Progetti', subtitle: 'Backlog per progetto' },
  '/habits': { title: 'Abitudini', subtitle: 'Costanza nel tempo' },
  '/settings': { title: 'Impostazioni', subtitle: 'Regole di Vector' },
}

function PageHeader() {
  const location = useLocation()
  const meta = PAGE_META[location.pathname] ?? PAGE_META['/']
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div>
        <h1 className="text-sm font-semibold leading-none">{meta.title}</h1>
        <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
      </div>
    </header>
  )
}

function App() {
  const { status } = useAuth()

  // Nessuna rotta è raggiungibile senza autenticazione: finché lo stato non
  // è confermato (verifica token in corso) non si mostra nulla, per evitare
  // un flash di contenuto protetto; da anonimo l'unica UI possibile è il
  // login, qualunque sia il path richiesto.
  if (status === 'checking') return null
  if (status === 'anonymous') return (
    <>
      <SignInPage />
      <Toaster />
    </>
  )

  return (
    <TooltipProvider delay={200}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <PageHeader />
          <div className="flex flex-1 flex-col gap-6 p-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
