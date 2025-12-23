"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Filter, Eye, Clock, ChefHat, Package, Truck, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { showErrorToast } from "@/lib/show-error-toast"
import { orderService, Order } from "@/services"

const STATUS_LABELS: Record<string, string> = {
    pending: "В ожидании",
    cooking: "Готовится",
    ready: "Кухня сдала",
    courier: "Принят курьером",
    delivered: "Доставлен",
    canceled: "Отменён"
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Clock className="size-4" />,
    cooking: <ChefHat className="size-4" />,
    ready: <Package className="size-4" />,
    courier: <Truck className="size-4" />,
    delivered: <CheckCircle2 className="size-4" />,
    canceled: <XCircle className="size-4" />
}

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    cooking: "bg-orange-100 text-orange-800",
    ready: "bg-blue-100 text-blue-800",
    courier: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    canceled: "bg-red-100 text-red-800"
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr.replace(" ", "T"))
    return date.toLocaleString("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    })
}

function formatCurrency(amount: number | string, currency: string = "RUB"): string {
    const value = Number(amount)
    const safeValue = Number.isFinite(value) ? value : 0
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(safeValue)
}

const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export default function OrdersList({ activeTeam }: { activeTeam: string }) {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [updatingStatus, setUpdatingStatus] = useState(false)

    const loadOrders = useCallback(async () => {
        if (!activeTeam) return
        setLoading(true)
        try {
            const filters = {
                status: statusFilter !== "all" ? statusFilter : undefined,
                search: searchQuery || undefined
            }
            const data = await orderService.getOrders(activeTeam, filters)
            setOrders(data.orders || [])
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось загрузить заказы")
        } finally {
            setLoading(false)
        }
    }, [activeTeam, statusFilter, searchQuery])

    useEffect(() => {
        loadOrders()
    }, [loadOrders])

    const handleStatusChange = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(true)
        try {
            await orderService.updateOrderStatus(activeTeam, orderId, newStatus)
            toast.success("Статус обновлён")
            await loadOrders()
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : null)
            }
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось обновить статус")
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleCancelOrder = async (orderId: number) => {
        setUpdatingStatus(true)
        try {
            await orderService.cancelOrder(activeTeam, orderId)
            toast.success("Заказ отменён")
            await loadOrders()
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: 'canceled' } : null)
            }
        } catch (error: any) {
            showErrorToast(error.detail || "Не удалось отменить заказ")
        } finally {
            setUpdatingStatus(false)
        }
    }

    if (!activeTeam) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4">
                <Card><CardHeader><CardTitle>Выберите заведение</CardTitle></CardHeader></Card>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col xl:flex-row gap-6 p-4 xl:h-[calc(100vh-120px)]">
            {/* Orders List */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по номеру, имени, телефону..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[200px]">
                            <Filter className="size-4 mr-2" />
                            <SelectValue placeholder="Статус" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все статусы</SelectItem>
                            <SelectItem value="pending">В ожидании</SelectItem>
                            <SelectItem value="cooking">Готовится</SelectItem>
                            <SelectItem value="ready">Кухня сдала</SelectItem>
                            <SelectItem value="courier">Принят курьером</SelectItem>
                            <SelectItem value="delivered">Доставлен</SelectItem>
                            <SelectItem value="canceled">Отменён</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <Card className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">№</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead>К оплате</TableHead>
                                    <TableHead>Телефон</TableHead>
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Способ оплаты</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">
                                            <Loader2 className="size-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            Заказов пока нет
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className={`cursor-pointer hover:bg-muted/50 ${selectedOrder?.id === order.id ? "bg-muted" : ""}`}
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <TableCell className="font-medium">#{order.number}</TableCell>
                                            <TableCell>
                                                <Badge className={`${STATUS_COLORS[order.status]} gap-1`}>
                                                    {STATUS_ICONS[order.status]}
                                                    {STATUS_LABELS[order.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(order.amount, order.currency)}</TableCell>
                                            <TableCell>{order.customer_phone}</TableCell>
                                            <TableCell>{order.customer_name}</TableCell>
                                            <TableCell>{order.payment_method}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                                                    <Eye className="size-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </Card>
            </div>

            {/* Order Detail Panel */}
            {selectedOrder && (
                <Card className="w-full xl:w-[420px] max-w-full xl:shrink-0 flex flex-col overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">Заказ №{selectedOrder.number}</CardTitle>
                            <Badge className={STATUS_COLORS[selectedOrder.status]}>
                                {STATUS_LABELS[selectedOrder.status]}
                            </Badge>
                        </div>
                    </CardHeader>

                    <ScrollArea className="flex-1 max-h-[70vh] xl:max-h-[calc(100vh-240px)]">
                        <CardContent className="space-y-6">
                            {/* Dates */}
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Заказ создан:</span>
                                    <span>{formatDate(selectedOrder.created_at)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Последнее обновление:</span>
                                    <span>{formatDate(selectedOrder.updated_at)}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Delivery Info */}
                            <div>
                                <h4 className="font-semibold mb-3">Информация о доставке</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Способ доставки:</span>
                                        <span>{selectedOrder.delivery_method}</span>
                                    </div>
                                    {selectedOrder.delivery_time && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Время доставки:</span>
                                            <span>{selectedOrder.delivery_time}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Payment Info */}
                            <div>
                                <h4 className="font-semibold mb-3">Информация об оплате</h4>
                                <div className="text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Способ оплаты:</span>
                                        <span>{selectedOrder.payment_method}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Guest Info */}
                            <div>
                                <h4 className="font-semibold mb-3">Данные гостя</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Имя гостя:</span>
                                        <span>{selectedOrder.customer_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Номер телефона:</span>
                                        <span>{selectedOrder.customer_phone}</span>
                                    </div>
                                    {selectedOrder.delivery_address && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Адрес доставки:</span>
                                            <span className="text-right max-w-[200px]">{selectedOrder.delivery_address}</span>
                                        </div>
                                    )}
                                    {selectedOrder.delivery_zone && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Зона доставки:</span>
                                            <span>{selectedOrder.delivery_zone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedOrder.comment && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="font-semibold mb-2">Внутренний комментарий</h4>
                                        <p className="text-sm text-muted-foreground">{selectedOrder.comment || "—"}</p>
                                    </div>
                                </>
                            )}

                            <Separator />

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold mb-3">Позиции</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Название</TableHead>
                                            <TableHead className="text-center">Кол-во</TableHead>
                                            <TableHead className="text-right">Цена</TableHead>
                                            <TableHead className="text-right">Итого</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedOrder.items.map((item) => {
                                            const price = toNumber(item.price)
                                            const quantity = toNumber(item.quantity)
                                            const total = toNumber(item.total, price * quantity)

                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="whitespace-normal break-words max-w-[220px]">{item.name}</TableCell>
                                                    <TableCell className="text-center">{quantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Totals */}
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                                {(() => {
                                    const orderAmount = toNumber(selectedOrder.amount)
                                    const deliveryCost = toNumber(selectedOrder.delivery_cost)
                                    const itemsCost = Math.max(orderAmount - deliveryCost, 0)

                                    return (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Стоимость заказа:</span>
                                                <span>{formatCurrency(itemsCost)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Стоимость доставки:</span>
                                                <span>{formatCurrency(deliveryCost)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-bold text-base">
                                                <span>Итого:</span>
                                                <span>{formatCurrency(orderAmount)}</span>
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>

                            {/* Actions */}
                            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'canceled' && (
                                <div className="flex gap-3">
                                    {selectedOrder.status === 'pending' && (
                                        <Button className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, 'cooking')} disabled={updatingStatus}>
                                            Начать готовку
                                        </Button>
                                    )}
                                    {selectedOrder.status === 'cooking' && (
                                        <Button className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, 'ready')} disabled={updatingStatus}>
                                            Заказ готов
                                        </Button>
                                    )}
                                    {selectedOrder.status === 'ready' && (
                                        <Button className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, 'courier')} disabled={updatingStatus}>
                                            Передан курьеру
                                        </Button>
                                    )}
                                    {selectedOrder.status === 'courier' && (
                                        <Button className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, 'delivered')} disabled={updatingStatus}>
                                            Доставлен
                                        </Button>
                                    )}
                                    <Button variant="destructive" onClick={() => handleCancelOrder(selectedOrder.id)} disabled={updatingStatus}>
                                        Отменить
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </ScrollArea>
                </Card>
            )}
        </div>
    )
}
