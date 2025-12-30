"use client"

import { Suspense, useEffect, useState, ReactNode, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import ViewData from "@/components/dashboard/ViewData"
import Categories from "@/components/dashboard/menu/Categories"
import MenuItems from "@/components/dashboard/menu/MenuItems"
import Integrations from "@/components/dashboard/menu/Integrations"
import GeneralInfo from "@/components/dashboard/restaurant/GeneralInfo"
import AdditionalInfo from "@/components/dashboard/restaurant/AdditionalInfo"
import WorkingHours from "@/components/dashboard/restaurant/WorkingHours"
import DeliverySettings from "@/components/dashboard/restaurant/DeliverySettings"
import Subscription from "@/components/dashboard/Subscription"
import Tariffs from "@/components/dashboard/Tariffs"
import AccountSettings from "@/components/dashboard/AccountSettings"
import Currency from "@/components/dashboard/Currency"
import OrdersList from "@/components/dashboard/orders/OrdersList"
import Terminal from "@/components/dashboard/orders/Terminal"
import Notifications from "@/components/dashboard/orders/Notifications"
import Statistics from "@/components/dashboard/analytics/Statistics"
import { Skeleton } from "@/components/ui/skeleton"
import { userService, restaurantService, orderService } from "@/services"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon, Bell } from "lucide-react"

type AccountData = {
  email: string
  first_name: string | null
  last_name: string | null
  photo: string | null
  phone: string | null
  payment_method_type: string | null
  payment_method_number: string | null
  is_profile_complete: boolean
}

const dashboardBlocks = [
  "view",
  "edit-menu-categories",
  "edit-menu-items",
  "edit-menu-integrations",
  "edit-data",
  "edit-data-general",
  "edit-data-additional",
  "edit-data-hours",
  "edit-data-delivery",
  "subscription",
  "tariffs",
  "account-settings",
  "currency",
  "orders",
  "terminal",
  "notifications",
  "statistics",
]

function LoadingFallback() {
  return (
    <SidebarProvider>
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </SidebarProvider>
  )
}

function DynamicBreadcrumb({
  activeBlock,
  isProfileComplete,
}: {
  activeBlock: string
  isProfileComplete: boolean
}) {
  const breadcrumbMap: { [key: string]: string } = {
    view: "Просмотр данных",
    "edit-menu-categories": "Категории",
    "edit-menu-items": "Позиции",
    "edit-menu-integrations": "Интеграции",
    "edit-data": "Изменить данные",
    "edit-data-general": "Основные настройки",
    "edit-data-additional": "Дополнительно",
    "edit-data-hours": "Время работы",
    "edit-data-delivery": "Способы доставки",
    subscription: "Подписка и история",
    tariffs: "Тарифы",
    "account-settings": "Настройки аккаунта",
    currency: "Валюта",
    orders: "Заказы",
    terminal: "Терминал",
    notifications: "Уведомления",
    statistics: "Статистика",
  }

  const showRestaurantBreadcrumb = [
    "view",
    "edit-menu-categories",
    "edit-menu-items",
    "edit-menu-integrations",
    "edit-data",
    "edit-data-general",
    "edit-data-additional",
    "edit-data-hours",
    "edit-data-delivery"
  ].includes(activeBlock)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showRestaurantBreadcrumb && isProfileComplete && (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/dashboard">Мое заведение</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>
            {breadcrumbMap[activeBlock] || "Просмотр данных"}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function DashboardInner() {
  const [activeBlock, setActiveBlock] = useState("view")
  const [activeTeam, setActiveTeam] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<AccountData | null>(null)
  const [notificationsCount, setNotificationsCount] = useState(0)

  const searchParams = useSearchParams()
  const router = useRouter()

  const updateRoute = useCallback(
    (teamId: string, block: string, method: "push" | "replace" = "push") => {
      const safeBlock = dashboardBlocks.includes(block) ? block : "view"
      const params = new URLSearchParams()
      params.set("block", safeBlock)
      if (teamId) {
        params.set("team", teamId)
      }
      const url = `/dashboard?${params.toString()}`
      if (method === "replace") {
        router.replace(url)
      } else {
        router.push(url)
      }
    },
    [router],
  )

  const goTo = useCallback(
    (teamId: string, block: string, method: "push" | "replace" = "push") => {
      const safeBlock = dashboardBlocks.includes(block) ? block : "view"
      const activeElement = document.activeElement as HTMLElement
      // Prevent focus loss loop if interacting with form elements
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        // Should allow navigation, but be careful of loops
      }

      setActiveTeam(teamId)
      setActiveBlock(safeBlock)
      updateRoute(teamId, safeBlock, method)
    },
    [updateRoute],
  )

  const changeBlock = useCallback(
    (block: string, method: "push" | "replace" = "push") => {
      goTo(activeTeam, block, method)
    },
    [activeTeam, goTo],
  )

  const changeTeam = useCallback(
    (teamId: string, method: "push" | "replace" = "push") => {
      goTo(teamId, activeBlock, method)
    },
    [activeBlock, goTo],
  )

  const loadNotificationsCount = useCallback(async () => {
    if (!activeTeam) {
      setNotificationsCount(0)
      return
    }
    try {
      const data = await orderService.getNotifications(activeTeam)
      const list = Array.isArray(data.notifications) ? data.notifications : []
      const unread = list.filter((item) => !item.read).length
      setNotificationsCount(unread)
    } catch (err) {
      console.error(err)
    }
  }, [activeTeam])

  useEffect(() => {
    const blockParam = searchParams.get("block")
    if (!blockParam || !dashboardBlocks.includes(blockParam)) {
      setActiveBlock("view")
    } else {
      setActiveBlock(blockParam)
    }
    const teamParam = searchParams.get("team")
    if (teamParam) {
      setActiveTeam(teamParam)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const profileData = await userService.getMe()
        if (!cancelled) setProfile(profileData)

        const data = await restaurantService.getRestaurants()
        if (!cancelled && Array.isArray(data)) {
          if (data.length > 0) {
            const params =
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search)
                : null
            const blockParam = params?.get("block") || ""
            const teamParam = params?.get("team") || ""
            const safeBlock = dashboardBlocks.includes(blockParam)
              ? blockParam
              : "view"
            const hasTeam = data.some(
              (item: any) => String(item.id) === teamParam,
            )
            const nextTeam = hasTeam ? teamParam : String(data[0].id)
            if (!teamParam || !hasTeam || !dashboardBlocks.includes(blockParam)) {
              goTo(nextTeam, safeBlock, "replace")
            } else {
              setActiveTeam(nextTeam)
              setActiveBlock(safeBlock)
            }
          } else {
            setActiveTeam("")
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [goTo])

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ block?: string; team?: string }>
      const detail = customEvent.detail || {}
      const nextBlock = detail.block || activeBlock
      const nextTeam = detail.team || activeTeam
      goTo(nextTeam, nextBlock)
    }
    window.addEventListener("dashboard:navigate", handler as EventListener)
    return () =>
      window.removeEventListener("dashboard:navigate", handler as EventListener)
  }, [activeBlock, activeTeam, goTo])

  useEffect(() => {
    loadNotificationsCount()
    const interval = setInterval(loadNotificationsCount, 30000)
    return () => clearInterval(interval)
  }, [loadNotificationsCount])

  const blockComponents: { [key: string]: ReactNode } = {
    view: <ViewData activeTeam={activeTeam} />,
    "edit-menu-categories": <Categories activeTeam={activeTeam} />,
    "edit-menu-items": <MenuItems activeTeam={activeTeam} />,
    "edit-menu-integrations": <Integrations activeTeam={activeTeam} />,
    "edit-data": <GeneralInfo activeTeam={activeTeam} />,
    "edit-data-general": <GeneralInfo activeTeam={activeTeam} />,
    "edit-data-additional": <AdditionalInfo activeTeam={activeTeam} />,
    "edit-data-hours": <WorkingHours activeTeam={activeTeam} />,
    "edit-data-delivery": <DeliverySettings activeTeam={activeTeam} />,
    subscription: <Subscription activeTeam={activeTeam} />,
    tariffs: <Tariffs activeTeam={activeTeam} />,
    "account-settings": <AccountSettings activeTeam={activeTeam} />,
    currency: <Currency activeTeam={activeTeam} />,
    orders: <OrdersList activeTeam={activeTeam} />,
    terminal: <Terminal activeTeam={activeTeam} />,
    notifications: <Notifications activeTeam={activeTeam} />,
    statistics: <Statistics activeTeam={activeTeam} />,
  }
  if (loading) {
    return <LoadingFallback />
  }

  if (profile && !profile.is_profile_complete && activeBlock !== "account-settings") {
    const missingFields: string[] = []
    if (!profile.first_name) missingFields.push("имя")
    if (!profile.phone) missingFields.push("телефон")

    return (
      <SidebarProvider>
        <AppSidebar
          setActiveBlock={changeBlock}
          activeTeam={activeTeam}
          setActiveTeam={changeTeam}
        />
        <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <DynamicBreadcrumb
              activeBlock={activeBlock}
              isProfileComplete={!!profile?.is_profile_complete}
            />
          </div>
          <div className="flex items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeBlock("notifications")}
              className="relative"
              aria-label="Уведомления"
            >
              <Bell className="size-5" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {notificationsCount > 9 ? "9+" : notificationsCount}
                </span>
              )}
            </Button>
          </div>
        </header>
          <div className="p-4 space-y-4">
            <Alert variant="default">
              <AlertCircleIcon />
              <AlertTitle>Необходимо заполнить данные!</AlertTitle>
              <AlertDescription>
                Заполните данные профиля: {missingFields.join(", ")}
              </AlertDescription>
            </Alert>
          </div>
          {blockComponents[activeBlock] || <ViewData activeTeam={activeTeam} />}
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar
        setActiveBlock={changeBlock}
        activeTeam={activeTeam}
        setActiveTeam={changeTeam}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <DynamicBreadcrumb
              activeBlock={activeBlock}
              isProfileComplete={true}
            />
          </div>
          <div className="flex items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeBlock("notifications")}
              className="relative"
              aria-label="Уведомления"
            >
              <Bell className="size-5" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {notificationsCount > 9 ? "9+" : notificationsCount}
                </span>
              )}
            </Button>
          </div>
        </header>
        {blockComponents[activeBlock] || <ViewData activeTeam={activeTeam} />}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardInner />
    </Suspense>
  )
}
