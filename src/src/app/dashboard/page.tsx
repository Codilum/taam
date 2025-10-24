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
import ViewData from "@/components/dashboard/ViewData"
import EditMenu from "@/components/dashboard/EditMenu"
import EditData from "@/components/dashboard/EditData"
import Subscription from "@/components/dashboard/Subscription"
import Tariffs from "@/components/dashboard/Tariffs"
import AccountSettings from "@/components/dashboard/AccountSettings"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

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
  "edit-menu",
  "edit-data",
  "subscription",
  "tariffs",
  "account-settings",
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
    "edit-menu": "Изменить меню",
    "edit-data": "Изменить данные",
    subscription: "Подписка и история",
    tariffs: "Тарифы",
    "account-settings": "Настройки аккаунта",
  }

  const showRestaurantBreadcrumb = ["view", "edit-menu", "edit-data"].includes(
    activeBlock,
  )

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
        const token = localStorage.getItem("access_token")
        if (!token) throw new Error("No token")

        const profileRes = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!profileRes.ok) throw new Error("Failed to fetch profile")
        const profileData: AccountData = await profileRes.json()
        if (!cancelled) setProfile(profileData)

        const res = await fetch("/api/restaurants", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!res.ok) throw new Error("Failed to fetch restaurants")
        const data = await res.json()
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

  const blockComponents: { [key: string]: ReactNode } = {
    view: <ViewData activeTeam={activeTeam} />,
    "edit-menu": <EditMenu activeTeam={activeTeam} />,
    "edit-data": <EditData activeTeam={activeTeam} />,
    subscription: <Subscription activeTeam={activeTeam} />,
    tariffs: <Tariffs activeTeam={activeTeam} />,
    "account-settings": <AccountSettings activeTeam={activeTeam} />,
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
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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
