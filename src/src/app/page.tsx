"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true); // компонент смонтирован
    const t = localStorage.getItem("access_token");
    setToken(t);
  }, []);

  if (!mounted) return null; // ничего не рендерим на сервере

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />

        {/* Кнопка входа или кабинет */}
        <div className="mt-4">
          <Link className="btn" href={token ? "/dashboard" : "/login"}>
            {token ? "Кабинет" : "Войти"}
          </Link>
        </div>
      </main>
    </div>
  );
}
