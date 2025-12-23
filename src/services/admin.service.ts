import { api } from "@/lib/api";

export const adminService = {
    getOverview: () => api.get<any>("/admin/overview"),
};
