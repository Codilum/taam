import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatCurrency(amount: number, currency: string = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getCurrencySymbol(currency: string = "RUB"): string {
  const symbols: Record<string, string> = {
    RUB: "₽",
    BYN: "Br",
    KZT: "₸",
    AZN: "₼",
    UZS: "so'm",
    GEL: "₾",
    KGS: "сом",
    AMD: "֏",
    USD: "$",
    EUR: "€",
    GBP: "£",
    RSD: "дин.",
    THB: "฿",
    CNY: "¥",
    KRW: "₩",
    UAH: "₴",
  }
  return symbols[currency] || currency
}
