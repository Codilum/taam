
"use client"

import { useEffect, useState } from "react"
import ViewData from "@/components/dashboard/ViewData"
import { useRouter } from "next/navigation"

interface Restaurant {
  id: number
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
  type: string | null
  phone: string | null
  subdomain: string | null
}

export default function SubdomainPage() {
  const router = useRouter()
  const [subdomain, setSubdomain] = useState<string>("")
  const [restaurantId, setRestaurantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Получаем subdomain из URL
    const hostname = window.location.hostname
    const currentSubdomain = hostname.split('.')[0]
    
    if (currentSubdomain === 'taam' || currentSubdomain === 'www') {
      setError(true)
      setLoading(false)
      return
    }
    
    setSubdomain(currentSubdomain)
  }, [])

  useEffect(() => {
    if (!subdomain) return

    const fetchRestaurant = async () => {
      try {
        const res = await fetch(`http://taam.menu:8003/api/restaurants/by-subdomain/${subdomain}`)
        if (!res.ok) throw new Error("not found")
        const data: Restaurant = await res.json()
        setRestaurantId(data.id)
      } catch (e) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [subdomain])

  if (loading) return <div className="p-10 text-center text-xl">Загрузка...</div>
  if (error || !restaurantId) return <div className="p-10 text-center text-xl">Ресторан не найден</div>

  return <ViewData activeTeam={String(restaurantId)} />
}