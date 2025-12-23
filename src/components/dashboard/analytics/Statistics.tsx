"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingUp, TrendingDown, Package, DollarSign, Clock, Truck, Loader2, BarChart3, PieChart } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { showErrorToast } from "@/lib/show-error-toast"
import { statsService, DashboardStats, StatsPeriod } from "@/services"
import { cn } from "@/lib/utils"

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(amount)
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
                if (parsed?.data) {
                    setStats(parsed.data)
                }
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
            if (storageKey) {
                localStorage.setItem(storageKey, JSON.stringify({ data: normalized }))
            }
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось загрузить статистику")
        } finally {
            setLoading(false)
        }
    }, [activeTeam, period, storageKey])

    useEffect(() => {
        loadStats()
    }, [loadStats])

    const chartPoints = (stats?.chart_data || [])
        .map((point) => ({
            ...point,
            orders: Number(point.orders || 0),
            revenue: Number(point.revenue || 0)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const periodLengthMap: Record<StatsPeriod, number> = {
        day: 1,
        week: 7,
        month: 30,
        year: 365,
    }

    const periodLength = periodLengthMap[period] || 30
    const today = new Date()
    const filledChartPoints = Array.from({ length: periodLength }).map((_, idx) => {
        const day = new Date(today)
        day.setDate(today.getDate() - (periodLength - idx - 1))
        const dateKey = day.toISOString().slice(0, 10)
        const existing = chartPoints.find((point) => point.date === dateKey)
        return existing || { date: dateKey, orders: 0, revenue: 0 }
    })

    const visibleChartPoints = filledChartPoints.slice(-14)
    const maxOrdersValue = visibleChartPoints.reduce((max, p) => Math.max(max, p.orders), 0)
    const safeMaxOrders = maxOrdersValue > 0 ? maxOrdersValue : 1

    if (!activeTeam) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4">
                <Card><CardHeader><CardTitle>Выберите заведение</CardTitle></CardHeader></Card>
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
                            value={stats.total_orders.toString()}
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
                        {/* Orders Over Time */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="size-5" />
                                    Заказы за период
                                </CardTitle>
                                <CardDescription>Количество заказов и выручка по дням</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] flex items-end gap-2">
                                    {visibleChartPoints.length > 0 ? (
                                        visibleChartPoints.map((point, idx) => {
                                            const height = (point.orders / safeMaxOrders) * 100
                                            return (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                                    <div
                                                        className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                                                        style={{ height: `${Math.max(height, 5)}%` }}
                                                        title={`${point.orders} заказов, ${formatCurrency(point.revenue)}`}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                                                        {point.date.split("-").slice(1).join("/")}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                            Нет данных
                                        </div>
                                    )}
                                </div>
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
                                            canceled: "bg-red-500"
                                        }
                                        const labels: Record<string, string> = {
                                            pending: "В ожидании",
                                            cooking: "Готовится",
                                            ready: "Готово",
                                            courier: "У курьера",
                                            delivered: "Доставлено",
                                            canceled: "Отменено"
                                        }
                                        return (
                                            <div key={status} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span>{labels[status] || status}</span>
                                                    <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
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
                                    {stats.sales_by_category.length > 0 ? (
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
                                    {stats.sales_by_item.length > 0 ? (
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
                                    <div className="text-4xl font-bold text-primary mb-2">
                                        {formatMinutes(stats.dispatch_time_avg)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Среднее время отправки
                                    </div>
                                </div>
                                <div className="text-center p-6 bg-muted/50 rounded-xl">
                                    <div className="text-4xl font-bold text-primary mb-2">
                                        {formatMinutes(stats.delivery_time_avg)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Среднее время доставки
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-20 text-center text-muted-foreground">
                        Нет данных для отображения
                    </CardContent>
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
                    <div className={cn("p-3 rounded-xl text-white", color)}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
