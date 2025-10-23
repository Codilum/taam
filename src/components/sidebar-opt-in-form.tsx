"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface QrCardProps {
  qrSrc?: string | null
  qrLink: string
  className?: string
  collapsed?: boolean // <-- состояние из родителя
  setCollapsed?: (val: boolean) => void // <-- функция управления
}

export function QrCard({ qrSrc, qrLink, className, collapsed, setCollapsed }: QrCardProps) {
  const [localCollapsed, setLocalCollapsed] = useState(collapsed ?? false)

  const isCollapsed = collapsed ?? localCollapsed
  const hasQr = !!qrSrc
  const toggleCollapsed = () => {
    if (setCollapsed) setCollapsed(!isCollapsed)
    else setLocalCollapsed(!isCollapsed)
  }

  const handleDownload = () => {
    if (!hasQr) return
    const link = document.createElement("a")
    link.href = qrSrc as string
    link.download = "qr-code.png"
    link.click()
  }

  const handleCopy = async () => {
    if (!qrLink) return
    await navigator.clipboard.writeText(qrLink)
    toast.success("Ссылка скопирована.")
  }

  return (
    <Card className={`${className} qr-card border-none shadow gap-2`}>
      <CardHeader className="flex flex-col items-center gap-0">
        <CardTitle>Ваш QR</CardTitle>
        {isCollapsed && (
          <Button variant="link" onClick={toggleCollapsed} className="text-sm underline-offset-4 hover:underline" type="button">
            Показать
          </Button>
        )}
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="flex flex-col items-center gap-2">
          {hasQr ? (
            <img
              src={qrSrc as string}
              alt="QR Code"
              className="w-32 h-32 object-contain"
            />
          ) : (
            <div className="w-32 h-32 rounded-lg border border-dashed flex items-center justify-center text-center text-xs text-muted-foreground p-2">
              QR появится после указания поддомена
            </div>
          )}
          <div className="grid gap-2.5 w-full">
            <Button
              onClick={handleDownload}
              className="w-full"
              style={{ backgroundColor: '#FFEA5A', color: '#000' }}
              disabled={!hasQr}
            >
              Скачать QR
            </Button>
            <Button
              variant="outline"
              onClick={handleCopy}
              className="w-full"
              disabled={!qrLink}
            >
              Скопировать ссылку
            </Button>
            <Button variant="link" onClick={toggleCollapsed} className="mx-auto text-sm underline-offset-4 hover:underline" type="button">
              Скрыть
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
