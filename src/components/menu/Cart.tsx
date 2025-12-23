"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { orderService, restaurantService } from "@/services"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CartState } from "@/hooks/useCart"
import { toast } from "sonner"

interface CartProps {
    cart: CartState
    subdomain: string
    restaurantName?: string
    restaurantId: number
}

type DeliveryStep = 'info' | 'checkout' | 'confirmation'

interface DeliveryForm {
    deliveryMethod: 'delivery' | 'pickup'
    deliveryTime: 'asap' | 'scheduled'
    scheduledTime?: string
    name: string
    phone: string
    address: string
    apartment: string
    comment: string
    paymentMethod: 'cash' | 'card' | 'online' | 'transfer'
}

interface DeliveryMethodSettings {
    enabled: boolean
    message: string
    payment_methods: string[]
    allow_asap: boolean
    allow_scheduled: boolean
    discount_percent?: number
    asap_time_hint?: string
    cost_info?: string
}

interface DeliverySettingsData {
    delivery: DeliveryMethodSettings
    pickup: DeliveryMethodSettings
}

const defaultDeliverySettings: DeliverySettingsData = {
    delivery: {
        enabled: true,
        message: "",
        payment_methods: ["cash", "card", "online", "transfer"],
        allow_asap: true,
        allow_scheduled: true,
        cost_info: "",
    },
    pickup: {
        enabled: true,
        message: "",
        payment_methods: ["cash", "card", "online", "transfer"],
        allow_asap: true,
        allow_scheduled: true,
        discount_percent: 0,
        asap_time_hint: "",
    },
}

const paymentLabels: Record<DeliveryForm['paymentMethod'], string> = {
    card: 'Картой при получении',
    cash: 'Наличными',
    online: 'Онлайн',
    transfer: 'Перевод по номеру',
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(amount)
}

export default function Cart({ cart, subdomain, restaurantName, restaurantId }: CartProps) {
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'delivery'>('list')
    const [deliveryStep, setDeliveryStep] = useState<DeliveryStep>('info')
    const [submitting, setSubmitting] = useState(false)
    const [orderNumber, setOrderNumber] = useState<string | null>(null)
    const [lastOrderTotal, setLastOrderTotal] = useState<number | null>(null)
    const [lastOrderDiscount, setLastOrderDiscount] = useState<number>(0)
    const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsData>(defaultDeliverySettings)
    const [errors, setErrors] = useState<{ name?: string; phone?: string; address?: string; scheduledTime?: string }>({})

    const [form, setForm] = useState<DeliveryForm>({
        deliveryMethod: 'delivery',
        deliveryTime: 'asap',
        name: '',
        phone: '',
        address: '',
        apartment: '',
        comment: '',
        paymentMethod: 'card'
    })

    const methodSettings = deliverySettings[form.deliveryMethod]

    useEffect(() => {
        if (!open) {
            setDeliveryStep('info')
            setActiveTab('list')
        }
    }, [open])

    useEffect(() => {
        if (activeTab === 'delivery' && deliveryStep !== 'confirmation') {
            setDeliveryStep('info')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    useEffect(() => {
        async function loadDeliverySettings() {
            try {
                const restaurant = await restaurantService.getBySubdomain(subdomain)
                const rawSettings = restaurant?.delivery_settings
                let parsedSettings: any = null

                if (rawSettings) {
                    try {
                        parsedSettings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings
                    } catch (error) {
                        console.error('Не удалось разобрать delivery_settings', error)
                    }
                }

                const merged: DeliverySettingsData = {
                    delivery: { ...defaultDeliverySettings.delivery, ...(parsedSettings?.delivery || {}) },
                    pickup: { ...defaultDeliverySettings.pickup, ...(parsedSettings?.pickup || {}) },
                }

                setDeliverySettings(merged)
                setForm(prev => {
                    const preferredMethod: DeliveryForm['deliveryMethod'] = merged[prev.deliveryMethod].enabled
                        ? prev.deliveryMethod
                        : (merged.delivery.enabled ? 'delivery' : 'pickup')
                    const allowedPayments = merged[preferredMethod].payment_methods || []
                    const nextPayment = allowedPayments.includes(prev.paymentMethod)
                        ? prev.paymentMethod
                        : (allowedPayments[0] as DeliveryForm['paymentMethod'] | undefined) || 'card'
                    const nextTime = prev.deliveryTime === 'scheduled' && !merged[preferredMethod].allow_scheduled
                        ? 'asap'
                        : prev.deliveryTime === 'asap' && !merged[preferredMethod].allow_asap
                            ? 'scheduled'
                            : prev.deliveryTime

                    return { ...prev, deliveryMethod: preferredMethod, paymentMethod: nextPayment, deliveryTime: nextTime }
                })
            } catch (error) {
                console.error('Не удалось загрузить способы доставки', error)
                setDeliverySettings(defaultDeliverySettings)
            }
        }

        loadDeliverySettings()
    }, [subdomain])

    const handleFormChange = (field: keyof DeliveryForm, value: string) => {
        setForm(prev => {
            if (field === 'deliveryMethod') {
                const method = value as DeliveryForm['deliveryMethod']
                const allowedPayments = deliverySettings[method].payment_methods || []
                const nextPayment = allowedPayments.includes(prev.paymentMethod)
                    ? prev.paymentMethod
                    : (allowedPayments[0] as DeliveryForm['paymentMethod'] | undefined) || 'card'
                const nextTime = prev.deliveryTime === 'scheduled' && !deliverySettings[method].allow_scheduled
                    ? 'asap'
                    : prev.deliveryTime === 'asap' && !deliverySettings[method].allow_asap
                        ? 'scheduled'
                        : prev.deliveryTime

                return { ...prev, deliveryMethod: method, paymentMethod: nextPayment, deliveryTime: nextTime }
            }

            if (field === 'deliveryTime') {
                const time = value as DeliveryForm['deliveryTime']
                const nextScheduled = time === 'scheduled' ? prev.scheduledTime : ''
                return { ...prev, deliveryTime: time, scheduledTime: nextScheduled }
            }

            if (field === 'paymentMethod') {
                const payment = value as DeliveryForm['paymentMethod']
                return { ...prev, paymentMethod: payment }
            }

            return { ...prev, [field]: value }
        })

        setErrors(prev => ({ ...prev, [field]: undefined }))
    }

    const handleSubmitOrder = async () => {
        if (!restaurantId) return

        const name = form.name.trim()
        const phone = form.phone.trim()
        const address = form.address.trim()
        const apartment = form.apartment.trim()
        const deliveryAddress = form.deliveryMethod === 'delivery' ? [address, apartment].filter(Boolean).join(', ') : null
        const timeIsValid = form.deliveryTime === 'asap' ? methodSettings.allow_asap : (methodSettings.allow_scheduled && !!form.scheduledTime)

        if (!methodSettings.enabled) {
            toast.error('Этот способ сейчас недоступен')
            return
        }

        const nextErrors: typeof errors = {}
        if (!name) nextErrors.name = 'Введите имя'
        if (!phone) nextErrors.phone = 'Введите телефон'
        if (form.deliveryMethod === 'delivery' && !address) nextErrors.address = 'Введите адрес доставки'
        if (!timeIsValid) nextErrors.scheduledTime = 'Укажите время получения'

        if (!methodSettings.enabled || cart.items.length === 0) {
            toast.error('Заполните обязательные поля и выберите время доставки')
            return
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors)
            toast.error('Заполните обязательные поля и выберите время доставки')
            setDeliveryStep('checkout')
            return
        }

        setErrors({})

        const discountPercent = form.deliveryMethod === 'pickup' ? methodSettings.discount_percent || 0 : 0
        const discountAmount = Math.round(cart.total * (discountPercent / 100))
        const payableTotal = Math.max(cart.total - discountAmount, 0)
        const deliveryNotes: string[] = []

        if (form.deliveryMethod === 'delivery' && methodSettings.cost_info) {
            deliveryNotes.push(`Доставка: ${methodSettings.cost_info}`)
        }
        if (form.deliveryMethod === 'pickup' && discountPercent > 0) {
            deliveryNotes.push(`Скидка на самовывоз: ${discountPercent}% (${formatCurrency(discountAmount)})`)
        }
        if (form.deliveryTime === 'asap') {
            deliveryNotes.push(`Время получения: как можно скорее${methodSettings.asap_time_hint ? ` (${methodSettings.asap_time_hint})` : ''}`)
        }
        if (form.deliveryTime === 'scheduled' && form.scheduledTime) {
            deliveryNotes.push(`Время получения: ${form.scheduledTime}`)
        }

        setSubmitting(true)
        try {
            const res = await orderService.createOrder(restaurantId, {
                customer_name: name,
                customer_phone: phone,
                delivery_method: form.deliveryMethod,
                delivery_address: deliveryAddress,
                delivery_zone: null,
                delivery_time: form.deliveryTime === 'asap' ? 'ASAP' : form.scheduledTime,
                payment_method: form.paymentMethod,
                items: cart.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
                comment: [form.comment, deliveryNotes.join('; ')].filter(Boolean).join('\n'),
            })
            setLastOrderDiscount(discountAmount)
            setLastOrderTotal(payableTotal)
            setOrderNumber(res.order_number)
            setDeliveryStep('confirmation')
            cart.clearCart()
        } catch (error: any) {
            console.error(error)
            toast.error(error.detail || "Ошибка при оформлении заказа")
        } finally {
            setSubmitting(false)
        }
    }

    const handleNewOrder = () => {
        cart.clearCart()
        setDeliveryStep('info')
        setActiveTab('list')
        setOrderNumber(null)
        setLastOrderTotal(null)
        setLastOrderDiscount(0)
        setForm({
            deliveryMethod: 'delivery',
            deliveryTime: 'asap',
            name: '',
            phone: '',
            address: '',
            apartment: '',
            comment: '',
            paymentMethod: 'card'
        })
    }

    const trimmedName = form.name.trim()
    const trimmedPhone = form.phone.trim()
    const trimmedAddress = form.address.trim()
    const discountPercent = form.deliveryMethod === 'pickup' ? methodSettings.discount_percent || 0 : 0
    const discountAmount = Math.round(cart.total * (discountPercent / 100))
    const payableTotal = Math.max(cart.total - discountAmount, 0)
    const timeIsValid = form.deliveryTime === 'asap'
        ? methodSettings.allow_asap
        : (methodSettings.allow_scheduled && !!form.scheduledTime)
    const hasTimeOption = methodSettings.allow_asap || methodSettings.allow_scheduled
    const availablePayments = methodSettings.payment_methods || []
    const canProceedToCheckout = methodSettings.enabled && hasTimeOption && cart.items.length > 0
    const canGoToCheckout = canProceedToCheckout && timeIsValid
    const canSubmitOrder = Boolean(
        methodSettings.enabled &&
        trimmedName &&
        trimmedPhone &&
        timeIsValid &&
        cart.items.length > 0 &&
        availablePayments.length > 0 &&
        (form.deliveryMethod === 'pickup' || trimmedAddress)
    )
    const timeLabel = form.deliveryTime === 'asap'
        ? (methodSettings.asap_time_hint ? `Как можно скорее (${methodSettings.asap_time_hint})` : 'Как можно скорее')
        : form.scheduledTime || 'Ко времени'
    const displayedTotal = lastOrderTotal ?? payableTotal
    const isPickupDiscounted = form.deliveryMethod === 'pickup' && discountPercent > 0
    const confirmationDiscount = lastOrderDiscount || discountAmount
    const fieldErrorClass = (field: keyof typeof errors) => errors[field] ? 'border-red-500 focus-visible:ring-red-500' : ''

    const handleGoToCheckout = () => {
        if (!timeIsValid) {
            setErrors(prev => ({ ...prev, scheduledTime: !form.scheduledTime && form.deliveryTime === 'scheduled' ? 'Укажите время получения' : prev.scheduledTime }))
            toast.error('Укажите время получения')
            return
        }
        setDeliveryStep('checkout')
    }

    return (
        <>
            {/* Floating Cart Button */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                        size="icon"
                    >
                        <ShoppingCart className="h-6 w-6" />
                        {cart.itemCount > 0 && (
                            <Badge
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                                variant="destructive"
                            >
                                {cart.itemCount}
                            </Badge>
                        )}
                    </Button>
                </SheetTrigger>

                <SheetContent className="w-full sm:max-w-lg flex flex-col">
                    <SheetHeader>
                        <SheetTitle>Корзина</SheetTitle>
                    </SheetHeader>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'delivery')} className="flex-1 flex flex-col mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="list">Список</TabsTrigger>
                            <TabsTrigger value="delivery" disabled={cart.items.length === 0}>
                                Доставка
                            </TabsTrigger>
                        </TabsList>

                        {/* List Tab */}
                        <TabsContent value="list" className="flex-1 flex flex-col">
                            {cart.items.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                    <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                                    <p>Корзина пуста</p>
                                    <p className="text-sm">Добавьте блюда из меню</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-auto space-y-3 py-4">
                                        {cart.items.map(item => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{item.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatCurrency(item.price)} × {item.quantity}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => cart.removeItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Separator />

                                    <div className="py-4 space-y-4">
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Итого:</span>
                                            <span>{formatCurrency(cart.total)}</span>
                                        </div>
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={() => setActiveTab('delivery')}
                                        >
                                            Оформить заказ
                                        </Button>
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        {/* Delivery Tab */}
                        <TabsContent value="delivery" className="flex-1 flex flex-col">
                            {/* Step 1: Delivery Info */}
                            {deliveryStep === 'info' && (
                                <div className="flex-1 flex flex-col">
                                    <div className="flex-1 overflow-auto py-4 space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold">Способ получения</Label>
                                            <RadioGroup
                                                value={form.deliveryMethod}
                                                onValueChange={(v) => handleFormChange('deliveryMethod', v)}
                                            >
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="delivery" id="delivery" disabled={!deliverySettings.delivery.enabled} />
                                                    <Label htmlFor="delivery" className="flex-1 cursor-pointer">
                                                        <span className="font-medium">Доставка</span>
                                                        <p className="text-sm text-muted-foreground">Курьер привезёт заказ</p>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="pickup" id="pickup" disabled={!deliverySettings.pickup.enabled} />
                                                    <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                                                        <span className="font-medium">Самовывоз</span>
                                                        <p className="text-sm text-muted-foreground">Заберите сами</p>
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold">Время</Label>
                                            <RadioGroup
                                                value={form.deliveryTime}
                                                onValueChange={(v) => handleFormChange('deliveryTime', v)}
                                            >
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="asap" id="asap" disabled={!methodSettings.allow_asap} />
                                                    <Label htmlFor="asap" className="cursor-pointer">Ближайшее</Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="scheduled" id="scheduled" disabled={!methodSettings.allow_scheduled} />
                                                    <Label htmlFor="scheduled" className="cursor-pointer">Ко времени</Label>
                                                </div>
                                            </RadioGroup>
                                            {form.deliveryTime === 'scheduled' && (
                                                <Input
                                                    type="time"
                                                    value={form.scheduledTime || ''}
                                                    onChange={(e) => handleFormChange('scheduledTime', e.target.value)}
                                                    className={cn(fieldErrorClass('scheduledTime'))}
                                                />
                                            )}
                                            {errors.scheduledTime && <p className="text-xs text-red-500">{errors.scheduledTime}</p>}
                                            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {form.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}
                                                    </span>
                                                    {isPickupDiscounted && (
                                                        <Badge variant="secondary">Скидка {discountPercent}%</Badge>
                                                    )}
                                                </div>
                                                {methodSettings.message && (
                                                    <p className="text-muted-foreground leading-snug">{methodSettings.message}</p>
                                                )}
                                                {form.deliveryMethod === 'delivery' && methodSettings.cost_info && (
                                                    <p className="text-muted-foreground leading-snug">Стоимость: {methodSettings.cost_info}</p>
                                                )}
                                                {form.deliveryMethod === 'pickup' && methodSettings.asap_time_hint && form.deliveryTime === 'asap' && (
                                                    <p className="text-muted-foreground leading-snug">Готовность: {methodSettings.asap_time_hint}</p>
                                                )}
                                                <p className="text-muted-foreground leading-snug">Время: {timeLabel}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="py-4">
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={handleGoToCheckout}
                                            disabled={!canGoToCheckout}
                                        >
                                            Далее <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Checkout Form */}
                            {deliveryStep === 'checkout' && (
                                <div className="flex-1 flex flex-col">
                                    <div className="flex-1 overflow-auto py-4 space-y-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeliveryStep('info')}
                                            className="-ml-2"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
                                        </Button>

                                        <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-base">
                                                    {form.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}
                                                </span>
                                                {isPickupDiscounted && (
                                                    <Badge variant="secondary">Скидка {discountPercent}%</Badge>
                                                )}
                                            </div>
                                            {methodSettings.message && (
                                                <p className="text-muted-foreground leading-snug">{methodSettings.message}</p>
                                            )}
                                            <div className="flex justify-between">
                                                <span>Время получения</span>
                                                <span className="font-medium">{timeLabel}</span>
                                            </div>
                                            {form.deliveryMethod === 'delivery' && methodSettings.cost_info && (
                                                <div className="flex justify-between">
                                                    <span>Доставка</span>
                                                    <span className="font-medium">{methodSettings.cost_info}</span>
                                                </div>
                                            )}
                                            {isPickupDiscounted && (
                                                <div className="flex justify-between text-green-700 dark:text-green-500">
                                                    <span>Скидка за самовывоз</span>
                                                    <span>-{formatCurrency(discountAmount)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                            <Label htmlFor="name">Имя *</Label>
                                            <Input
                                                id="name"
                                                placeholder="Ваше имя"
                                                value={form.name}
                                                onChange={(e) => handleFormChange('name', e.target.value)}
                                                className={cn(fieldErrorClass('name'))}
                                                />
                                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Телефон *</Label>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                placeholder="+7 999 123 45 67"
                                                value={form.phone}
                                                onChange={(e) => handleFormChange('phone', e.target.value)}
                                                className={cn(fieldErrorClass('phone'))}
                                                />
                                            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                                        </div>

                                        {form.deliveryMethod === 'delivery' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="address">Адрес доставки *</Label>
                                                    <Input
                                                        id="address"
                                                        placeholder="Улица, дом"
                                                        value={form.address}
                                                        onChange={(e) => handleFormChange('address', e.target.value)}
                                                        className={cn(fieldErrorClass('address'))}
                                                        />
                                                    {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
                                                </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="apartment">Квартира/офис</Label>
                                                        <Input
                                                            id="apartment"
                                                            placeholder="Кв. / Офис"
                                                            value={form.apartment}
                                                            onChange={(e) => handleFormChange('apartment', e.target.value)}
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div className="space-y-2">
                                                <Label htmlFor="comment">Комментарий</Label>
                                                <Textarea
                                                    id="comment"
                                                    placeholder="Пожелания к заказу..."
                                                    value={form.comment}
                                                    onChange={(e) => handleFormChange('comment', e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-base font-semibold">Способ оплаты</Label>
                                                {availablePayments.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">Для выбранного способа нет доступных оплат</p>
                                                ) : (
                                                    <RadioGroup
                                                        value={form.paymentMethod}
                                                        onValueChange={(v) => handleFormChange('paymentMethod', v)}
                                                    >
                                                        {availablePayments.map((method) => (
                                                            <div key={method} className="flex items-center space-x-3 p-3 border rounded-lg">
                                                                <RadioGroupItem value={method} id={`pay-${method}`} />
                                                                <Label htmlFor={`pay-${method}`} className="cursor-pointer">
                                                                    {paymentLabels[method as DeliveryForm['paymentMethod']] || method}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="py-4 space-y-3">
                                        <div className="space-y-1 text-sm text-muted-foreground">
                                            <div className="flex justify-between">
                                                <span>Способ:</span>
                                                <span>{form.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Время:</span>
                                                <span>{timeLabel}</span>
                                            </div>
                                            {form.deliveryMethod === 'delivery' && methodSettings.cost_info && (
                                                <div className="flex justify-between">
                                                    <span>Доставка:</span>
                                                    <span>{methodSettings.cost_info}</span>
                                                </div>
                                            )}
                                            {isPickupDiscounted && (
                                                <div className="flex justify-between">
                                                    <span>Скидка на самовывоз:</span>
                                                    <span>{discountPercent}%</span>
                                                </div>
                                            )}
                                        </div>
                                        <Separator />
                                        {isPickupDiscounted && (
                                            <div className="flex justify-between text-sm">
                                                <span>Скидка</span>
                                                <span>-{formatCurrency(discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold">
                                            <span>Итого:</span>
                                            <span>{formatCurrency(payableTotal)}</span>
                                        </div>
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={handleSubmitOrder}
                                            disabled={!canSubmitOrder || submitting}
                                        >
                                            {submitting ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Оформляем...</>
                                            ) : (
                                                <>Оформить заказ</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Confirmation */}
                            {deliveryStep === 'confirmation' && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                                        <Check className="h-10 w-10 text-green-600" />
                                    </div>

                                    <h2 className="text-2xl font-bold mb-2">Заказ принят!</h2>
                                    <p className="text-muted-foreground mb-6">
                                        Номер заказа: <span className="font-bold">#{orderNumber}</span>
                                    </p>

                                    <Card className="w-full text-left">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Детали заказа</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Способ:</span>
                                                <span>{form.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Время:</span>
                                                <span>{timeLabel}</span>
                                            </div>
                                            {form.deliveryMethod === 'delivery' && methodSettings.cost_info && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Доставка:</span>
                                                    <span>{methodSettings.cost_info}</span>
                                                </div>
                                            )}
                                            {isPickupDiscounted && confirmationDiscount > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Скидка:</span>
                                                    <span>-{formatCurrency(confirmationDiscount)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Имя:</span>
                                                <span>{form.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Телефон:</span>
                                                <span>{form.phone}</span>
                                            </div>
                                            {form.address && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Адрес:</span>
                                                    <span className="text-right">{form.address}{form.apartment && `, ${form.apartment}`}</span>
                                                </div>
                                            )}
                                            <Separator />
                                            <div className="flex justify-between font-bold">
                                                <span>Сумма:</span>
                                                <span>{formatCurrency(displayedTotal)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Button
                                        className="w-full mt-6"
                                        variant="outline"
                                        onClick={handleNewOrder}
                                    >
                                        Новый заказ
                                    </Button>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>
        </>
    )
}
