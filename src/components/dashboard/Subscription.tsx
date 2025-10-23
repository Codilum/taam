"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  CalendarClock,
  Clock3,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { showErrorToast } from "@/lib/show-error-toast"

type SubscriptionInfo = {
  plan_code: string | null
  plan_name: string | null
  status: string | null
  started_at?: string | null
  expires_at?: string | null
  amount?: number | null
  currency?: string | null
} | null

type Limits = {
  category_limit: number | null
  item_limit: number | null
}

type HistoryEntry = {
  id: number
  plan_code: string
  plan_name: string
  status: string
  created_at?: string | null
  started_at?: string | null
  expires_at?: string | null
  amount?: number
  amount_minor?: number
  currency?: string
  duration_days?: number | null
}

const statusLabels: Record<string, string> = {
  active: "Активна",
  pending: "Ожидает оплаты",
  expired: "Истекла",
  canceled: "Отменена",
}

const badgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "outline",
  expired: "secondary",
  canceled: "destructive",
}

const parseMessage = (data: any, raw: string, fallback: string) => {
  if (typeof data === "string" && data.trim()) return data
  if (data && typeof data.message === "string" && data.message.trim()) return data.message
  if (data && typeof data.detail === "string" && data.detail.trim()) return data.detail
  if (data && typeof data.error === "string" && data.error.trim()) return data.error
  return raw?.trim() || fallback
}

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const normalized = value.replace(" ", "T")
  const date = new Date(`${normalized}Z`)
  if (Number.isNaN(date.getTime())) {
    return value.split(" ")[0]
  }
  return date.toLocaleDateString("ru-RU")
}

const formatLimitsText = (limits: Limits | null) => {
  if (!limits) return "Ограничения не определены"
  const { category_limit, item_limit } = limits
  if (category_limit == null && item_limit == null) return "Полный доступ без ограничений"
  const parts: string[] = []
  if (typeof category_limit === "number") {
    parts.push(`До ${category_limit} категорий меню`)
  }
  if (typeof item_limit === "number") {
    parts.push(`До ${item_limit} блюд в категории`)
  }
  return parts.join(", ")
}

const getStatusIcon = (status: string | null) => {
  if (status === "active") return <BadgeCheck className="size-5 text-emerald-300" />
  if (status === "pending") return <Clock3 className="size-5 text-yellow-300" />
  if (status === "canceled") return <Clock3 className="size-5 text-red-300" />
  if (status === "expired") return <Clock3 className="size-5 text-sky-200" />
  return <Sparkles className="size-5 text-[#FFEA5A]" />
}

export default function Subscription({ activeTeam }: { activeTeam: string }) {
  const [subscription, setSubscription] = useState<SubscriptionInfo>(null)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const reloadSubscription = useCallback(async () => {
    if (!activeTeam) {
      setSubscription(null)
      setLimits(null)
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setLoadingSubscription(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const raw = await res.text()
      let data: any = null
      if (raw) {
        try {
          data = JSON.parse(raw)
        } catch {
          data = null
        }
      }
      if (!res.ok) {
        const message = parseMessage(data, raw, "Не удалось загрузить подписку")
        showErrorToast(message)
        return
      }
      setSubscription(data?.subscription ?? null)
      setLimits(data?.limits ?? null)
      window.dispatchEvent(new CustomEvent("subscription:updated"))
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось загрузить подписку")
    } finally {
      setLoadingSubscription(false)
    }
  }, [activeTeam])

  const loadHistory = useCallback(async () => {
    if (!activeTeam) {
      setHistory([])
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription/history`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const raw = await res.text()
      let data: any = null
      if (raw) {
        try {
          data = JSON.parse(raw)
        } catch {
          data = null
        }
      }
      if (!res.ok) {
        const message = parseMessage(data, raw, "Не удалось загрузить историю")
        showErrorToast(message)
        return
      }
      if (Array.isArray(data?.history)) {
        setHistory(data.history)
      } else {
        setHistory([])
      }
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось загрузить историю подписок")
    } finally {
      setLoadingHistory(false)
    }
  }, [activeTeam])

  useEffect(() => {
    reloadSubscription()
    loadHistory()
  }, [reloadSubscription, loadHistory])

  const currentStatusLabel = useMemo(() => {
    if (!subscription?.status) return "Подписка не оформлена"
    return statusLabels[subscription.status] || subscription.status
  }, [subscription])

  const periodText = useMemo(() => {
    if (!subscription) return "Подписка не оформлена"
    if (subscription.plan_code === "base") return "Без срока действия"
    if (subscription.expires_at) return `До ${formatDate(subscription.expires_at)}`
    return "Без срока действия"
  }, [subscription])

  const startedAt = useMemo(() => formatDate(subscription?.started_at), [subscription])

  const limitsText = useMemo(() => formatLimitsText(limits), [limits])

  const lastPayment = useMemo(() => {
    if (subscription?.amount != null) {
      return formatCurrency(subscription.amount, subscription.currency || "RUB")
    }
    const paidEntry = history.find((entry) => entry.amount != null)
    if (paidEntry && paidEntry.amount != null) {
      return formatCurrency(paidEntry.amount, paidEntry.currency || "RUB")
    }
    return "—"
  }, [subscription, history])

  const handleOpenTariffs = () => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const teamParam = params.get("team") || activeTeam
    window.dispatchEvent(
      new CustomEvent("dashboard:navigate", {
        detail: { block: "tariffs", team: teamParam || undefined },
      }),
    )
  }

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <h2 className="text-xl font-bold">Подписка и история</h2>
        <Card>
          <CardHeader>
            <CardTitle>Выберите заведение</CardTitle>
            <CardDescription>Чтобы увидеть информацию о подписке, выберите заведение в боковом меню.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const statusIcon = getStatusIcon(subscription?.status || null)
  const statusVariant = badgeVariants[subscription?.status || ""] || "outline"

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Подписка и история</h2>
        <Button variant="outline" onClick={handleOpenTariffs} className="w-full sm:w-auto">
          Перейти к тарифам
        </Button>
      </div>

      <Card className="overflow-hidden border-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
                {statusIcon}
              </div>
              <div>
                <CardTitle className="text-white text-xl">
                  {subscription?.plan_name || "Подписка не оформлена"}
                </CardTitle>
                <CardDescription className="text-slate-200">
                  Статус: {currentStatusLabel}
                </CardDescription>
              </div>
            </div>
            <Badge variant={statusVariant} className="w-max">
              {currentStatusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <BadgeCheck className="size-4" />
                <span>Статус</span>
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {loadingSubscription ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Обновляем данные…</span>
                  </span>
                ) : (
                  currentStatusLabel
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <CalendarClock className="size-4" />
                <span>Период</span>
              </div>
              <div className="mt-2 text-base font-semibold text-white">{periodText}</div>
              {subscription?.started_at && (
                <div className="text-xs text-slate-200/80">С {startedAt}</div>
              )}
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <ShieldCheck className="size-4" />
                <span>Ограничения</span>
              </div>
              <div className="mt-2 text-base font-semibold text-white">{limitsText}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <CreditCard className="size-4" />
                <span>Последний платёж</span>
              </div>
              <div className="mt-2 text-base font-semibold text-white">{lastPayment}</div>
              {subscription?.amount != null && subscription?.currency && (
                <div className="text-xs text-slate-200/80">По текущей подписке</div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-200/80">
            Следите за лимитами и переходите на новые тарифы в один клик.
          </p>
          <Button variant="secondary" onClick={handleOpenTariffs} className="bg-[#FFEA5A] text-black hover:bg-[#ffe142]">
            Выбрать другой тариф
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История подписок</CardTitle>
          <CardDescription>
            Здесь отображаются все оформленные подписки и их статус.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Загружаем историю…</span>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">История оплат пока пуста.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Подписка</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата оформления</TableHead>
                    <TableHead>Начало</TableHead>
                    <TableHead>Окончание</TableHead>
                    <TableHead>Стоимость</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => {
                    const label = statusLabels[entry.status] || entry.status
                    const variant = badgeVariants[entry.status] || "secondary"
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.plan_name}</TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(entry.created_at)}</TableCell>
                        <TableCell>{formatDate(entry.started_at)}</TableCell>
                        <TableCell>{formatDate(entry.expires_at)}</TableCell>
                        <TableCell>
                          {entry.amount != null
                            ? formatCurrency(entry.amount, entry.currency || "RUB")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
