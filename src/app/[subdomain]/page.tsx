import MenuPageClient from "./MenuPageClient"
import { restaurantService, menuService } from "@/services"

// Все типы — только здесь. Компонент ниже — серверный (без "use client")
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

export default async function SubdomainPage({
  // ВАЖНО: в Next 14.2+/15 params может быть асинхронным
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  const [restaurantData, menuData] = await Promise.all([
    restaurantService.getBySubdomain(subdomain).catch(() => null),
    menuService.getBySubdomain(subdomain).catch(() => ({ categories: [] })),
  ])

  if (!restaurantData) {
    return <div className="p-10 text-center text-xl">Ресторан не найден</div>
  }

  const data: RestaurantData = {
    ...restaurantData,
    features: Array.isArray(restaurantData.features) ? restaurantData.features : [],
    menu: Array.isArray(menuData?.categories) ? (menuData.categories as MenuCategory[]) : [],
  }

  return <MenuPageClient data={data} />
}
