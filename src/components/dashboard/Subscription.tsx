"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleCheck, Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type Plan = {
  code: string
  name: string
  description?: string | null
  price: number
  price_minor: number
  currency: string
  duration_days?: number | null
  category_limit?: number | null
  item_limit?: number | null
  is_full_access?: boolean
  is_trial?: boolean
  features?: string[]
}

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

const statusLabels: Record<string, string> = {
  active: "Активна",
  pending: "Ожидает оплаты",
  expired: "Истекла",
  canceled: "Отменена",
}

const parseMessage = (data: any, raw: string, fallback: string) => {
  if (typeof data === "string" && data.trim()) return data
  if (data && typeof data.message === "string" && data.message.trim()) return data.message
  if (data && typeof data.detail === "string" && data.detail.trim()) return data.detail
  if (data && typeof data.error === "string" && data.error.trim()) return data.error
  if (raw && raw.includes("Request Entity Too Large")) return "Файл слишком большой"
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
  if (!value) return null
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
    parts.push(`до ${category_limit} категорий`)
  }
  if (typeof item_limit === "number") {
    parts.push(`до ${item_limit} блюд в категории`)
  }
  return parts.join(", ")
}

const planLimitDescription = (plan: Plan) => {
  if (plan.is_full_access) return "Полный доступ без ограничений"
  const parts: string[] = []
  if (typeof plan.category_limit === "number") {
    parts.push(`До ${plan.category_limit} категорий меню`)
  }
  if (typeof plan.item_limit === "number") {
    parts.push(`До ${plan.item_limit} блюд в категории`)
  }
  return parts.join(", ") || "Гибкие ограничения"
}

export default function Subscription({ activeTeam }: { activeTeam: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo>(null)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [loading, setLoading] = useState(false)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState<{ paymentId: string; confirmationUrl?: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      const token = localStorage.getItem("access_token")
      if (!token) return
      try {
        const res = await fetch("/api/subscriptions/plans", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.plans)) {
          setPlans(data.plans)
        }
      } catch (error) {
        console.error("Не удалось загрузить тарифы", error)
      }
    }

    loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  const reloadSubscription = useCallback(async () => {
    if (!activeTeam) {
      setSubscription(null)
      setLimits(null)
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      toast.error("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setLoading(true)
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
        toast.error(message)
        return
      }
      setSubscription(data?.subscription ?? null)
      setLimits(data?.limits ?? null)
      setPendingPayment(null)
      window.dispatchEvent(new CustomEvent("subscription:updated"))
    } catch (error) {
      console.error(error)
      toast.error("Не удалось загрузить подписку")
    } finally {
      setLoading(false)
    }
  }, [activeTeam])

  useEffect(() => {
    reloadSubscription()
  }, [reloadSubscription])

  const currentStatusLabel = useMemo(() => {
    if (!subscription?.status) return "Подписка не оформлена"
    return statusLabels[subscription.status] || subscription.status
  }, [subscription])

  const activePlanCode = subscription?.plan_code || null

  const handleSubscribe = async (planCode: string) => {
    if (!activeTeam) {
      toast.error("Выберите заведение")
      return
    }
    if (pendingPayment?.paymentId) {
      toast.warning("Сначала завершите оплату текущей подписки")
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      toast.error("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setProcessingPlan(planCode)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_code: planCode,
          return_url: `${window.location.origin}/dashboard?block=subscription`,
        }),
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
        const message = parseMessage(data, raw, "Не удалось оформить подписку")
        toast.error(message)
        return
      }

      if (data?.status === "active") {
        await reloadSubscription()
        toast.success("Подписка активирована")
      } else if (data?.status === "pending") {
        const paymentId = data?.payment_id as string | undefined
        setPendingPayment({ paymentId: paymentId || "", confirmationUrl: data?.confirmation_url })
        if (data?.confirmation_url) {
          window.open(data.confirmation_url, "_blank", "noopener")
        }
        toast.info("Перейдите к оплате и подтвердите платеж")
      } else {
        await reloadSubscription()
        toast.success("Запрос на подписку отправлен")
      }
    } catch (error) {
      console.error(error)
      toast.error("Не удалось оформить подписку")
    } finally {
      setProcessingPlan(null)
    }
  }

  const handleRefreshPayment = async () => {
    if (!activeTeam || !pendingPayment?.paymentId) {
      toast.warning("Нет платежа для проверки")
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      toast.error("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setRefreshing(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_id: pendingPayment.paymentId }),
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
        const message = parseMessage(data, raw, "Не удалось проверить платеж")
        toast.error(message)
        return
      }

      const status = data?.status
      if (status === "active") {
        await reloadSubscription()
        setPendingPayment(null)
        toast.success("Подписка активирована")
      } else if (status === "canceled") {
        setPendingPayment(null)
        toast.error("Платеж отменен")
      } else {
        toast.info("Платеж ещё обрабатывается")
      }
    } catch (error) {
      console.error(error)
      toast.error("Не удалось проверить платеж")
    } finally {
      setRefreshing(false)
    }
  }

  const renderPlanPrice = (plan: Plan) => {
    if (plan.price <= 0) return "Бесплатно"
    return formatCurrency(plan.price, plan.currency)
  }

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <h2 className="text-xl font-bold">Моя подписка</h2>
        <Card>
          <CardHeader>
            <CardTitle>Выберите заведение</CardTitle>
            <CardDescription>
              Чтобы управлять подпиской, выберите заведение из списка слева.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h2 className="text-xl font-bold">Моя подписка</h2>

      <Card>
        <CardHeader>
          <CardTitle>{subscription?.plan_name || "Подписка не оформлена"}</CardTitle>
          <CardDescription>
            Статус: {currentStatusLabel}
            {subscription?.expires_at && (
              <span className="block">
                Действует до {formatDate(subscription.expires_at)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Загружаем данные подписки…</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Текущие ограничения: {formatLimitsText(limits)}</p>
              {subscription?.amount != null && (
                <p>
                  Последний платёж: {formatCurrency(subscription.amount, subscription.currency || "RUB")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingPayment?.paymentId && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base">Оплата ожидает подтверждения</CardTitle>
            <CardDescription>
              Завершите оплату и нажмите «Проверить оплату», чтобы активировать подписку.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-2">
            {pendingPayment.confirmationUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(pendingPayment.confirmationUrl, "_blank", "noopener")}
              >
                Открыть оплату
              </Button>
            )}
            <Button onClick={handleRefreshPayment} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Проверить оплату
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="bg-muted/50 rounded-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const features = [...(plan.features ?? [])]
              const limitText = planLimitDescription(plan)
              if (!features.includes(limitText)) {
                features.unshift(limitText)
              }
              const isActive = activePlanCode === plan.code && subscription?.status === "active"
              const isProcessing = processingPlan === plan.code

              return (
                <Card
                  key={plan.code}
                  className="flex h-full flex-col justify-between text-left shadow-sm"
                >
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.description && (
                      <CardDescription>{plan.description}</CardDescription>
                    )}
                    <div className="mt-4 text-3xl font-semibold">
                      {renderPlanPrice(plan)}
                    </div>
                    {plan.duration_days && (
                      <p className="text-sm text-muted-foreground">
                        Длительность: {plan.duration_days} дн.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Separator className="mb-4" />
                    <ul className="space-y-3 text-sm">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 size-4 text-green-600" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(plan.code)}
                      disabled={isActive || isProcessing}
                    >
                      {isActive
                        ? "Текущий тариф"
                        : isProcessing
                        ? "Оформляем..."
                        : "Оформить подписку"}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
            {plans.length === 0 && (
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>Тарифы временно недоступны</CardTitle>
                  <CardDescription>
                    Попробуйте обновить страницу позже или обратитесь в поддержку.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

