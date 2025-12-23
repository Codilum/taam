import { api } from "@/lib/api";

export const subscriptionService = {
    getPlans: () => api.get<any>("/subscriptions/plans"),
    getSubscription: (restaurantId: string | number) =>
        api.get<any>(`/restaurants/${restaurantId}/subscription`),
    getHistory: (restaurantId: string | number) =>
        api.get<any>(`/restaurants/${restaurantId}/subscription/history`),
    subscribe: (restaurantId: string | number, data: any) =>
        api.post<any>(`/restaurants/${restaurantId}/subscription`, data),
    refreshPayment: (restaurantId: string | number, paymentId: string) =>
        api.post<any>(`/restaurants/${restaurantId}/subscription/refresh`, { payment_id: paymentId }),
    cancelPending: (restaurantId: string | number, paymentId: string | null) =>
        api.post<any>(`/restaurants/${restaurantId}/subscription/cancel`, { payment_id: paymentId }),
    grantTrial: (restaurantId: string | number) =>
        api.post<any>(`/restaurants/${restaurantId}/subscription/grant-trial`),
};
