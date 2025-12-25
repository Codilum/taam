"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LogIn, Loader2 } from "lucide-react"
import { PasswordInput } from "@/components/password-input"

type Mode = "login" | "register" | "forgot" | "reset"

const API_URL = "http://taam.menu/api"

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({})
  const [canResendRegister, setCanResendRegister] = useState(true)
  const [canResendForgot, setCanResendForgot] = useState(true)
  const [countdownRegister, setCountdownRegister] = useState(0)
  const [countdownForgot, setCountdownForgot] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  const resetForm = useCallback(() => {
    setPassword("")
    setConfirmPassword("")
    setCode("")
    setNewPassword("")
    setConfirmNewPassword("")
    setCodeSent(false)
    setError("")
    setFieldErrors({})
  }, [])

  const changeMode = useCallback(
    (newMode: Mode) => {
      resetForm()
      setMode(newMode)
    },
    [resetForm]
  )

  useEffect(() => {
    if (countdownRegister > 0) {
      const timer = setTimeout(() => setCountdownRegister(countdownRegister - 1), 1000)
      return () => clearTimeout(timer)
    } else setCanResendRegister(true)
  }, [countdownRegister])

  useEffect(() => {
    if (countdownForgot > 0) {
      const timer = setTimeout(() => setCountdownForgot(countdownForgot - 1), 1000)
      return () => clearTimeout(timer)
    } else setCanResendForgot(true)
  }, [countdownForgot])

  const parseError = async (res: Response) => {
    try {
      const data = await res.json()
      if (data?.detail) return data.detail
      return JSON.stringify(data)
    } catch {
      return await res.text()
    }
  }

  const sendCode = async () => {
    setIsLoading(true)
    try {
      let res: Response
      if (mode === "register") {
        if (password !== confirmPassword) {
          setFieldErrors({
            password: "Пароли не совпадают",
            confirmPassword: "Пароли не совпадают",
          })
          setError("Пароли не совпадают")
          setIsLoading(false)
          return
        }
        res = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
      } else if (mode === "forgot") {
        res = await fetch(`${API_URL}/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      } else {
        throw new Error("Неверный режим отправки кода")
      }

      if (!res.ok) throw new Error(await parseError(res))

      setCodeSent(true)
      if (mode === "register") {
        setCanResendRegister(false)
        setCountdownRegister(60)
      } else {
        setCanResendForgot(false)
        setCountdownForgot(60)
      }
    } catch (err: any) {
      setError(err.message || "Ошибка отправки кода")
    } finally {
      setIsLoading(false)
    }
  }

  const verifyCode = async () => {
    try {
      const res = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      if (!res.ok) throw new Error(await parseError(res))
      return await res.json()
    } catch (err: any) {
      setError(err.message || "Ошибка проверки кода")
      return null
    }
  }

  const resetPassword = async () => {
    if (newPassword !== confirmNewPassword) {
      setFieldErrors({
        newPassword: "Пароли не совпадают",
        confirmNewPassword: "Пароли не совпадают",
      })
      setError("Пароли не совпадают")
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      })
      if (!res.ok) throw new Error(await parseError(res))
      changeMode("login")
    } catch (err: any) {
      setError(err.message || "Ошибка сброса пароля")
    } finally {
      setIsLoading(false)
    }
  }

  const login = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(await parseError(res))
      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || "Ошибка входа")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFieldErrors({})
    if (mode === "login") return login()
    if (mode === "register") {
      if (!codeSent) return sendCode()
      const ok = await verifyCode()
      if (ok) {
        await login()
      }
    }
    if (mode === "forgot") {
      if (!codeSent) return sendCode()
      const ok = await verifyCode()
      if (ok) changeMode("reset")
    }
    if (mode === "reset") return resetPassword()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "login" && "Добро пожаловать"}
            {mode === "register" && "Регистрация"}
            {mode === "forgot" && "Восстановление пароля"}
            {mode === "reset" && "Новый пароль"}
          </CardTitle>
          <CardDescription>
            {mode === "login" && "Войдите в ваш аккаунт"}
            {mode === "register" && (codeSent ? "Введите код из письма" : "Создайте новый аккаунт")}
            {mode === "forgot" && (codeSent ? "Введите код из письма" : "Укажите email")}
            {mode === "reset" && "Введите новый пароль"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="grid gap-6">
            {/* Email при login, register(до кода), forgot(до кода) */}
            {(mode === "login" || (mode === "register" && !codeSent) || (mode === "forgot" && !codeSent)) && (
              <div className="grid gap-3">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={cn(fieldErrors.email && "border-red-500 focus-visible:ring-red-500")}
                />
                {fieldErrors.email && <p className="text-sm text-red-500">{fieldErrors.email}</p>}
              </div>
            )}

            {/* Пароль при login или register(до кода) */}
            {(mode === "login" || (mode === "register" && !codeSent)) && (
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label>Пароль</Label>
                  {mode === "login" && (
                    <Button
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                      variant="link"
                      onClick={() => changeMode("forgot")}
                      type="button"
                    >
                      Забыли пароль?
                    </Button>
                  )}
                </div>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  show={showPassword}
                  setShow={setShowPassword}
                  error={fieldErrors.password}
                  required
                />
                {fieldErrors.password && <p className="text-sm text-red-500">{fieldErrors.password}</p>}
              </div>
            )}

            {/* Подтверждение пароля при register (до кода) */}
            {mode === "register" && !codeSent && (
              <div className="grid gap-3">
                <Label>Подтвердите пароль</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  show={showConfirmPassword}
                  setShow={setShowConfirmPassword}
                  error={fieldErrors.confirmPassword}
                  required
                />
                {fieldErrors.confirmPassword && <p className="text-sm text-red-500">{fieldErrors.confirmPassword}</p>}
              </div>
            )}

            {/* Сообщение после отправки кода при register */}
            {mode === "register" && codeSent && (
              <p className="text-center text-sm text-muted-foreground">
                Мы отправили код на <span className="font-medium">{email}</span>.  
                Пожалуйста, проверьте почту — письмо может оказаться в папке <span className="font-medium">Спам</span>.
              </p>
            )}
          {mode === "forgot" && codeSent && (
            <p className="text-center text-sm text-muted-foreground">
              Мы отправили код для восстановления пароля на <span className="font-medium">{email}</span>.  
              Пожалуйста, проверьте почту — письмо может оказаться в папке <span className="font-medium">Спам</span>.
            </p>
          )}

            {/* Поле кода при register/forgot/reset */}
            {(mode === "register" || mode === "forgot" || mode === "reset") && codeSent && (
              <div className="grid gap-3">
                <Label>Код из письма</Label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className={cn(fieldErrors.code && "border-red-500 focus-visible:ring-red-500")}
                />
                {fieldErrors.code && <p className="text-sm text-red-500">{fieldErrors.code}</p>}
              </div>
            )}

            {/* Новый пароль при reset */}
            {mode === "reset" && (
              <div className="grid gap-3">
                <Label>Новый пароль</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  show={showNewPassword}
                  setShow={setShowNewPassword}
                  error={fieldErrors.newPassword}
                  required
                />
                <Label>Подтвердите новый пароль</Label>
                <PasswordInput
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  show={showConfirmNewPassword}
                  setShow={setShowConfirmNewPassword}
                  error={fieldErrors.confirmNewPassword}
                  required
                />
              </div>
            )}

            {/* Кнопка действия */}
            <Button type="submit" className="w-full flex items-center gap-2 bg-[#FFEB5A] text-[#3d3d3d] hover:bg-[#fbe23f]" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" && <LogIn className="w-4 h-4" />}
              {mode === "login"
                ? "Войти"
                : mode === "register"
                ? codeSent
                  ? "Зарегистрироваться"
                  : "Отправить код"
                : mode === "forgot"
                ? codeSent
                  ? "Проверить код"
                  : "Отправить код"
                : "Сбросить пароль"}
            </Button>

            {/* Повторная отправка кода */}
            {(mode === "register" || mode === "forgot") && codeSent && (
              <div className="text-center text-sm text-muted-foreground">
                {(mode === "register" && canResendRegister) || (mode === "forgot" && canResendForgot) ? (
                  <button type="button" onClick={sendCode} className="underline hover:no-underline">
                    Отправить код ещё раз
                  </button>
                ) : (
                  `Повторить через ${mode === "register" ? countdownRegister : countdownForgot}с`
                )}
              </div>
            )}
          </form>

          <div className="flex flex-col gap-2 mt-4">
            {mode === "login" && (
              <Button variant="outline" onClick={() => changeMode("register")}>
                Зарегистрироваться
              </Button>
            )}
            {mode !== "login" && (
              <Button variant="outline" onClick={() => changeMode("login")}>
                Назад ко входу
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
