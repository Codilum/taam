// app/[subdomain]/MenuPageClient.tsx
"use client"

import Image from "next/image"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { cn } from "@/lib/utils"

interface MenuItem {
  id: number
  name: string
  price: number
  description: string | null
  photo: string | null
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
  weight?: number
}

interface MenuCategory {
  id: number
  name: string
  items: MenuItem[]
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
    const parsed = JSON.parse(hours) as { days: string; open: string; close: string }[]
    return parsed.map((h) => `${h.days}: ${h.open} - ${h.close}`).join("\n")
  } catch {
    return hours
  }
}

export default function MenuPageClient({ data }: { data: RestaurantData }) {
  const isRestaurantIncomplete = !data.phone || !data.address || !data.city || !data.hours

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)
  const [activeCat, setActiveCat] = useState<number | null>(null)

  const handleItemClick = (item: MenuItem, index: number) => {
    setSelectedItem(item)
    setCurrentItemIndex(index)
  }

  const findCatByItem = (item: MenuItem | null) =>
    item ? data.menu.find(cat => cat.items.some(i => i.id === item.id)) ?? null : null

  const handleNextItem = () => {
    if (!selectedItem) return
    const catIndex = data.menu.findIndex(cat => cat.items.some(i => i.id === selectedItem.id))
    if (catIndex === -1) return
    const currentCat = data.menu[catIndex]
    const idx = currentCat.items.findIndex(i => i.id === selectedItem.id)
    const nextIndex = idx + 1

    if (nextIndex < currentCat.items.length) {
      setSelectedItem(currentCat.items[nextIndex])
      setCurrentItemIndex(nextIndex)
    } else if (catIndex + 1 < data.menu.length) {
      const nextCat = data.menu[catIndex + 1]
      if (nextCat.items.length > 0) {
        setSelectedItem(nextCat.items[0])
        setCurrentItemIndex(0)
        setActiveCat(nextCat.id)
      }
    }
  }

  const handlePrevItem = () => {
    if (!selectedItem) return
    const catIndex = data.menu.findIndex(cat => cat.items.some(i => i.id === selectedItem.id))
    if (catIndex === -1) return
    const currentCat = data.menu[catIndex]
    const idx = currentCat.items.findIndex(i => i.id === selectedItem.id)
    const prevIndex = idx - 1

    if (prevIndex >= 0) {
      setSelectedItem(currentCat.items[prevIndex])
      setCurrentItemIndex(prevIndex)
    } else if (catIndex - 1 >= 0) {
      const prevCat = data.menu[catIndex - 1]
      if (prevCat.items.length > 0) {
        setSelectedItem(prevCat.items[prevCat.items.length - 1])
        setCurrentItemIndex(prevCat.items.length - 1)
        setActiveCat(prevCat.id)
      }
    }
  }

  // Корректные disabled для стрелок
  const currentCat = findCatByItem(selectedItem)
  const isFirst =
    selectedItem && currentCat
      ? currentCat.items[0].id === selectedItem.id &&
        data.menu.findIndex(c => c.id === currentCat.id) === 0
      : true

  const isLast =
    selectedItem && currentCat
      ? currentCat.items[currentCat.items.length - 1].id === selectedItem.id &&
        data.menu.findIndex(c => c.id === currentCat.id) === data.menu.length - 1
      : true

  return (
    <div className="bg-gray-100 min-h-screen p-4 max-w-6xl mx-auto space-y-8">
      {isRestaurantIncomplete && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Необходимо заполнить данные!</AlertTitle>
          <AlertDescription>
            Заполните данные заведения: название, фото, город, адрес, телефон, время работы
          </AlertDescription>
        </Alert>
      )}

      {/* Информация о ресторане */}
      <div className="bg-white rounded-2xl p-6 space-y-4 md:flex md:gap-6">
        {data.photo && (
          <div className="w-32 h-32 md:w-64 md:h-64 rounded-2xl overflow-hidden">
            <Image src={data.photo} alt={data.name} width={256} height={256} className="object-cover" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {data.type && <Badge>{data.type}</Badge>}
            <h1 className="text-3xl font-bold">{data.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.features.map(f => <Badge key={f}>{f}</Badge>)}
          </div>
          <p>{data.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><strong>Город</strong><p>{data.city || "—"}</p></div>
            <div><strong>Адрес</strong><p>{data.address || "—"}</p></div>
            <div><strong>Телефон</strong><p>{data.phone || "—"}</p></div>
            <div><strong>График</strong><p className="whitespace-pre-line">{formatHours(data.hours)}</p></div>
          </div>
        </div>
      </div>

      {/* Меню */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-4">
          {data.menu.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth" }) }}
              className={cn(
                "px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors",
                activeCat === cat.id ? "bg-gray-200 font-semibold" : "hover:bg-gray-100"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {data.menu.map(cat => (
          <div key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-36 space-y-2">
            <h3 className="text-2xl font-bold">{cat.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {cat.items.map((item, idx) => (
                <div key={item.id} className="cursor-pointer rounded-xl p-2 hover:bg-gray-100"
                     onClick={() => handleItemClick(item, idx)}>
                  {item.photo ? (
                    <Image src={item.photo} alt={item.name} width={256} height={128} className="object-cover w-full h-32 rounded-xl mb-2" />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded-xl mb-2" />
                  )}
                  <div className="flex justify-between">
                    <span className="truncate">{item.name}</span>
                    <span>{item.price} ₽</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Popup блюда */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="[&>button]:rounded-full [&>button]:p-2 [&>button]:bg-[#D9D9D9]">
          <VisuallyHidden>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </VisuallyHidden>

          {selectedItem?.photo && (
            <div className="relative w-full h-60">
              <Image src={selectedItem.photo} alt={selectedItem.name} fill className="object-cover rounded-sm" />
            </div>
          )}

          <div className="p-4 space-y-4">
            <h2 className="text-2xl font-bold text-center">{selectedItem?.name}</h2>
            <p className="text-sm text-gray-600 break-all">{selectedItem?.description || "Нет описания"}</p>

            <div className="flex justify-between mt-4">
              <Button onClick={handlePrevItem} disabled={isFirst}>←</Button>
              <Button onClick={handleNextItem} disabled={isLast}>→</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}