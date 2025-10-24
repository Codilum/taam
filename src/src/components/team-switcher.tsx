"use client"

import * as React from "react"
import { ChevronsUpDown, Store, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type Restaurant = {
  id: string
  name: string
  plan: string
  logo: React.ElementType
}

type TeamSwitcherProps = {
  activeTeam: string
  setActiveTeam: (id: string) => void
}

export function TeamSwitcher({ activeTeam, setActiveTeam }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const [teams, setTeams] = React.useState<Restaurant[]>([])

  const fetchRestaurants = React.useCallback(async () => {
    try {
      const res = await fetch("/api/restaurants", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      if (!res.ok) throw new Error("Failed to fetch restaurant data")
      const data = await res.json()
      const formatted = data.map((r: any) => ({
        id: r.id.toString(),
        name: r.name,
        plan: r.subscription?.plan_name || "Без подписки",
        logo: Store,
      }))
      setTeams(formatted)
      if (formatted.length > 0 && !activeTeam) {
        setActiveTeam(formatted[0].id)
      }
    } catch (err) {
      console.error(err)
    }
  }, [activeTeam, setActiveTeam])

  React.useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  React.useEffect(() => {
    const handler = () => {
      fetchRestaurants()
    }
    window.addEventListener("subscription:updated", handler)
    return () => window.removeEventListener("subscription:updated", handler)
  }, [fetchRestaurants])

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ team?: string }>).detail
      if (!detail?.team || detail.team === activeTeam) {
        fetchRestaurants()
      }
    }
    window.addEventListener("restaurant:updated", handler as EventListener)
    return () => window.removeEventListener("restaurant:updated", handler as EventListener)
  }, [activeTeam, fetchRestaurants])

  // Создание нового заведения
  const handleAddRestaurant = async () => {
    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ name: "Новое заведение", description: "Описание..." }),
      })
      if (!res.ok) throw new Error("Не удалось создать заведение")
      const newRestaurant = await res.json()
      const restaurant: Restaurant = {
        id: newRestaurant.id.toString(),
        name: newRestaurant.name,
        plan: newRestaurant.subscription?.plan_name || "Без подписки",
        logo: Store,
      }
      setTeams((prev) => [...prev, restaurant])
      setActiveTeam(restaurant.id)
    } catch (err) {
      console.error(err)
    }
  }

  const currentTeam = teams.find((team) => team.id === activeTeam)
  if (!currentTeam) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#FFEA5A]">
                <currentTeam.logo className="size-4 text-black" />
              </div>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentTeam.name}</span>
                <span className="truncate text-xs">{currentTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Заведения
            </DropdownMenuLabel>

            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => setActiveTeam(team.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <span className="ml-auto text-muted-foreground">⌘{index + 1}</span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 p-2" onClick={handleAddRestaurant}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                Добавить заведение
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
