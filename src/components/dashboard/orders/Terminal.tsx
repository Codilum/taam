"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Volume2, VolumeX, ChefHat, Package, Truck, Clock, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { showErrorToast } from "@/lib/show-error-toast"
import { orderService, Order } from "@/services"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
    pending: "В ожидании",
    cooking: "Готовится",
    ready: "Кухня сдала",
    courier: "У курьера"
}

const STATUS_COLORS: Record<string, string> = {
    pending: "border-yellow-400 bg-yellow-50",
    cooking: "border-orange-400 bg-orange-50",
    ready: "border-blue-400 bg-blue-50",
    courier: "border-purple-400 bg-purple-50"
}

const BADGE_COLORS: Record<string, string> = {
    pending: "bg-yellow-500 text-white",
    cooking: "bg-orange-500 text-white",
    ready: "bg-blue-500 text-white",
    courier: "bg-purple-500 text-white"
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr.replace(" ", "T"))
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

export default function Terminal({ activeTeam }: { activeTeam: string }) {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(false)
    const [updating, setUpdating] = useState<number | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const prevOrderCount = useRef<number>(0)

    const loadOrders = useCallback(async () => {
        if (!activeTeam) return
        setLoading(true)
        try {
            const data = await orderService.getActiveOrders(activeTeam)
            const newOrders = data.orders || []

            // Play sound if new orders appeared
            if (soundEnabled && newOrders.length > prevOrderCount.current && prevOrderCount.current > 0) {
                audioRef.current?.play()
            }
            prevOrderCount.current = newOrders.length

            setOrders(newOrders)
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось загрузить заказы")
        } finally {
            setLoading(false)
        }
    }, [activeTeam, soundEnabled])

    useEffect(() => {
        loadOrders()
        const interval = setInterval(loadOrders, 30000) // Poll every 30 seconds
        return () => clearInterval(interval)
    }, [loadOrders])

    const handleStatusChange = async (orderId: number, newStatus: string) => {
        setUpdating(orderId)
        try {
            await orderService.updateOrderStatus(activeTeam, orderId, newStatus)
            toast.success("Статус обновлён")
            await loadOrders()
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось обновить статус")
        } finally {
            setUpdating(null)
        }
    }

    const toggleSound = () => {
        setSoundEnabled(prev => !prev)
        if (!soundEnabled) {
            toast.success("Звуковые уведомления включены")
        }
    }

    if (!activeTeam) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4">
                <Card><CardHeader><CardTitle>Выберите заведение</CardTitle></CardHeader></Card>
            </div>
        )
    }

    // Group orders by status for Kanban-like view
    const ordersByStatus = {
        pending: orders.filter(o => o.status === 'pending'),
        cooking: orders.filter(o => o.status === 'cooking'),
        ready: orders.filter(o => o.status === 'ready'),
        courier: orders.filter(o => o.status === 'courier')
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            {/* Hidden audio element */}
            <audio ref={audioRef} src="/notification.mp3" preload="auto" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Терминал заказов</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
                        <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                        Обновить
                    </Button>
                    <Button
                        variant={soundEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={toggleSound}
                        className={soundEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {soundEnabled ? <Volume2 className="size-4 mr-2" /> : <VolumeX className="size-4 mr-2" />}
                        {soundEnabled ? "Звук вкл." : "Включить звук"}
                    </Button>
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
                {/* Pending */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2">
                        <Clock className="size-5 text-yellow-600" />
                        <span className="font-semibold">В ожидании</span>
                        <Badge variant="secondary">{ordersByStatus.pending.length}</Badge>
                    </div>
                    <div className="space-y-3 flex-1">
                        {ordersByStatus.pending.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                updating={updating === order.id}
                                nextStatus="cooking"
                                nextLabel="Начать готовку"
                            />
                        ))}
                    </div>
                </div>

                {/* Cooking */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2">
                        <ChefHat className="size-5 text-orange-600" />
                        <span className="font-semibold">Готовится</span>
                        <Badge variant="secondary">{ordersByStatus.cooking.length}</Badge>
                    </div>
                    <div className="space-y-3 flex-1">
                        {ordersByStatus.cooking.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                updating={updating === order.id}
                                nextStatus="ready"
                                nextLabel="Заказ готов"
                            />
                        ))}
                    </div>
                </div>

                {/* Ready */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2">
                        <Package className="size-5 text-blue-600" />
                        <span className="font-semibold">Кухня сдала</span>
                        <Badge variant="secondary">{ordersByStatus.ready.length}</Badge>
                    </div>
                    <div className="space-y-3 flex-1">
                        {ordersByStatus.ready.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                updating={updating === order.id}
                                nextStatus="courier"
                                nextLabel="Передать курьеру"
                            />
                        ))}
                    </div>
                </div>

                {/* Courier */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2">
                        <Truck className="size-5 text-purple-600" />
                        <span className="font-semibold">У курьера</span>
                        <Badge variant="secondary">{ordersByStatus.courier.length}</Badge>
                    </div>
                    <div className="space-y-3 flex-1">
                        {ordersByStatus.courier.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                updating={updating === order.id}
                                nextStatus="delivered"
                                nextLabel="Доставлен"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

interface OrderCardProps {
    order: Order
    onStatusChange: (orderId: number, status: string) => void
    updating: boolean
    nextStatus: string
    nextLabel: string
}

function OrderCard({ order, onStatusChange, updating, nextStatus, nextLabel }: OrderCardProps) {
    return (
        <Card className={cn("border-l-4 transition-all", STATUS_COLORS[order.status])}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">#{order.number}</CardTitle>
                    <span className="text-sm text-muted-foreground">{formatTime(order.created_at)}</span>
                </div>
                <CardDescription>{order.delivery_method} • {order.customer_name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Items */}
                <div className="space-y-1">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                        </div>
                    ))}
                </div>

                <Separator />

                {/* Action */}
                <Button
                    className="w-full"
                    size="sm"
                    onClick={() => onStatusChange(order.id, nextStatus)}
                    disabled={updating}
                >
                    {updating ? (
                        <><Loader2 className="size-4 mr-2 animate-spin" /> Обновляем...</>
                    ) : (
                        <><CheckCircle2 className="size-4 mr-2" /> {nextLabel}</>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
