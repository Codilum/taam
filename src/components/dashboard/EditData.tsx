import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface WorkingHours {
  startDay: string;
  endDay: string;
  open: string;
  close: string;
  breakStart: string;
  breakEnd: string;
}

interface RestaurantData {
  photo: string;
  name: string;
  description: string;
  city: string;
  address: string;
  hours: string;
  instagram: string;
  telegram: string;
  vk: string;
  whatsapp: string;
  features: string[];
  phone: string;
  subdomain: string;
  type: string;
}

export default function EditData({ activeTeam }: { activeTeam: string }) {
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([
    { startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  ]);

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

  const restaurantTypes = [
    "Ресторан",
    "Кафе",
    "Кофейня",
    "Фаст-фуд",
    "Столовая",
    "Пекарня",
    "Суши-бар",
  ];

  const daysOptions = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  useEffect(() => {
    const fetchData = async () => {
      if (!activeTeam) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/restaurants/${activeTeam}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }); 
        if (res.ok) {
          const restaurantData = await res.json();
          setData({
            photo: restaurantData.photo,
            name: restaurantData.name || "",
            description: restaurantData.description || "",
            city: restaurantData.city || "",
            address: restaurantData.address || "",
            hours: restaurantData.hours || "",
            instagram: restaurantData.instagram || "",
            telegram: restaurantData.telegram || "",
            vk: restaurantData.vk || "",
            whatsapp: restaurantData.whatsapp || "",
            features: restaurantData.features || [],
            phone: restaurantData.phone || "",
            subdomain: restaurantData.subdomain || "",
            type: restaurantData.type || "",
          });
          setFeatures(restaurantData.features || []);

          if (restaurantData.hours) {
            try {
              const parsedHours = JSON.parse(restaurantData.hours);
              if (Array.isArray(parsedHours)) {
                setWorkingHours(parsedHours.map(h => ({
                  startDay: h.days.split("-")[0] || "Пн",
                  endDay: h.days.split("-")[1] || h.days.split("-")[0] || "Пн",
                  open: h.open || "",
                  close: h.close || "",
                  breakStart: h.breakStart || "",
                  breakEnd: h.breakEnd || "",
                })));
              }
            } catch {
              const [open, close] = restaurantData.hours.split("-");
              setWorkingHours([{ startDay: "Пн", endDay: "Вс", open: open || "", close: close || "", breakStart: "", breakEnd: "" }]);
            }
          }
        } else {
          toast.error("Ошибка загрузки данных заведения");
        }
      } catch (err) {
        console.error(err);
        toast.error("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTeam]);

  const handleFeatureChange = (feature: string) => {
    setFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const addCustomFeature = () => {
    if (customFeature.trim() && !features.includes(customFeature.trim())) {
      setFeatures(prev => [...prev, customFeature.trim()]);
      setCustomFeature("");
      toast.success("Тег добавлен");
    }
  };

  const removeFeature = (feature: string) => {
    setFeatures(prev => prev.filter(f => f !== feature));
  };

  const handleSave = async () => {
    if (!data) return;

    const formattedHours = JSON.stringify(
      workingHours.filter(h => h.open && h.close).map(h => ({
        days: h.startDay === h.endDay ? h.startDay : `${h.startDay}-${h.endDay}`,
        open: h.open,
        close: h.close,
        breakStart: h.breakStart,
        breakEnd: h.breakEnd,
      }))
    );

    const saveData = { 
      ...data, 
      hours: formattedHours, 
      features 
    };

    try {
      const res = await fetch(`/api/restaurants/${activeTeam}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(saveData),
      });
      if (res.ok) {
        toast.success("Данные сохранены");
      } else {
        toast.error("Ошибка при сохранении");
      }
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при сохранении");
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const formData = new FormData();
      formData.append("file", e.target.files[0]);
      try {
        const res = await fetch(`/api/restaurants/${activeTeam}/upload-photo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
          body: formData,
        });
        if (res.ok) {
          const { photo } = await res.json();
          setData((prev) => (prev ? { ...prev, photo } : prev));
          toast.success("Фото обновлено");
        } else {
          toast.error("Ошибка загрузки фото");
        }
      } catch (err) {
        console.error(err);
        toast.error("Ошибка загрузки фото");
      }
    }
  };

  const updateWorkingHours = (index: number, field: keyof WorkingHours, value: string) => {
    setWorkingHours(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === "startDay" && daysOptions.indexOf(value) > daysOptions.indexOf(item.endDay)) {
          updated.endDay = value;
        }
        if (field === "open" && item.close && value >= item.close) return item;
        if (field === "close" && item.open && value <= item.open) return item;
        if (field === "breakStart" && item.breakEnd && value >= item.breakEnd) return item;
        if (field === "breakEnd" && item.breakStart && value <= item.breakStart) return item;
        return updated;
      }
      return item;
    }));
  };

  const addWorkingHours = () => {
    setWorkingHours(prev => [...prev, { startDay: "Пн", endDay: "Пн", open: "09:00", close: "18:00", breakStart: "", breakEnd: "" }]);
  };

  const removeWorkingHours = (index: number) => {
    if (workingHours.length > 1) {
      setWorkingHours(prev => prev.filter((_, i) => i !== index));
    }
  };

  const clearBreak = (index: number) => {
    setWorkingHours(prev => prev.map((item, i) => 
      i === index ? { ...item, breakStart: "", breakEnd: "" } : item
    ));
  };

  if (loading || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <h2 className="text-xl font-bold">Изменить данные</h2>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-64 w-64 rounded-2xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h2 className="text-xl font-bold">Изменить данные</h2>
      <Card>
        <CardContent className="space-y-8 pt-6">
          {/* Основная информация */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Основная информация</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <label htmlFor="photo-upload" className="w-64 h-64 rounded-2xl overflow-hidden border cursor-pointer">
                  {data.photo ? (
                    <img
                    src={data.photo}
                    alt={data.name || "Фото заведения"}
                    width={256}
                    height={256}
                    loading="lazy"
                    decoding="async"
                    className="object-cover w-full h-full hover:opacity-80 transition-opacity"
                  />

                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-colors">
                      Выберите фото
                    </div>
                  )}
                  <Input 
                    id="photo-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handlePhotoChange} 
                  />
                </label>
              </div>

              <div>
                <Label>Тип заведения*</Label>
                <Select value={data.type || ""} onValueChange={(v) => setData({ ...data, type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип заведения" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurantTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Название заведения*</Label>
                <Input
                  placeholder="Ресторан 'Восток'"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Город*</Label>
                  <Input
                    placeholder="Москва"
                    value={data.city || ""}
                    onChange={(e) => setData({ ...data, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Адрес*</Label>
                  <Input
                    placeholder="ул. Пушкина, д. 10"
                    value={data.address || ""}
                    onChange={(e) => setData({ ...data, address: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Телефон для связи*</Label>
                <Input
                  placeholder="+79991234567"
                  value={data.phone || ""}
                  onChange={(e) => setData({ ...data, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Поддомен*</Label>
                <div className="flex items-center">
                  <Input
                    placeholder="your-restaurant"
                    value={data.subdomain || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[a-z0-9-]*$/.test(value)) {
                        setData({ ...data, subdomain: value });
                      }
                    }}
                    className="rounded-r-none"
                    required
                  />
                  <div className="bg-gray-100 px-3 py-2 border border-l-0 border-gray-300 rounded-r-md text-sm">
                    .taam.menu
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ваша ссылка: https://{data.subdomain || "ваш-ресторан"}.taam.menu
                </p>
              </div>

              {/* Время работы - компактный вариант */}
              <div>
                <Label>Время работы*</Label>
                <div className="space-y-2 mt-2">
                  {workingHours.map((hours, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-center gap-2 w-full border p-2 rounded-lg bg-muted/10"
                    >
                      <div className="flex items-center gap-1">
                        <Select
                          value={hours.startDay}
                          onValueChange={(v) => updateWorkingHours(index, "startDay", v)}
                        >
                          <SelectTrigger className="w-18 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {daysOptions.map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs">-</span>
                        <Select
                          value={hours.endDay}
                          onValueChange={(v) => updateWorkingHours(index, "endDay", v)}
                        >
                          <SelectTrigger className="w-18 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {daysOptions
                              .filter((option) => daysOptions.indexOf(option) >= daysOptions.indexOf(hours.startDay))
                              .map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => updateWorkingHours(index, "open", e.target.value)}
                          className="w-24 h-8"
                        />
                        <span className="text-xs">-</span>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => updateWorkingHours(index, "close", e.target.value)}
                          className="w-24 h-8"
                        />
                      </div>
                      <div className="flex items-center gap-1 w-full text-xs whitespace-nowrap">Перерыв:</div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={hours.breakStart}
                          onChange={(e) => updateWorkingHours(index, "breakStart", e.target.value)}
                          className=""
                          placeholder="Начало"
                        />
                        <Input
                          type="time"
                          value={hours.breakEnd}
                          onChange={(e) => updateWorkingHours(index, "breakEnd", e.target.value)}
                          className=""
                          placeholder="Конец"
                        />
                        <div className="flex gap-1">
                          {(hours.breakStart || hours.breakEnd) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => clearBreak(index)}
                            >
                              ×
                            </Button>
                          )}
                          {workingHours.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeWorkingHours(index)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWorkingHours}
                    className="mt-1"
                  >
                    + Добавить время работы
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Доп. информация */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Дополнительная информация</h3>
            <div className="space-y-4">
              <div>
                <Label>Описание заведения</Label>
                <Input
                  placeholder="Уютный ресторан с европейской кухней и живой музыкой"
                  value={data.description || ""}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Instagram</Label>
                  <Input
                    placeholder="@vashrestoran"
                    value={data.instagram || ""}
                    onChange={(e) => setData({ ...data, instagram: e.target.value })}
                  />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input
                    placeholder="+79991234567"
                    value={data.whatsapp || ""}
                    onChange={(e) => setData({ ...data, whatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telegram</Label>
                  <Input
                    placeholder="@vashrestoran"
                    value={data.telegram || ""}
                    onChange={(e) => setData({ ...data, telegram: e.target.value })}
                  />
                </div>
                <div>
                  <Label>VK</Label>
                  <Input
                    placeholder="vk.com/vashrestoran"
                    value={data.vk || ""}
                    onChange={(e) => setData({ ...data, vk: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Теги */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Теги</h3>
            {features.length > 0 && (
              <div className="mb-6">
                <Label>Выбранные теги:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                    >
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className="text-primary/70 hover:text-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                {predefinedFeatureOptions
                  .filter((f) => f.length <= 12)
                  .map((feature) => (
                    <Button
                      key={feature}
                      variant="outline"
                      className={`flex justify-center items-center overflow-hidden ${
                        features.includes(feature)
                          ? "bg-primary/20 text-primary border-primary"
                          : "bg-background text-foreground"
                      }`}
                      onClick={() => handleFeatureChange(feature)}
                    >
                      <span className="truncate">{feature}</span>
                    </Button>
                  ))}
              </div>

              <div className="grid grid-cols-1 gap-3 mt-3">
                {predefinedFeatureOptions
                  .filter((f) => f.length > 12)
                  .map((feature) => (
                    <Button
                      key={feature}
                      variant="outline"
                      className={`flex justify-center items-center overflow-hidden ${
                        features.includes(feature)
                          ? "bg-primary/20 text-primary border-primary"
                          : "bg-background text-foreground"
                      }`}
                      onClick={() => handleFeatureChange(feature)}
                    >
                      <span className="truncate">{feature}</span>
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={handleSave} className="w-full sm:w-auto" style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}>
            Сохранить изменения
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
