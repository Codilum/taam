import { api } from "@/lib/api"

export interface OrderItem {
    id: number
    name: string
    quantity: number
    price: number
    total: number
}

export interface Order {
    id: number
    number: string
    order_number?: string
    status: 'pending' | 'cooking' | 'ready' | 'courier' | 'delivered' | 'canceled'
    amount: number
    currency: string
    customer_name: string
    customer_phone: string
    payment_method: string
    delivery_method: string
    delivery_address?: string
    delivery_zone?: string
    delivery_time?: string
    created_at: string
    updated_at: string
    items: OrderItem[]
    delivery_cost?: number
    comment?: string
}

export interface OrderFilters {
    status?: string
    search?: string
}

function buildQuery(filters?: OrderFilters): string {
    if (!filters) return ""
    const params = new URLSearchParams()
    if (filters.status) params.set("status", filters.status)
    if (filters.search) params.set("search", filters.search)
    const qs = params.toString()
    return qs ? `?${qs}` : ""
}

export const orderService = {
    getOrders: (restaurantId: string | number, filters?: OrderFilters) =>
        api.get<{ orders: Order[] }>(`/restaurants/${restaurantId}/orders${buildQuery(filters)}`),

    getActiveOrders: (restaurantId: string | number) =>
        api.get<{ orders: Order[] }>(`/restaurants/${restaurantId}/orders/active`),

    getOrderDetails: (restaurantId: string | number, orderId: number) =>
        api.get<{ order: Order }>(`/restaurants/${restaurantId}/orders/${orderId}`),

    updateOrderStatus: (restaurantId: string | number, orderId: number, status: string) =>
        api.patch<Order>(`/restaurants/${restaurantId}/orders/${orderId}/status`, { status }),

    cancelOrder: (restaurantId: string | number, orderId: number, reason?: string) =>
        api.post<Order>(`/restaurants/${restaurantId}/orders/${orderId}/cancel`, { reason }),

    getNotifications: (restaurantId: string | number) =>
        api.get<{ notifications: any[] }>(`/restaurants/${restaurantId}/notifications`),

    markNotificationRead: (restaurantId: string | number, notificationId: number) =>
        api.post(`/restaurants/${restaurantId}/notifications/${notificationId}/read`, {}),

    markAllNotificationsRead: (restaurantId: string | number) =>
        api.post(`/restaurants/${restaurantId}/notifications/read-all`, {}),

    createOrder: (restaurantId: string | number, data: any) =>
        api.post<{ order_id: number; order_number: string }>(`/restaurants/${restaurantId}/orders`, data)
}
