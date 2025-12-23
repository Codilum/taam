"use client";

import { useState, useEffect } from "react";
import {
    Card, CardContent,
    CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    PlusCircle, Pencil, Trash2, LayoutGrid, List, Eye, EyeOff, Search, GripVertical
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/show-error-toast";
import { menuService } from "@/services";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface MenuItem {
    id: number;
    photo: string | null;
    name: string;
    price: number;
    description: string | null;
    calories: number | null;
    proteins: number | null;
    fats: number | null;
    carbs: number | null;
    weight: number | null;
    view: boolean;
    placenum: number;
    category_id: number;
}

interface MenuCategory {
    id: number;
    name: string;
    items: MenuItem[];
}

function ItemForm({
    item,
    categories,
    category_id,
    onSubmit,
    onCancel,
}: {
    item: MenuItem | null;
    categories: MenuCategory[];
    category_id?: number | null;
    onSubmit: (data: Partial<MenuItem>, photo: File | null) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(item?.name || "");
    const [price, setPrice] = useState(item?.price || 0);
    const [description, setDescription] = useState(item?.description || "");
    const [categoryId, setCategoryId] = useState(item?.category_id || category_id || (categories[0]?.id));
    const [photo, setPhoto] = useState<File | null>(null);
    const [view, setView] = useState(item ? item.view : true);

    // Nutrition
    const [calories, setCalories] = useState(item?.calories || 0);
    const [weight, setWeight] = useState(item?.weight || 0);
    const [proteins, setProteins] = useState(item?.proteins || 0);
    const [fats, setFats] = useState(item?.fats || 0);
    const [carbs, setCarbs] = useState(item?.carbs || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            name,
            price,
            description,
            category_id: Number(categoryId),
            calories, weight, proteins, fats, carbs,
            view
        }, photo);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
                <Label className="text-base font-semibold">Видимость блюда</Label>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{view ? "Показано" : "Скрыто"}</span>
                    <Switch checked={view} onCheckedChange={setView} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Название</Label>
                    <Input required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Цена</Label>
                    <Input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Категория</Label>
                <Select value={String(categoryId)} onValueChange={(v) => setCategoryId(Number(v))}>
                    <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
                <Label>Фото</Label>
                <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="space-y-1"><Label className="text-xs">Вес (г)</Label><Input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Ккал</Label><Input type="number" value={calories} onChange={e => setCalories(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Белки</Label><Input type="number" value={proteins} onChange={e => setProteins(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Жиры</Label><Input type="number" value={fats} onChange={e => setFats(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Углеводы</Label><Input type="number" value={carbs} onChange={e => setCarbs(Number(e.target.value))} /></div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
                <Button type="submit">Сохранить</Button>
            </div>
        </form>
    );
}

export default function MenuItems({ activeTeam }: { activeTeam: string }) {
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    useEffect(() => {
        fetchData();
    }, [activeTeam]);

    const fetchData = async () => {
        if (!activeTeam) return;
        setIsLoading(true);
        try {
            const data = await menuService.getMenu(activeTeam);
            // Ensure items are sorted by placenum
            const cats = data.categories.map((c: any) => ({
                id: c.id,
                name: c.name,
                items: (c.items || []).map((i: any) => ({ ...i, category_id: c.id })).sort((a: any, b: any) => a.placenum - b.placenum)
            }));
            setCategories(cats);
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка загрузки меню");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateOrUpdate = async (data: Partial<MenuItem>, photo: File | null) => {
        try {
            if (editingItem) {
                await menuService.updateItem(activeTeam, editingItem.id, data);
                if (photo) await menuService.uploadItemPhoto(activeTeam, editingItem.id, photo);

                toast.success("Блюдо обновлено");
            } else {
                const formData = new FormData();
                Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
                // Assuming new items go to end of list, placenum logic handled by backend usually or we specificy
                const cat = categories.find(c => c.id === data.category_id);
                const maxPlacenum = cat?.items.length ? Math.max(...cat.items.map(i => i.placenum)) : 0;
                formData.append("placenum", String(maxPlacenum + 1));

                if (photo) formData.append("photo", photo);

                await menuService.createItem(activeTeam, data.category_id!, formData);
                toast.success("Блюдо создано");
            }
            setIsDialogOpen(false);
            setEditingItem(null);
            fetchData(); // Refresh to get correct state
        } catch (error: any) {
            console.error(error);
            showErrorToast(error.message || "Ошибка сохранения");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Удалить блюдо?")) return;
        try {
            await menuService.deleteItem(activeTeam, id);
            toast.success("Блюдо удалено");
            fetchData();
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка удаления");
        }
    };

    const toggleVisibility = async (item: MenuItem) => {
        try {
            await menuService.updateItem(activeTeam, item.id, { view: !item.view });
            // Optimistic update
            const newCats = categories.map(c => ({
                ...c,
                items: c.items.map(i => i.id === item.id ? { ...i, view: !item.view } : i)
            }));
            setCategories(newCats);
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка обновления");
        }
    };

    const onDragEnd = async (result: DropResult, categoryId: number) => {
        if (!result.destination) return;

        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return;

        const newItems = Array.from(categories[catIndex].items);
        const [moved] = newItems.splice(result.source.index, 1);
        newItems.splice(result.destination.index, 0, moved);

        // Update state immediately
        const newCategories = [...categories];
        newCategories[catIndex] = { ...newCategories[catIndex], items: newItems };
        setCategories(newCategories);

        // Calculate new placenums
        const updates = newItems.map((item, index) => ({
            id: item.id,
            placenum: index + 1
        }));

        try {
            await Promise.all(updates.map(u =>
                menuService.updateItem(activeTeam, u.id, { placenum: u.placenum })
            ));
            toast.success("Порядок сохранен");
        } catch (error) {
            console.error(error);
            showErrorToast("Ошибка сохранения порядка");
        }
    };

    const filteredCategories = categories.map(cat => ({
        ...cat,
        items: cat.items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
    })).filter(cat => {
        if (selectedCategory !== "all" && String(cat.id) !== selectedCategory) return false;
        // If searching, only show categories that have matching items
        if (searchQuery && cat.items.length === 0) return false;
        return true;
    });

    if (isLoading) return <div className="p-4"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-60 w-full" /></div>;

    return (
        <div className="flex flex-col gap-6 p-4 pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur py-2">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Поиск блюд..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Категория" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все категории</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-lg p-1 bg-muted/50">
                        <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")}>
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Добавить
                    </Button>
                </div>
            </div>

            {filteredCategories.map(category => (
                <div key={category.id} className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{category.name}</h3>
                        <span className="text-muted-foreground text-sm">({category.items.length})</span>
                    </div>

                    <DragDropContext onDragEnd={(res) => onDragEnd(res, category.id)}>
                        <Droppable droppableId={`cat-${category.id}`} direction={viewMode === "grid" ? "horizontal" : "vertical"}>
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={viewMode === "grid"
                                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                                        : "border rounded-lg divide-y bg-card"
                                    }
                                >
                                    {category.items.map((item, index) => (
                                        <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                                            {(provided) => (
                                                viewMode === "grid" ? (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                        <Card className={`overflow-hidden flex flex-col h-full group ${!item.view ? 'opacity-60 grayscale' : ''}`}>
                                                            <div className="aspect-square bg-muted relative">
                                                                {item.photo ? (
                                                                    <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full text-muted-foreground">Нет фото</div>
                                                                )}
                                                                <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="bg-background/80 p-1.5 rounded cursor-grab active:cursor-grabbing">
                                                                        <GripVertical className="h-4 w-4" />
                                                                    </span>
                                                                </div>
                                                                <div className="absolute top-2 left-2">
                                                                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); toggleVisibility(item); }}>
                                                                        {item.view ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <CardHeader className="p-4 pb-2">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <CardTitle className="text-base line-clamp-1">{item.name}</CardTitle>
                                                                    <span className="font-bold whitespace-nowrap">{item.price} ₽</span>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="p-4 pt-0 mt-auto flex justify-end gap-2">
                                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                                                                    <Pencil className="mr-2 h-3 w-3" /> Ред.
                                                                </Button>
                                                                <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                ) : (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`flex items-center gap-4 p-4 hover:bg-muted/50 ${!item.view ? 'opacity-60' : ''}`}
                                                    >
                                                        <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground">
                                                            <GripVertical className="h-5 w-5" />
                                                        </div>
                                                        <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                                                            {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm sm:text-base">{item.name}</div>
                                                        </div>
                                                        <div className="font-semibold">{item.price} ₽</div>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => toggleVisibility(item)}>
                                                                {item.view ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            ))}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? "Редактировать блюдо" : "Новое блюдо"}</DialogTitle>
                    </DialogHeader>
                    <ItemForm
                        item={editingItem}
                        categories={categories}
                        onSubmit={handleCreateOrUpdate}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
