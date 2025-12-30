"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCcw, ShieldCheck, Users, UserPlus, PencilLine } from "lucide-react"
import { adminService } from "@/services"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminUser = {
  email: string
  verified: boolean
  first_name: string | null
  last_name: string | null
  phone: string | null
  payment_method_type: string | null
  payment_method_number: string | null
  role: "admin" | "user"
}

type AdminRestaurant = {
  id: number
  name: string
  city: string | null
  address: string | null
  owner_email: string
  subdomain: string | null
  category_count: number
  item_count: number
  visible_items: number
  active_subscription: {
    plan_code: string | null
    plan_name: string | null
    status: string | null
    started_at?: string | null
    expires_at?: string | null
    amount?: number | null
    currency?: string | null
  } | null
  latest_subscription: AdminRestaurant["active_subscription"]
  limits: { category_limit: number | null; item_limit: number | null }
}

type AdminSubscription = {
  id: number
  restaurant_id: number
  restaurant_name: string
  plan_code: string
  plan_name: string
  status: string
  created_at: string | null
  started_at: string | null
  expires_at: string | null
  amount_minor: number
  amount: number
  currency: string
  payment_id: string | null
  is_trial: boolean
}

type AdminPlan = {
  code: string
  name: string
  description?: string | null
  price: number
  price_minor: number
  currency: string
  duration_days?: number | null
  category_limit?: number | null
  item_limit?: number | null
  is_full_access?: boolean
  is_trial?: boolean
  features?: string[]
}

type AdminOverview = {
  summary: Record<string, number>
  users: AdminUser[]
  restaurants: AdminRestaurant[]
  subscriptions: AdminSubscription[]
  plans: AdminPlan[]
  generated_at: string
}

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  return new Date(value.replace(" ", "T")).toLocaleString("ru-RU")
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "user" as "admin" | "user",
    verified: true,
  })
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    role: "user" as "admin" | "user",
    verified: true,
    password: "",
  })

  const loadOverview = useCallback(async () => {
    setRefreshing(true)
    try {
      const payload: AdminOverview = await adminService.getOverview()
      setData(payload)
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.detail || err.message || "Не удалось загрузить данные админ-панели")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (!editingUser) return
    setEditForm({
      first_name: editingUser.first_name || "",
      last_name: editingUser.last_name || "",
      phone: editingUser.phone || "",
      role: editingUser.role || "user",
      verified: editingUser.verified,
      password: "",
    })
  }, [editingUser])

  const summaryItems = useMemo(() => {
    if (!data?.summary) return []
    const entries = [
      { key: "total_users", label: "Пользователи" },
      { key: "total_restaurants", label: "Заведения" },
      { key: "active_subscriptions", label: "Активные подписки" },
      { key: "active_paid_subscriptions", label: "Оплаченные активные" },
      { key: "active_trial_subscriptions", label: "Активные пробные" },
      { key: "pending_payments", label: "Ожидают оплаты" },
    ]
    return entries
      .map(item => ({ ...item, value: data.summary[item.key] ?? 0 }))
      .filter(item => item.value !== undefined)
  }, [data?.summary])

  const refreshButton = (
    <Button onClick={loadOverview} disabled={refreshing} variant="outline">
      {refreshing ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <RefreshCcw className="mr-2 size-4" />
      )}
      Обновить данные
    </Button>
  )

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      setActionError("Email и пароль обязательны")
      return
    }
    setCreating(true)
    setActionError(null)
    try {
      await adminService.createUser({
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name || null,
        last_name: createForm.last_name || null,
        phone: createForm.phone || null,
        role: createForm.role,
        verified: createForm.verified,
      })
      setCreateForm({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        phone: "",
        role: "user",
        verified: true,
      })
      await loadOverview()
    } catch (err: any) {
      setActionError(err.detail || err.message || "Не удалось создать аккаунт")
    } finally {
      setCreating(false)
    }
  }

  const handleEditSave = async () => {
    if (!editingUser) return
    setEditLoading(true)
    setActionError(null)
    try {
      await adminService.updateUser(editingUser.email, {
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        phone: editForm.phone || null,
        role: editForm.role,
        verified: editForm.verified,
        password: editForm.password || null,
      })
      setEditingUser(null)
      await loadOverview()
    } catch (err: any) {
      setActionError(err.detail || err.message || "Не удалось обновить пользователя")
    } finally {
      setEditLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Загрузка админ-панели...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <ShieldCheck className="size-5" />
              Нет доступа
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">{refreshButton}</CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { users, restaurants, subscriptions, plans, generated_at } = data

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Админ-панель</h1>
            <p className="text-muted-foreground">
              Полный обзор пользователей, заведений и подписок. Обновлено: {formatDate(generated_at)}
            </p>
          </div>
          {refreshButton}
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {summaryItems.map(item => (
            <Card key={item.key} className="shadow-sm">
              <CardHeader className="space-y-1 pb-2">
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="text-2xl font-semibold">{item.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" /> Создание аккаунта
            </CardTitle>
            <CardDescription>Добавьте нового пользователя или администратора</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {actionError}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Пароль</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-first-name">Имя</Label>
                <Input
                  id="create-first-name"
                  value={createForm.first_name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, first_name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-last-name">Фамилия</Label>
                <Input
                  id="create-last-name"
                  value={createForm.last_name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, last_name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">Телефон</Label>
                <Input
                  id="create-phone"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Тип аккаунта</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: "admin" | "user") =>
                    setCreateForm((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Пользователь</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant={createForm.verified ? "default" : "outline"}>
                {createForm.verified ? "Подтвержден" : "Не подтвержден"}
              </Badge>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Создать аккаунт
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" /> Пользователи
              </CardTitle>
              <CardDescription>Список зарегистрированных аккаунтов</CardDescription>
            </div>
            <Badge variant="secondary">{users.length}</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Платёжный метод</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.email}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>{user.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? "Админ" : "Пользователь"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.payment_method_type ? (
                        <div className="flex flex-col">
                          <span>{user.payment_method_type}</span>
                          {user.payment_method_number && (
                            <span className="text-xs text-muted-foreground">
                              {user.payment_method_number}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.verified ? "default" : "outline"}>
                        {user.verified ? "Подтвержден" : "Не подтвержден"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)}>
                        <PencilLine className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Заведения</CardTitle>
            <CardDescription>Статус меню и подписок по всем заведениями</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Владелец</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Поддомен</TableHead>
                  <TableHead>Категории</TableHead>
                  <TableHead>Блюда</TableHead>
                  <TableHead>Активная подписка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.map((restaurant) => {
                  const active = restaurant.active_subscription
                  const limits = restaurant.limits
                  return (
                    <TableRow key={restaurant.id}>
                      <TableCell>{restaurant.id}</TableCell>
                      <TableCell className="font-medium">{restaurant.name}</TableCell>
                      <TableCell>{restaurant.owner_email}</TableCell>
                      <TableCell>{restaurant.city || "—"}</TableCell>
                      <TableCell>{restaurant.subdomain || "—"}</TableCell>
                      <TableCell>
                        {restaurant.category_count}
                        {limits.category_limit != null && (
                          <span className="text-xs text-muted-foreground">
                            {` / ${limits.category_limit}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {restaurant.visible_items} / {restaurant.item_count}
                        {limits.item_limit != null && (
                          <span className="text-xs text-muted-foreground">{` (лимит ${limits.item_limit})`}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {active ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{active.plan_name || active.plan_code}</span>
                            <span className="text-xs text-muted-foreground">
                              {active.status === "active" ? "Активна" : active.status || "—"}
                              {active.expires_at && ` · до ${formatDate(active.expires_at)}`}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Последние подписки</CardTitle>
            <CardDescription>Первые 50 записей истории подписок</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Заведение</TableHead>
                  <TableHead>Тариф</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Активна с</TableHead>
                  <TableHead>Действует до</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={`${sub.id}-${sub.restaurant_id}`}>
                    <TableCell>{sub.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{sub.restaurant_name}</span>
                        <span className="text-xs text-muted-foreground">ID: {sub.restaurant_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{sub.plan_name}</span>
                        <span className="text-xs text-muted-foreground">{sub.plan_code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant=
                        {sub.status === "active"
                          ? "default"
                          : sub.status === "pending"
                            ? "outline"
                            : sub.status === "canceled"
                              ? "destructive"
                              : "secondary"}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.amount > 0
                        ? formatCurrency(sub.amount, sub.currency)
                        : sub.is_trial
                          ? "Пробная"
                          : "0"}
                    </TableCell>
                    <TableCell>{formatDate(sub.created_at)}</TableCell>
                    <TableCell>{formatDate(sub.started_at)}</TableCell>
                    <TableCell>{formatDate(sub.expires_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Тарифы</CardTitle>
            <CardDescription>Актуальные параметры тарифных планов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <Card key={plan.code} className="border border-dashed">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="font-semibold">
                      {plan.price > 0
                        ? formatCurrency(plan.price, plan.currency)
                        : "Бесплатно"}
                    </div>
                    <div className="text-muted-foreground">
                      Продолжительность: {plan.duration_days ? `${plan.duration_days} дн.` : "без ограничений"}
                    </div>
                    <div className="text-muted-foreground">
                      Ограничения: {plan.is_full_access
                        ? "Полный доступ"
                        : `${plan.category_limit ?? "∞"} категорий / ${plan.item_limit ?? "∞"} блюд`}
                    </div>
                    {plan.features && plan.features.length > 0 && (
                      <div className="text-muted-foreground">
                        <Separator className="my-2" />
                        <ul className="list-disc pl-4">
                          {plan.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!editingUser} onOpenChange={(open) => setEditingUser(open ? editingUser : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-first-name">Имя</Label>
              <Input
                id="edit-first-name"
                value={editForm.first_name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, first_name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-last-name">Фамилия</Label>
              <Input
                id="edit-last-name"
                value={editForm.last_name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, last_name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Тип аккаунта</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: "admin" | "user") =>
                  setEditForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Новый пароль</Label>
              <Input
                id="edit-password"
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <Badge variant={editForm.verified ? "default" : "outline"}>
              {editForm.verified ? "Подтвержден" : "Не подтвержден"}
            </Badge>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Отмена
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
