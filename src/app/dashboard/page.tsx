"use client"

import { Suspense, useEffect, useState, ReactNode } from "react"
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
import AccountSettings from "@/components/dashboard/AccountSettings"
import PaymentHistory from "@/components/dashboard/PaymentHistory"
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
    subscription: "Моя подписка",
    "account-settings": "Настройки аккаунта",
    "payment-history": "История оплат",
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
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<AccountData | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Синхронизация блока с параметром ?block=
    const block = searchParams.get("block")
    if (
      block &&
      [
        "view",
        "edit-menu",
        "edit-data",
        "subscription",
        "account-settings",
        "payment-history",
      ].includes(block)
    ) {
      setActiveBlock(block)
    } else {
      setActiveBlock("view")
      // Сбрасываем URL, чтобы убрать неверные query-параметры
      router.replace("/dashboard")
    }
  }, [searchParams, router])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const token = localStorage.getItem("access_token")
        if (!token) throw new Error("No token")

        // Профиль
        const profileRes = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!profileRes.ok) throw new Error("Failed to fetch profile")
        const profileData: AccountData = await profileRes.json()
        if (!cancelled) setProfile(profileData)

        // Рестораны
        const res = await fetch("/api/restaurants", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!res.ok) throw new Error("Failed to fetch restaurants")
        const data = await res.json()
        if (!cancelled) {
          setTeams(data)
          if (data.length > 0) setActiveTeam(String(data[0].id))
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
  }, [])

  const blockComponents: { [key: string]: ReactNode } = {
    view: <ViewData activeTeam={activeTeam} />,
    "edit-menu": <EditMenu activeTeam={activeTeam} />,
    "edit-data": <EditData activeTeam={activeTeam} />,
    subscription: <Subscription activeTeam={activeTeam} />,
    "account-settings": <AccountSettings activeTeam={activeTeam} />,
    "payment-history": <PaymentHistory activeTeam={activeTeam} />,
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
          setActiveBlock={setActiveBlock}
          activeTeam={activeTeam}
          setActiveTeam={setActiveTeam}
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
        setActiveBlock={setActiveBlock}
        activeTeam={activeTeam}
        setActiveTeam={setActiveTeam}
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
