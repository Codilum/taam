"use client"

import { useState, useEffect } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const parseUploadError = async (res: Response, fallback: string) => {
  try {
    const text = await res.text()
    if (!text) return fallback

    try {
      const data = JSON.parse(text) as any
      if (typeof data === "string" && data.trim()) return data
      if (data && typeof data.message === "string" && data.message.trim()) {
        return data.message
      }
      if (data && typeof data.detail === "string" && data.detail.trim()) {
        return data.detail
      }
      if (data && typeof data.error === "string" && data.error.trim()) {
        return data.error
      }
    } catch {
      if (text.trim()) {
        return text
      }
    }
  } catch {
    return fallback
  }

  return fallback
}

// Тип для данных аккаунта
interface AccountData {
  email: string
  first_name: string | null
  last_name: string | null
  photo: string | null
  phone: string | null
  is_profile_complete: boolean
}

export default function AccountSettings({ activeTeam }: { activeTeam: string }) {
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [showIncompleteProfileAlert, setShowIncompleteProfileAlert] = useState(false)

  // Загрузка данных профиля
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) throw new Error("No token")
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error("Failed to fetch profile")
        const data: AccountData = await response.json()
        setAccountData(data)
        setShowIncompleteProfileAlert(!data.is_profile_complete)
        setLoading(false)
      } catch (error) {
        console.error("Ошибка загрузки профиля:", error)
        toast.error("Ошибка загрузки профиля")
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Инициализация полей редактирования
  useEffect(() => {
    if (accountData) {
      setNewFirstName(accountData.first_name || "")
      setNewLastName(accountData.last_name || "")
      setNewPhone(accountData.phone || "")
      setPhotoPreview(accountData.photo || null)
    }
  }, [accountData, isEditDialogOpen])

  // Обработка выбора фото
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setNewPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // Сохранение изменений профиля
  const handleSaveProfileChanges = async () => {
    if (!accountData) return
    try {
      const token = localStorage.getItem("access_token")
      if (!token) throw new Error("No token")

      // Обновление имени, фамилии и телефона
      const updateData: Partial<AccountData> = {}
      if (newFirstName && newFirstName !== accountData.first_name) {
        updateData.first_name = newFirstName
      }
      if (newLastName !== accountData.last_name) {
        updateData.last_name = newLastName
      }
      if (newPhone && newPhone !== accountData.phone) {
        updateData.phone = newPhone
      }

      if (Object.keys(updateData).length > 0) {
        const response = await fetch("/api/account", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        })
        if (!response.ok) throw new Error("Failed to update profile")
        const data: AccountData = await response.json()
        setAccountData({ ...accountData, ...data })
        setShowIncompleteProfileAlert(!data.is_profile_complete)
      }

      // Загрузка фото
      if (newPhotoFile) {
        setUploadingPhoto(true)
        const formData = new FormData()
        formData.append("file", newPhotoFile)
        const photoResponse = await fetch("/api/upload-photo", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!photoResponse.ok) {
          const message = await parseUploadError(
            photoResponse,
            "Ошибка загрузки фото"
          )
          throw new Error(message)
        }
        const photoData: AccountData = await photoResponse.json()
        setAccountData({ ...accountData, photo: photoData.photo, is_profile_complete: photoData.is_profile_complete })
        setShowIncompleteProfileAlert(!photoData.is_profile_complete)
        setNewPhotoFile(null)
        setPhotoPreview(null)
      }

      setIsEditDialogOpen(false)
      toast.success("Данные профиля обновлены")
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Не удалось обновить данные профиля"
      toast.error(message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Удаление аккаунта
  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) throw new Error("No token")
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error("Failed to delete account")
      localStorage.removeItem("access_token")
      window.location.href = "/login"
      toast.success("Аккаунт удалён")
    } catch (error) {
      toast.error("Не удалось удалить аккаунт")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Профиль аккаунта</CardTitle>
          <CardDescription>Управление вашими личными данными</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : accountData ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={accountData.photo || "/avatars/default.jpg"} alt={accountData.first_name || "User"} style={{ objectFit: "cover" }} />
                  <AvatarFallback>{accountData.first_name?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">
                    {accountData.first_name || accountData.last_name
                      ? `${accountData.first_name ?? ""} ${accountData.last_name ?? ""}`.trim()
                      : "Имя не указано"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {accountData.phone || "Телефон не указан"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={accountData.email} disabled className="mt-1" />
              </div>
            </>
          ) : (
            <p>Ошибка загрузки данных</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => setIsEditDialogOpen(true)} style={{ backgroundColor: '#FFEA5A', color: '#000' }}>
            Редактировать профиль
          </Button>
        </CardFooter>
      </Card>

      {/* Popup для редактирования профиля */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать профиль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Фото профиля</Label>
              <div className="flex items-center gap-4 mt-2">
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={photoPreview || accountData?.photo || "/avatars/default.jpg"} style={{ objectFit: "cover" }} />
                    <AvatarFallback>{accountData?.first_name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Имя*</Label>
                <Input
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Иван"
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex-1">
                <Label>Фамилия</Label>
                <Input
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Иванов"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Номер телефона*</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+79999999999"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSaveProfileChanges}
              disabled={!newFirstName || !newPhone}
              style={{ backgroundColor: '#FFEA5A', color: '#000' }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Опасная зона</CardTitle>
          <CardDescription>Действия, которые являются необратимыми</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>Удаление</p>
            <p className="text-sm text-muted-foreground">
              Это действие невозможно отменить. Все данные, связанные с этим аккаунтом, будут удалены.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Удалить</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие необратимо. Все данные, связанные с аккаунтом, будут удалены. Вы уверены?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button variant="destructive" onClick={handleDeleteAccount}>
                    Удалить
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  )
}
