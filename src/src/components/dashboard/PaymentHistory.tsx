"use client"

import { useEffect, useMemo, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { showErrorToast } from "@/lib/show-error-toast"

type HistoryEntry = {
  id: number
  plan_code: string
  plan_name: string
  status: string
  created_at?: string | null
  started_at?: string | null
  expires_at?: string | null
  amount?: number
  amount_minor?: number
  currency?: string
  duration_days?: number | null
}

const statusLabels: Record<string, string> = {
  active: "Активна",
  pending: "Ожидает оплаты",
  expired: "Истекла",
  canceled: "Отменена",
}

const badgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "outline",
  expired: "secondary",
  canceled: "destructive",
}

const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
  if (amount == null) return "—"
  const cur = currency || "RUB"
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${cur}`
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const normalized = value.replace(" ", "T")
  const date = new Date(`${normalized}Z`)
  if (Number.isNaN(date.getTime())) {
    return value.split(" ")[0]
  }
  return date.toLocaleDateString("ru-RU")
}

export default function PaymentHistory({ activeTeam }: { activeTeam: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      if (!activeTeam) {
        setHistory([])
        return
      }
      const token = localStorage.getItem("access_token")
      if (!token) return
      setLoading(true)
      try {
        const res = await fetch(`/api/restaurants/${activeTeam}/subscription/history`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        const raw = await res.text()
        let data: any = null
        if (raw) {
          try {
            data = JSON.parse(raw)
          } catch {
            data = null
          }
        }
        if (!res.ok) {
          if (!cancelled) {
            const message = data?.detail || data?.message || raw || "Не удалось загрузить историю"
            showErrorToast(message)
          }
          return
        }
        if (!cancelled && Array.isArray(data?.history)) {
          setHistory(data.history)
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          showErrorToast("Не удалось загрузить историю подписок")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [activeTeam])

  const current = useMemo(
    () => history.find((entry) => entry.status === "active"),
    [history],
  )

  if (!activeTeam) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>История оплат</CardTitle>
            <CardDescription>Чтобы увидеть историю, выберите заведение в боковом меню.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>История подписок</CardTitle>
          <CardDescription>
            Здесь отображаются все оформленные подписки и их статус.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Загружаем историю…</span>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">История оплат пока пуста.</p>
          ) : (
            <>
              {current && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Ваша текущая подписка: <strong>{current.plan_name}</strong>
                  {current.expires_at && (
                    <>
                      , действует до <strong>{formatDate(current.expires_at)}</strong>
                    </>
                  )}
                  .
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Подписка</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата оформления</TableHead>
                      <TableHead>Начало</TableHead>
                      <TableHead>Окончание</TableHead>
                      <TableHead>Стоимость</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => {
                      const label = statusLabels[entry.status] || entry.status
                      const variant = badgeVariants[entry.status] || "secondary"
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.plan_name}</TableCell>
                          <TableCell>
                            <Badge variant={variant}>{label}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(entry.created_at)}</TableCell>
                          <TableCell>{formatDate(entry.started_at)}</TableCell>
                          <TableCell>{formatDate(entry.expires_at)}</TableCell>
                          <TableCell>
                            {formatCurrency(entry.amount, entry.currency)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

