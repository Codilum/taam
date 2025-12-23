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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/show-error-toast";
import { restaurantService } from "@/services";

export default function AdditionalInfo({ activeTeam }: { activeTeam: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [features, setFeatures] = useState<string[]>([]);
    const [customFeature, setCustomFeature] = useState("");

    const predefinedFeatureOptions = [
        "Место для молитвы",
        "Без музыки",
        "Халяль",
        "Национальная кухня",
        "Европейская кухня",
        "ПП",
        "Детская зона",
        "Удобная парковка",
        "Wi-Fi",
        "Безналичная оплата",
        "Еда навынос",
        "Доставка",
        "Завтраки",
    ];

    const fetchRestaurantData = useCallback(async () => {
        if (!activeTeam) return;
        setLoading(true);
        try {
            const restaurantData = await restaurantService.getRestaurant(activeTeam);
            setData(restaurantData);
            setFeatures(restaurantData.features || []);
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

    const handleFeatureChange = (feature: string) => {
        setFeatures((prev) =>
            prev.includes(feature)
                ? prev.filter((f) => f !== feature)
                : [...prev, feature]
        );
    };

    const addCustomFeature = () => {
        if (customFeature.trim() && !features.includes(customFeature.trim())) {
            setFeatures((prev) => [...prev, customFeature.trim()]);
            setCustomFeature("");
            toast.success("Тег добавлен");
        }
    };

    const removeFeature = (feature: string) => {
        setFeatures((prev) => prev.filter((f) => f !== feature));
    };

    const handleSave = async () => {
        if (!data) return;

        try {
            await restaurantService.updateRestaurant(activeTeam, {
                ...data,
                features: features,
            });
            toast.success("Данные сохранены");

            // Update global restaurant state if needed
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

    if (loading || !data) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <h2 className="text-xl font-bold">Дополнительно</h2>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-20" />
                                <Skeleton className="h-8 w-20" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Описание и теги</CardTitle>
                    <CardDescription>
                        Добавьте подробное описание и ключевые особенности вашего заведения
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Описание ресторана</Label>
                        <Textarea
                            className="resize-none"
                            rows={4}
                            placeholder="Расскажите гостям о вашей кухне и атмосфере..."
                            value={data.description || ""}
                            onChange={(e) => setData({ ...data, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label>Особенности (теги)</Label>

                        {/* Выбранные теги */}
                        <div className="flex flex-wrap gap-2">
                            {features.map((feature) => (
                                <div
                                    key={feature}
                                    className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm text-secondary-foreground"
                                >
                                    {feature}
                                    <button
                                        onClick={() => removeFeature(feature)}
                                        className="ml-1 text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {features.length === 0 && (
                                <span className="text-sm text-muted-foreground">Теги не выбраны</span>
                            )}
                        </div>

                        {/* Добавление своего тега */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Свой тег..."
                                value={customFeature}
                                onChange={(e) => setCustomFeature(e.target.value)}
                                className="max-w-xs"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomFeature();
                                    }
                                }}
                            />
                            <Button onClick={addCustomFeature} variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                Добавить
                            </Button>
                        </div>

                        {/* Предустановленные теги */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Популярные теги:</Label>
                            <div className="flex flex-wrap gap-2">
                                {predefinedFeatureOptions.map((option) => {
                                    const isSelected = features.includes(option);
                                    if (isSelected) return null; // Hide already selected
                                    return (
                                        <button
                                            key={option}
                                            onClick={() => handleFeatureChange(option)}
                                            className="rounded border px-2 py-1 text-xs hover:bg-muted"
                                        >
                                            + {option}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-4">
                    <Button onClick={handleSave}>Сохранить изменения</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
