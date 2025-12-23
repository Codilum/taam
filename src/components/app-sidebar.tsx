"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  GalleryVerticalEnd,
  Settings2,
  SquareTerminal,
  ShoppingCart,
} from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { QrCard } from "@/components/sidebar-opt-in-form"
import { userService, restaurantService } from "@/services"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Home,
  Building2,
  Menu as MenuIcon,
  Truck,
  CreditCard,
  CircleDollarSign,
  List,
  ClipboardList,
  LayoutDashboard,
  Search,
} from "lucide-react"

export function SearchForm({
  value,
  onSearchChange,
  ...props
}: React.ComponentProps<"form"> & {
  value: string;
  onSearchChange: (value: string) => void
}) {
  return (
    <form {...props} onSubmit={(e) => e.preventDefault()}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <SidebarInput
            id="search"
            placeholder="поиск..."
            className="pl-8"
            value={value}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}

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
        const data = await userService.getMe()
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
      const data = await restaurantService.getRestaurant(activeTeam)
      setRestaurantData(data)
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

  const [searchQuery, setSearchQuery] = useState("")

  const handleNavClick = useCallback(
    (block: string) => {
      setActiveBlock(block)
      if (isMobile) {
        setOpen(false)
      }
    },
    [setActiveBlock, isMobile, setOpen]
  )

  // Данные для навигации
  const navData = {
    navMain: [
      {
        title: "Главная",
        url: "view",
        icon: Home,
      },
      {
        title: "Заведение",
        url: "edit-data",
        icon: Building2,
        items: [
          { title: "Основные", url: "edit-data-general" },
          { title: "Дополнительно", url: "edit-data-additional" },
          { title: "Время работы", url: "edit-data-hours" },
          { title: "Способы доставки", url: "edit-data-delivery" },
        ],
      },
      {
        title: "Электронное меню",
        url: "edit-menu",
        icon: ShoppingCart,
        items: [
          { title: "Категории", url: "edit-menu-categories" },
          { title: "Позиции", url: "edit-menu-items" },
          { title: "Интеграции", url: "edit-menu-integrations" }
        ],
      },
      {
        title: "Доставка",
        url: "delivery",
        icon: Truck,
        items: [
          { title: "Заказы", url: "orders" },
          { title: "Терминал", url: "terminal" },
          { title: "Уведомления", url: "notifications" },
          { title: "Статистика", url: "statistics" },
        ],
      },
      {
        title: "Тариф",
        url: "subscription",
        icon: CreditCard,
      },
      {
        title: "Валюта",
        url: "currency",
        icon: CircleDollarSign,
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

  const filterMenu = (items: any[]): any[] => {
    return items
      .map((item) => {
        const matches = item.title.toLowerCase().includes(searchQuery.toLowerCase())
        const filteredChildren = item.items ? filterMenu(item.items) : []

        if (matches || filteredChildren.length > 0) {
          return {
            ...item,
            isActive: searchQuery ? true : item.isActive,
            items: filteredChildren.length > 0 ? filteredChildren : item.items,
          }
        }
        return null
      })
      .filter(Boolean)
  }

  const filteredNavMain = searchQuery ? filterMenu(navData.navMain) : navData.navMain

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher activeTeam={activeTeam} setActiveTeam={setActiveTeam} />
        <SearchForm value={searchQuery} onSearchChange={setSearchQuery} />
      </SidebarHeader>

      <SidebarContent>
        {/* 👇 сюда передаем обработчик */}
        <NavMain items={filteredNavMain} setActiveBlock={handleNavClick} />
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
