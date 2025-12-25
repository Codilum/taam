"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  TrendingUp,
  Package,
  DollarSign,
  Clock,
  Truck,
  Loader2,
  BarChart3,
  PieChart,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { showErrorToast } from "@/lib/show-error-toast"
import { statsService, type DashboardStats, type StatsPeriod } from "@/services"
import { cn } from "@/lib/utils"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} мин`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}ч ${mins}м`
}

export default function Statistics({ activeTeam }: { activeTeam: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<StatsPeriod>("day")

  const storageKey = activeTeam ? `taam_stats_${activeTeam}_${period}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { data: DashboardStats }
        if (parsed?.data) setStats(parsed.data)
      }
    } catch (error) {
      console.error("Не удалось прочитать статистику из кеша", error)
    }
  }, [storageKey])

  const loadStats = useCallback(async () => {
    if (!activeTeam) return
    setLoading(true)
    try {
      const data = await statsService.getDashboardStats(activeTeam, period)
      const normalized = (data as any).stats || data
      setStats(normalized)
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ data: normalized }))
    } catch (error: any) {
      showErrorToast(error?.detail || "Не удалось загрузить статистику")
    } finally {
      setLoading(false)
    }
  }, [activeTeam, period, storageKey])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // ---- Chart prep (safe, normalized) ----
  const chartPoints = (stats?.chart_data || [])
    .map((point: any) => ({
      date: String(point.date).slice(0, 10), // ensure YYYY-MM-DD
      orders: Number(point.orders || 0),
      revenue: Number(point.revenue || 0),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const periodLengthMap: Record<StatsPeriod, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  }

  const periodLength = periodLengthMap[period] || 30

  // IMPORTANT: build dates in LOCAL time (no UTC shift bugs)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (periodLength - 1))

  const filledChartPoints = Array.from({ length: periodLength }).map((_, idx) => {
    const day = new Date(start)
    day.setDate(start.getDate() + idx)
    const yyyy = day.getFullYear()
    const mm = String(day.getMonth() + 1).padStart(2, "0")
    const dd = String(day.getDate()).padStart(2, "0")
    const dateKey = `${yyyy}-${mm}-${dd}`

    const existing = chartPoints.find((p) => p.date === dateKey)
    return existing || { date: dateKey, orders: 0, revenue: 0 }
  })

  const visibleChartPoints = filledChartPoints.slice(-14)

  const chartData = visibleChartPoints.map((p) => ({
    date: p.date,
    orders: Number(p.orders || 0),
    revenue: Number(p.revenue || 0),
  }))

  const chartConfig = {
    orders: { label: "Заказы", color: "var(--chart-1)" },
    revenue: { label: "Выручка", color: "var(--chart-2)" },
  } satisfies ChartConfig

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Выберите заведение</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Статистика заказов</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as StatsPeriod)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Сегодня</SelectItem>
            <SelectItem value="week">Неделя</SelectItem>
            <SelectItem value="month">Месяц</SelectItem>
            <SelectItem value="year">Год</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Всего заказов"
              value={String(stats.total_orders)}
              icon={<Package className="size-5" />}
              color="bg-blue-500"
            />
            <StatCard
              title="Выручка"
              value={formatCurrency(stats.total_revenue)}
              icon={<DollarSign className="size-5" />}
              color="bg-green-500"
            />
            <StatCard
              title="Средний чек"
              value={formatCurrency(stats.average_check)}
              icon={<TrendingUp className="size-5" />}
              color="bg-purple-500"
            />
            <StatCard
              title="Среднее время доставки"
              value={formatMinutes(stats.delivery_time_avg)}
              icon={<Truck className="size-5" />}
              color="bg-orange-500"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders Over Time (Recharts) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5" />
                  Заказы за период
                </CardTitle>
                <CardDescription>Количество заказов и выручка по дням</CardDescription>
              </CardHeader>

              <CardContent>
                {chartData.length ? (
                  <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <LineChart data={chartData} margin={{ left: 12, right: 12, top: 10 }}>
                      <CartesianGrid vertical={false} />

                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tickFormatter={(value: string) => {
                          const parts = String(value).split("-")
                          return `${parts[2]}/${parts[1]}`
                        }}
                      />

                      <YAxis tickLine={false} axisLine={false} width={32} />

                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => {
                              const [y, m, d] = String(label).split("-")
                              return `${d}.${m}.${y}`
                            }}
                            formatter={(value, name) => {
                              if (name === "revenue") return formatCurrency(Number(value))
                              return `${Number(value)}`
                            }}
                          />
                        }
                      />

                      <Line
                        dataKey="orders"
                        type="natural"
                        stroke="var(--color-orders)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-orders)" }}
                        activeDot={{ r: 6 }}
                      />

                      <Line
                        dataKey="revenue"
                        type="natural"
                        stroke="var(--color-revenue)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-revenue)" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orders by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="size-5" />
                  Заказы по статусам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.orders_by_status).map(([status, count]) => {
                    const total = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0)
                    const percentage = total > 0 ? (count / total) * 100 : 0

                    const colors: Record<string, string> = {
                      pending: "bg-yellow-500",
                      cooking: "bg-orange-500",
                      ready: "bg-blue-500",
                      courier: "bg-purple-500",
                      delivered: "bg-green-500",
                      canceled: "bg-red-500",
                    }

                    const labels: Record<string, string> = {
                      pending: "В ожидании",
                      cooking: "Готовится",
                      ready: "Готово",
                      courier: "У курьера",
                      delivered: "Доставлено",
                      canceled: "Отменено",
                    }

                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{labels[status] || status}</span>
                          <span className="font-medium">
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", colors[status] || "bg-gray-500")}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category and Item Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Продажи по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.sales_by_category?.length ? (
                    stats.sales_by_category.slice(0, 10).map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <span className="font-medium">{cat.category}</span>
                          <span className="text-sm text-muted-foreground ml-2">({cat.count} шт.)</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(cat.revenue)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет данных</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sales by Item */}
            <Card>
              <CardHeader>
                <CardTitle>Топ позиций</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.sales_by_item?.length ? (
                    stats.sales_by_item.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <span className="font-medium">{item.item}</span>
                          <span className="text-sm text-muted-foreground ml-2">({item.count} шт.)</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.revenue)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет данных</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timing Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                Время обработки заказов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-muted/50 rounded-xl">
                  <div className="text-4xl font-bold text-primary mb-2">{formatMinutes(stats.dispatch_time_avg)}</div>
                  <div className="text-sm text-muted-foreground">Среднее время отправки</div>
                </div>
                <div className="text-center p-6 bg-muted/50 rounded-xl">
                  <div className="text-4xl font-bold text-primary mb-2">{formatMinutes(stats.delivery_time_avg)}</div>
                  <div className="text-sm text-muted-foreground">Среднее время доставки</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">Нет данных для отображения</CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-xl text-white", color)}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
