"use client"

import { useState, useCallback, useMemo } from "react"

export interface CartItem {
    id: number
    name: string
    price: number
    quantity: number
    photo?: string | null
}

export interface CartState {
    items: CartItem[]
    addItem: (item: Omit<CartItem, 'quantity'>) => void
    removeItem: (id: number) => void
    updateQuantity: (id: number, quantity: number) => void
    clearCart: () => void
    total: number
    itemCount: number
}

export function useCart(): CartState {
    const [items, setItems] = useState<CartItem[]>([])

    const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === item.id)
            if (existing) {
                return prev.map(i =>
                    i.id === item.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            }
            return [...prev, { ...item, quantity: 1 }]
        })
    }, [])

    const removeItem = useCallback((id: number) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }, [])

    const updateQuantity = useCallback((id: number, quantity: number) => {
        if (quantity <= 0) {
            setItems(prev => prev.filter(i => i.id !== id))
        } else {
            setItems(prev => prev.map(i =>
                i.id === id ? { ...i, quantity } : i
            ))
        }
    }, [])

    const clearCart = useCallback(() => {
        setItems([])
    }, [])

    const total = useMemo(() =>
        items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [items]
    )

    const itemCount = useMemo(() =>
        items.reduce((sum, item) => sum + item.quantity, 0),
        [items]
    )

    return {
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount
    }
}
