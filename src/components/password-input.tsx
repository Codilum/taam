"use client"

import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  show: boolean
  setShow: (val: boolean) => void
}

export function PasswordInput({ error, className, show, setShow, ...props }: PasswordInputProps) {
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={cn(
          "pr-8",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
