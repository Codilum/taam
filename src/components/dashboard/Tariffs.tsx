"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleCheck, Loader2, RefreshCcw, Sparkles, ArrowLeft, Check, X } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

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
import { subscriptionService } from "@/services"
import { cn } from "@/lib/utils"

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

// Custom Tariff Definitions to match User Request
const TARIFF_DEFINITIONS: Record<string, { title: string, description: string, features: string[], highlight?: boolean }> = {
  "base": {
    title: "Базовый",
    description: "Для небольших меню",
    features: ["Базовый функционал", "Ограничение по позициям", "Стандартная поддержка"]
  },
  "trial": {
    title: "Пробный",
    description: "Попробовать все возможности",
    features: ["Полный функционал на 7 дней", "Все интеграции", "Без ограничений"]
  },
  "qr-menu": {
    title: "QR-Menu",
    description: "Идеально для зала",
    features: [
      "Полный доступ без ограничений",
      "Без ограничений по категориям",
      "Без ограничений по блюдам",
      "Поддержка приоритетного уровня"
    ]
  },
  "full": {
    title: "Полный",
    description: "Максимальные возможности",
    highlight: true,
    features: [
      "Полный доступ без ограничений",
      "Без ограничений по категориям",
      "Без ограничений по блюдам",
      "Возможность оформить доставку",
      "Статистика заказов",
      "Поддержка приоритетного уровня"
    ]
  }
};

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
  const [keySequence, setKeySequence] = useState<string[]>([])
  const [showKeyIndicator, setShowKeyIndicator] = useState(false)

  // Обработчик горячих клавиш (оставлен без изменений)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase()
      setKeySequence(prev => {
        const newSequence = [...prev, key].slice(-3)
        return newSequence
      })
      setTimeout(() => setShowKeyIndicator(false), 1000)
      if ((event.altKey || event.metaKey) && key === '†') {
        event.preventDefault()
        setSecretControlsVisible((prev) => !prev)
        setKeySequence([])
      }
      const currentSequence = [...keySequence, key].slice(-4).join('')
      if (currentSequence.includes('show')) {
        event.preventDefault()
        setSecretControlsVisible((prev) => !prev)
        setKeySequence([])
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [keySequence])

  const loadData = useCallback(async () => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const [plansData, subData] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getSubscription(activeTeam)
      ]);

      if (Array.isArray(plansData?.plans)) {
        setPlans(plansData.plans);
      }

      setSubscription(subData?.subscription ?? null);
      const pending = subData?.pending_payment;
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

    } catch (error: any) {
      console.error(error);
      showErrorToast("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleSubscribe = async (planCode: string) => {
    if (!activeTeam) {
      showErrorToast("Выберите заведение")
      return
    }
    // Prevent subscribing to base if paid active
    const activePlan = plans.find(p => p.code === subscription?.plan_code);
    const hasPaidActive = subscription?.status === "active" && !activePlan?.is_trial && (activePlan?.price || 0) > 0;

    if (planCode === "base" && hasPaidActive) {
      toast.error("Нельзя перейти на базовый тариф, пока действует оплаченная подписка")
      return
    }

    setProcessingPlan(planCode)
    try {
      const params = new URLSearchParams(window.location.search)
      const returnTeam = params.get("team") || activeTeam
      const data = await subscriptionService.subscribe(activeTeam, {
        plan_code: planCode,
        return_url: `${window.location.origin}/dashboard?team=${returnTeam}&block=subscription`,
      })

      if (data?.status === "active") {
        await loadData()
        toast.success("Подписка активирована")
      } else if (data?.status === "pending") {
        // Handle pending payment logic similar to before
        const paymentId = (data?.payment_id as string | null | undefined) ?? null
        const confirmationUrl = data?.confirmation_url as string | undefined
        const planName = data?.plan_name as string | undefined
        const existing = Boolean(data?.existing)
        setPendingPayment({ paymentId, confirmationUrl, planName, existing })
        if (confirmationUrl && !existing) window.open(confirmationUrl, "_blank", "noopener");
        toast.info(existing ? "У вас уже есть неоплаченная подписка" : "Перейдите к оплате");
      } else {
        await loadData();
        toast.success("Запрос отправлен");
      }
    } catch (error: any) {
      console.error(error)
      showErrorToast(error.detail || error.message || "Не удалось оформить подписку")
    } finally {
      setProcessingPlan(null)
    }
  }

  const handleRefreshPayment = async () => {
    if (!activeTeam || !pendingPayment?.paymentId) return;
    setRefreshing(true);
    try {
      const data = await subscriptionService.refreshPayment(activeTeam, pendingPayment.paymentId);
      if (data?.status === "active") {
        await loadData();
        setPendingPayment(null);
        toast.success("Подписка активирована");
      } else if (data?.status === "canceled") {
        setPendingPayment(null);
        showErrorToast("Платеж отменен");
      } else {
        toast.info("Платеж ещё обрабатывается");
      }
    } catch (e) { showErrorToast("Ошибка проверки"); } finally { setRefreshing(false); }
  }

  const handleCancelPending = async () => {
    if (!activeTeam) return;
    setCanceling(true);
    try {
      await subscriptionService.cancelPending(activeTeam, pendingPayment?.paymentId ?? null);
      setPendingPayment(null);
      await loadData();
      toast.success("Подписка отменена");
    } catch (e) { showErrorToast("Ошибка отмены"); } finally { setCanceling(false); }
  }

  const handleGrantTrial = async () => {
    if (!activeTeam) return;
    setGrantingTrial(true);
    try {
      await subscriptionService.grantTrial(activeTeam);
      toast.success("Trial activated");
      await loadData();
    } catch (e) { showErrorToast("Error"); } finally { setGrantingTrial(false); }
  }

  const handleBack = () => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const teamParam = params.get("team") || activeTeam
    window.dispatchEvent(
      new CustomEvent("dashboard:navigate", {
        detail: { block: "subscription", team: teamParam || undefined },
      }),
    )
  }

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card><CardHeader><CardTitle>Выберите заведение</CardTitle></CardHeader></Card>
      </div>
    )
  }

  // Sort plans: Base, Trial, QR-Menu, Full
  // We assume backend codes map to frontend keys or we use frontend keys to find backend plans
  const displayPlans = ["base", "trial", "qr-menu", "full"].map(key => {
    // Find matching backend plan. Assume exact code match or strict mapping.
    // If backend codes differ, we might need a mapping function.
    // For now, assuming codes match: 'base', 'trial', 'qr-menu' (slugified?), 'full'
    const backendPlan = plans.find(p => p.code === key) || plans.find(p => p.code.includes(key));

    const def = TARIFF_DEFINITIONS[key] || { title: key, description: "", features: [] };
    return {
      ...def,
      backendPlan,
      code: key
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 relative max-w-[1600px] mx-auto w-full">
      {/* Secret Key Indicator */}
      <AnimatePresence>
        {showKeyIndicator && (
          <div className="fixed top-4 right-4 z-50 bg-background/80 p-3 rounded">{keySequence.join('')}</div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={handleBack} className="-ml-2">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Выберите тариф</h1>
      </div>

      <AnimatePresence>
        {secretControlsVisible && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <Button variant="outline" onClick={handleGrantTrial} disabled={grantingTrial}>
              {grantingTrial ? <Loader2 className="animate-spin" /> : "Выдать Trial"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Payment Warning */}
      {pendingPayment && (
        <Card className="border-yellow-200 bg-yellow-50 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 font-semibold text-yellow-800">
              <Sparkles className="size-5" />
              Требуется подтверждение оплаты {pendingPayment.planName && `для "${pendingPayment.planName}"`}
            </div>
          </CardHeader>
          <CardFooter className="gap-3 pt-0">
            {pendingPayment.confirmationUrl && (
              <Button variant="default" size="sm" onClick={() => window.open(pendingPayment.confirmationUrl!, "_blank")}>
                Оплатить
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefreshPayment} disabled={refreshing}>
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4 mr-2" />} Проверить
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleCancelPending} disabled={canceling}>
              Отменить
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {displayPlans.map((plan) => {
          const backend = plan.backendPlan;
          const priceText = backend
            ? (backend.price === 0 ? "Бесплатно" : formatCurrency(backend.price, backend.currency))
            : "Недоступно";

          const isCurrent = subscription?.plan_code === backend?.code && subscription?.status === "active";
          const isProcessing = processingPlan === backend?.code;

          // Downgrade restriction
          const activePlan = plans.find(p => p.code === subscription?.plan_code);
          const hasPaidActive = subscription?.status === "active" && !activePlan?.is_trial && (activePlan?.price || 0) > 0;
          const isRestricted = plan.code === "base" && hasPaidActive;

          return (
            <Card
              key={plan.code}
              className={cn(
                "relative flex flex-col transition-all duration-200 hover:shadow-lg border-2",
                plan.highlight ? "border-primary shadow-md" : "border-transparent",
                isCurrent ? "ring-2 ring-green-500 border-green-500 bg-green-50/10" : "bg-card"
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Рекомендуем
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.title}</CardTitle>
                <CardDescription className="text-base mt-2 min-h-[40px]">{plan.description}</CardDescription>
                <div className="mt-4 text-3xl font-bold tracking-tight">
                  {priceText}
                  {backend?.duration_days && backend.price > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">/ {backend.duration_days} дн.</span>}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <Separator className="mb-6" />
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="mt-1 rounded-full bg-primary/10 p-1">
                        <Check className="size-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-6">
                <Button
                  className="w-full h-11 text-base font-medium"
                  variant={isCurrent ? "outline" : (plan.highlight ? "default" : "secondary")}
                  disabled={isCurrent || !backend || isProcessing || isRestricted || loading}
                  onClick={() => backend && handleSubscribe(backend.code)}
                >
                  {isCurrent ? (
                    <span className="flex items-center gap-2 text-green-600"><Check className="size-4" /> Ваш тариф</span>
                  ) : isProcessing ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Оформляем</>
                  ) : isRestricted ? (
                    "Недоступно"
                  ) : (
                    "Выбрать"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        Есть вопросы? <a href="#" className="underline underline-offset-4 hover:text-primary">Свяжитесь с поддержкой</a>
      </div>
    </div>
  )
}