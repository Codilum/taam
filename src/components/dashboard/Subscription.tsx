"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch"; // Импортируем Switch
import { Label } from "@/components/ui/label"; // Импортируем Label для лучшей семантики

export default function Subscription({ activeTeam }: { activeTeam: string }) {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      id: "demo",
      name: "Демо-доступ",
      description: "Бесплатно на 3 дня с момента регистрации",
      monthlyPrice: "0 ₽",
      yearlyPrice: "0 ₽",
      features: [
        { text: "3 категории в меню" },
        { text: "До 5 блюд в каждой категории" },
        { text: "Возможность сразу перейти на платный тариф" },
      ],
      button: {
        text: "Активировать демо",
        url: "/billing/demo",
      },
    },
    {
      id: "main",
      name: "Основной тариф",
      description: "Полный доступ без ограничений",
      monthlyPrice: "2 999 ₽",
      yearlyPrice: "29 990 ₽",
      features: [
        { text: "1 заведение" },
        { text: "Неограниченные категории и блюда" },
        { text: "Аналитика и статистика" },
        { text: "Поддержка 24/7" },
      ],
      button: {
        text: "Оформить подписку",
        url: "/billing/subscribe",
      },
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h2 className="text-xl font-bold">Тарифы</h2>

      <div className="bg-muted/50 rounded-xl">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-6 text-center">
          {/* Переключатель Ежемесячно / Ежегодно */}
          <div className="flex items-center gap-3 text-lg">
            <Label>Ежемесячно</Label>
            <Switch
              checked={isYearly}
              onCheckedChange={() => setIsYearly(!isYearly)}
            />
            <Label>Ежегодно</Label>
          </div>

          <div className="grid gap-6 md:grid-cols-2 w-full">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="flex flex-col justify-between text-left shadow-md hover:shadow-lg transition"
              >
                <CardHeader>
                  <CardTitle>
                    <p>{plan.name}</p>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <div className="flex items-end mt-4">
                    <span className="text-4xl font-semibold">
                      {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    {plan.id !== "demo" && (
                      <span className="text-2xl font-semibold text-muted-foreground ml-1">
                        {isYearly ? "/год" : "/мес"}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-6" />
                  <ul className="space-y-4">
                    {plan.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CircleCheck className="size-4 text-green-600" />
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button asChild className="w-full">
                    <a href={plan.button.url}>{plan.button.text}</a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}