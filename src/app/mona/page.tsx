
"use client"

import { useEffect, useState } from "react"
import ViewData from "@/components/dashboard/ViewData"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

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
        const res = await fetch(`/api/restaurants/by-subdomain/${subdomain}`)
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

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 space-y-8">
          {/* Restaurant Info Block */}
          <div className="bg-white rounded-2xl p-6 space-y-6">
            <div className="flex justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" /> {/* Badge */}
                  <Skeleton className="h-8 w-1/3" /> {/* Restaurant name */}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24" /> {/* Feature badge */}
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-4 w-3/4" /> {/* Description */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Skeleton className="h-4 w-24" /> {/* City */}
                  <Skeleton className="h-4 w-24" /> {/* Address */}
                  <Skeleton className="h-4 w-24" /> {/* Hours */}
                  <Skeleton className="h-4 w-24" /> {/* Phone */}
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-6 w-6" /> {/* Social icon */}
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                </div>
              </div>
              <Skeleton className="w-64 h-64 rounded-2xl" /> {/* Photo */}
            </div>
          </div>
          {/* Menu Block */}
          <div className="bg-white rounded-2xl p-6 space-y-6">
            <div className="sticky top-0 bg-white z-1 pb-3 border-b-2 border-black-500 border-solid">
              <Skeleton className="h-6 w-24 mb-2" /> {/* Menu title */}
              <div className="flex gap-3">
                <Skeleton className="h-8 w-20 rounded-lg" /> {/* Category button */}
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
            {/* Category Sections */}
            {[1, 2].map((_, catIndex) => (
              <div key={catIndex} className="space-y-4">
                <Skeleton className="h-6 w-32" /> {/* Category name */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((_, itemIndex) => (
                    <div key={itemIndex} className="p-2">
                      <Skeleton className="w-full h-32 rounded-xl" /> {/* Item photo */}
                      <div className="flex justify-between mt-2">
                        <Skeleton className="h-4 w-3/4" /> {/* Item name */}
                        <Skeleton className="h-4 w-16" /> {/* Price */}
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
  if (error || !restaurantId) return <div className="p-10 text-center text-xl">Ресторан не найден</div>

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <ViewData activeTeam={String(restaurantId)} />
      </div>
      <div className="text-center p-4 text-sm text-gray-500">
        Сделано на <a href="https://taam.menu" className="underline">taam.menu</a>
      </div>
    </div>
  )
}