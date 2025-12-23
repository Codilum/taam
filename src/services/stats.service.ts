import { api } from "@/lib/api"

export interface DashboardStats {
    total_orders: number
    total_revenue: number
    average_check: number
    orders_by_status: Record<string, number>
    sales_by_category: { category: string; count: number; revenue: number }[]
    sales_by_item: { item: string; count: number; revenue: number }[]
    dispatch_time_avg: number // minutes
    delivery_time_avg: number // minutes
    chart_data: { date: string; orders: number; revenue: number }[]
}

export type StatsPeriod = 'day' | 'week' | 'month' | 'year'

export const statsService = {
    getDashboardStats: (restaurantId: string | number, period: StatsPeriod = 'day') =>
        api.get<DashboardStats>(`/restaurants/${restaurantId}/stats/dashboard?period=${period}`)
}
