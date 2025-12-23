"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Instagram, Send, ShoppingCart, Check, Loader2, Trash2, ArrowLeft, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
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
  delivery_settings: string | null;
}

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

  // Delivery Form State
  const [cartStep, setCartStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryTime, setDeliveryTime] = useState<'asap' | 'scheduled'>('asap');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ id: number; number: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    apartment: '',
    comment: '',
    paymentMethod: 'cash'
  });

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
    }
  };

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

  const handleSubmitOrder = async () => {
    if (!data?.id) return;
    setIsSubmitting(true);
    try {
      const res = await orderService.createOrder(data.id, {
        customer_name: formData.name,
        customer_phone: formData.phone,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'delivery' ? formData.address : null,
        delivery_zone: null,
        delivery_time: deliveryTime === 'asap' ? 'ASAP' : 'Scheduled',
        payment_method: formData.paymentMethod,
        items: cartDetails.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        comment: formData.comment
      });
      setOrderResult({ id: res.order_id, number: res.order_number });
      setCartStep(3);
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

  const isRestaurantIncomplete = !data.phone || !data.address || !data.city || !data.hours;
  if (isRestaurantIncomplete) {
    return (
      <div className="flex flex-col bg-gray-100 min-h-screen">
        <div className="px-4 pt-4">
          <Alert>
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Необходимо заполнить данные!</AlertTitle>
            <AlertDescription>Пожалуйста, заполните контактную информацию заведения.</AlertDescription>
          </Alert>
        </div>
        <GeneralInfo activeTeam={activeTeam} />
      </div>
    );
  }

  const currentCat = data.menu.find((cat) => cat.id === currentCategoryId);

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="bg-white rounded-b-[18px] md:bg-transparent md:rounded-none">
        {data.photo && (
          <div className="w-full h-[150px] md:hidden overflow-hidden px-4 mt-4">
            <img src={data.photo} className="w-full h-full object-cover rounded-[8px]" />
          </div>
        )}
        <div className="px-0 md:px-4 max-w-6xl mx-auto">
          {/* Mobile Header */}
          <div className="md:hidden p-4 space-y-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <img src="https://taam.menu/menu.gif" className="w-6 h-6" />
              {data.type && <Badge className="bg-[#90FF55] text-black">{data.type}</Badge>}
              {data.features.map(f => <Badge key={f} className="bg-yellow-300 text-black">{f}</Badge>)}
            </div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <p className="text-gray-700">{data.description || "Нет описания"}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><h3 className="font-semibold text-gray-600">Город</h3><p>{data.city}</p></div>
              <div><h3 className="font-semibold text-gray-600">Адрес</h3><p>{data.address}</p></div>
              <div><h3 className="font-semibold text-gray-600">Телефон</h3><p>{data.phone}</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-center">График работы</h3>
              {formatHours(data.hours)}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block bg-white rounded-b-[18px] p-8 mt-4">
            <div className="flex gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-3xl font-bold">{data.name}</h1>
                  <div className="flex gap-2 mt-2">
                    {data.type && <Badge className="bg-[#90FF55] text-black">{data.type}</Badge>}
                    {data.features.map(f => <Badge key={f} className="bg-yellow-300 text-black">{f}</Badge>)}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-500">Описание</span>
                  <p className="text-gray-700 mt-1">{data.description || "Нет описания"}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <span className="text-xs font-semibold uppercase text-gray-500">Город</span>
                    <p className="mt-1 font-medium">{data.city}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <span className="text-xs font-semibold uppercase text-gray-500">Адрес</span>
                    <p className="mt-1 font-medium">{addressWithoutCity || data.address}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <span className="text-xs font-semibold uppercase text-gray-500">Телефон</span>
                    <p className="mt-1 font-medium">{data.phone}</p>
                  </div>
                </div>
              </div>
              {data.photo && (
                <div className="w-64 h-64 rounded-2xl overflow-hidden border">
                  <img src={data.photo} className="w-full h-full object-cover" />
                </div>
              )}
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
                            <span className="font-bold">{item.price} ₽</span>
                            {qty > 0 ? (
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="secondary" className="h-7" onClick={(e) => { e.stopPropagation(); decreaseCartItem(item.id); }}>−</Button>
                                <span className="w-8 text-center text-sm font-bold w-full">{qty}</span>
                                <Button size="sm" className="h-7 bg-[#FFEB5A] text-black hover:bg-[#FFEB5A]/80" onClick={(e) => { e.stopPropagation(); addToCart(item.id); }}>+</Button>
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
                {cartStep === 1 ? 'Мой заказ' : cartStep === 2 ? 'Оформление' : 'Готово!'}
              </DialogTitle>
              {cartStep === 1 && (
                <button onClick={() => { clearCart(); setIsCartOpen(false); }} className="text-xs text-gray-400 hover:text-red-500">Очистить всё</button>
              )}
            </div>

            {cartStep === 1 && (
              <div className="space-y-4">
                <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {cartDetails.map(item => (
                    <div key={item.id} className="flex gap-3 bg-gray-50 p-3 rounded-2xl">
                      <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden shrink-0">
                        {item.photo && <img src={item.photo} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className="text-sm font-semibold line-clamp-1">{item.name}</span>
                        <span className="text-xs text-gray-500">{item.price} ₽</span>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => decreaseCartItem(item.id)} className="w-6 h-6 rounded-lg bg-white border flex items-center justify-center text-sm shadow-sm">-</button>
                            <span className="text-sm font-bold">{item.quantity}</span>
                            <button onClick={() => addToCart(item.id)} className="w-6 h-6 rounded-lg bg-[#FFEB5A] flex items-center justify-center text-sm shadow-sm">+</button>
                          </div>
                          <span className="text-sm font-bold">{item.price * item.quantity} ₽</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-gray-500">Сумма заказа</span>
                    <span className="text-xl font-black">{totalPrice} ₽</span>
                  </div>
                  <Button className="w-full h-12 rounded-2xl bg-black text-white hover:bg-neutral-800" onClick={() => setCartStep(2)}>Перейти к оформлению</Button>
                </div>
              </div>
            )}

            {cartStep === 2 && (
              <Tabs defaultValue="delivery" className="w-full" onValueChange={(v) => setDeliveryMethod(v as any)}>
                <TabsList className="grid grid-cols-2 mb-6 bg-gray-100 p-1 rounded-xl h-12">
                  <TabsTrigger value="delivery" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full">Доставка</TabsTrigger>
                  <TabsTrigger value="pickup" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full">Самовывоз</TabsTrigger>
                </TabsList>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide pb-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-gray-500 ml-1">Имя</Label>
                        <Input placeholder="Как вас зовут?" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-gray-500 ml-1">Телефон</Label>
                        <Input placeholder="+7 (___) ___" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} className="rounded-xl h-11" />
                      </div>
                    </div>

                    {deliveryMethod === 'delivery' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-500 ml-1">Адрес доставки</Label>
                        <Input placeholder="Улица, дом, подъезд" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} className="rounded-xl h-11" />
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase text-gray-400">Способ оплаты</Label>
                      <RadioGroup defaultValue="cash" onValueChange={v => setFormData(f => ({ ...f, paymentMethod: v }))} className="flex flex-col gap-2">
                        <div className={cn("flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer", formData.paymentMethod === 'cash' ? "border-black bg-gray-50" : "bg-white")}>
                          <RadioGroupItem value="cash" id="cash" />
                          <Label htmlFor="cash" className="flex-1 cursor-pointer font-medium">Наличными</Label>
                        </div>
                        <div className={cn("flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer", formData.paymentMethod === 'card' ? "border-black bg-gray-50" : "bg-white")}>
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card" className="flex-1 cursor-pointer font-medium">Картой при получении</Label>
                        </div>
                        {/* <div className={cn("flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer", formData.paymentMethod === 'online' ? "border-black bg-gray-50" : "bg-white")}>
                          <RadioGroupItem value="online" id="online" />
                          <Label htmlFor="online" className="flex-1 cursor-pointer font-medium">Онлайн на сайте</Label>
                        </div> */}
                      </RadioGroup>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500 ml-1">Комментарий к заказу</Label>
                      <Textarea placeholder="Пожелания, код домофона и т.д." value={formData.comment} onChange={e => setFormData(f => ({ ...f, comment: e.target.value }))} className="rounded-xl resize-none" rows={2} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex flex-col gap-3">
                  <Button disabled={isSubmitting} className="w-full h-12 rounded-2xl bg-black text-white hover:bg-neutral-800 font-bold" onClick={handleSubmitOrder}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : `Заказать на ${totalPrice} ₽`}
                  </Button>
                  <button onClick={() => setCartStep(1)} className="text-xs font-medium text-gray-400 py-1">Вернуться к списку</button>
                </div>
              </Tabs>
            )}

            {cartStep === 3 && orderResult && (
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
                  <div className="flex justify-between"><span>Сумма:</span><span className="font-bold">{totalPrice} ₽</span></div>
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
              <span className="text-xl font-black">{selectedItem?.price} ₽</span>
            </div>

            <p className="text-gray-600 leading-relaxed">{selectedItem?.description || "Нет описания"}</p>

            <div className="grid grid-cols-4 gap-2 text-center py-4 border-y border-dashed">
              <div className="space-y-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Ккал</p><p className="text-sm font-bold">{selectedItem?.calories || 0}</p></div>
              <div className="space-y-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Белки</p><p className="text-sm font-bold">{selectedItem?.proteins || 0}</p></div>
              <div className="space-y-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Жиры</p><p className="text-sm font-bold">{selectedItem?.fats || 0}</p></div>
              <div className="space-y-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Угл.</p><p className="text-sm font-bold">{selectedItem?.carbs || 0}</p></div>
            </div>

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