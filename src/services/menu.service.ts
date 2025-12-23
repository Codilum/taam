import { api } from "@/lib/api";

export const menuService = {
    getStandardCategories: () => api.get<any>("/menu-categories"),
    getCategories: (restaurantId: string | number) => api.get<any>(`/restaurants/${restaurantId}/categories`),
    getMenu: (restaurantId: string | number) => api.get<any>(`/restaurants/${restaurantId}/menu`),
    getBySubdomain: (subdomain: string) =>
        api.get<any>(`/menu/by-subdomain/${subdomain}`),
    createCategory: (restaurantId: string | number, data: any) =>
        api.post<any>(`/restaurants/${restaurantId}/menu-categories`, data),

    updateCategory: (restaurantId: string | number, categoryId: string | number, data: any) =>
        api.patch<any>(`/restaurants/${restaurantId}/menu-categories/${categoryId}`, data),

    deleteCategory: (restaurantId: string | number, categoryId: string | number) =>
        api.delete<any>(`/restaurants/${restaurantId}/menu-categories/${categoryId}`),

    createItem: (restaurantId: string | number, categoryId: string | number, data: FormData) =>
        api.post<any>(`/restaurants/${restaurantId}/menu-categories/${categoryId}/items`, data),

    updateItem: (restaurantId: string | number, itemId: string | number, data: any) =>
        api.patch<any>(`/restaurants/${restaurantId}/menu-items/${itemId}`, data),

    deleteItem: (restaurantId: string | number, itemId: string | number) =>
        api.delete<any>(`/restaurants/${restaurantId}/menu-items/${itemId}`),

    uploadItemPhoto: (restaurantId: string | number, itemId: string | number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post<any>(`/restaurants/${restaurantId}/menu-items/${itemId}/upload-photo`, formData);
    },

    importCsv: (restaurantId: string | number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post<any>(`/restaurants/${restaurantId}/menu/import-csv`, formData);
    },

    exportCsv: (restaurantId: string | number) =>
        api.getBlob(`/restaurants/${restaurantId}/menu/export-csv`)
};
