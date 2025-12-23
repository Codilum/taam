"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Clock, Truck } from "lucide-react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/show-error-toast";
import { restaurantService } from "@/services";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ScheduleItem {
    startDay: string;
    endDay: string;
    open: string;
    close: string;
    breakStart: string;
    breakEnd: string;
}

export default function WorkingHours({ activeTeam }: { activeTeam: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Hours state
    const [restaurantHours, setRestaurantHours] = useState<ScheduleItem[]>([
        { startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
    ]);
    const [deliveryHours, setDeliveryHours] = useState<ScheduleItem[]>([
        { startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
    ]);

    const daysOptions = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const parseHours = (hoursString: any): ScheduleItem[] => {
        if (!hoursString) {
            return [{ startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" }];
        }

        try {
            const parsed = JSON.parse(hoursString);
            if (Array.isArray(parsed)) {
                return parsed.map((h: any) => ({
                    startDay: h.days?.split("-")[0] || "Пн",
                    endDay: h.days?.split("-")[1] || h.days?.split("-")[0] || "Пн",
                    open: h.open || "",
                    close: h.close || "",
                    breakStart: h.breakStart || "",
                    breakEnd: h.breakEnd || "",
                }));
            }
        } catch {
            // Fallback for simple string format "09:00-18:00"
            if (typeof hoursString === "string") {
                const [open, close] = hoursString.split("-") ?? ["", ""];
                return [{ startDay: "Пн", endDay: "Вс", open: open || "", close: close || "", breakStart: "", breakEnd: "" }];
            }
        }

        return [{ startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" }];
    }

    const fetchRestaurantData = useCallback(async () => {
        if (!activeTeam) return;
        setLoading(true);
        try {
            const restaurantData = await restaurantService.getRestaurant(activeTeam);
            setData(restaurantData);
            setRestaurantHours(parseHours(restaurantData.hours));
            setDeliveryHours(parseHours(restaurantData.delivery_hours));
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

    // Generic helper for updating hours list
    const updateSchedule = (
        list: ScheduleItem[],
        setList: (val: ScheduleItem[]) => void,
        index: number,
        field: keyof ScheduleItem,
        value: string
    ) => {
        setList(list.map((item, i) => {
            if (i === index) {
                const updated = { ...item, [field]: value };
                if (field === "startDay" && daysOptions.indexOf(value) > daysOptions.indexOf(item.endDay)) {
                    updated.endDay = value;
                }
                // Basic validation logic
                if (field === "open" && item.close && value >= item.close) return item;
                if (field === "close" && item.open && value <= item.open) return item;
                if (field === "breakStart" && item.breakEnd && value >= item.breakEnd) return item;
                if (field === "breakEnd" && item.breakStart && value <= item.breakStart) return item;
                return updated;
            }
            return item;
        }));
    };

    const addScheduleItem = (setList: React.Dispatch<React.SetStateAction<ScheduleItem[]>>) => {
        setList(prev => [...prev, { startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" }]);
    };

    const removeScheduleItem = (list: ScheduleItem[], setList: (val: ScheduleItem[]) => void, index: number) => {
        if (list.length > 1) {
            setList(list.filter((_, i) => i !== index));
        }
    };

    const clearBreak = (list: ScheduleItem[], setList: (val: ScheduleItem[]) => void, index: number) => {
        setList(list.map((item, i) =>
            i === index ? { ...item, breakStart: "", breakEnd: "" } : item
        ));
    };

    const handleSave = async () => {
        if (!data) return;

        const formatForSave = (list: ScheduleItem[]) => JSON.stringify(
            list.filter(h => h.open && h.close).map(h => ({
                days: h.startDay === h.endDay ? h.startDay : `${h.startDay}-${h.endDay}`,
                open: h.open,
                close: h.close,
                breakStart: h.breakStart,
                breakEnd: h.breakEnd,
            }))
        );

        try {
            await restaurantService.updateRestaurant(activeTeam, {
                ...data,
                hours: formatForSave(restaurantHours),
                delivery_hours: formatForSave(deliveryHours),
            });
            toast.success("График работы сохранен");

            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("restaurant:updated", { detail: { team: activeTeam } })
                );
            }
        } catch (err: any) {
            console.error(err);
            showErrorToast(err.detail || err.message || "Ошибка при сохранении");
        }
    };

    const renderScheduleEditor = (
        list: ScheduleItem[],
        setList: React.Dispatch<React.SetStateAction<ScheduleItem[]>>
    ) => (
        <div className="space-y-4">
            {list.map((item, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-4 bg-card">
                    <div className="flex flex-wrap items-end gap-6">
                        {/* Days Range */}
                        <div className="space-y-2">
                            <Label>Дни недели</Label>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={item.startDay}
                                    onValueChange={(val) => updateSchedule(list, setList, index, "startDay", val)}
                                >
                                    <SelectTrigger className="w-[80px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {daysOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">-</span>
                                <Select
                                    value={item.endDay}
                                    onValueChange={(val) => updateSchedule(list, setList, index, "endDay", val)}
                                >
                                    <SelectTrigger className="w-[80px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {daysOptions.map((d, i) => (
                                            <SelectItem
                                                key={d}
                                                value={d}
                                                disabled={daysOptions.indexOf(d) < daysOptions.indexOf(item.startDay)}
                                            >
                                                {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Open Hours */}
                        <div className="space-y-2">
                            <Label>Время работы</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    value={item.open}
                                    onChange={(e) => updateSchedule(list, setList, index, "open", e.target.value)}
                                    className="w-[100px]"
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="time"
                                    value={item.close}
                                    onChange={(e) => updateSchedule(list, setList, index, "close", e.target.value)}
                                    className="w-[100px]"
                                />
                            </div>
                        </div>

                        {/* Delete Row Button */}
                        {list.length > 1 && (
                            <div className="pb-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => removeScheduleItem(list, setList, index)}
                                    title="Удалить"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Удалить</span>
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Breaks */}
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        {(!item.breakStart && !item.breakEnd) ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground"
                                onClick={() => updateSchedule(list, setList, index, "breakStart", "13:00")}
                            >
                                <Plus className="mr-1 h-3 w-3" />
                                Добавить перерыв
                            </Button>
                        ) : (
                            <div className="flex items-center gap-4 bg-muted/50 rounded-md px-3 py-2">
                                <span className="text-xs font-medium text-muted-foreground">Перерыв:</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="time"
                                        value={item.breakStart}
                                        onChange={(e) => updateSchedule(list, setList, index, "breakStart", e.target.value)}
                                        className="w-[90px] h-8 text-sm"
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input
                                        type="time"
                                        value={item.breakEnd}
                                        onChange={(e) => updateSchedule(list, setList, index, "breakEnd", e.target.value)}
                                        className="w-[90px] h-8 text-sm"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => clearBreak(list, setList, index)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            <Button variant="outline" className="w-full border-dashed" onClick={() => addScheduleItem(setList)}>
                <Plus className="mr-2 h-4 w-4" /> Добавить
            </Button>
        </div>
    );

    if (loading || !data) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="space-y-4">
                    <Skeleton className="h-[200px] w-full" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Tabs defaultValue="restaurant" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="restaurant" className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Заведение
                        </TabsTrigger>
                        <TabsTrigger value="delivery" className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Доставка
                        </TabsTrigger>
                    </TabsList>
                    <Button onClick={handleSave}>Сохранить график</Button>
                </div>

                <TabsContent value="restaurant" className="space-y-4 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Режим работы заведения</CardTitle>
                            <CardDescription>
                                Укажите время, когда ваше заведение открыто для посещения гостями.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderScheduleEditor(restaurantHours, setRestaurantHours)}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="delivery" className="space-y-4 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Режим работы доставки</CardTitle>
                            <CardDescription>
                                В это время пользователи смогут оформлять заказы на доставку и самовывоз.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderScheduleEditor(deliveryHours, setDeliveryHours)}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-4">
                {/* Duplicate save button at bottom for convenience on mobile */}
                <Button onClick={handleSave} className="md:hidden w-full">Сохранить график</Button>
            </div>

        </div>
    );
}
