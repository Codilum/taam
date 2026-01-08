"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Instagram, Send, ShoppingCart, Check, Loader2, Trash2, ArrowLeft, Plus, Minus } from "lucide-react";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import GeneralInfo from "./restaurant/GeneralInfo";
import { orderService, restaurantService, menuService } from "@/services";
import { toast } from "sonner";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string | null;
  calories: number | null;
  proteins: number | null;
  fats: number | null;
  carbs: number | null;
  weight: number | null;
  photo: string | null;
  view: boolean;
  placenum: number;
}

interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  placenum: number;
  items: MenuItem[];
}

interface CartItemDetails extends MenuItem {
  categoryName: string;
}

interface CartEntry extends CartItemDetails {
  quantity: number;
}

type PaymentMethod = "cash" | "card" | "transfer";

interface DeliveryMethodSettings {
  enabled: boolean;
  message: string;
  payment_methods: PaymentMethod[];
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

interface RestaurantData {
  id: number;
  photo: string | null;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  hours: string | null;
  instagram: string | null;
  telegram: string | null;
  vk: string | null;
  whatsapp: string | null;
  features: string[];
  menu: MenuCategory[];
  phone: string | null;
  subdomain: string | null;
  type: string | null;
  currency: string | null;
  delivery_settings: DeliverySettingsData | string | null;
}

const defaultDeliverySettings: DeliverySettingsData = {
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

function formatHours(hours: string | null) {
  if (!hours) return "—";

  try {
    const parsed = JSON.parse(hours) as {
      days: string;
      open: string;
      close: string;
      breakStart?: string;
      breakEnd?: string;
    }[];

    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-2">
        {parsed.map((h, idx) => (
          <div key={idx} className="text-sm leading-tight">
            <div className="font-medium">{h.days}</div>
            <div>
              {h.open}–{h.close}
            </div>
            {h.breakStart && h.breakEnd && (
              <div className="text-xs text-gray-500">
                Перерыв: {h.breakStart}–{h.breakEnd}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  } catch {
    const [open, close] = hours.split("-") ?? ["", ""];
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3 text-sm leading-tight">
        {days.map((d) => (
          <div key={d}>
            <div className="font-medium">{d}</div>
            <div>{open && close ? `${open}–${close}` : hours}</div>
          </div>
        ))}
      </div>
    );
  }
}

const hasNutritionValue = (value?: number | null) => {
  if (value === null || value === undefined) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const ArrowLeftIcon = () => (
  <svg
    width="25"
    height="25"
    viewBox="0 0 25 25"
    fill="none"
    xmlns="https://www.w3.org/2000/svg"
  >
    <mask
      id="mask0_arrow_left"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="25"
      height="25"
    >
      <rect
        x="1.00024"
        y="0.878387"
        width="24"
        height="24"
        transform="rotate(0.291 1.00024 0.878387)"
        fill="#D9D9D9"
      />
    </mask>
    <g mask="url(#mask0_arrow_left)">
      <path
        d="M16.9035 19.9596L5.93933 12.9037L16.9747 5.95975L16.9035 19.9596ZM14.9221 16.2995L14.9562 9.59948L9.6892 12.9228L14.9221 16.2995Z"
        fill="#1C1B1F"
      />
    </g>
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    width="25"
    height="25"
    viewBox="0 0 25 25"
    fill="none"
    xmlns="https://www.w3.org/2000/svg"
  >
    <mask
      id="mask0_arrow_right"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="25"
      height="25"
    >
      <rect
        x="23.9998"
        y="24.1216"
        width="24"
        height="24"
        transform="rotate(-179.709 23.9998 24.1216)"
        fill="#D9D9D9"
      />
    </mask>
    <g mask="url(#mask0_arrow_right)">
      <path
        d="M8.09649 5.04043L19.0607 12.0963L8.02529 19.0402L8.09649 5.04043ZM10.0779 8.70055L10.0438 15.4005L15.3108 12.0772L10.0779 8.70055Z"
        fill="#1C1B1F"
      />
    </g>
  </svg>
);

export default function ViewData({ activeTeam }: { activeTeam: string }) {
  const [data, setData] = useState<RestaurantData | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1);
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isSticky, setIsSticky] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [cartItems, setCartItems] = useState<Record<number, number>>({});
  const [cartExpiresAt, setCartExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsData>(defaultDeliverySettings);

  // Delivery Form State
  const [cartStep, setCartStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryTime, setDeliveryTime] = useState<'asap' | 'scheduled'>('asap');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ id: number; number: string } | null>(null);
  const initialFormState = {
    name: '',
    phone: '',
    city: '',
    street: '',
    house: '',
    building: '',
    entrance: '',
    apartment: '',
    comment: '',
    paymentMethod: 'cash',
    desiredTime: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const currencySymbol = useMemo(
    () => getCurrencySymbol(data?.currency || 'RUB'),
    [data?.currency]
  );
  const formatPrice = useCallback((amount: number) => `${amount} ${currencySymbol}`, [currencySymbol]);
  const formatPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    let normalized = digits;
    if (normalized.startsWith("8")) {
      normalized = `7${normalized.slice(1)}`;
    }
    if (!normalized.startsWith("7")) {
      normalized = `7${normalized}`;
    }
    const numbers = normalized.slice(1, 11);
    let result = "+7";
    if (numbers.length > 0) {
      result += ` (${numbers.slice(0, 3)}`;
    }
    if (numbers.length > 3) {
      result += ")";
    }
    if (numbers.length > 3) {
      result += ` ${numbers.slice(3, 6)}`;
    }
    if (numbers.length > 6) {
      result += `-${numbers.slice(6, 8)}`;
    }
    if (numbers.length > 8) {
      result += `-${numbers.slice(8, 10)}`;
    }
    return result;
  }, []);

  const cartKey = `taam_cart_${activeTeam}`;
  const normalizedSearch = searchValue.trim().toLowerCase();

  const normalizedAddress = useMemo(() => {
    if (!data?.address) {
      return { street: "", remainder: "", full: "" };
    }
    const raw = data.address.trim();
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 1) {
      return { street: raw, remainder: "", full: raw };
    }
    return { street: parts[0], remainder: parts.slice(1).join(", "), full: raw };
  }, [data?.address]);

  const addressWithoutCity = useMemo(() => {
    if (!data?.address) return "";
    const raw = data.address.trim();
    const cityValue = data?.city?.trim().toLowerCase() || "";
    const parts = raw.split(",").map(p => p.trim());
    return parts.filter(p => p.toLowerCase() !== cityValue).join(", ");
  }, [data?.address, data?.city]);

  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const menuHeaderRef = useRef<HTMLDivElement>(null);
  const categoriesContainerRef = useRef<HTMLDivElement>(null);

  const getVisibleCategories = () => {
    if (!data || !data.menu) return [];
    if (!normalizedSearch) return data.menu;
    return data.menu.filter((cat) =>
      cat.items.some((item) =>
        item.name.toLowerCase().includes(normalizedSearch)
      )
    );
  };

  const updateCart = (
    updater: (prev: Record<number, number>) => Record<number, number>
  ) => {
    setCartItems((prev) => {
      const next = updater(prev);
      const clean: Record<number, number> = {};
      Object.entries(next).forEach(([k, v]) => {
        if (v > 0) clean[Number(k)] = v;
      });
      return clean;
    });
  };

  const addToCart = (itemId: number, count = 1) => {
    updateCart((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + count,
    }));
  };

  const decreaseCartItem = (itemId: number) => {
    updateCart((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        next[itemId] = next[itemId] - 1;
      }
      return next;
    });
  };

  const removeFromCart = (itemId: number) => {
    updateCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const clearCart = () => {
    setCartItems({});
    setCartStep(1);
    setOrderResult(null);
    setDeliveryTime(deliverySettings[deliveryMethod]?.allow_asap ? 'asap' : 'scheduled');
    setFormData({ ...initialFormState, city: data?.city || '' });
  };

  const findMenuItemById = (id: number): CartItemDetails | null => {
    if (!data) return null;
    for (const cat of data.menu) {
      const found = cat.items.find((item) => item.id === id);
      if (found) {
        return { ...found, categoryName: cat.name };
      }
    }
    return null;
  };

  const fetchRestaurantViewData = useCallback(async () => {
    if (!activeTeam) {
      setData(null);
      setActiveCat(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [restaurantData, menuResponse] = await Promise.all([
        restaurantService.getRestaurant(activeTeam),
        menuService.getMenu(activeTeam)
      ]);

      let menuData: MenuCategory[] = [];
      if (menuResponse?.categories) {
        menuData = menuResponse.categories
          .map((cat: any) => ({
            ...cat,
            items: (cat.items || [])
              .filter((item: MenuItem) => item.view === true)
              .sort((a: MenuItem, b: MenuItem) => a.placenum - b.placenum),
          }))
          .sort((a: MenuCategory, b: MenuCategory) => a.placenum - b.placenum);
      }

      let parsedDeliverySettings: DeliverySettingsData = defaultDeliverySettings;
      if (restaurantData.delivery_settings) {
        try {
          const raw = typeof restaurantData.delivery_settings === 'string'
            ? JSON.parse(restaurantData.delivery_settings)
            : restaurantData.delivery_settings;
          parsedDeliverySettings = {
            delivery: { ...defaultDeliverySettings.delivery, ...(raw?.delivery || {}) },
            pickup: { ...defaultDeliverySettings.pickup, ...(raw?.pickup || {}) },
          };
        } catch (error) {
          console.error('Failed to parse delivery settings', error);
          parsedDeliverySettings = defaultDeliverySettings;
        }
      }

      categoryRefs.current = {};

      setData({
        id: restaurantData.id,
        photo: restaurantData.photo,
        name: restaurantData.name,
        description: restaurantData.description || "",
        city: restaurantData.city || "",
        address: restaurantData.address || "",
        hours: restaurantData.hours || "",
        instagram: restaurantData.instagram || "",
        telegram: restaurantData.telegram || "",
        vk: restaurantData.vk || "",
        whatsapp: restaurantData.whatsapp || "",
        features: restaurantData.features || [],
        menu: menuData,
        phone: restaurantData.phone || "",
        subdomain: restaurantData.subdomain || "",
        type: restaurantData.type || "",
        currency: restaurantData.currency || "RUB",
        delivery_settings: restaurantData.delivery_settings || null,
      });

      // Initialize form city if not already set or if it's empty
      if (!formData.city && restaurantData.city) {
        setFormData(prev => ({ ...prev, city: restaurantData.city || "" }));
      }

      setDeliverySettings(parsedDeliverySettings);

      const preferredMethod = parsedDeliverySettings.delivery.enabled
        ? 'delivery'
        : parsedDeliverySettings.pickup.enabled
          ? 'pickup'
          : 'delivery';
      setDeliveryMethod(preferredMethod);

      const supportsAsap = parsedDeliverySettings[preferredMethod as keyof DeliverySettingsData].allow_asap;
      const supportsScheduled = parsedDeliverySettings[preferredMethod as keyof DeliverySettingsData].allow_scheduled;
      if (!supportsAsap && supportsScheduled) {
        setDeliveryTime('scheduled');
      } else if (supportsAsap) {
        setDeliveryTime('asap');
      }

      if (menuData.length > 0) setActiveCat(menuData[0].id);
    } catch (err: any) {
      console.error("Error fetching restaurant view data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    fetchRestaurantViewData();
  }, [fetchRestaurantViewData]);

  useEffect(() => {
    const handleScroll = () => {
      const categories = getVisibleCategories();
      const headerHeight = menuHeaderRef.current?.getBoundingClientRect().height || 0;
      const targetLine = headerHeight + 24;
      let newActive: number | null = null;

      for (const cat of categories) {
        const el = categoryRefs.current[cat.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= targetLine && rect.bottom > targetLine) {
          newActive = cat.id;
          break;
        }
      }
      if (newActive && newActive !== activeCat) {
        setActiveCat(newActive);
        scrollCategoryIntoView(newActive);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [data, activeCat]);

  const scrollCategoryIntoView = (categoryId: number) => {
    if (!categoriesContainerRef.current) return;
    const items = categoriesContainerRef.current.querySelectorAll("button");
    const visible = getVisibleCategories();
    const idx = visible.findIndex(c => c.id === categoryId);
    if (idx !== -1 && items[idx]) {
      items[idx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const scrollToCategory = (categoryId: number) => {
    const el = categoryRefs.current[categoryId];
    if (!el) return;
    const headerHeight = menuHeaderRef.current?.getBoundingClientRect().height || 0;
    const offset = headerHeight + 24;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior: "smooth" });
  };

  const handleItemClick = (item: MenuItem, index: number, categoryId: number) => {
    setSelectedItem(item);
    setCurrentItemIndex(index);
    setCurrentCategoryId(categoryId);
    setActiveCat(categoryId);
  };

  const handleNextItem = () => {
    if (!data || currentCategoryId === null) return;
    const catIdx = data.menu.findIndex(c => c.id === currentCategoryId);
    const cat = data.menu[catIdx];
    if (currentItemIndex < cat.items.length - 1) {
      setSelectedItem(cat.items[currentItemIndex + 1]);
      setCurrentItemIndex(currentItemIndex + 1);
    } else if (catIdx < data.menu.length - 1) {
      const nextCat = data.menu[catIdx + 1];
      setSelectedItem(nextCat.items[0]);
      setCurrentItemIndex(0);
      setCurrentCategoryId(nextCat.id);
      setActiveCat(nextCat.id);
    }
  };

  const handlePrevItem = () => {
    if (!data || currentCategoryId === null) return;
    const catIdx = data.menu.findIndex(c => c.id === currentCategoryId);
    const cat = data.menu[catIdx];
    if (currentItemIndex > 0) {
      setSelectedItem(cat.items[currentItemIndex - 1]);
      setCurrentItemIndex(currentItemIndex - 1);
    } else if (catIdx > 0) {
      const prevCat = data.menu[catIdx - 1];
      setSelectedItem(prevCat.items[prevCat.items.length - 1]);
      setCurrentItemIndex(prevCat.items.length - 1);
      setCurrentCategoryId(prevCat.id);
      setActiveCat(prevCat.id);
    }
  };

  useEffect(() => {
    if (!selectedItem) return;

    const target = itemRefs.current[selectedItem.id];
    if (target) {
      const headerHeight = menuHeaderRef.current?.getBoundingClientRect().height || 0;
      const offset = headerHeight + 24;
      const top = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [selectedItem]);

  const isFirstItem = () => !data || (currentItemIndex === 0 && data.menu.findIndex(c => c.id === currentCategoryId) === 0);
  const isLastItem = () => !data || (currentCategoryId !== null && currentItemIndex === data.menu[data.menu.findIndex(c => c.id === currentCategoryId)].items.length - 1 && data.menu.findIndex(c => c.id === currentCategoryId) === data.menu.length - 1);

  const cartDetails: CartEntry[] = Object.entries(cartItems)
    .map(([k, v]) => {
      const d = findMenuItemById(Number(k));
      return d ? { ...d, quantity: v } : null;
    })
    .filter((e): e is CartEntry => !!e);

  const totalPrice = cartDetails.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartDetails.reduce((s, i) => s + i.quantity, 0);
  const uniqueItemCount = cartDetails.length;
  const hasSelectedItemNutrition = selectedItem
    ? [selectedItem.calories, selectedItem.proteins, selectedItem.fats, selectedItem.carbs].some(hasNutritionValue)
    : false;

  const currentMethodSettings = deliverySettings[deliveryMethod];
  const availablePaymentMethods: PaymentMethod[] = (currentMethodSettings?.payment_methods?.length
    ? currentMethodSettings.payment_methods
    : defaultDeliverySettings[deliveryMethod].payment_methods) as PaymentMethod[];
  const paymentLabels: Record<PaymentMethod, string> = {
    cash: 'Наличными',
    card: 'Картой при получении',
    transfer: 'Переводом',
  };

  useEffect(() => {
    const supportsAsap = currentMethodSettings?.allow_asap;
    const supportsScheduled = currentMethodSettings?.allow_scheduled;
    if (!supportsAsap && supportsScheduled && deliveryTime === 'asap') {
      setDeliveryTime('scheduled');
    }
    if (!supportsScheduled && deliveryTime === 'scheduled' && supportsAsap) {
      setDeliveryTime('asap');
    }
  }, [currentMethodSettings?.allow_asap, currentMethodSettings?.allow_scheduled, deliveryTime]);



  useEffect(() => {
    if (!availablePaymentMethods.includes(formData.paymentMethod as PaymentMethod)) {
      setFormData((prev) => ({ ...prev, paymentMethod: availablePaymentMethods[0] || 'cash' }));
    }
  }, [availablePaymentMethods, formData.paymentMethod]);

  const trimmedName = formData.name.trim();
  const trimmedPhone = formData.phone.trim();
  const trimmedCity = formData.city.trim();
  const trimmedStreet = formData.street.trim();
  const trimmedHouse = formData.house.trim();
  const trimmedDesiredTime = formData.desiredTime.trim();
  const formattedDeliveryAddress = [
    trimmedCity && `г. ${trimmedCity}`,
    trimmedStreet && `ул. ${trimmedStreet}`,
    trimmedHouse && `д. ${trimmedHouse}`,
    formData.building.trim() && `корп. ${formData.building.trim()}`,
    formData.entrance.trim() && `подъезд ${formData.entrance.trim()}`,
    formData.apartment.trim() && `кв. ${formData.apartment.trim()}`,
  ]
    .filter(Boolean)
    .join(", ");
  const trimmedAddress = formattedDeliveryAddress.trim();
  const hasDeliveryAddress = Boolean(trimmedCity && trimmedStreet && trimmedHouse);
  const canSubmitOrder = Boolean(
    cartDetails.length > 0 &&
    currentMethodSettings?.enabled &&
    trimmedName &&
    trimmedPhone &&
    (deliveryMethod === 'pickup' || hasDeliveryAddress) &&
    (deliveryTime !== 'scheduled' || trimmedDesiredTime)
  );

  const handleSubmitOrder = async () => {
    if (!data?.id) return;
    if (!canSubmitOrder) {
      toast.error("Заполните обязательные поля заказа");
      setCartStep(2);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await orderService.createOrder(data.id, {
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'delivery' ? trimmedAddress : null,
        delivery_zone: null,
        delivery_time: deliveryTime === 'asap' ? 'ASAP' : trimmedDesiredTime || 'Scheduled',
        delivery_time_option: deliveryTime,
        payment_method: formData.paymentMethod,
        items: cartDetails.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        comment: formData.comment
      });
      setOrderResult({ id: res.order_id, number: res.order_number });
      setCartStep(4);
    } catch (e) {
      console.error(e);
      alert("Ошибка при оформлении заказа");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="bg-gray-100 min-h-screen p-4 space-y-8">
        <div className="bg-white rounded-2xl p-6 flex gap-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="w-64 h-64 rounded-2xl" />
        </div>
      </div>
    );
  }


  const currentCat = data.menu.find((cat) => cat.id === currentCategoryId);

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="bg-white rounded-b-[18px] md:bg-transparent md:rounded-none">
        {data.photo && (
          <div className="w-full h-[150px] md:hidden overflow-hidden px-4 mt-4">
            <img
              src={data.photo}
              alt={data.name || "Фото заведения"}
              width={1200}
              height={150}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover rounded-[8px]"
            />
          </div>
        )}

        <div className="px-0 md:px-4">
          <div className="max-w-6xl mx-auto">
            <div className="md:hidden p-4 space-y-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                <img src="https://taam.menu/menu.gif" alt="menu gif" className="w-6 h-6 md:hidden" />
                {data.type && (
                  <Badge className="bg-[#90FF55] text-black whitespace-nowrap">{data.type}</Badge>
                )}
                {data.features.map((feature) => (
                  <Badge key={feature} className="bg-yellow-300 text-black whitespace-nowrap">
                    {feature}
                  </Badge>
                ))}
              </div>

              <h1 className="text-2xl font-bold">{data.name}</h1>

              <p className="text-gray-700">{data.description || "Нет описания"}</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-gray-600">Город</h3>
                    <p className="text-base">{data.city || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-gray-600">Адрес</h3>
                    <p className="text-base">{data.address || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-gray-600">Телефон</h3>
                    <p className="text-base">{data.phone || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-center">График работы</h3>
                <div className="text-base">{formatHours(data.hours)}</div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-center">Мы в соцсетях</h3>
                <div className="flex gap-4 justify-center items-center">
                  {data.instagram && (
                    <a
                      href={data.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg"
                    >
                      <Instagram className="w-6 h-6" />
                    </a>
                  )}
                  {data.telegram && (
                    <a
                      href={`https://t.me/${data.telegram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg"
                    >
                      <Send className="w-6 h-6" />
                    </a>
                  )}
                  {data.whatsapp && (
                    <a
                      href={`https://wa.me/${data.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg w-10 h-10 flex items-center justify-center"
                    >
                      <svg
                        xmlns="https://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                        fill="currentColor"
                        className="w-6 h-6"
                      >
                        <path d="M476.9 161.1C435 119.1 379.2 96 319.9 96C197.5 96 97.9 195.6 97.9 318C97.9 357.1 108.1 395.3 127.5 429L96 544L213.7 513.1C246.1 530.8 282.6 540.1 319.8 540.1L319.9 540.1C442.2 540.1 544 440.5 544 318.1C544 258.8 518.8 203.1 476.9 161.1zM319.9 502.7C286.7 502.7 254.2 493.8 225.9 477L219.2 473L149.4 491.3L168 423.2L163.6 416.2C145.1 386.8 135.4 352.9 135.4 318C135.4 216.3 218.2 133.5 320 133.5C369.3 133.5 415.6 152.7 450.4 187.6C485.2 222.5 506.6 268.8 506.5 318.1C506.5 419.9 421.6 502.7 319.9 502.7zM421.1 364.5C415.6 361.7 388.3 348.3 383.2 346.5C378.1 344.6 374.4 343.7 370.7 349.3C367 354.9 356.4 367.3 353.1 371.1C349.9 374.8 346.6 375.3 341.1 372.5C308.5 356.2 287.1 343.4 265.6 306.5C259.9 296.7 271.3 297.4 281.9 276.2C283.7 272.5 282.8 269.3 281.4 266.5C280 263.7 268.9 236.4 264.3 225.3C259.8 214.5 255.2 216 251.8 215.8C248.6 215.6 244.9 215.6 241.2 215.6C237.5 215.6 231.5 217 226.4 222.5C221.3 228.1 207 241.5 207 268.8C207 296.1 226.9 322.5 229.6 326.2C232.4 329.9 268.7 385.9 324.4 410C359.6 425.2 373.4 426.5 391 423.9C401.7 422.3 423.8 410.5 428.4 397.5C433 384.5 433 373.4 431.6 371.1C430.3 368.6 426.6 367.2 421.1 364.5z" />
                      </svg>
                    </a>
                  )}
                  {data.vk && (
                    <a
                      href={data.vk}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg w-10 h-10 flex items-center justify-center"
                    >
                      <svg
                        xmlns="https://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                        fill="currentColor"
                        className="w-6 h-6"
                      >
                        <path d="M127.5 127.5C96 159 96 209.7 96 311L96 329C96 430.3 96 481 127.5 512.5C159 544 209.7 544 311 544L328.9 544C430.3 544 481 544 512.4 512.5C543.8 481 544 430.3 544 329L544 311.1C544 209.7 544 159 512.5 127.6C481 96.2 430.3 96 329 96L311 96C209.7 96 159 96 127.5 127.5zM171.6 232.3L222.7 232.3C224.4 317.8 262.1 354 292 361.5L292 232.3L340.2 232.3L340.2 306C369.7 302.8 400.7 269.2 411.1 232.3L459.3 232.3C455.4 251.5 447.5 269.6 436.2 285.6C424.9 301.6 410.5 315.1 393.7 325.2C412.4 334.5 428.9 347.6 442.1 363.7C455.3 379.8 465 398.6 470.4 418.7L417.4 418.7C412.5 401.2 402.6 385.6 388.8 373.7C375 361.8 358.1 354.3 340.1 352.1L340.1 418.7L334.3 418.7C232.2 418.7 174 348.7 171.5 232.2z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:block bg-white rounded-b-[18px] p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-bold text-gray-900">{data.name}</h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {data.type && <Badge className="bg-[#90FF55] text-black">{data.type}</Badge>}
                      {data.features.map((feature) => (
                        <Badge key={feature} className="bg-yellow-300 text-black">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Описание</span>
                    <p className="text-base leading-relaxed text-gray-700">
                      {data.description || "Нет описания"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      График работы
                    </h3>
                    <div className="mt-3 text-base text-gray-800">{formatHours(data.hours)}</div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-gray-100 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Город</p>
                        <p className="mt-2 text-base text-gray-900">{data.city?.trim() || "—"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Адрес</p>
                        <p className="mt-2 text-base text-gray-900">
                          {addressWithoutCity ||
                            normalizedAddress.remainder ||
                            normalizedAddress.full ||
                            data.address?.trim() ||
                            "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Телефон</p>
                        <p className="mt-2 text-base text-gray-900">{data.phone?.trim() || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {data.instagram && (
                      <a
                        href={data.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:text-black"
                      >
                        <Instagram className="h-5 w-5" />
                      </a>
                    )}
                    {data.telegram && (
                      <a
                        href={`https://t.me/${data.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:text-black"
                      >
                        <Send className="h-4 w-4" />
                      </a>
                    )}
                    {data.whatsapp && (
                      <a
                        href={`https://wa.me/${data.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:text-black"
                      >
                        <svg
                          xmlns="https://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path d="M476.9 161.1C435 119.1 379.2 96 319.9 96C197.5 96 97.9 195.6 97.9 318C97.9 357.1 108.1 395.3 127.5 429L96 544L213.7 513.1C246.1 530.8 282.6 540.1 319.8 540.1L319.9 540.1C442.2 540.1 544 440.5 544 318.1C544 258.8 518.8 203.1 476.9 161.1zM319.9 502.7C286.7 502.7 254.2 493.8 225.9 477L219.2 473L149.4 491.3L168 423.2L163.6 416.2C145.1 386.8 135.4 352.9 135.4 318C135.4 216.3 218.2 133.5 320 133.5C369.3 133.5 415.6 152.7 450.4 187.6C485.2 222.5 506.6 268.8 506.5 318.1C506.5 419.9 421.6 502.7 319.9 502.7zM421.1 364.5C415.6 361.7 388.3 348.3 383.2 346.5C378.1 344.6 374.4 343.7 370.7 349.3C367 354.9 356.4 367.3 353.1 371.1C349.9 374.8 346.6 375.3 341.1 372.5C308.5 356.2 287.1 343.4 265.6 306.5C259.9 296.7 271.3 297.4 281.9 276.2C283.7 272.5 282.8 269.3 281.4 266.5C280 263.7 268.9 236.4 264.3 225.3C259.8 214.5 255.2 216 251.8 215.8C248.6 215.6 244.9 215.6 241.2 215.6C237.5 215.6 231.5 217 226.4 222.5C221.3 228.1 207 241.5 207 268.8C207 296.1 226.9 322.5 229.6 326.2C232.4 329.9 268.7 385.9 324.4 410C359.6 425.2 373.4 426.5 391 423.9C401.7 422.3 423.8 410.5 428.4 397.5C433 384.5 433 373.4 431.6 371.1C430.3 368.6 426.6 367.2 421.1 364.5z" />
                        </svg>
                      </a>
                    )}
                    {data.vk && (
                      <a
                        href={data.vk}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:text-black"
                      >
                        <svg
                          xmlns="https://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path d="M127.5 127.5C96 159 96 209.7 96 311L96 329C96 430.3 96 481 127.5 512.5C159 544 209.7 544 311 544L328.9 544C430.3 544 481 544 512.4 512.5C543.8 481 544 430.3 544 329L544 311.1C544 209.7 544 159 512.5 127.6C481 96.2 430.3 96 329 96L311 96C209.7 96 159 96 127.5 127.5zM171.6 232.3L222.7 232.3C224.4 317.8 262.1 354 292 361.5L292 232.3L340.2 232.3L340.2 306C369.7 302.8 400.7 269.2 411.1 232.3L459.3 232.3C455.4 251.5 447.5 269.6 436.2 285.6C424.9 301.6 410.5 315.1 393.7 325.2C412.4 334.5 428.9 347.6 442.1 363.7C455.3 379.8 465 398.6 470.4 418.7L417.4 418.7C412.5 401.2 402.6 385.6 388.8 373.7C375 361.8 358.1 354.3 340.1 352.1L340.1 418.7L334.3 418.7C232.2 418.7 174 348.7 171.5 232.2z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                {data.photo && (
                  <div className="w-full max-w-xs shrink-0 self-start">
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-2">
                      <img
                        src={data.photo}
                        alt={data.name || "Фото заведения"}
                        width={288}
                        height={288}
                        loading="lazy"
                        decoding="async"
                        className="h-72 w-full rounded-xl object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-4"></div>

      {/* Menu Section */}
      <div className="bg-white rounded-t-2xl md:rounded-2xl max-w-6xl mx-auto min-h-[60vh]">
        <div ref={menuHeaderRef} className="sticky top-0 bg-white z-10 border-b-2 transition-all p-4 space-y-3 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <p className="text-xl font-bold">{isSticky ? data.name : "Меню"}</p>
            <img src="https://taam.menu/menu.gif" className="w-6 h-6 md:hidden" />
          </div>
          <Input
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Поиск по блюдам"
            className="bg-gray-100 border-none"
          />
          <div ref={categoriesContainerRef} className="flex gap-3 overflow-x-auto scrollbar-hide">
            {getVisibleCategories().map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); scrollToCategory(cat.id); }}
                className={cn("px-4 py-1 rounded-lg text-sm whitespace-nowrap", activeCat === cat.id ? "bg-gray-200 font-bold" : "hover:bg-gray-100")}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-8">
          {getVisibleCategories().map(cat => {
            const items = normalizedSearch ? cat.items.filter(i => i.name.toLowerCase().includes(normalizedSearch)) : cat.items;
            if (items.length === 0) return null;
            return (
              <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }} className="scroll-mt-40">
                <h3 className="text-2xl font-bold mb-4">{cat.name}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {items.map((item, idx) => {
                    const qty = cartItems[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        ref={el => { itemRefs.current[item.id] = el; }}
                        onClick={() => handleItemClick(item, idx, cat.id)}
                        className={cn("flex flex-col rounded-xl overflow-hidden shadow-sm border border-transparent hover:border-black transition-all cursor-pointer", qty > 0 && "border-black")}
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          {item.photo && <img src={item.photo} className="w-full h-full object-cover" />}
                          {qty > 0 && <span className="absolute top-2 right-2 bg-black text-white text-[10px] px-2 py-1 rounded-full">В списке</span>}
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium text-sm line-clamp-2">{item.name}</span>
                            {item.weight && <span className="text-[10px] text-gray-500 pt-0.5">{item.weight}гр</span>}
                          </div>
                          <div className="mt-auto pt-3 flex flex-col gap-2">
                            <span className="font-bold">{formatPrice(item.price)}</span>
                            {qty > 0 ? (
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="secondary" className="h-7" style={{ flex: '2' }} onClick={(e) => { e.stopPropagation(); decreaseCartItem(item.id); }}>−</Button>
                                <span className="w-8 text-center text-sm font-bold w-full" style={{ flex: '2' }}>{qty}</span>
                                <Button size="sm" className="h-7 bg-[#FFEB5A] text-black hover:bg-[#FFEB5A]/80" style={{ flex: '2' }} onClick={(e) => { e.stopPropagation(); addToCart(item.id); }}>+</Button>
                              </div>
                            ) : (
                              <Button size="sm" className="w-full bg-[#FFEB5A] text-black hover:bg-[#FFEB5A]/80 font-semibold" onClick={(e) => { e.stopPropagation(); addToCart(item.id); }}>В заказ</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button
          onClick={() => { setIsCartOpen(true); setCartStep(1); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl z-50 transition-transform active:scale-95"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-[#FFEB5A] text-black text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{cartCount}</span>
        </button>
      )}

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md w-[95vw] p-0 rounded-3xl overflow-hidden gap-0">
          <div className="p-6">

            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-xl font-bold">
                {cartStep === 1 ? 'Мой заказ' : cartStep === 2 ? 'Доставка' : cartStep === 3 ? 'Данные' : 'Готово!'}
              </DialogTitle>
              {cartStep === 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm text-gray-600 hover:text-red-600 px-3"
                  onClick={() => { clearCart(); setIsCartOpen(false); }}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Очистить всё
                </Button>
              )}
            </div>

            {cartStep === 1 && (
              <div className="space-y-4">
                <div className="max-h-[40vh] overflow-y-scroll space-y-3 pr-2 scrollbar-visible">
                  {cartDetails.map(item => (
                    <div key={item.id} className="flex gap-3 bg-gray-50 p-3 rounded-2xl">
                      <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden shrink-0">
                        {item.photo && <img src={item.photo} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className="text-sm font-semibold line-clamp-1">{item.name}</span>
                        <span className="text-xs text-gray-500">{formatPrice(item.price)}</span>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => decreaseCartItem(item.id)} className="w-6 h-6 rounded-lg bg-white border flex items-center justify-center text-sm shadow-sm">-</button>
                            <span className="text-sm font-bold">{item.quantity}</span>
                            <button onClick={() => addToCart(item.id)} className="w-6 h-6 rounded-lg bg-[#FFEB5A] flex items-center justify-center text-sm shadow-sm">+</button>
                          </div>
                          <span className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-gray-500">Сумма заказа</span>
                    <span className="text-xl font-black">{formatPrice(totalPrice)}</span>
                  </div>
                  <Button className="w-full h-12 rounded-2xl bg-black text-white hover:bg-neutral-800" onClick={() => setCartStep(2)}>Перейти к оформлению</Button>
                </div>
              </div>
            )}

            {cartStep === 2 && (
              <div className="flex flex-col max-h-[70vh]">
                <div className="flex-1 space-y-6 overflow-y-scroll scrollbar-visible px-1  pb-4">
                  <Tabs value={deliveryMethod} className="w-full" onValueChange={(v) => {
                    const method = v as 'delivery' | 'pickup';
                    if (!deliverySettings[method]?.enabled) return;
                    setDeliveryMethod(method);
                  }}>
                    <TabsList className="grid grid-cols-2 mb-4 bg-gray-100 p-1 rounded-xl h-12">
                      <TabsTrigger value="delivery" disabled={!deliverySettings.delivery.enabled} className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full">Доставка</TabsTrigger>
                      <TabsTrigger value="pickup" disabled={!deliverySettings.pickup.enabled} className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full">Самовывоз</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase font-semibold text-gray-500">{deliveryMethod === 'delivery' ? 'Стоимость доставки' : 'Самовывоз'}</p>
                        <p className="text-lg font-semibold">
                          {deliveryMethod === 'delivery'
                            ? currentMethodSettings.cost_info || 'Стоимость рассчитывается по вашим тарифам'
                            : currentMethodSettings.discount_percent
                              ? `Скидка ${currentMethodSettings.discount_percent}% на самовывоз`
                              : 'Готовим к вашему приезду'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="px-3 py-1 rounded-full text-xs">
                        {deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}
                      </Badge>
                    </div>

                    {currentMethodSettings.message && (
                      <Alert className="bg-white/70 border-dashed">
                        <AlertDescription className="text-sm">
                          {currentMethodSettings.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="rounded-xl border bg-white p-3">
                      <p className="text-xs uppercase font-semibold text-gray-500 mb-2">Режим работы</p>
                      <div className="text-sm text-gray-800 space-y-1">
                        {formatHours(data.hours)}
                      </div>
                    </div>

                    {deliveryMethod === 'pickup' && currentMethodSettings.asap_time_hint && (
                      <div className="text-sm text-muted-foreground">
                        {currentMethodSettings.asap_time_hint}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase text-gray-400">Время получения</Label>
                    <RadioGroup value={deliveryTime} onValueChange={(v) => setDeliveryTime(v as 'asap' | 'scheduled')} className="flex flex-col gap-2">
                      {currentMethodSettings.allow_asap && (
                        <div className={cn("flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer", deliveryTime === 'asap' ? "border-black bg-gray-50" : "bg-white")}>
                          <RadioGroupItem value="asap" id="asap" />
                          <div className="flex-1">
                            <Label htmlFor="asap" className="flex-1 cursor-pointer font-medium">Как можно скорее</Label>
                            <p className="text-xs text-muted-foreground">Мы начнем готовить сразу после подтверждения</p>
                          </div>
                        </div>
                      )}

                      {currentMethodSettings.allow_scheduled && (
                        <div className={cn("space-y-2 p-3 rounded-xl border transition-all", deliveryTime === 'scheduled' ? "border-black bg-gray-50" : "bg-white")}>
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="scheduled" id="scheduled" />
                            <div className="flex-1">
                              <Label htmlFor="scheduled" className="font-medium cursor-pointer">К времени</Label>
                              <p className="text-xs text-muted-foreground">Выберите удобное время, мы подстроимся</p>
                            </div>
                          </div>
                          <Input
                            placeholder="Например, 18:30"
                            value={formData.desiredTime}
                            onChange={(e) => setFormData((f) => ({ ...f, desiredTime: e.target.value }))}
                            disabled={deliveryTime !== 'scheduled'}
                            className="rounded-xl h-11"
                          />
                        </div>
                      )}

                      {!currentMethodSettings.allow_asap && !currentMethodSettings.allow_scheduled && (
                        <div className="text-sm text-red-500">Способ временно недоступен</div>
                      )}
                    </RadioGroup>
                  </div>
                </div>

                <div className="pt-2 border-t flex flex-col gap-3 px-1 bg-white">
                  <Button
                    disabled={!currentMethodSettings.enabled || (!currentMethodSettings.allow_asap && !currentMethodSettings.allow_scheduled)}
                    className="w-full h-12 rounded-2xl bg-black text-white hover:bg-neutral-800 font-bold"
                    onClick={() => setCartStep(3)}
                  >
                    Продолжить
                  </Button>
                  <button onClick={() => setCartStep(1)} className="text-xs font-medium text-gray-400 py-1">Вернуться к списку</button>
                </div>
              </div>
            )}

            {cartStep === 3 && (
              <div className="flex flex-col max-h-[65vh]">
                <div className="flex-1 space-y-6 overflow-y-auto px-1 scrollbar-hide pb-4">
                  <div className="rounded-2xl border bg-gray-50 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Способ получения</span>
                      <button onClick={() => setCartStep(2)} className="text-xs font-medium text-primary">Изменить</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}</span>
                      <Badge variant="secondary" className="text-[11px] px-2 py-1">
                        {deliveryTime === 'asap' ? 'Как можно скорее' : `К времени: ${trimmedDesiredTime || 'указать'}`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {deliveryMethod === 'delivery'
                        ? (trimmedAddress || 'Укажите адрес доставки ниже')
                        : `Заберёте в: ${addressWithoutCity || data.address}`}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-gray-500 ml-1">Имя</Label>
                        <Input placeholder="Как вас зовут?" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-gray-500 ml-1">Телефон</Label>
                        <Input
                          placeholder="+7 (___) ___-__-__"
                          value={formData.phone}
                          inputMode="tel"
                          onChange={e => setFormData(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                          className="rounded-xl h-11"
                        />
                      </div>
                    </div>

                    {deliveryMethod === 'delivery' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500 ml-1">Адрес доставки</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5 col-span-2">
                            <Input placeholder="Город" value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Input placeholder="Улица" value={formData.street} onChange={e => setFormData(f => ({ ...f, street: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Input placeholder="Дом" value={formData.house} onChange={e => setFormData(f => ({ ...f, house: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Input placeholder="Корпус (необязательно)" value={formData.building} onChange={e => setFormData(f => ({ ...f, building: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Input placeholder="Подъезд" value={formData.entrance} onChange={e => setFormData(f => ({ ...f, entrance: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Input placeholder="Квартира" value={formData.apartment} onChange={e => setFormData(f => ({ ...f, apartment: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase text-gray-400">Способ оплаты</Label>
                      <RadioGroup value={formData.paymentMethod} onValueChange={v => setFormData(f => ({ ...f, paymentMethod: v }))} className="flex flex-col gap-2">
                        {availablePaymentMethods.map((method) => (
                          <div key={method} className={cn("flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer", formData.paymentMethod === method ? "border-black bg-gray-50" : "bg-white")}>
                            <RadioGroupItem value={method} id={`pay-${method}`} />
                            <Label htmlFor={`pay-${method}`} className="flex-1 cursor-pointer font-medium">{paymentLabels[method]}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500 ml-1">Комментарий к заказу</Label>
                      <Textarea placeholder="Пожелания, код домофона и т.д." value={formData.comment} onChange={e => setFormData(f => ({ ...f, comment: e.target.value }))} className="rounded-xl resize-none" rows={2} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t flex flex-col gap-3 px-1 bg-white">
                  <Button
                    disabled={isSubmitting || !canSubmitOrder}
                    className="w-full h-12 rounded-2xl bg-black text-white hover:bg-neutral-800 font-bold"
                    onClick={handleSubmitOrder}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : `Заказать на ${formatPrice(totalPrice)}`}
                  </Button>
                  <button onClick={() => setCartStep(2)} className="text-xs font-medium text-gray-400 py-1">Вернуться к доставке</button>
                </div>
              </div>
            )}

            {cartStep === 4 && orderResult && (
              <div className="py-8 text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <Check className="w-10 h-10" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-2xl font-black mb-1">Заказ #{orderResult.number}</h3>
                  <p className="text-gray-500">Мы уже начали его готовить!</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl text-left text-sm space-y-2">
                  <div className="flex justify-between"><span>Клиент:</span><span className="font-bold">{formData.name}</span></div>
                  <div className="flex justify-between"><span>Тип:</span><span className="font-bold">{deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}</span></div>
                  <div className="flex justify-between"><span>Сумма:</span><span className="font-bold">{formatPrice(totalPrice)}</span></div>
                </div>
                <Button className="w-full h-12 rounded-2xl border-2 border-black bg-white text-black hover:bg-gray-50" onClick={() => { setIsCartOpen(false); clearCart(); }}>Вернуться в меню</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Details Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-[420px] w-[95vw] p-0 rounded-3xl overflow-hidden gap-0">
          <VisuallyHidden><DialogTitle>{selectedItem?.name}</DialogTitle></VisuallyHidden>
          {selectedItem?.photo && (
            <div className="w-full aspect-[4/3] relative">
              <img src={selectedItem.photo} className="w-full h-full object-cover" />
              <Badge className="absolute top-3 left-3 bg-white/90 text-black hover:bg-white border-none shadow-sm">{currentCat?.name}</Badge>
            </div>
          )}
          <div className="p-6 pb-8 space-y-6">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold">{selectedItem?.name}</h2>
              <span className="text-xl font-black">{selectedItem ? formatPrice(selectedItem.price) : ""}</span>
            </div>

            <p className="text-gray-600 leading-relaxed">{selectedItem?.description || "Нет описания"}</p>

            {selectedItem && hasSelectedItemNutrition && (
              <div className="grid grid-cols-4 gap-2 text-center py-4 border-y border-dashed">
                {hasNutritionValue(selectedItem.calories) && (
                  <div>
                    <p className="font-normal text-black">Ккал</p>
                    <p>{selectedItem.calories}</p>
                  </div>
                )}

                {hasNutritionValue(selectedItem.proteins) && (
                  <div>
                    <p className="font-normal text-black">Белки</p>
                    <p>{selectedItem.proteins}</p>
                  </div>
                )}

                {hasNutritionValue(selectedItem.fats) && (
                  <div>
                    <p className="font-normal text-black">Жиры</p>
                    <p>{selectedItem.fats}</p>
                  </div>
                )}

                {hasNutritionValue(selectedItem.carbs) && (
                  <div>
                    <p className="font-normal text-black">Углеводы</p>
                    <p>{selectedItem.carbs}</p>
                  </div>
                )}
              </div>
            )}


            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 h-12 rounded-2xl" disabled={isFirstItem()} onClick={handlePrevItem}><ArrowLeft className="w-4 h-4" /></Button>
                <div className="flex-[2] flex bg-gray-100 rounded-2xl p-1 items-center">
                  <button onClick={() => decreaseCartItem(selectedItem!.id)} className="w-10 h-10 rounded-xl bg-white border shadow-sm flex items-center justify-center text-xl">-</button>
                  <span className="flex-1 text-center font-black text-lg">{cartItems[selectedItem?.id || 0] || 0}</span>
                  <button onClick={() => addToCart(selectedItem!.id)} className="w-10 h-10 rounded-xl bg-[#FFEB5A] shadow-sm flex items-center justify-center text-xl">+</button>
                </div>
                <Button variant="secondary" className="flex-1 h-12 rounded-2xl" disabled={isLastItem()} onClick={handleNextItem}><ArrowLeft className="w-4 h-4 rotate-180" /></Button>
              </div>
              <Button className="h-12 rounded-2xl bg-black text-white hover:bg-neutral-800 font-bold" onClick={() => setSelectedItem(null)}>Готово</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
