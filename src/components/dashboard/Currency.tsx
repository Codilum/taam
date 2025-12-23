import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/show-error-toast";
import { restaurantService } from "@/services";

const availableCurrencies: Record<string, string> = {
    RUB: "Российский рубль",
    BYN: "Белорусский рубль",
    KZT: "Казахский тенге",
    AZN: "Азербайджанский манат",
    UZS: "Узбекский сум",
    GEL: "Грузинский лари",
    KGS: "Киргизский сом",
    AMD: "Армянский драм",
    USD: "Доллар США",
    EUR: "Евро",
    GBP: "Фунт стерлингов",
    RSD: "Сербский динар",
    THB: "Тайский бат",
    CNY: "Китайский юань",
    KRW: "Южнокорейская вона",
    UAH: "Украинская гривна"
};

export default function Currency({ activeTeam }: { activeTeam: string }) {
    const [currency, setCurrency] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchCurrency = useCallback(async () => {
        if (!activeTeam) return;
        setLoading(true);
        try {
            const data = await restaurantService.getRestaurant(activeTeam);
            setCurrency(data.currency || "RUB");
        } catch (err) {
            console.error(err);
            showErrorToast("Ошибка загрузки валюты");
        } finally {
            setLoading(false);
        }
    }, [activeTeam]);

    useEffect(() => {
        fetchCurrency();
    }, [fetchCurrency]);

    const handleSave = async () => {
        if (!activeTeam) return;
        setSaving(true);
        try {
            await restaurantService.updateRestaurant(activeTeam, { currency });
            toast.success("Валюта сохранена");
            window.dispatchEvent(
                new CustomEvent("restaurant:updated", { detail: { team: activeTeam } })
            );
        } catch (err: any) {
            console.error(err);
            showErrorToast(err.detail || err.message || "Ошибка при сохранении");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <h2 className="text-xl font-bold">Валюта</h2>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <h2 className="text-xl font-bold">Валюта</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Выберите валюту</CardTitle>
                    <CardDescription>
                        Выберите валюту, в которой работает ваше заведение — она будет отображаться во всех интерфейсах.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currency-select">Валюта заведения</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger id="currency-select">
                                <SelectValue placeholder="Выберите валюту" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(availableCurrencies).map(([code, name]) => (
                                    <SelectItem key={code} value={code}>
                                        {name} ({code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
                        className="w-full sm:w-auto"
                    >
                        {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
