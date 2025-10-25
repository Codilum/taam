"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleCheck, Loader2, RefreshCcw, Sparkles } from "lucide-react"
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
import { showErrorToast } from "@/lib/show-error-toast"

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

const formatDate = (value?: string | null) => {
  if (!value) return null
  const normalized = value.replace(" ", "T")
  const date = new Date(`${normalized}Z`)
  if (Number.isNaN(date.getTime())) {
    return value.split(" ")[0]
  }
  return date.toLocaleDateString("ru-RU")
}

export default function Tariffs({ activeTeam }: { activeTeam: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo>(null)
  const [loading, setLoading] = useState(false)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState<
    { paymentId: string | null; confirmationUrl?: string; planName?: string; existing?: boolean } | null
  >(null)
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [secretControlsVisible, setSecretControlsVisible] = useState(false)
  const [grantingTrial, setGrantingTrial] = useState(false)

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase()
      if (event.altKey && event.shiftKey && key === "t") {
        event.preventDefault()
        setSecretControlsVisible((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const reloadSubscription = useCallback(async () => {
    if (!activeTeam) {
      setSubscription(null)
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
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
        showErrorToast(message)
        return
      }
      setSubscription(data?.subscription ?? null)
      const pending = data?.pending_payment
      if (pending) {
        setPendingPayment({
          paymentId: (pending.payment_id as string | null | undefined) ?? null,
          confirmationUrl: pending.confirmation_url as string | undefined,
          planName: pending.plan_name as string | undefined,
          existing: true,
        })
      } else {
        setPendingPayment(null)
      }
      window.dispatchEvent(new CustomEvent("subscription:updated"))
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось загрузить подписку")
    } finally {
      setLoading(false)
    }
  }, [activeTeam])

  useEffect(() => {
    reloadSubscription()
  }, [reloadSubscription])

  const activePlanCode = subscription?.plan_code || null
  const currentStatus = subscription?.status || null

  const handleSubscribe = async (planCode: string) => {
    if (!activeTeam) {
      showErrorToast("Выберите заведение")
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setProcessingPlan(planCode)
    try {
      const params = new URLSearchParams(window.location.search)
      const returnTeam = params.get("team") || activeTeam
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_code: planCode,
          return_url: `${window.location.origin}/dashboard?team=${returnTeam}&block=subscription`,
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
        showErrorToast(message)
        return
      }

      if (data?.status === "active") {
        await reloadSubscription()
        toast.success("Подписка активирована")
      } else if (data?.status === "pending") {
        const paymentId = (data?.payment_id as string | null | undefined) ?? null
        const confirmationUrl = data?.confirmation_url as string | undefined
        const planName = data?.plan_name as string | undefined
        const existing = Boolean(data?.existing)
        setPendingPayment({
          paymentId,
          confirmationUrl,
          planName,
          existing,
        })
        if (confirmationUrl && !existing) {
          window.open(confirmationUrl, "_blank", "noopener")
        }
        if (existing) {
          toast.warning("У вас уже есть неоплаченная подписка. Вы можете продолжить оплату или отменить её.")
        } else {
          toast.info("Перейдите к оплате и подтвердите платеж")
        }
      } else {
        await reloadSubscription()
        toast.success("Запрос на подписку отправлен")
      }
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось оформить подписку")
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
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
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
        showErrorToast(message)
        return
      }

      const status = data?.status
      if (status === "active") {
        await reloadSubscription()
        setPendingPayment(null)
        toast.success("Подписка активирована")
      } else if (status === "canceled") {
        setPendingPayment(null)
        showErrorToast("Платеж отменен")
      } else {
        toast.info("Платеж ещё обрабатывается")
      }
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось проверить платеж")
    } finally {
      setRefreshing(false)
    }
  }

  const handleCancelPending = async () => {
    if (!activeTeam) {
      showErrorToast("Выберите заведение")
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setCanceling(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_id: pendingPayment?.paymentId ?? null }),
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
        const message = parseMessage(data, raw, "Не удалось отменить подписку")
        showErrorToast(message)
        return
      }

      setPendingPayment(null)
      toast.success("Неоплаченная подписка отменена")
      await reloadSubscription()
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось отменить подписку")
    } finally {
      setCanceling(false)
    }
  }

  const handleGrantTrial = useCallback(async () => {
    if (!activeTeam) {
      showErrorToast("Выберите заведение")
      return
    }
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Нет доступа. Авторизуйтесь повторно")
      return
    }
    setGrantingTrial(true)
    try {
      const res = await fetch(`/api/restaurants/${activeTeam}/subscription/grant-trial`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        const message = parseMessage(data, raw, "Не удалось выдать пробную подписку")
        showErrorToast(message)
        return
      }
      toast.success("Пробная подписка активирована")
      setPendingPayment(null)
      if (data?.subscription) {
        setSubscription(data.subscription)
      }
      await reloadSubscription()
    } catch (error) {
      console.error(error)
      showErrorToast("Не удалось выдать пробную подписку")
    } finally {
      setGrantingTrial(false)
    }
  }, [activeTeam, reloadSubscription])

  const renderPlanPrice = (plan: Plan) => {
    if (plan.price <= 0) return "Бесплатно"
    return formatCurrency(plan.price, plan.currency)
  }

  const currentExpires = useMemo(() => {
    if (!subscription?.expires_at) return null
    return formatDate(subscription.expires_at)
  }, [subscription])

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <h2 className="text-xl font-bold">Тарифы</h2>
        <Card>
          <CardHeader>
            <CardTitle>Выберите заведение</CardTitle>
            <CardDescription>Чтобы управлять тарифами, выберите заведение из списка слева.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Тарифы</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin" />}
          <span>
            {subscription?.plan_name ? (
              <>Текущий тариф: <span className="font-medium text-foreground">{subscription.plan_name}</span></>
            ) : (
              <>Подписка ещё не оформлена</>
            )}
            {currentExpires && <>, действует до {currentExpires}</>}
          </span>
        </div>
      </div>

      {secretControlsVisible && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGrantTrial}
            disabled={grantingTrial || loading}
          >
            {grantingTrial && <Loader2 className="mr-2 size-4 animate-spin" />}
            {grantingTrial ? "Активируем..." : "Выдать пробную подписку"}
          </Button>
        </div>
      )}

      {pendingPayment && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-yellow-600" />
              Оплата ожидает подтверждения
            </CardTitle>
            <CardDescription>
              {pendingPayment.planName ? (
                <>
                  Оплата тарифа «{pendingPayment.planName}» ожидает подтверждения. Завершите платеж и обновите статус.
                </>
              ) : (
                <>Завершите оплату и нажмите «Проверить оплату», чтобы активировать подписку.</>
              )}
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
            <Button onClick={handleRefreshPayment} disabled={refreshing || !pendingPayment.paymentId}>
              {refreshing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Проверить оплату
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPending}
              disabled={canceling}
            >
              {canceling ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {canceling ? "Отменяем..." : "Отменить оплату"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="bg-muted/50 rounded-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const baseFeatures = plan.features ?? []
              const limitText = planLimitDescription(plan)
              const combined = limitText ? [limitText, ...baseFeatures] : baseFeatures
              const features = Array.from(new Set(combined))
              const isActive = activePlanCode === plan.code && currentStatus === "active"
              const isProcessing = processingPlan === plan.code

              return (
                <Card
                  key={plan.code}
                  className={`flex h-full flex-col justify-between text-left shadow-sm transition ${
                    isActive ? "border-2 border-[#FFEA5A] bg-white" : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {isActive && <Sparkles className="size-5 text-[#FFAE00]" />}
                      {plan.name}
                    </CardTitle>
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
                      disabled={isActive || isProcessing || loading}
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
