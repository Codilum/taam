"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showErrorToast } from "@/lib/show-error-toast";
import { restaurantService } from "@/services";
import { QrCode, Copy, Download, ExternalLink } from "lucide-react";

export default function GeneralInfo({ activeTeam }: { activeTeam: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [initialSubdomain, setInitialSubdomain] = useState<string>("");
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    const restaurantTypes = [
        "Ресторан",
        "Кафе",
        "Кофейня",
        "Фаст-фуд",
        "Столовая",
        "Пекарня",
        "Суши-бар",
    ];

    const fetchRestaurantData = useCallback(async () => {
        if (!activeTeam) return;
        setLoading(true);
        try {
            const restaurantData = await restaurantService.getRestaurant(activeTeam);
            setData(restaurantData);
            setInitialSubdomain((restaurantData.subdomain || "").trim());
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

    const handleSave = async () => {
        if (!data) return;

        const trimmedSubdomain = (data.subdomain || "").trim();
        const subdomainChanged = trimmedSubdomain !== initialSubdomain.trim();

        try {
            await restaurantService.updateRestaurant(activeTeam, {
                ...data,
                subdomain: trimmedSubdomain,
            });
            toast.success("Данные сохранены");
            if (subdomainChanged && trimmedSubdomain) {
                toast.info("Запись поддомена занимает до 15 минут");
            }
            setInitialSubdomain(trimmedSubdomain);

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

    const handleDeleteRestaurant = async () => {
        if (!activeTeam) {
            showErrorToast("Заведение не выбрано");
            return;
        }

        try {
            setDeleting(true);
            await restaurantService.deleteRestaurant(activeTeam);
            toast.success("Заведение удалено");

            if (typeof window !== "undefined") {
                window.location.href = "/dashboard";
            } else {
                router.replace("/dashboard");
                router.refresh();
            }
        } catch (error: any) {
            console.error(error);
            showErrorToast(
                error.detail || error.message || "Не удалось удалить заведение"
            );
        } finally {
            setDeleting(false);
        }
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const { photo } = await restaurantService.uploadPhoto(
                    activeTeam,
                    e.target.files[0]
                );
                setData((prev: any) => (prev ? { ...prev, photo } : prev));
                toast.success("Фото обновлено");
            } catch (err: any) {
                console.error(err);
                showErrorToast(err.detail || err.message || "Ошибка загрузки фото");
            }
        }
    };

    const handleDownloadQr = () => {
        if (!data?.qr_code) return;
        const link = document.createElement("a");
        link.href = data.qr_code;
        link.download = "qr-code.png";
        link.click();
    };

    const handleCopyLink = async () => {
        if (!data?.subdomain) return;
        const url = `https://${data.subdomain}.taam.menu`;
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
    };

    if (loading || !data) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Form - Takes up 2 columns on large screens */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Основная информация</CardTitle>
                            <CardDescription>
                                Название, контакты и основные настройки заведения
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col gap-6 sm:flex-row items-start">
                                {data.photo ? (
                                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border">
                                        <img
                                            src={data.photo}
                                            alt="Logo"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                        <span className="text-sm text-muted-foreground">Нет фото</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-3">
                                    <Label htmlFor="photo-upload" className="cursor-pointer">
                                        <div className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                                            Загрузить логотип
                                        </div>
                                        <Input
                                            id="photo-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                        />
                                    </Label>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">
                                        Рекомендуемый размер: 512x512px, макс. 5MB. Форматы: JPG, PNG.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Swapped Order: Type first, then Name */}
                                <div className="space-y-2">
                                    <Label>Тип заведения</Label>
                                    <Select
                                        value={data.type || ""}
                                        onValueChange={(val) => setData({ ...data, type: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите тип" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {restaurantTypes.map((t) => (
                                                <SelectItem key={t} value={t}>
                                                    {t}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Название заведения</Label>
                                    <Input
                                        value={data.name || ""}
                                        onChange={(e) =>
                                            setData({ ...data, name: e.target.value })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Телефон</Label>
                                    <Input
                                        value={data.phone || ""}
                                        onChange={(e) => setData({ ...data, phone: e.target.value })}
                                        placeholder="+7 (999) 000-00-00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Город</Label>
                                    <Input
                                        value={data.city || ""}
                                        onChange={(e) => setData({ ...data, city: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Адрес</Label>
                                <Input
                                    value={data.address || ""}
                                    onChange={(e) => setData({ ...data, address: e.target.value })}
                                    placeholder="Улица, дом"
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Instagram</Label>
                                    <Input
                                        value={data.instagram || ""}
                                        onChange={(e) => setData({ ...data, instagram: e.target.value })}
                                        placeholder="Ссылка или юзернейм"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>WhatsApp</Label>
                                    <Input
                                        value={data.whatsapp || ""}
                                        onChange={(e) => setData({ ...data, whatsapp: e.target.value })}
                                        placeholder="Номер или ссылка"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Telegram</Label>
                                    <Input
                                        value={data.telegram || ""}
                                        onChange={(e) => setData({ ...data, telegram: e.target.value })}
                                        placeholder="Ссылка или юзернейм"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>ВКонтакте</Label>
                                    <Input
                                        value={data.vk || ""}
                                        onChange={(e) => setData({ ...data, vk: e.target.value })}
                                        placeholder="Ссылка или юзернейм"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4">
                            <Button onClick={handleSave}>Сохранить изменения</Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Sidebar Column: QR & Danger Zone - Stacked Vertically */}
                <div className="space-y-6">
                    {/* Redesigned QR Block with Subdomain Input */}
                    <Card className="overflow-hidden border-primary/20 bg-primary/5">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Ваш QR и Ссылка</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label>Поддомен заведения</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={data.subdomain || ""}
                                        onChange={(e) => {
                                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                                            setData({ ...data, subdomain: val });
                                        }}
                                        placeholder="myspot"
                                        className="bg-background font-medium"
                                    />
                                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                        .taam.menu
                                    </span>
                                </div>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Это адрес вашего сайта.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-4 shadow-sm border">
                                {data.qr_code ? (
                                    <img
                                        src={data.qr_code}
                                        alt="QR Code"
                                        className="h-40 w-40 object-contain"
                                    />
                                ) : (
                                    <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed bg-gray-50 text-xs text-muted-foreground text-center p-2">
                                        Сохраните поддомен, чтобы получить QR
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={handleDownloadQr}
                                        disabled={!data.qr_code}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Скачать
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={handleCopyLink}
                                        disabled={!data.subdomain}
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Скопировать
                                    </Button>
                                </div>
                                {data.subdomain && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs h-auto py-1"
                                        asChild
                                    >
                                        <a href={`https://${data.subdomain}.taam.menu`} target="_blank" rel="noreferrer">
                                            Открыть сайт <ExternalLink className="ml-1 h-3 w-3" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                            <Button onClick={handleSave} className="w-full">
                                Обновить QR код
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <Card className="border-destructive/50">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base text-destructive font-semibold">Опасная зона</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                        Удаление заведения приведет к необратимой потере всех данных.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full">
                                Удалить заведение
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Это действие нельзя отменить. Это навсегда удалит ваше
                                    заведение и все связанные данные.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteRestaurant}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={deleting}
                                >
                                    {deleting ? "Удаление..." : "Удалить"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}
