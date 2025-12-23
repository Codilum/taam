"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Volume2, VolumeX, Bell, Package, Truck, ChefHat, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react"

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
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [archived, setArchived] = useState<Notification[]>([])
    const archivedRef = useRef<Notification[]>([])
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const prevCount = useRef<number>(0)

    const storageKey = activeTeam ? `taam_archived_notifications_${activeTeam}` : null

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

            const archivedIds = new Set(archivedRef.current.map(n => n.id))
            const incomingArchived = newNotifs.filter(n => archivedIds.has(n.id) || n.read)
            const fresh = newNotifs.filter(n => !archivedIds.has(n.id) && !n.read)

            setNotifications(fresh)
            if (incomingArchived.length > 0) {
                setArchived((prev) => {
                    const merged = [...prev]
                    incomingArchived.forEach((notif) => {
                        if (!merged.some((n) => n.id === notif.id)) {
                            merged.push({ ...notif, read: true })
                        }
                    })
                    return merged
                })
            }
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось загрузить уведомления")
        } finally {
            setLoading(false)
        }
    }, [activeTeam, soundEnabled])

    useEffect(() => {
        archivedRef.current = archived
    }, [archived])

    useEffect(() => {
        if (!storageKey) return
        try {
            const cached = localStorage.getItem(storageKey)
            if (cached) {
                setArchived(JSON.parse(cached))
            }
        } catch (error) {
            console.error("Не удалось загрузить архив уведомлений", error)
        }
    }, [storageKey])

    useEffect(() => {
        if (!storageKey) return
        localStorage.setItem(storageKey, JSON.stringify(archived))
    }, [archived, storageKey])

    useEffect(() => {
        loadNotifications()
    }, [loadNotifications])

    useEffect(() => {
        const interval = setInterval(loadNotifications, autoRefresh ? 10000 : 30000)
        return () => clearInterval(interval)
    }, [autoRefresh, loadNotifications])

    const toggleSound = () => {
        setSoundEnabled(prev => !prev)
    }

    const archiveNotification = (notif: Notification) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
        setArchived((prev) => prev.some((n) => n.id === notif.id) ? prev : [...prev, { ...notif, read: true }])
    }

    const markAllAsRead = () => {
        setArchived((prev) => {
            const archivedIds = new Set(prev.map((n) => n.id))
            const toArchive = notifications.filter((n) => !archivedIds.has(n.id)).map((n) => ({ ...n, read: true }))
            return [...prev, ...toArchive]
        })
        setNotifications([])
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
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadNotifications} disabled={loading}>
                        <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                        Обновить
                    </Button>
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh((prev) => !prev)}
                    >
                        <RefreshCw className={cn("size-4 mr-2", autoRefresh && "animate-spin")} />
                        Авто
                    </Button>
                    <Button
                        variant={soundEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={toggleSound}
                        className={soundEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {soundEnabled ? <Volume2 className="size-4 mr-2" /> : <VolumeX className="size-4 mr-2" />}
                        {soundEnabled ? "Звук" : "Включить звук"}
                    </Button>
                </div>
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
                                <div className="flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                                    <span>Новые уведомления</span>
                                    {notifications.length > 0 && (
                                        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8 px-2">
                                            Отметить все
                                        </Button>
                                    )}
                                </div>
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
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">Заказ #{notif.order_number}</span>
                                                {!notif.read && (
                                                    <Badge variant="default" className="text-xs">Новое</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{notif.message}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{formatTime(notif.created_at)}</span>
                                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => archiveNotification(notif)}>
                                                    В архив
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {archived.length > 0 && (
                                    <div className="bg-muted/30">
                                        <div className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">Архив</div>
                                        {archived.map((notif) => (
                                            <div key={`arch-${notif.id}`} className="flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground">
                                                <CheckCircle2 className="size-4 mt-0.5 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium">Заказ #{notif.order_number}</div>
                                                    <div className="line-clamp-2">{notif.message}</div>
                                                    <div className="text-xs mt-1">{formatTime(notif.created_at)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>
        </div>
    )
}
