"use client"

import { useState } from "react"
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { orderService } from "@/services"
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
    paymentMethod: 'cash' | 'card' | 'online'
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

    const handleFormChange = (field: keyof DeliveryForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmitOrder = async () => {
        if (!restaurantId) return
        setSubmitting(true)
        try {
            const res = await orderService.createOrder(restaurantId, {
                customer_name: form.name,
                customer_phone: form.phone,
                delivery_method: form.deliveryMethod,
                delivery_address: form.deliveryMethod === 'delivery' ? `${form.address}, ${form.apartment}` : null,
                delivery_zone: null,
                delivery_time: form.deliveryTime === 'asap' ? 'ASAP' : form.scheduledTime,
                payment_method: form.paymentMethod,
                items: cart.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
                comment: form.comment
            })
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

    const canProceedToCheckout = form.deliveryMethod !== undefined
    const canSubmitOrder = form.name && form.phone && (form.deliveryMethod === 'pickup' || form.address)

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
                                                    <RadioGroupItem value="delivery" id="delivery" />
                                                    <Label htmlFor="delivery" className="flex-1 cursor-pointer">
                                                        <span className="font-medium">Доставка</span>
                                                        <p className="text-sm text-muted-foreground">Курьер привезёт заказ</p>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="pickup" id="pickup" />
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
                                                    <RadioGroupItem value="asap" id="asap" />
                                                    <Label htmlFor="asap" className="cursor-pointer">Ближайшее</Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                                    <RadioGroupItem value="scheduled" id="scheduled" />
                                                    <Label htmlFor="scheduled" className="cursor-pointer">Ко времени</Label>
                                                </div>
                                            </RadioGroup>
                                            {form.deliveryTime === 'scheduled' && (
                                                <Input
                                                    type="time"
                                                    value={form.scheduledTime || ''}
                                                    onChange={(e) => handleFormChange('scheduledTime', e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="py-4">
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={() => setDeliveryStep('checkout')}
                                            disabled={!canProceedToCheckout}
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

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Имя *</Label>
                                                <Input
                                                    id="name"
                                                    placeholder="Ваше имя"
                                                    value={form.name}
                                                    onChange={(e) => handleFormChange('name', e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="phone">Телефон *</Label>
                                                <Input
                                                    id="phone"
                                                    type="tel"
                                                    placeholder="+7 999 123 45 67"
                                                    value={form.phone}
                                                    onChange={(e) => handleFormChange('phone', e.target.value)}
                                                />
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
                                                        />
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
                                                <RadioGroup
                                                    value={form.paymentMethod}
                                                    onValueChange={(v) => handleFormChange('paymentMethod', v)}
                                                >
                                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                                        <RadioGroupItem value="card" id="card" />
                                                        <Label htmlFor="card" className="cursor-pointer">Картой при получении</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                                        <RadioGroupItem value="cash" id="cash" />
                                                        <Label htmlFor="cash" className="cursor-pointer">Наличными</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                                        <RadioGroupItem value="online" id="online" />
                                                        <Label htmlFor="online" className="cursor-pointer">Онлайн</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="py-4 space-y-3">
                                        <div className="flex justify-between font-bold">
                                            <span>Итого:</span>
                                            <span>{formatCurrency(cart.total)}</span>
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
                                                <span>{form.deliveryTime === 'asap' ? 'Ближайшее' : form.scheduledTime}</span>
                                            </div>
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
                                                <span>{formatCurrency(cart.total)}</span>
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
