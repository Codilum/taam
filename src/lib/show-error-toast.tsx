import { toast } from "sonner"

const limitToastButtonClasses =
  "mt-3 inline-flex w-full items-center justify-center rounded-md bg-[#FFEA5A] px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-[#ffe142] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFEA5A]"

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
      duration: 6000,
      description: (
        <button className={limitToastButtonClasses} onClick={goToTariffs} type="button">
          Оформить подписку
        </button>
      ),
    })
    return
  }
  toast.error(text)
}
