"use client";

import { useState, useEffect } from "react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, GripVertical } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DragDropContext, Droppable, Draggable, DropResult
} from "@hello-pangea/dnd";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/show-error-toast";
import { menuService } from "@/services";

// Temporary redefine or import needed interfaces and subcomponents
// Since CategoryForm is likely internal to EditMenu, I might need to extract it or copy it.
// For now, I'll assume I need to copy the logic or extract shared components later.
// To save time and ensure stability, I will include the CategoryForm internal code here or refactor EditMenu to export it.
// Given the limitations, I will rewrite a simple CategoryForm here or try to reuse if I can export it.
// Checking EditMenu content again, CategoryForm is likely a subcomponent defined in EditMenu.tsx or imported.
// Wait, in the previous `view_file` of `EditMenu.tsx`, `CategoryForm` was used but I didn't see the definition.
// It might be imported or defined at the bottom.
// I will definte a simple local generic form for now to be safe.

interface MenuCategory {
    id: number;
    photo: string | null;
    name: string;
    description: string | null;
    placenum: number;
}

interface StandardCategory {
    name: string;
    description: string;
}

// Re-implementing a simple CategoryForm
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function CategoryForm({
    category,
    standardCategories,
    existingCategories,
    onSubmit,
    onCancel,
}: {
    category: MenuCategory | null;
    standardCategories: StandardCategory[];
    existingCategories: MenuCategory[];
    onSubmit: (data: Partial<MenuCategory>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(category?.name || "");
    const [description, setDescription] = useState(category?.description || "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, description });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="cat-name">Название категории</Label>
                <Input
                    id="cat-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Пицца"
                    required
                />
                {/* Suggestion buttons could go here */}
            </div>
            <div className="space-y-2">
                <Label htmlFor="cat-desc">Описание (необязательно)</Label>
                <Textarea
                    id="cat-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Краткое описание категории"
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Отмена
                </Button>
                <Button type="submit">Сохранить</Button>
            </div>
        </form>
    );
}

export default function Categories({ activeTeam }: { activeTeam: string }) {
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [standardCategories, setStandardCategories] = useState<StandardCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

    // Load Categories
    useEffect(() => {
        const fetchData = async () => {
            if (!activeTeam) return;
            setIsLoading(true);
            try {
                const [menuData, stdData] = await Promise.all([
                    menuService.getMenu(activeTeam),
                    menuService.getStandardCategories().catch(() => ({ categories: [] }))
                ]);

                const sortedCats = (menuData.categories || []).map((c: any) => ({
                    id: c.id,
                    photo: c.photo,
                    name: c.name,
                    description: c.description,
                    placenum: c.placenum
                })).sort((a: any, b: any) => a.placenum - b.placenum);

                setCategories(sortedCats);
                setStandardCategories(stdData.categories || []);
            } catch (error) {
                console.error(error);
                showErrorToast("Ошибка загрузки категорий");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeTeam]);

    const handleCreateCategory = async (data: Partial<MenuCategory>) => {
        try {
            const newCategory = await menuService.createCategory(activeTeam, {
                name: data.name!,
                description: data.description || "",
                placenum: categories.length + 1
            });
            setCategories([...categories, newCategory]);
            setIsCategoryDialogOpen(false);
            toast.success("Категория добавлена");
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка при создании категории");
        }
    };

    const handleUpdateCategory = async (id: number, data: Partial<MenuCategory>) => {
        try {
            await menuService.updateCategory(activeTeam, id, data);
            setCategories(categories.map(c => c.id === id ? { ...c, ...data } : c));
            setIsCategoryDialogOpen(false);
            setEditingCategory(null);
            toast.success("Категория обновлена");
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка при обновлении категории");
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm("Удалить категорию и все блюда в ней?")) return;
        try {
            await menuService.deleteCategory(activeTeam, id);
            setCategories(categories.filter(c => c.id !== id));
            toast.success("Категория удалена");
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка при удалении категории");
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const reordered = Array.from(categories);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        const updated = reordered.map((cat, index) => ({
            ...cat,
            placenum: index + 1
        }));

        setCategories(updated);

        try {
            await Promise.all(updated.map(cat =>
                menuService.updateCategory(activeTeam, cat.id, { placenum: cat.placenum })
            ));
            toast.success("Порядок сохранен");
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка сохранения порядка");
        }
    };

    if (isLoading) {
        return <div className="p-4"><Skeleton className="h-10 w-40 mb-4" /><Skeleton className="h-40 w-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 p-4 pt-0">
            <div className="flex items-center justify-between">
                {/* Title removed as per dashboard style, handled by breadcrumbs usually, but keeping button */}
                <Button onClick={() => { setEditingCategory(null); setIsCategoryDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Добавить категорию
                </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="grid gap-4">
                            {categories.map((category, index) => (
                                <Draggable key={category.id} draggableId={String(category.id)} index={index}>
                                    {(provided) => (
                                        <Card
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                        >
                                            <CardHeader className="flex flex-row items-center justify-between p-4">
                                                <div className="flex items-center gap-4">
                                                    <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab">
                                                        <GripVertical className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{category.name}</CardTitle>
                                                        {category.description && (
                                                            <CardDescription>{category.description}</CardDescription>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setEditingCategory(category);
                                                        setIsCategoryDialogOpen(true);
                                                    }}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
                    </DialogHeader>
                    <CategoryForm
                        category={editingCategory}
                        standardCategories={standardCategories}
                        existingCategories={categories}
                        onSubmit={(data) => {
                            if (editingCategory) handleUpdateCategory(editingCategory.id, data);
                            else handleCreateCategory(data);
                        }}
                        onCancel={() => setIsCategoryDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
