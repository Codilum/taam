import { toast } from "sonner"

type NavigateDetail = { block?: string; team?: string }

const hasLimitMessage = (message: string) => {
  const text = message.toLowerCase()
  return text.includes("лимит") && (text.includes("подпис") || text.includes("куп"))
}

const goToTariffs = () => {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  const team = params.get("team") || undefined
  const detail: NavigateDetail = { block: "tariffs" }
  if (team) detail.team = team
  window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail }))
}

export const showErrorToast = (message: string) => {
  const text = message?.toString().trim() || "Произошла ошибка"
  if (hasLimitMessage(text)) {
    toast.warning(text, {
      action: {
        label: "Оформить подписку",
        onClick: goToTariffs,
      },
    })
    return
  }
  toast.error(text)
}
