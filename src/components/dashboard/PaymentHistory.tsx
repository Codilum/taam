"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const mockPayments = [
  {
    id: 1,
    plan: "Базовая подписка",
    period: "1 месяц",
    amount: "499 ₽",
    date: "2025-08-01",
    expires: "2025-09-01",
  },
  {
    id: 2,
    plan: "Премиум подписка",
    period: "3 месяца",
    amount: "1299 ₽",
    date: "2025-05-01",
    expires: "2025-08-01",
  },
]

export default function PaymentHistory({ activeTeam }: { activeTeam: string }) {
  const [payments] = useState(mockPayments)
  const current = payments[0] // для примера считаем первый элемент активным

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* <h2 className="text-xl font-bold">
        История оплат: {activeTeam === "restaurant1" ? "Ресторан 1" : "Ресторан 2"}
      </h2> */}
      {current && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-800">
              Ваша текущая подписка: <strong>{current.plan}</strong>, истекает{" "}
              <strong>{current.expires}</strong>.
            </p>
          </div>
        )}
      <div className="bg-muted/50 flex-1 rounded-xl p-4">
        {payments.length === 0 ? (
          <p className="text-gray-500">История оплат пока пуста.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Подписка</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Дата покупки</TableHead>
                <TableHead>Окончание</TableHead>
                <TableHead>Стоимость</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.plan}</TableCell>
                  <TableCell>{p.period}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{p.expires}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>
                    <Badge variant={p.id === current.id ? "default" : "secondary"}>
                      {p.id === current.id ? "Активна" : "Истекла"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
