"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  GalleryVerticalEnd,
  Settings2,
  SquareTerminal,
} from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { QrCard } from "@/components/sidebar-opt-in-form"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"

interface UserData {
  email: string
  first_name: string | null
  last_name: string | null
  photo: string | null
}

interface RestaurantData {
  photo: string | null
  name: string
  description: string | null
  city: string | null
  address: string | null
  hours: string | null
  instagram: string | null
  telegram: string | null
  vk: string | null
  whatsapp: string | null
  features: string[]
  phone: string | null
  subdomain: string | null
  type: string | null
  qr_code?: string | null
  subscription?: {
    plan_code: string | null
    plan_name: string | null
    status: string | null
    started_at?: string | null
    expires_at?: string | null
  } | null
}

export function AppSidebar({
  setActiveBlock,
  activeTeam,
  setActiveTeam,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  setActiveBlock: (block: string) => void
  activeTeam: string
  setActiveTeam: (team: string) => void
}) {
  const isMobile = useIsMobile()
  const { setOpen } = useSidebar() // 👈 доступ к состоянию боковой панели

  const [qrCollapsed, setQrCollapsed] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(false)

  // Загрузка данных пользователя
  useEffect(() => {
    async function fetchUserData() {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) throw new Error("No token")
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error("Failed to fetch user data")
        const data: UserData = await response.json()
        setUser({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          photo:
            data.photo ||
            "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
        })
      } catch (error) {
        console.error("Ошибка загрузки данных пользователя:", error)
        setUser({
          email: "test@gmail.com",
          first_name: "Я",
          last_name: "Тестович",
          photo: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
        })
      } finally {
        setLoadingUser(false)
      }
    }
    fetchUserData()
  }, [])

  // Загрузка данных ресторана по activeTeam (id)
  const fetchRestaurant = useCallback(async () => {
    if (!activeTeam) return
    setLoadingRestaurant(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      })
      if (res.ok) {
        const data: RestaurantData = await res.json()
        setRestaurantData(data)
      }
    } catch (error) {
      console.error("Ошибка загрузки данных ресторана:", error)
      setRestaurantData(null)
    } finally {
      setLoadingRestaurant(false)
    }
  }, [activeTeam])

  useEffect(() => {
    fetchRestaurant()
  }, [fetchRestaurant])

  useEffect(() => {
    const handler = () => {
      fetchRestaurant()
    }
    window.addEventListener("subscription:updated", handler)
    return () => window.removeEventListener("subscription:updated", handler)
  }, [fetchRestaurant])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ team?: string }>).detail
      if (!detail?.team || detail.team === activeTeam) {
        fetchRestaurant()
      }
    }
    window.addEventListener("restaurant:updated", handler as EventListener)
    return () => window.removeEventListener("restaurant:updated", handler as EventListener)
  }, [activeTeam, fetchRestaurant])

  // Обработчик клика по пункту меню
  const handleNavClick = (block: string) => {
    setActiveBlock(block)
    if (isMobile) {
      setOpen(false) // 👈 закрыть панель на мобиле
    }
  }

  // Данные для навигации
  const navData = {
    navMain: [
      {
        title: "Мое заведение",
        url: "view",
        icon: SquareTerminal,
        isActive: true,
        items: [
          { title: "Посмотреть меню", url: "view" },
          { title: "Изменить меню", url: "edit-menu" },
          { title: "Данные ресторана", url: "edit-data" },
        ],
      },
      {
        title: "Подписка",
        url: "subscription",
        icon: Settings2,
        items: [
          { title: "Подписка и история", url: "subscription" },
          { title: "Тарифы", url: "tariffs" },
        ],
      },
    ],
    teams: [
      {
        name: restaurantData?.name || "Мой ресторан",
        logo: GalleryVerticalEnd,
        plan: restaurantData?.subscription?.plan_name || "Без подписки",
        id: activeTeam,
      },
    ],
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher activeTeam={activeTeam} setActiveTeam={setActiveTeam} />
      </SidebarHeader>

      <SidebarContent>
        {/* 👇 сюда передаем обработчик */}
        <NavMain items={navData.navMain} setActiveBlock={handleNavClick} />
      </SidebarContent>

      <SidebarFooter>
        <div className="p-1 w-full">
          <QrCard
            qrSrc={restaurantData?.qr_code || undefined}
            qrLink={
              restaurantData?.subdomain
                ? `https://${restaurantData.subdomain}.taam.menu`
                : ""
            }
            className="w-full"
            collapsed={qrCollapsed}
            setCollapsed={setQrCollapsed}
          />
        </div>
      </SidebarFooter>

      <SidebarFooter>
        {loadingUser ? (
          <div className="p-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <NavUser
            user={{
              name:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : "Пользователь",
              email: user?.email || "test@gmail.com",
              avatar:
                user?.photo ||
                "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
            }}
            setActiveBlock={handleNavClick} // 👈 тоже закрываем при выборе из профиля
          />
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
