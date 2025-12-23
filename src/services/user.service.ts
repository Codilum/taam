import { api } from "@/lib/api";

export const userService = {
    getMe: () => api.get<any>("/me"),
    updateProfile: (data: any) => api.patch<any>("/account", data),
    uploadPhoto: (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post<any>("/upload-photo", formData);
    },
    deleteAccount: () => api.delete<any>("/account"),
};
