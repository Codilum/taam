"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { ShoppingCart, SlidersHorizontal } from "lucide-react";

type CatalogCategory = "men" | "women" | "kids";

interface Product {
  id: number;
  name: string;
  price: number;
  status: "В наличии" | "На складе" | "Под заказ";
  brand: string;
  fabric: string;
  category: CatalogCategory;
  sizes: string[];
  colors: string[];
  image: string;
  description: string;
}

interface CartItem {
  id: number;
  size: string;
  color: string;
  quantity: number;
}

const categories: { id: CatalogCategory; title: string; description: string }[] = [
  {
    id: "men",
    title: "Мужская одежда",
    description: "Классика, casual и smart‑повседневка",
  },
  {
    id: "women",
    title: "Женская одежда",
    description: "Образы для города, офиса и отдыха",
  },
  {
    id: "kids",
    title: "Детская одежда",
    description: "Мягкие ткани и удобная посадка",
  },
];

const products: Product[] = [
  {
    id: 1,
    name: "Льняной пиджак Nord",
    price: 12990,
    status: "В наличии",
    brand: "Nordic Form",
    fabric: "Лен",
    category: "men",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Графит", "Песочный", "Синий"],
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    description:
      "Легкий пиджак для шоурума: прямой крой, breathable лен, подходит для летних образов.",
  },
  {
    id: 2,
    name: "Платье вечернее Aurora",
    price: 18450,
    status: "На складе",
    brand: "Lumiere",
    fabric: "Шифон",
    category: "women",
    sizes: ["XS", "S", "M"],
    colors: ["Изумруд", "Черный", "Лиловый"],
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
    description:
      "Воздушное платье с мягким шифоном, рассчитано на витрину и фотозону в шоуруме.",
  },
  {
    id: 3,
    name: "Детский комплект Cloud",
    price: 6290,
    status: "Под заказ",
    brand: "MiniFlow",
    fabric: "Хлопок",
    category: "kids",
    sizes: ["92", "98", "104", "110"],
    colors: ["Молочный", "Небесный", "Персиковый"],
    image:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80",
    description:
      "Мягкий комплект с хлопковой подкладкой, идеально для детской зоны.",
  },
  {
    id: 4,
    name: "Блуза Silk City",
    price: 9990,
    status: "В наличии",
    brand: "Lumiere",
    fabric: "Шелк",
    category: "women",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Айвори", "Карамель", "Черный"],
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    description:
      "Шелковая блуза для витрин: легкий блеск и аккуратный ворот.",
  },
  {
    id: 5,
    name: "Куртка Urban Shell",
    price: 21900,
    status: "На складе",
    brand: "Gridline",
    fabric: "Твил",
    category: "men",
    sizes: ["M", "L", "XL"],
    colors: ["Хаки", "Черный"],
    image:
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=800&q=80",
    description:
      "Структурная куртка с плотным твилом, подходит для экспозиции и примерки.",
  },
  {
    id: 6,
    name: "Комбинезон Play",
    price: 5490,
    status: "В наличии",
    brand: "MiniFlow",
    fabric: "Футер",
    category: "kids",
    sizes: ["86", "92", "98"],
    colors: ["Желтый", "Мятный"],
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    description:
      "Теплый футер, мягкие манжеты, адаптирован для детской примерочной зоны.",
  },
];

const brands = ["Nordic Form", "Lumiere", "MiniFlow", "Gridline"];
const fabrics = ["Лен", "Шифон", "Хлопок", "Шелк", "Твил", "Футер"];

export default function ShowroomCatalogPage() {
  const [activeCategories, setActiveCategories] = useState<CatalogCategory[]>([
    "men",
    "women",
    "kids",
  ]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(25000);
  const [brandFilters, setBrandFilters] = useState<string[]>([...brands]);
  const [fabricFilters, setFabricFilters] = useState<string[]>([...fabrics]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("courier");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selections, setSelections] = useState<Record<number, { size: string; color: string }>>(
    () =>
      products.reduce(
        (acc, product) => {
          acc[product.id] = { size: product.sizes[0], color: product.colors[0] };
          return acc;
        },
        {} as Record<number, { size: string; color: string }>
      )
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategories.length === 0 || activeCategories.includes(product.category);
      const matchesPrice = product.price >= priceMin && product.price <= priceMax;
      const matchesBrand = brandFilters.length === 0 || brandFilters.includes(product.brand);
      const matchesFabric = fabricFilters.length === 0 || fabricFilters.includes(product.fabric);
      return matchesCategory && matchesPrice && matchesBrand && matchesFabric;
    });
  }, [activeCategories, priceMin, priceMax, brandFilters, fabricFilters]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => {
    const product = products.find((prod) => prod.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const toggleCategory = (categoryId: CatalogCategory) => {
    setActiveCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const updateSelection = (productId: number, key: "size" | "color", value: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [key]: value,
      },
    }));
  };

  const addToCart = (product: Product) => {
    const selection = selections[product.id];
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.id === product.id && item.size === selection.size && item.color === selection.color
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, size: selection.size, color: selection.color, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const updateFilterList = (
    current: string[],
    value: string,
    setter: (next: string[]) => void
  ) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <section className="bg-white rounded-t-3xl rounded-b-2xl p-6 shadow-sm space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full px-3 py-1">Шоурум</Badge>
                <h1 className="text-2xl font-semibold">Каталог демонстрационных товаров</h1>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Витринная страница с мок‑данными: здесь можно посмотреть ассортимент шоурума,
                включить фильтры, открыть карточку товара и оформить демонстрационный заказ.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Город</p>
                  <p className="text-lg font-semibold">Москва, Арт‑кластер «Пульс»</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Часы работы</p>
                  <p className="text-lg font-semibold">Ежедневно 10:00–21:00</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Демонстрации</p>
                  <p className="text-lg font-semibold">Примерка, фотозона, стилист</p>
                </div>
              </div>
            </div>
            <div className="relative h-60 overflow-hidden rounded-3xl">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80"
                alt="Интерьер шоурума"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-2 text-sm font-medium">
                Пространство шоурума · 240 м²
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-2">
              <p className="text-sm uppercase text-muted-foreground">Рекламный блок</p>
              <h2 className="text-xl font-semibold">Осенняя капсула 2025</h2>
              <p className="text-muted-foreground max-w-xl">
                Забронируйте витрину для презентации новой коллекции — специальная цена для шоурумов и
                дизайн‑студий до конца месяца.
              </p>
              <Button className="rounded-full mt-3">Забронировать слот</Button>
            </div>
            <div className="relative h-48 overflow-hidden rounded-3xl">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80"
                alt="Рекламная витрина коллекции"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
                -15% на экспозицию
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Главные категории</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveCategories([])}>
                Сбросить
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveCategories(["men", "women", "kids"])}
              >
                Выбрать все
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((category) => {
              const isActive = activeCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition shadow-sm",
                    isActive ? "border-black bg-white" : "bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{category.title}</h3>
                    {isActive && <Badge className="rounded-full">Активно</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{category.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 space-y-6 border shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Каталог шоурума</h2>
              <p className="text-sm text-muted-foreground">
                Фильтры активируются здесь и влияют только на демонстрационную страницу.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Фильтры
              </Button>
              <Button variant="default" className="gap-2" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="h-4 w-4" /> Корзина
                {cartCount > 0 && (
                  <Badge className="ml-1 rounded-full bg-white text-black">{cartCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeCategories.length > 0 && (
              <Badge variant="secondary" className="rounded-full">
                Категории: {activeCategories.map((cat) => categories.find((c) => c.id === cat)?.title).join(", ")}
              </Badge>
            )}
            <Badge variant="secondary" className="rounded-full">
              Цена: {priceMin.toLocaleString("ru-RU")}–{priceMax.toLocaleString("ru-RU")} ₽
            </Badge>
            {brandFilters.length > 0 && (
              <Badge variant="secondary" className="rounded-full">
                Бренды: {brandFilters.join(", ")}
              </Badge>
            )}
            {fabricFilters.length > 0 && (
              <Badge variant="secondary" className="rounded-full">
                Ткани: {fabricFilters.join(", ")}
              </Badge>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const selection = selections[product.id];
              return (
                <div
                  key={product.id}
                  className="rounded-2xl border bg-white p-3 shadow-sm flex flex-col gap-3"
                >
                  <div className="overflow-hidden rounded-xl">
                    <img src={product.image} alt={product.name} className="h-44 w-full object-cover" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold leading-tight">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.brand}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{product.price.toLocaleString("ru-RU")} ₽</p>
                      <p className="text-xs text-muted-foreground">{product.status}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{product.description}</p>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Размер</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => updateSelection(product.id, "size", size)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs",
                              selection.size === size
                                ? "border-black bg-black text-white"
                                : "bg-white"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Цвет</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {product.colors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateSelection(product.id, "color", color)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs",
                              selection.color === color
                                ? "border-black bg-black text-white"
                                : "bg-white"
                            )}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    className="mt-auto rounded-full"
                    variant="outline"
                    onClick={() => setSelectedProduct(product)}
                  >
                    Открыть
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Фильтры каталога</DialogTitle>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label>Цена</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={priceMin}
                  onChange={(event) => setPriceMin(Number(event.target.value))}
                />
                <span className="text-sm text-muted-foreground">—</span>
                <Input
                  type="number"
                  min={0}
                  value={priceMax}
                  onChange={(event) => setPriceMax(Number(event.target.value))}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Бренд</Label>
              <div className="space-y-2">
                {brands.map((brand) => (
                  <label key={brand} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={brandFilters.includes(brand)}
                      onCheckedChange={() => updateFilterList(brandFilters, brand, setBrandFilters)}
                    />
                    {brand}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Ткань</Label>
              <div className="space-y-2">
                {fabrics.map((fabric) => (
                  <label key={fabric} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={fabricFilters.includes(fabric)}
                      onCheckedChange={() => updateFilterList(fabricFilters, fabric, setFabricFilters)}
                    />
                    {fabric}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Быстрые действия</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPriceMin(0);
                    setPriceMax(25000);
                    setBrandFilters([]);
                    setFabricFilters([]);
                  }}
                >
                  Сбросить фильтры
                </Button>
                <Button
                  onClick={() => {
                    setBrandFilters([...brands]);
                    setFabricFilters([...fabrics]);
                  }}
                >
                  Выбрать всё
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedProduct !== null} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl">
          {selectedProduct && (
            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="h-full max-h-[360px] w-full rounded-2xl object-cover"
              />
              <div className="space-y-4">
                <div>
                  <DialogTitle className="text-2xl font-semibold">{selectedProduct.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{selectedProduct.brand}</p>
                </div>
                <p className="text-muted-foreground">{selectedProduct.description}</p>
                <div className="rounded-2xl border p-4 space-y-2">
                  <p className="text-lg font-semibold">
                    {selectedProduct.price.toLocaleString("ru-RU")} ₽
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.status}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Размер</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedProduct.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateSelection(selectedProduct.id, "size", size)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm",
                            selections[selectedProduct.id]?.size === size
                              ? "border-black bg-black text-white"
                              : "bg-white"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Цвет</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedProduct.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateSelection(selectedProduct.id, "color", color)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm",
                            selections[selectedProduct.id]?.color === color
                              ? "border-black bg-black text-white"
                              : "bg-white"
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button className="w-full rounded-full" onClick={() => addToCart(selectedProduct)}>
                  Добавить в корзину
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Оформление заказа</DialogTitle>
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {cartItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">Корзина пуста. Добавьте товары из каталога.</p>
                )}
                {cartItems.map((item) => {
                  const product = products.find((prod) => prod.id === item.id);
                  if (!product) return null;
                  return (
                    <div key={`${item.id}-${item.size}-${item.color}`} className="flex gap-4 border rounded-2xl p-4">
                      <img src={product.image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Размер: {item.size} · Цвет: {item.color}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm">Количество: {item.quantity}</p>
                          <p className="font-semibold">
                            {(product.price * item.quantity).toLocaleString("ru-RU")} ₽
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl border p-4 space-y-3">
                <h3 className="text-base font-semibold">Данные для оформления</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="order-name">Имя</Label>
                    <Input id="order-name" placeholder="Алексей" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="order-phone">Телефон</Label>
                    <Input id="order-phone" placeholder="+7 (999) 123-45-67" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="order-email">Email</Label>
                  <Input id="order-email" placeholder="alexey@mail.ru" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="order-address">Адрес доставки</Label>
                  <Input id="order-address" placeholder="ул. Тверская, 12, офис 8" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="order-comment">Комментарий</Label>
                  <Input id="order-comment" placeholder="Позвонить за 30 минут до доставки" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Итого</p>
                <p className="text-2xl font-semibold">{cartTotal.toLocaleString("ru-RU")} ₽</p>
              </div>
              <div className="rounded-2xl border p-4 space-y-3">
                <Label>Способ доставки</Label>
                <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="courier" id="delivery-courier" />
                    <Label htmlFor="delivery-courier">Курьер</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="mail" id="delivery-mail" />
                    <Label htmlFor="delivery-mail">Почта</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cdek" id="delivery-cdek" />
                    <Label htmlFor="delivery-cdek">СДЭК</Label>
                  </div>
                </RadioGroup>
              </div>
              <Button className="w-full rounded-full">Подтвердить демонстрационный заказ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
