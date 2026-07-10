import { NavLink, useLocation } from 'react-router-dom'
import { Compass, ListChecks, Repeat, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV_ITEMS = [
  { to: '/', label: 'Oggi', icon: Compass, end: true },
  { to: '/projects', label: 'Progetti', icon: ListChecks, end: false },
  { to: '/habits', label: 'Abitudini', icon: Repeat, end: false },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Compass className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold tracking-tight">Vector</span>
                <span className="truncate text-xs text-muted-foreground">Direzione di oggi</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Comando</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<NavLink to={item.to} end={item.end} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={location.pathname === '/settings'}
              tooltip="Impostazioni"
              render={<NavLink to="/settings" />}
            >
              <Settings />
              <span>Impostazioni</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
