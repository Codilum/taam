import { api } from "@/lib/api";

export const authService = {
    login: (data: any) => api.post<any>("/login", data),
    register: (data: any) => api.post<any>("/register", data),
    verifyEmail: (data: any) => api.post<any>("/verify", data),
    forgotPassword: (data: any) => api.post<any>("/forgot-password", data),
    resetPassword: (email: string, code: string, password: string) =>
        api.post<any>("/reset-password", { email, code, new_password: password }),
};
