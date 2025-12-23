"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Truck, ShoppingBag, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/show-error-toast";
import { restaurantService } from "@/services";

interface DeliveryMethodSettings {
    enabled: boolean;
    message: string;
    payment_methods: string[]; // "cash", "card"
    allow_asap: boolean;
    allow_scheduled: boolean;
    discount_percent?: number;
    asap_time_hint?: string;
    cost_info?: string;
}

interface DeliverySettingsData {
    delivery: DeliveryMethodSettings;
    pickup: DeliveryMethodSettings;
}

const defaultSettings: DeliverySettingsData = {
    delivery: {
        enabled: true,
        message: "",
        payment_methods: ["cash", "card", "transfer"],
        allow_asap: true,
        allow_scheduled: true,
        cost_info: "",
    },
    pickup: {
        enabled: true,
        message: "",
        payment_methods: ["cash", "card", "transfer"],
        allow_asap: true,
        allow_scheduled: true,
        discount_percent: 0,
        asap_time_hint: "",
    },
};

export default function DeliverySettings({ activeTeam }: { activeTeam: string }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null); // Full restaurant data
    const [settings, setSettings] = useState<DeliverySettingsData>(defaultSettings);

    const [editingMethod, setEditingMethod] = useState<"delivery" | "pickup" | null>(null);
    const [tempSettings, setTempSettings] = useState<DeliveryMethodSettings | null>(null);

    const fetchRestaurantData = useCallback(async () => {
        if (!activeTeam) return;
        setLoading(true);
        try {
            const restaurantData = await restaurantService.getRestaurant(activeTeam);
            setData(restaurantData);

            if (restaurantData.delivery_settings) {
                try {
                    const parsed = typeof restaurantData.delivery_settings === "string"
                        ? JSON.parse(restaurantData.delivery_settings)
                        : restaurantData.delivery_settings;
                    setSettings({ ...defaultSettings, ...parsed });
                } catch {
                    setSettings(defaultSettings);
                }
            } else {
                setSettings(defaultSettings);
            }
        } catch (err: any) {
            console.error(err);
            showErrorToast(
                err.detail || err.message || "Ошибка загрузки данных заведения"
            );
        } finally {
            setLoading(false);
        }
    }, [activeTeam]);

    useEffect(() => {
        fetchRestaurantData();
    }, [fetchRestaurantData]);

    const handleOpenSettings = (method: "delivery" | "pickup") => {
        setEditingMethod(method);
        setTempSettings({ ...settings[method] });
    };

    const handleSaveSettings = async () => {
        if (!editingMethod || !tempSettings) return;

        const newSettings = {
            ...settings,
            [editingMethod]: tempSettings,
        };

        setSettings(newSettings);
        setEditingMethod(null);
        setTempSettings(null);

        // Save to backend immediately
        try {
            await restaurantService.updateRestaurant(activeTeam, {
                ...data,
                delivery_settings: JSON.stringify(newSettings)
            });
            toast.success("Настройки сохранены");

            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("restaurant:updated", { detail: { team: activeTeam } })
                );
            }
        } catch (err: any) {
            console.error(err);
            showErrorToast(err.detail || err.message || "Ошибка сохранения");
            // Revert UI state logic could be added here, but for now we trust optimistic update or user retry
        }
    };

    const handleToggleEnable = async (method: "delivery" | "pickup", enabled: boolean) => {
        const newSettings = {
            ...settings,
            [method]: { ...settings[method], enabled }
        };
        setSettings(newSettings);

        try {
            await restaurantService.updateRestaurant(activeTeam, {
                ...data,
                delivery_settings: JSON.stringify(newSettings)
            });
            toast.success(`Способ ${enabled ? "включен" : "выключен"}`);
        } catch (err: any) {
            console.error(err);
            showErrorToast(err.detail || err.message || "Ошибка сохранения");
        }
    };

    if (loading || !data) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

            <div className="grid gap-4 md:grid-cols-2">
                {/* Delivery Card */}
                <Card className="flex flex-col h-full">
                    <CardContent className="flex flex-col justify-between p-6 h-full gap-4">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 rounded-lg bg-blue-50 p-3 shrink-0">
                                <Truck className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg">Доставка</h3>
                                    {settings.delivery.enabled ? (
                                        <span className="inline-flex items-center rounded-full border px-2 text-[10px] uppercase font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-500/10 text-green-600">
                                            вкл.
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full border px-2 text-[10px] uppercase font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-gray-100 text-gray-500">
                                            выкл.
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Клиент сможет заказать доставку курьером до двери.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t mt-auto">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="delivery-switch" className="text-sm font-medium cursor-pointer">
                                    {settings.delivery.enabled ? "Работает" : "Отключено"}
                                </Label>
                                <Switch
                                    id="delivery-switch"
                                    checked={settings.delivery.enabled}
                                    onCheckedChange={(checked) => handleToggleEnable("delivery", checked)}
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleOpenSettings("delivery")}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Настроить
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Pickup Card */}
                <Card className="flex flex-col h-full">
                    <CardContent className="flex flex-col justify-between p-6 h-full gap-4">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 rounded-lg bg-orange-50 p-3 shrink-0">
                                <ShoppingBag className="h-6 w-6 text-orange-600" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg">Самовывоз</h3>
                                    {settings.pickup.enabled ? (
                                        <span className="inline-flex items-center rounded-full border px-2 text-[10px] uppercase font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-500/10 text-green-600">
                                            вкл.
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full border px-2 text-[10px] uppercase font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-gray-100 text-gray-500">
                                            выкл.
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Клиент сможет самостоятельно забрать заказ из ресторана.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t mt-auto">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="pickup-switch" className="text-sm font-medium cursor-pointer">
                                    {settings.pickup.enabled ? "Работает" : "Отключено"}
                                </Label>
                                <Switch
                                    id="pickup-switch"
                                    checked={settings.pickup.enabled}
                                    onCheckedChange={(checked) => handleToggleEnable("pickup", checked)}
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleOpenSettings("pickup")}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Настроить
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings Dialog */}
            <Dialog open={!!editingMethod} onOpenChange={(open) => !open && setEditingMethod(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            Настройка: {editingMethod === "delivery" ? "Доставка" : "Самовывоз"}
                        </DialogTitle>
                        <DialogDescription>
                            Укажите параметры для этого способа получения заказа.
                        </DialogDescription>
                    </DialogHeader>

                    {tempSettings && (
                        <div className="grid gap-6 py-4">
                            {/* Message */}
                            <div className="space-y-2">
                                <Label>Сообщение для гостя</Label>
                                <Textarea
                                    placeholder="Например: Курьер позвонит за 15 минут до прибытия."
                                    value={tempSettings.message}
                                    onChange={(e) => setTempSettings({ ...tempSettings, message: e.target.value })}
                                />
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Это сообщение будет показано гостю при оформлении заказа.
                                </p>
                            </div>

                            {/* Payment Methods */}
                            <div className="space-y-3">
                                <Label>Способы оплаты</Label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="pm-cash"
                                            checked={tempSettings.payment_methods.includes("cash")}
                                            onCheckedChange={(checked) => {
                                                const newMethods = checked
                                                    ? [...tempSettings.payment_methods, "cash"]
                                                    : tempSettings.payment_methods.filter(m => m !== "cash");
                                                setTempSettings({ ...tempSettings, payment_methods: newMethods });
                                            }}
                                        />
                                        <Label htmlFor="pm-cash" className="font-normal cursor-pointer">
                                            Наличными
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="pm-card"
                                            checked={tempSettings.payment_methods.includes("card")}
                                            onCheckedChange={(checked) => {
                                                const newMethods = checked
                                                    ? [...tempSettings.payment_methods, "card"]
                                                    : tempSettings.payment_methods.filter(m => m !== "card");
                                                setTempSettings({ ...tempSettings, payment_methods: newMethods });
                                            }}
                                        />
                                        <Label htmlFor="pm-card" className="font-normal cursor-pointer">
                                            Картой при получении
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="pm-transfer"
                                            checked={tempSettings.payment_methods.includes("transfer")}
                                            onCheckedChange={(checked) => {
                                                const newMethods = checked
                                                    ? [...tempSettings.payment_methods, "transfer"]
                                                    : tempSettings.payment_methods.filter(m => m !== "transfer");
                                                setTempSettings({ ...tempSettings, payment_methods: newMethods });
                                            }}
                                        />
                                        <Label htmlFor="pm-transfer" className="font-normal cursor-pointer">
                                            Перевод по номеру
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            {/* Order Time */}
                            <div className="space-y-3">
                                <Label>Время заказа</Label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="time-asap"
                                            checked={tempSettings.allow_asap}
                                            onCheckedChange={(checked) =>
                                                setTempSettings({ ...tempSettings, allow_asap: !!checked })
                                            }
                                        />
                                        <Label htmlFor="time-asap" className="font-normal cursor-pointer">
                                            Как можно скорее
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="time-scheduled"
                                            checked={tempSettings.allow_scheduled}
                                            onCheckedChange={(checked) =>
                                                setTempSettings({ ...tempSettings, allow_scheduled: !!checked })
                                            }
                                        />
                                        <Label htmlFor="time-scheduled" className="font-normal cursor-pointer">
                                            Ко времени
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            {editingMethod === "pickup" && (
                                <div className="space-y-2">
                                    <Label>Время приготовления для «как можно скорее»</Label>
                                    <Input
                                        placeholder="Например: 15-20 минут"
                                        value={tempSettings.asap_time_hint || ""}
                                        onChange={(e) => setTempSettings({ ...tempSettings, asap_time_hint: e.target.value })}
                                    />
                                </div>
                            )}

                            {editingMethod === "delivery" && (
                                <div className="space-y-2">
                                    <Label>Информация о стоимости доставки</Label>
                                    <Textarea
                                        placeholder="Например: бесплатно от 1500 ₽, внутри КАД — 200 ₽"
                                        value={tempSettings.cost_info || ""}
                                        onChange={(e) => setTempSettings({ ...tempSettings, cost_info: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* Discount (Pickup only) */}
                            {editingMethod === "pickup" && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Скидка на самовывоз (%)</Label>
                                        <span className="text-xs text-muted-foreground">0 = выключено</span>
                                    </div>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={tempSettings.discount_percent || 0}
                                        onChange={(e) => setTempSettings({ ...tempSettings, discount_percent: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMethod(null)}>Отмена</Button>
                        <Button onClick={handleSaveSettings}>Сохранить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
