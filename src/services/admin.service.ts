import { api } from "@/lib/api";

export const adminService = {
    getOverview: () => api.get<any>("/admin/overview"),
    createUser: (data: {
        email: string
        password: string
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
        role?: "admin" | "user"
        verified?: boolean
        restaurant_name?: string | null
    }) => api.post("/admin/users", data),
    updateUser: (email: string, data: {
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
        role?: "admin" | "user"
        verified?: boolean
        password?: string | null
    }) => api.patch(`/admin/users/${encodeURIComponent(email)}`, data),
};
