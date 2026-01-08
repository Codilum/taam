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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { authService } from "@/services"

type Mode = "login" | "register" | "forgot" | "reset"


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


  const sendCode = async () => {
    setIsLoading(true)
    try {
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
        await authService.register({ email, password })
      } else if (mode === "forgot") {
        await authService.forgotPassword({ email })
      } else {
        throw new Error("Неверный режим отправки кода")
      }

      setCodeSent(true)
      if (mode === "register") {
        setCanResendRegister(false)
        setCountdownRegister(60)
      } else {
        setCanResendForgot(false)
        setCountdownForgot(60)
      }
    } catch (err: any) {
      setError(err.detail || err.message || "Ошибка отправки кода")
    } finally {
      setIsLoading(false)
    }
  }

  const verifyCode = async () => {
    try {
      return await authService.verifyEmail({ email, code })
    } catch (err: any) {
      setError(err.detail || err.message || "Ошибка проверки кода")
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
      await authService.resetPassword(email, code, newPassword)
      changeMode("login")
    } catch (err: any) {
      setError(err.detail || err.message || "Ошибка сброса пароля")
    } finally {
      setIsLoading(false)
    }
  }

  const login = async () => {
    setIsLoading(true)
    try {
      const data = await authService.login({ email, password })
      localStorage.setItem("access_token", data.access_token)
      router.push("/dashboard")
    } catch (err: any) {
      console.log(err)
      setError(err.detail || err.message || "Ошибка входа")
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
      <Card className="overflow-hidden p-0 border-none shadow-lg">
        <CardContent className="grid p-0 md:grid-cols-1">
          <div className="flex flex-col">
            <div className="p-6 md:p-8 flex flex-col h-full">
              <form onSubmit={handleSubmit} className="flex-grow">
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center mb-4">
                    <h1 className="text-2xl font-bold">
                      {mode === "login" && "Добро пожаловать"}
                      {mode === "register" && "Регистрация"}
                      {mode === "forgot" && "Восстановление пароля"}
                      {mode === "reset" && "Новый пароль"}
                    </h1>
                    <p className="text-muted-foreground text-balance">
                      {mode === "login" && "Войдите в ваш аккаунт taam.menu"}
                      {mode === "register" && (codeSent ? "Введите код из письма" : "Создайте новый аккаунт")}
                      {mode === "forgot" && (codeSent ? "Введите код из письма" : "Укажите ваш email")}
                      {mode === "reset" && "Введите новый пароль"}
                    </p>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Email fields */}
                  {(mode === "login" || (mode === "register" && !codeSent) || (mode === "forgot" && !codeSent)) && (
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={cn(fieldErrors.email && "border-red-500")}
                      />
                      {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                    </Field>
                  )}

                  {/* Password fields for Login and Initial Registration */}
                  {(mode === "login" || (mode === "register" && !codeSent)) && (
                    <Field>
                      <div className="flex items-center">
                        <FieldLabel htmlFor="password">Пароль</FieldLabel>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => changeMode("forgot")}
                            className="ml-auto text-sm underline-offset-2 hover:underline"
                          >
                            Забыли пароль?
                          </button>
                        )}
                      </div>
                      <PasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        show={showPassword}
                        setShow={setShowPassword}
                        required
                      />
                      {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                    </Field>
                  )}

                  {/* Confirm Password for Registration */}
                  {mode === "register" && !codeSent && (
                    <Field>
                      <FieldLabel htmlFor="confirmPassword">Подтвердите пароль</FieldLabel>
                      <PasswordInput
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        show={showConfirmPassword}
                        setShow={setShowConfirmPassword}
                        required
                      />
                      {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
                    </Field>
                  )}

                  {/* Identification code fields */}
                  {(mode === "register" || mode === "forgot" || mode === "reset") && codeSent && (
                    <Field>
                      <FieldDescription className="text-center mb-2">
                        Мы отправили код на <span className="font-medium">{email}</span>.
                        Проверьте почту (и папку Спам).
                      </FieldDescription>
                      <FieldLabel htmlFor="code">Код из письма</FieldLabel>
                      <Input
                        id="code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        className={cn(fieldErrors.code && "border-red-500")}
                      />
                      {fieldErrors.code && <p className="text-xs text-red-500">{fieldErrors.code}</p>}

                      <div className="text-center mt-2">
                        {(mode === "register" && canResendRegister) || (mode === "forgot" && canResendForgot) ? (
                          <button type="button" onClick={sendCode} className="text-sm underline hover:no-underline text-muted-foreground">
                            Отправить код ещё раз
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Повторить через {mode === "register" ? countdownRegister : countdownForgot}с
                          </span>
                        )}
                      </div>
                    </Field>
                  )}

                  {/* New Password fields for Reset */}
                  {mode === "reset" && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="newPassword">Новый пароль</FieldLabel>
                        <PasswordInput
                          id="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          show={showNewPassword}
                          setShow={setShowNewPassword}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="confirmNewPassword">Подтвердите новый пароль</FieldLabel>
                        <PasswordInput
                          id="confirmNewPassword"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          show={showConfirmNewPassword}
                          setShow={setShowConfirmNewPassword}
                          required
                        />
                      </Field>
                    </>
                  )}

                  <Field className="mt-2">
                    <Button type="submit" className="w-full bg-[#FFEB5A] text-[#3d3d3d] hover:bg-[#fbe23f] font-semibold h-11" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {mode === "login" && "Войти"}
                          {mode === "register" && (codeSent ? "Зарегистрироваться" : "Отправить код")}
                          {mode === "forgot" && (codeSent ? "Проверить код" : "Отправить код")}
                          {mode === "reset" && "Сбросить пароль"}
                        </>
                      )}
                    </Button>
                  </Field>

                  {mode === "login" && (
                    <>
                      <FieldSeparator>ИЛИ</FieldSeparator>
                      <Field>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-11 border-2 border-[#FFEB5A] hover:bg-[#FFEB5A]/10"
                          onClick={() => changeMode("register")}
                        >
                          Создать аккаунт
                        </Button>
                      </Field>
                    </>
                  )}

                  {mode !== "login" && (
                    <div className="text-center mt-4">
                      <button
                        type="button"
                        onClick={() => changeMode("login")}
                        className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
                      >
                        Вернуться ко входу
                      </button>
                    </div>
                  )}
                </FieldGroup>
              </form>
            </div>
            <div className="p-6 pt-0 text-center">
              <p className="text-xs text-muted-foreground">
                Продолжая, вы соглашаетесь с нашими{" "}
                <a href="/docs/policy.pdf" className="underline underline-offset-2">Условиями обслуживания</a>{" "}
                и <a href="/docs/policy.pdf" className="underline underline-offset-2">Политикой конфиденциальности</a>.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
