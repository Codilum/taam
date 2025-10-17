"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface QrCardProps {
  qrSrc: string
  qrLink: string
  className?: string
  collapsed?: boolean // <-- состояние из родителя
  setCollapsed?: (val: boolean) => void // <-- функция управления
}

export function QrCard({ qrSrc, qrLink, className, collapsed, setCollapsed }: QrCardProps) {
  const [localCollapsed, setLocalCollapsed] = useState(collapsed ?? false)

  const isCollapsed = collapsed ?? localCollapsed
  const toggleCollapsed = () => {
    if (setCollapsed) setCollapsed(!isCollapsed)
    else setLocalCollapsed(!isCollapsed)
  }

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = qrSrc
    link.download = "qr-code.png"
    link.click()
  }

  const handleCopy = async () => {
    console.log(qrLink)
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
          <img src={qrSrc} alt="QR Code" className="w-32 h-32 object-contain" />
          <div className="grid gap-2.5 w-full">
            <Button onClick={handleDownload} className="w-full" style={{ backgroundColor: '#FFEA5A', color: '#000' }}>
              Скачать QR
            </Button>
            <Button variant="outline" onClick={handleCopy} className="w-full">Скопировать ссылку</Button>
            <Button variant="link" onClick={toggleCollapsed} className="mx-auto text-sm underline-offset-4 hover:underline" type="button">
              Скрыть
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
