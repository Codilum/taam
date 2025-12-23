import { api } from "@/lib/api";

export const restaurantService = {
    getRestaurants: () => api.get<any[]>("/restaurants"),
    getRestaurant: (id: string | number) => api.get<any>(`/restaurants/${id}`),
    getBySubdomain: (subdomain: string) => api.get<any>(`/restaurants/by-subdomain/${subdomain}`),
    updateRestaurant: (id: string | number, data: any) => api.patch<any>(`/restaurants/${id}`, data),
    deleteRestaurant: (restaurantId: string | number) =>
        api.delete<any>(`/restaurants/${restaurantId}`),
    createRestaurant: (data: any) =>
        api.post<any>("/restaurants", data),
    uploadPhoto: (restaurantId: string | number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post<any>(`/restaurants/${restaurantId}/upload-photo`, formData);
    },
};
