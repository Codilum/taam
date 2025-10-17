"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Instagram, Send, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface MenuItem {
  id: number
  name: string
  price: number
  description: string | null
  calories: number | null
  proteins: number | null
  fats: number | null
  carbs: number | null
  weight: number | null
  photo: string | null
  view: boolean
  placenum: number
}

interface MenuCategory {
  id: number
  name: string
  description: string | null
  placenum: number
  items: MenuItem[]
}

interface CartItemDetails extends MenuItem {
  categoryName: string
}

interface CartEntry extends CartItemDetails {
  quantity: number
}

interface RestaurantData {
  photo: string | null
  name: string
  description: string | null
  city: string | null
  address: string | null
  hours: string | null
  instagram: string | null
  telegram: string | null
  vk: string | null
  whatsapp: string | null
  features: string[]
  menu: MenuCategory[]
  phone: string | null
  subdomain: string | null
  type: string | null
}
function formatHours(hours: string | null) {
  if (!hours) return "—"

  try {
    const parsed = JSON.parse(hours) as {
      days: string
      open: string
      close: string
      breakStart?: string
      breakEnd?: string
    }[]

    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-2">
        {parsed.map((h, idx) => (
          <div key={idx} className="text-sm leading-tight">
            <div className="font-medium">{h.days}</div>
            <div>{h.open}–{h.close}</div>
            {h.breakStart && h.breakEnd && (
              <div className="text-xs text-gray-500">
                Перерыв: {h.breakStart}–{h.breakEnd}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  } catch {
    // Старый формат: "09:00-22:00"
    const [open, close] = hours.split("-") ?? ["", ""]
    // Положим одно и то же время на все дни, в 2 колонки
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3 text-sm leading-tight">
        {days.map((d) => (
          <div key={d}>
            <div className="font-medium">{d}</div>
            <div>{open && close ? `${open}–${close}` : hours}</div>
          </div>
        ))}
      </div>
    )
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
)

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
)

export default function ViewData({ activeTeam }: { activeTeam: string }) {
  const [data, setData] = useState<RestaurantData | null>(null)
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSticky, setIsSticky] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [cartItems, setCartItems] = useState<Record<number, number>>({})
  const [cartExpiresAt, setCartExpiresAt] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)

  const cartKey = `taam_cart_${activeTeam}`
  const normalizedSearch = searchValue.trim().toLowerCase()

  // refs для секций категорий
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const menuHeaderRef = useRef<HTMLDivElement>(null)
  const categoriesContainerRef = useRef<HTMLDivElement>(null)

  const getVisibleCategories = () => {
    if (!data || !data.menu) return []
    if (!normalizedSearch) return data.menu
    return data.menu.filter((cat) =>
      cat.items.some((item) => item.name.toLowerCase().includes(normalizedSearch))
    )
  }

  const normalizeCart = (items: Record<number, number>) => {
    const normalized: Record<number, number> = {}
    Object.entries(items).forEach(([key, value]) => {
      const id = Number(key)
      const qty = Number(value)
      if (!Number.isNaN(id) && qty > 0) {
        normalized[id] = Math.floor(qty)
      }
    })
    return normalized
  }

  const saveCart = (items: Record<number, number>) => {
    if (typeof window === "undefined") return

    if (!activeTeam) {
      setCartExpiresAt(null)
      localStorage.removeItem(cartKey)
      return
    }

    const clean = normalizeCart(items)

    if (Object.keys(clean).length === 0) {
      localStorage.removeItem(cartKey)
      setCartExpiresAt(null)
      return
    }

    const expiresAt = Date.now() + 30 * 60 * 1000
    setCartExpiresAt(expiresAt)
    localStorage.setItem(cartKey, JSON.stringify({ items: clean, expiresAt }))
  }

  const updateCart = (updater: (prev: Record<number, number>) => Record<number, number>) => {
    setCartItems((prev) => {
      const updated = normalizeCart(updater(prev))
      saveCart(updated)
      return updated
    })
  }

  const addToCart = (itemId: number, count = 1) => {
    updateCart((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + count,
    }))
  }

  const decreaseCartItem = (itemId: number) => {
    updateCart((prev) => {
      const next = { ...prev }
      if (next[itemId]) {
        next[itemId] = next[itemId] - 1
        if (next[itemId] <= 0) {
          delete next[itemId]
        }
      }
      return next
    })
  }

  const removeFromCart = (itemId: number) => {
    updateCart((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const clearCart = () => {
    updateCart(() => ({}))
  }

  const findMenuItemById = (id: number): CartItemDetails | null => {
    if (!data) return null
    for (const cat of data.menu) {
      const found = cat.items.find((item) => item.id === id)
      if (found) {
        return { ...found, categoryName: cat.name }
      }
    }
    return null
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!activeTeam) return
      setLoading(true)
      try {
        const res = await fetch(`/api/restaurants/${activeTeam}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        })
        const resMenu = await fetch(`/api/restaurants/${activeTeam}/menu`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        })

        if (!res.ok) throw new Error("Failed to fetch restaurant data")
        const restaurantData = await res.json()
        let menuData: MenuCategory[] = []
        if (resMenu.ok) {
          const json = await resMenu.json()
          menuData = json.categories
            .map((cat: MenuCategory) => ({
              ...cat,
              items: cat.items
                .filter((item: MenuItem) => item.view === true)
                .sort((a: MenuItem, b: MenuItem) => a.placenum - b.placenum),
            }))
            .sort((a: MenuCategory, b: MenuCategory) => a.placenum - b.placenum)
        }

        categoryRefs.current = {}

        setData({
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
        })
        
        // Устанавливаем активную категорию по умолчанию
        if (menuData.length > 0) {
          setActiveCat(menuData[0].id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [activeTeam])

  useEffect(() => {
    if (!activeTeam) {
      setCartItems({})
      setCartExpiresAt(null)
      return
    }

    if (typeof window === "undefined") return

    const saved = localStorage.getItem(cartKey)
    if (!saved) {
      setCartItems({})
      setCartExpiresAt(null)
      return
    }

    try {
      const parsed = JSON.parse(saved) as { items?: unknown; expiresAt?: number }
      if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
        let restored: Record<number, number> = {}
        if (Array.isArray(parsed.items)) {
          parsed.items.forEach((id) => {
            if (typeof id === "number") {
              restored[id] = (restored[id] || 0) + 1
            }
          })
        } else if (parsed.items && typeof parsed.items === "object") {
          Object.entries(parsed.items as Record<string, unknown>).forEach(([key, value]) => {
            const id = Number(key)
            const qty = Number(value)
            if (!Number.isNaN(id) && qty > 0) {
              restored[id] = Math.floor(qty)
            }
          })
        }

        restored = normalizeCart(restored)

        if (Object.keys(restored).length > 0) {
          setCartItems(restored)
          setCartExpiresAt(parsed.expiresAt)
        } else {
          localStorage.removeItem(cartKey)
          setCartItems({})
          setCartExpiresAt(null)
        }
      } else {
        localStorage.removeItem(cartKey)
        setCartItems({})
        setCartExpiresAt(null)
      }
    } catch {
      localStorage.removeItem(cartKey)
      setCartItems({})
      setCartExpiresAt(null)
    }
  }, [cartKey, activeTeam])

  useEffect(() => {
    if (!data) return

    setCartItems((prev) => {
      const keys = Object.keys(prev)
      if (keys.length === 0) return prev

      const available = new Set<number>()
      data.menu.forEach((cat) => {
        cat.items.forEach((item) => available.add(item.id))
      })

      const filtered: Record<number, number> = {}
      keys.forEach((key) => {
        const id = Number(key)
        if (available.has(id)) {
          filtered[id] = prev[id]
        }
      })

      const normalized = normalizeCart(filtered)
      if (Object.keys(normalized).length === keys.length) return prev

      saveCart(normalized)
      return normalized
    })
  }, [data])

  // IntersectionObserver: подсветка категории при скролле
  useEffect(() => {
    if (!data || !data.menu || data.menu.length === 0) return

    const visibleCategories = getVisibleCategories()
    if (visibleCategories.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idAttr = entry.target.getAttribute("data-id")
            if (idAttr) {
              const categoryId = Number(idAttr)
              setActiveCat(categoryId)
              scrollCategoryIntoView(categoryId)
            }
          }
        })
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0.1,
      }
    )

    visibleCategories.forEach((cat) => {
      const el = categoryRefs.current[cat.id]
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [data, normalizedSearch])

  useEffect(() => {
    if (!data || !data.menu || data.menu.length === 0) {
      if (activeCat !== null) {
        setActiveCat(null)
      }
      return
    }

    const visible = getVisibleCategories()
    if (visible.length === 0) {
      if (activeCat !== null) {
        setActiveCat(null)
      }
      return
    }

    if (!activeCat || !visible.some((cat) => cat.id === activeCat)) {
      setActiveCat(visible[0].id)
    }
  }, [data, normalizedSearch, activeCat])

  useEffect(() => {
    const count = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0)
    if (count === 0 && isCartOpen) {
      setIsCartOpen(false)
    }
  }, [cartItems, isCartOpen])

  // IntersectionObserver для sticky header
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px"
      }
    );

    if (menuHeaderRef.current) {
      observer.observe(menuHeaderRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Функция для прокрутки категории в видимую область
  const scrollCategoryIntoView = (categoryId: number) => {
    if (!categoriesContainerRef.current) return

    const visibleCategories = getVisibleCategories()
    const categoryIndex = visibleCategories.findIndex((cat) => cat.id === categoryId)
    if (categoryIndex === -1) return

    const container = categoriesContainerRef.current
    const categoryButtons = container.querySelectorAll("button")

    if (categoryButtons[categoryIndex]) {
      const button = categoryButtons[categoryIndex]
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()

      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        button.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        })
      }
    }
  }

  const handleItemClick = (item: MenuItem, index: number, categoryId: number) => {
    setSelectedItem(item)
    setCurrentItemIndex(index)
    setCurrentCategoryId(categoryId)
    setActiveCat(categoryId)
    scrollCategoryIntoView(categoryId);
  }

  const handleNextItem = () => {
    if (!data || currentItemIndex === -1 || currentCategoryId === null) return
    
    const catIndex = data.menu.findIndex((cat) => cat.id === currentCategoryId)
    if (catIndex === -1) return
    
    const currentCat = data.menu[catIndex]
    const nextIndex = currentItemIndex + 1

    if (nextIndex < currentCat.items.length) {
      setSelectedItem(currentCat.items[nextIndex])
      setCurrentItemIndex(nextIndex)
    } else if (catIndex + 1 < data.menu.length) {
      const nextCat = data.menu[catIndex + 1]
      if (nextCat.items.length > 0) {
        setSelectedItem(nextCat.items[0])
        setCurrentItemIndex(0)
        setCurrentCategoryId(nextCat.id)
        setActiveCat(nextCat.id)
        categoryRefs.current[nextCat.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
        scrollCategoryIntoView(nextCat.id);
      }
    }
  }

  const handlePrevItem = () => {
    if (!data || currentItemIndex === -1 || currentCategoryId === null) return
    
    const catIndex = data.menu.findIndex((cat) => cat.id === currentCategoryId)
    if (catIndex === -1) return
    
    const currentCat = data.menu[catIndex]
    const prevIndex = currentItemIndex - 1

    if (prevIndex >= 0) {
      setSelectedItem(currentCat.items[prevIndex])
      setCurrentItemIndex(prevIndex)
    } else if (catIndex - 1 >= 0) {
      const prevCat = data.menu[catIndex - 1]
      if (prevCat.items.length > 0) {
        const lastIndex = prevCat.items.length - 1
        setSelectedItem(prevCat.items[lastIndex])
        setCurrentItemIndex(lastIndex)
        setCurrentCategoryId(prevCat.id)
        setActiveCat(prevCat.id)
        categoryRefs.current[prevCat.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
        scrollCategoryIntoView(prevCat.id);
      }
    }
  }

  // Функция для проверки, является ли элемент последним
  const isLastItem = () => {
    if (!data || currentItemIndex === -1 || currentCategoryId === null) return true
    
    const catIndex = data.menu.findIndex((cat) => cat.id === currentCategoryId)
    if (catIndex === -1) return true
    
    const currentCat = data.menu[catIndex]
    const isLastInCategory = currentItemIndex === currentCat.items.length - 1
    const isLastCategory = catIndex === data.menu.length - 1
    
    return isLastInCategory && isLastCategory
  }

  // Функция для проверки, является ли элемент первым
  const isFirstItem = () => {
    if (!data || currentItemIndex === -1 || currentCategoryId === null) return true

    const catIndex = data.menu.findIndex((cat) => cat.id === currentCategoryId)
    if (catIndex === -1) return true

    const currentCat = data.menu[catIndex]
    const isFirstInCategory = currentItemIndex === 0
    const isFirstCategory = catIndex === 0

    return isFirstInCategory && isFirstCategory
  }

  useEffect(() => {
    if (!cartExpiresAt) {
      setTimeLeft(null)
      return
    }

    const update = () => {
      const diff = cartExpiresAt - Date.now()
      if (diff <= 0) {
        setTimeLeft(0)
      } else {
        setTimeLeft(Math.ceil(diff / 60000))
      }
    }

    update()

    const interval = setInterval(update, 30000)

    return () => clearInterval(interval)
  }, [cartExpiresAt])

  useEffect(() => {
    if (!cartExpiresAt) return

    const now = Date.now()
    if (cartExpiresAt <= now) {
      setCartItems({})
      setCartExpiresAt(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem(cartKey)
      }
      return
    }

    const timeout = setTimeout(() => {
      setCartItems({})
      setCartExpiresAt(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem(cartKey)
      }
    }, cartExpiresAt - now)

    return () => clearTimeout(timeout)
  }, [cartExpiresAt, cartKey])

  if (loading || !data) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 space-y-8">
          {/* Restaurant Info Block */}
          <div className="bg-white rounded-2xl p-6 space-y-6">
            <div className="flex justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-1/3" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                </div>
              </div>
              <Skeleton className="w-64 h-64 rounded-2xl" />
            </div>
          </div>
          {/* Menu Block */}
          <div className="bg-white rounded-2xl p-6 space-y-6">
            <div className="sticky top-0 bg-white z-1 pb-3 border-b-2 border-black-500 border-solid">
              <Skeleton className="h-6 w-24 mb-2" />
              <div className="flex gap-3">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
            {/* Category Sections */}
            {[1, 2].map((_, catIndex) => (
              <div key={catIndex} className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((_, itemIndex) => (
                    <div key={itemIndex} className="p-2">
                      <Skeleton className="w-full h-32 rounded-xl" />
                      <div className="flex justify-between mt-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const isRestaurantIncomplete = !data.phone || !data.address || !data.city || !data.hours
  const currentCat = data.menu.find((cat) => cat.id === currentCategoryId)
  const categoriesForNav = getVisibleCategories()
  const cartDetails: CartEntry[] = Object.entries(cartItems)
    .map(([key, value]) => {
      const id = Number(key)
      const details = findMenuItemById(id)
      if (!details) return null
      return { ...details, quantity: Number(value) }
    })
    .filter((item): item is CartEntry => !!item && item.quantity > 0)
  const totalPrice = cartDetails.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cartDetails.reduce((sum, item) => sum + item.quantity, 0)
  const selectedItemQuantity = selectedItem ? cartItems[selectedItem.id] || 0 : 0
  const timeLeftText =
    timeLeft !== null
      ? timeLeft <= 1
        ? "Менее минуты до очистки"
        : `Список сохранится примерно ${timeLeft} мин.`
      : "Список сохраняется 30 минут после изменения."

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Restaurant Header with Full Width Photo */}
      <div className="bg-white rounded-b-[18px] md:bg-transparent md:rounded-none">
        {data.photo && (
          <div className="w-full h-[150px] md:hidden overflow-hidden px-4 mt-4 md:mt-0">
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
            {/* Mobile Layout */}
            <div className="md:hidden p-4 space-y-4">
              {/* Badges - Scrollable */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                <img 
                  src="https://taam.menu/menu.gif" 
                  alt="menu gif" 
                  className="w-6 h-6 md:hidden" 
                />
                {data.type && (
                  <Badge className="bg-[#90FF55] text-black whitespace-nowrap">{data.type}</Badge>
                )}
                {data.features.map((feature) => (
                  <Badge key={feature} className="bg-yellow-300 text-black whitespace-nowrap">
                    {feature}
                  </Badge>
                ))}
                
              </div>

              {/* Name */}
              <h1 className="text-2xl font-bold">{data.name}</h1>

              {/* Description */}
              <p className="text-gray-700">{data.description || "Нет описания"}</p>

              {/* Info Grid - Improved spacing */}
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

              {/* Hours Block - Added with background */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-center">График работы</h3>
                <div className="text-base">
                  {formatHours(data.hours)}
                </div>
              </div>

              {/* Social Links - Highlighted */}
              <div className="bg-gray-50 rounded-lg p-4 ">
                <h3 className="font-semibold mb-3 text-center">Мы в соцсетях</h3>
                <div className="flex gap-4 justify-center items-center">
                  {data.instagram && (
                    <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg shadow-sm">
                      <Instagram className="w-6 h-6" />
                    </a>
                  )}
                  {data.telegram && (
                    <a href={`https://t.me/${data.telegram}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg shadow-sm">
                      <Send className="w-6 h-6" />
                    </a>
                  )}
                  {data.whatsapp && (
                    <a href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg shadow-sm w-10 h-10 flex items-center justify-center">
                      <svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" className="w-6 h-6">
                        <path d="M476.9 161.1C435 119.1 379.2 96 319.9 96C197.5 96 97.9 195.6 97.9 318C97.9 357.1 108.1 395.3 127.5 429L96 544L213.7 513.1C246.1 530.8 282.6 540.1 319.8 540.1L319.9 540.1C442.2 540.1 544 440.5 544 318.1C544 258.8 518.8 203.1 476.9 161.1zM319.9 502.7C286.7 502.7 254.2 493.8 225.9 477L219.2 473L149.4 491.3L168 423.2L163.6 416.2C145.1 386.8 135.4 352.9 135.4 318C135.4 216.3 218.2 133.5 320 133.5C369.3 133.5 415.6 152.7 450.4 187.6C485.2 222.5 506.6 268.8 506.5 318.1C506.5 419.9 421.6 502.7 319.9 502.7zM421.1 364.5C415.6 361.7 388.3 348.3 383.2 346.5C378.1 344.6 374.4 343.7 370.7 349.3C367 354.9 356.4 367.3 353.1 371.1C349.9 374.8 346.6 375.3 341.1 372.5C308.5 356.2 287.1 343.4 265.6 306.5C259.9 296.7 271.3 297.4 281.9 276.2C283.7 272.5 282.8 269.3 281.4 266.5C280 263.7 268.9 236.4 264.3 225.3C259.8 214.5 255.2 216 251.8 215.8C248.6 215.6 244.9 215.6 241.2 215.6C237.5 215.6 231.5 217 226.4 222.5C221.3 228.1 207 241.5 207 268.8C207 296.1 226.9 322.5 229.6 326.2C232.4 329.9 268.7 385.9 324.4 410C359.6 425.2 373.4 426.5 391 423.9C401.7 422.3 423.8 410.5 428.4 397.5C433 384.5 433 373.4 431.6 371.1C430.3 368.6 426.6 367.2 421.1 364.5z"/>
                      </svg>
                    </a>
                  )}
                  {data.vk && (
                    <a href={data.vk} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg shadow-sm w-10 h-10 flex items-center justify-center">
                      <svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" className="w-6 h-6">
                        <path d="M127.5 127.5C96 159 96 209.7 96 311L96 329C96 430.3 96 481 127.5 512.5C159 544 209.7 544 311 544L328.9 544C430.3 544 481 544 512.4 512.5C543.8 481 544 430.3 544 329L544 311.1C544 209.7 544 159 512.5 127.6C481 96.2 430.3 96 329 96L311 96C209.7 96 159 96 127.5 127.5zM171.6 232.3L222.7 232.3C224.4 317.8 262.1 354 292 361.5L292 232.3L340.2 232.3L340.2 306C369.7 302.8 400.7 269.2 411.1 232.3L459.3 232.3C455.4 251.5 447.5 269.6 436.2 285.6C424.9 301.6 410.5 315.1 393.7 325.2C412.4 334.5 428.9 347.6 442.1 363.7C455.3 379.8 465 398.6 470.4 418.7L417.4 418.7C412.5 401.2 402.6 385.6 388.8 373.7C375 361.8 358.1 354.3 340.1 352.1L340.1 418.7L334.3 418.7C232.2 418.7 174 348.7 171.5 232.2z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Layout - Restored original design */}
            <div className="hidden md:block bg-white rounded-b-[18px] p-6 space-y-6">
              <div className="flex justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{data.name}</h1>
                  </div>
                  <div className="flex flex-wrap gap-[10px] mt-2 max-w-[530px]">
                    {data.type && (
                      <Badge className="bg-[#90FF55] text-black">{data.type}</Badge>
                    )}
                    {data.features.map((feature) => (
                      <Badge key={feature} className="bg-yellow-300 text-black">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-gray-700 mt-4">{data.description || "Нет описания"}</p>
                  
                  <div className="grid grid-cols-2 gap-6 mt-4 w-4/5">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold">Город</h3>
                        <p>{data.city || "—"}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold">Адрес</h3>
                        <p>{data.address || "—"}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold">Телефон</h3>
                        <p>{data.phone || "—"}</p>
                      </div>
                    </div>
                    
                    
                    
                    {/* Hours Block with background */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-3 text-center">График работы</h3>
                      <div className="whitespace-pre-line">
                        {formatHours(data.hours)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 justify-start items-center mt-4">
                        {data.instagram && (
                          <a href={data.instagram} target="_blank" rel="noopener noreferrer">
                            <Instagram className="w-6 h-6" />
                          </a>
                        )}
                        {data.telegram && (
                          <a href={`https://t.me/${data.telegram}`} target="_blank" rel="noopener noreferrer" >
                            <Send className="w-6 h-6" />
                          </a>
                        )}
                        {data.whatsapp && (
                          <a href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8">
                            <svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" className="w-full h-full">
                              <path d="M476.9 161.1C435 119.1 379.2 96 319.9 96C197.5 96 97.9 195.6 97.9 318C97.9 357.1 108.1 395.3 127.5 429L96 544L213.7 513.1C246.1 530.8 282.6 540.1 319.8 540.1L319.9 540.1C442.2 540.1 544 440.5 544 318.1C544 258.8 518.8 203.1 476.9 161.1zM319.9 502.7C286.7 502.7 254.2 493.8 225.9 477L219.2 473L149.4 491.3L168 423.2L163.6 416.2C145.1 386.8 135.4 352.9 135.4 318C135.4 216.3 218.2 133.5 320 133.5C369.3 133.5 415.6 152.7 450.4 187.6C485.2 222.5 506.6 268.8 506.5 318.1C506.5 419.9 421.6 502.7 319.9 502.7zM421.1 364.5C415.6 361.7 388.3 348.3 383.2 346.5C378.1 344.6 374.4 343.7 370.7 349.3C367 354.9 356.4 367.3 353.1 371.1C349.9 374.8 346.6 375.3 341.1 372.5C308.5 356.2 287.1 343.4 265.6 306.5C259.9 296.7 271.3 297.4 281.9 276.2C283.7 272.5 282.8 269.3 281.4 266.5C280 263.7 268.9 236.4 264.3 225.3C259.8 214.5 255.2 216 251.8 215.8C248.6 215.6 244.9 215.6 241.2 215.6C237.5 215.6 231.5 217 226.4 222.5C221.3 228.1 207 241.5 207 268.8C207 296.1 226.9 322.5 229.6 326.2C232.4 329.9 268.7 385.9 324.4 410C359.6 425.2 373.4 426.5 391 423.9C401.7 422.3 423.8 410.5 428.4 397.5C433 384.5 433 373.4 431.6 371.1C430.3 368.6 426.6 367.2 421.1 364.5z"/>
                            </svg>
                          </a>
                        )}
                        {data.vk && (
                          <a href={data.vk} target="_blank" rel="noopener noreferrer" className="w-8 h-8">
                            <svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" className="w-full h-full">
                              <path d="M127.5 127.5C96 159 96 209.7 96 311L96 329C96 430.3 96 481 127.5 512.5C159 544 209.7 544 311 544L328.9 544C430.3 544 481 544 512.4 512.5C543.8 481 544 430.3 544 329L544 311.1C544 209.7 544 159 512.5 127.6C481 96.2 430.3 96 329 96L311 96C209.7 96 159 96 127.5 127.5zM171.6 232.3L222.7 232.3C224.4 317.8 262.1 354 292 361.5L292 232.3L340.2 232.3L340.2 306C369.7 302.8 400.7 269.2 411.1 232.3L459.3 232.3C455.4 251.5 447.5 269.6 436.2 285.6C424.9 301.6 410.5 315.1 393.7 325.2C412.4 334.5 428.9 347.6 442.1 363.7C455.3 379.8 465 398.6 470.4 418.7L417.4 418.7C412.5 401.2 402.6 385.6 388.8 373.7C375 361.8 358.1 354.3 340.1 352.1L340.1 418.7L334.3 418.7C232.2 418.7 174 348.7 171.5 232.2z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                </div>
                {data.photo && (
                  <div className="w-64 h-64 rounded-2xl overflow-hidden">
                    
                    <img
                        src={data.photo}
                        alt={data.name || "Фото заведения"}
                        width={256}
                        height={256}
                        loading="lazy"
                        decoding="async"
                        className="object-cover"
                      />

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {isRestaurantIncomplete && (
        <div className="px-0 md:px-4 mt-2">
          <div className="max-w-6xl mx-auto p-4">
            <Alert variant="default">
              <AlertCircleIcon />
              <AlertTitle>Необходимо заполнить данные!</AlertTitle>
              <AlertDescription>
                Заполните данные заведения: {[
                  !data.city && "город",
                  !data.address && "адрес",
                  !data.phone && "телефон",
                  !data.hours && "время работы",
                ].filter(Boolean).join(", ")}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Spacing between info and menu */}
      <div className="h-2 md:h-2"></div>

      {/* Menu Block */}
      <div className="bg-white rounded-t-2xl md:rounded-2xl md:max-w-6xl mx-auto">
        <div className="max-w-6xl mx-auto">
          <div 
            ref={menuHeaderRef}
            className="sticky top-0 bg-white z-10 text-black-500 border-b-2 border-black-500 border-solid transition-all duration-200 rounded-t-[18px]"
            style={{
              boxShadow: isSticky ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">
                  {isSticky ? data.name : "Меню"}
                </p>
                <img
                  src="https://taam.menu/menu.gif"
                  alt="menu gif"
                  className="w-6 h-6 md:hidden"
                />
              </div>
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Поиск по блюдам"
                className="bg-gray-100 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {categoriesForNav.length > 0 ? (
                <div
                  ref={categoriesContainerRef}
                  className="flex gap-3 overflow-x-auto scrollbar-hide"
                >
                  {categoriesForNav.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCat(cat.id)
                        categoryRefs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
                        scrollCategoryIntoView(cat.id)
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors flex-shrink-0",
                        activeCat === cat.id ? "bg-gray-200 font-semibold" : "hover:bg-gray-100"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Категории не найдены</div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-6">
            {normalizedSearch && categoriesForNav.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-10 border border-dashed border-gray-300 rounded-xl">
                Ничего не найдено, попробуйте изменить запрос
              </div>
            ) : (
              categoriesForNav.map((cat) => {
                const itemsToShow = normalizedSearch
                  ? cat.items.filter((item) =>
                      item.name.toLowerCase().includes(normalizedSearch)
                    )
                  : cat.items

                return (
                  <div
                    key={cat.id}
                    id={`cat-${cat.id}`}
                    data-id={cat.id}
                    ref={(el) => {
                      categoryRefs.current[cat.id] = el
                    }}
                    className="scroll-mt-24"
                  >
                    <h3 className="text-2xl font-bold mb-4">{cat.name}</h3>
                    {itemsToShow.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                        {itemsToShow.map((item, index) => {
                          const quantity = cartItems[item.id] || 0
                          const inCart = quantity > 0
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "relative rounded-xl cursor-pointer hover:bg-gray-100 shadow-[2px_4px_10px_0_hsla(0,0%,80%,.5)] overflow-hidden",
                                inCart ? "border border-black" : ""
                              )}
                              onClick={() => handleItemClick(item, index, cat.id)}
                            >
                              {inCart && (
                                <span className="absolute top-2 right-2 bg-black text-white text-[10px] px-2 py-1 rounded-full">
                                  В корзине
                                </span>
                              )}
                              {item.photo ? (
                                <div className="w-full aspect-square overflow-hidden">
                                  <img
                                    src={item.photo}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-t-xl"
                                  />
                                </div>
                              ) : (
                                <div className="w-full aspect-square bg-gray-200 rounded-t-xl" />
                              )}

                              <div className="p-2 space-y-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-medium text-sm break-words flex-1 pr-2">
                                    {item.name}
                                  </span>
                                  {item.weight && item.weight !== 0.0 && (
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                      {item.weight} г
                                    </span>
                                  )}
                                </div>

                                <div className="text-black font-semibold text-sm">
                                  {item.price} ₽
                                </div>

                                {inCart ? (
                                  <div className="flex items-center justify-between gap-2 mt-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        decreaseCartItem(item.id)
                                      }}
                                      className="w-8 h-7 flex items-center justify-center rounded-lg bg-[#D9D9D9] text-base"
                                    >
                                      −
                                    </button>
                                    <span className="text-sm font-semibold">{quantity}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        addToCart(item.id)
                                      }}
                                      className="flex-1 h-7 rounded-lg bg-[#FFEB5A] text-black text-xs font-semibold"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addToCart(item.id)
                                    }}
                                    className="w-full text-xs font-medium mt-2 py-1 rounded-lg bg-[#FFEB5A] text-black"
                                  >
                                    В корзину
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl p-6">
                        В этой категории нет блюд по запросу
                      </div>
                    )}
                  </div>
                )
              })
            )}
        </div>
      </div>
    </div>

      {cartCount > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="fixed top-5 right-4 z-40 w-14 h-14 rounded-full bg-black text-white flex items-center justify-center shadow-lg relative"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-[#FFEB5A] text-black text-xs font-semibold px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
          </button>

          <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
            <DialogContent className="w-[92vw] max-w-[420px] p-4 sm:p-5 space-y-4 rounded-3xl">
              <DialogTitle className="text-lg font-semibold">Мой список</DialogTitle>
              <p className="text-xs text-gray-500">{timeLeftText}</p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {cartDetails.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-100 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500 truncate">{item.categoryName}</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {item.price * item.quantity} ₽
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decreaseCartItem(item.id)}
                          className="w-8 h-8 rounded-lg bg-[#D9D9D9] text-base flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(item.id)}
                          className="w-8 h-8 rounded-lg bg-[#FFEB5A] text-black text-base flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-xs text-red-500"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">Итого</span>
                <span className="text-lg font-semibold">{totalPrice} ₽</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    clearCart()
                    setIsCartOpen(false)
                  }}
                  className="text-xs text-gray-500"
                >
                  Очистить список
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Popup для блюда */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="[&>button]:rounded-full [&>button]:p-2 [&>button]:bg-[#D9D9D9] w-[92vw] max-w-[440px] p-0 overflow-hidden rounded-3xl">
          <VisuallyHidden>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </VisuallyHidden>

          {/* Photo + Badges */}
          {selectedItem?.photo && (
            <div className="relative w-full h-[220px] sm:h-[260px]">
              <img
                src={selectedItem.photo}
                alt={selectedItem.name}
                className="w-full h-full object-cover rounded-sm"
              />
              {currentCat && (
                <span className="absolute top-3 left-3 bg-[#90FF55] text-black text-xs px-3 py-1 rounded-full">
                  {currentCat.name}
                </span>
              )}
              <span className="absolute bottom-3 right-3 bg-[#FFEB5A] text-black text-sm px-3 py-1 rounded-full">
                {`${selectedItem.price} ₽`}
              </span>
            </div>
          )}
          
          {/* Content */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Name */}
            <h2 className="text-center text-xl font-normal text-[#222222]">
              {selectedItem?.name}
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-600 break-words">
              {selectedItem?.description || "Нет описания"}
            </p>

            {/* KBJU + Weight */}
            <div className="flex justify-between items-center text-xs text-gray-600 pt-2">
              <div className="flex gap-4 text-center">
                {selectedItem?.calories !== 0.0 && selectedItem?.calories && (
                  <div>
                    <p className="font-normal text-black">Ккал</p>
                    <p>{selectedItem.calories}</p>
                  </div>
                )}
                {selectedItem?.proteins !== 0.0 && selectedItem?.proteins && (
                  <div>
                    <p className="font-normal text-black">Белки</p>
                    <p>{selectedItem.proteins}</p>
                  </div>
                )}
                {selectedItem?.fats !== 0.0 && selectedItem?.fats && (
                  <div>
                    <p className="font-normal text-black">Жиры</p>
                    <p>{selectedItem.fats}</p>
                  </div>
                )}
                {selectedItem?.carbs !== 0.0 && selectedItem?.carbs && (
                  <div>
                    <p className="font-normal text-black">Углеводы</p>
                    <p>{selectedItem.carbs}</p>
                  </div>
                )}
              </div>
              {selectedItem?.weight !== 0.0 && selectedItem?.weight && (
                <div className="text-right">
                  <p className="font-normal text-black"></p>
                  <p>{selectedItem.weight} гр</p>
                </div>
              )}
            </div>

            {/* Управление */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
              <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-start w-full sm:w-auto">
                <Button
                  onClick={handlePrevItem}
                  disabled={isFirstItem()}
                  className={`w-24 h-11 p-0 flex items-center justify-center rounded-[8px] ${
                    isFirstItem()
                      ? "bg-[#D9D9D9] text-gray-600 cursor-not-allowed"
                      : "bg-[#FFEB5A] hover:bg-[#e6d84d]"
                  }`}
                >
                  <ArrowLeftIcon />
                </Button>
                <Button
                  onClick={handleNextItem}
                  disabled={isLastItem()}
                  className={`w-24 h-11 p-0 flex items-center justify-center rounded-[8px] ${
                    isLastItem()
                      ? "bg-[#D9D9D9] text-gray-600 cursor-not-allowed"
                      : "bg-[#FFEB5A] hover:bg-[#e6d84d]"
                  }`}
                >
                  <ArrowRightIcon />
                </Button>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 justify-end w-full sm:w-auto">
                {selectedItem && selectedItemQuantity > 0 ? (
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                    <button
                      type="button"
                      onClick={() => decreaseCartItem(selectedItem.id)}
                      className="w-8 h-8 rounded-lg bg-[#D9D9D9] text-base flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{selectedItemQuantity}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(selectedItem.id)}
                      className="w-8 h-8 rounded-lg bg-[#FFEB5A] text-black text-base flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                ) : selectedItem ? (
                  <Button
                    onClick={() => addToCart(selectedItem.id)}
                    className="h-11 px-6 rounded-lg bg-[#FFEB5A] text-black text-sm font-semibold"
                  >
                    Добавить в список
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
