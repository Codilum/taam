"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Volume2, VolumeX, Bell, Package, Truck, ChefHat, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { showErrorToast } from "@/lib/show-error-toast"
import { orderService } from "@/services"
import { cn } from "@/lib/utils"

interface Notification {
    id: number
    type: 'new_order' | 'status_change' | 'canceled'
    order_number: string
    message: string
    created_at: string
    read: boolean
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
    new_order: <Package className="size-5 text-green-600" />,
    status_change: <ChefHat className="size-5 text-blue-600" />,
    canceled: <XCircle className="size-5 text-red-600" />
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr.replace(" ", "T"))
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "только что"
    if (diffMins < 60) return `${diffMins} мин. назад`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} ч. назад`

    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function Notifications({ activeTeam }: { activeTeam: string }) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const prevCount = useRef<number>(0)

    const loadNotifications = useCallback(async () => {
        if (!activeTeam) return
        setLoading(true)
        try {
            const data = await orderService.getNotifications(activeTeam)
            const newNotifs = data.notifications || []

            // Play sound if new notifications
            if (soundEnabled && newNotifs.length > prevCount.current && prevCount.current > 0) {
                audioRef.current?.play()
            }
            prevCount.current = newNotifs.length

            setNotifications(newNotifs)
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось загрузить уведомления")
        } finally {
            setLoading(false)
        }
    }, [activeTeam, soundEnabled])

    useEffect(() => {
        loadNotifications()
        const interval = setInterval(loadNotifications, 30000)
        return () => clearInterval(interval)
    }, [loadNotifications])

    const toggleSound = () => {
        setSoundEnabled(prev => !prev)
    }

    if (!activeTeam) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4">
                <Card><CardHeader><CardTitle>Выберите заведение</CardTitle></CardHeader></Card>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
            {/* Hidden audio element */}
            <audio ref={audioRef} src="/notification.mp3" preload="auto" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bell className="size-6" />
                    <h1 className="text-2xl font-bold">Уведомления</h1>
                </div>
                <Button
                    variant={soundEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={toggleSound}
                    className={soundEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                >
                    {soundEnabled ? <Volume2 className="size-4 mr-2" /> : <VolumeX className="size-4 mr-2" />}
                    {soundEnabled ? "Звук вкл." : "Включить звуковой сигнал"}
                </Button>
            </div>

            {/* Notifications List */}
            <Card className="flex-1">
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <CardContent className="p-0">
                        {loading && notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Bell className="size-12 mb-4 opacity-50" />
                                <p>Уведомлений пока нет</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={cn(
                                            "flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors",
                                            !notif.read && "bg-primary/5"
                                        )}
                                    >
                                        <div className="mt-1">
                                            {NOTIFICATION_ICONS[notif.type] || <Bell className="size-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold">Заказ #{notif.order_number}</span>
                                                {!notif.read && (
                                                    <Badge variant="default" className="text-xs">Новое</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{notif.message}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatTime(notif.created_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>
        </div>
    )
}
