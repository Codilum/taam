"use client";

import { useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { PlusCircle, Pencil, Trash2, Eye, EyeOff, GripVertical, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DragDropContext, Droppable, Draggable, DropResult
} from "@hello-pangea/dnd";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuCategory {
  id: number;
  photo: string | null;
  name: string;
  description: string | null;
  placenum: number;
}

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

interface StandardCategory {
  name: string;
  description: string;
}

interface ImportResponse {
  created?: number;
  updated?: number;
  errors?: string[];
  items?: MenuItem[];
}

export default function EditMenu({ activeTeam }: { activeTeam: string }) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [standardCategories, setStandardCategories] = useState<StandardCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importCategoryId, setImportCategoryId] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const resetImportState = () => {
    setImportCategoryId("");
    setImportFile(null);
    setImportErrors([]);
    setIsImporting(false);
  };

  // Загрузка стандартных категорий из бекенда
  useEffect(() => {
    const fetchStandardCategories = async () => {
      try {
        const res = await fetch('/api/menu-categories');
        if (res.ok) {
          const data = await res.json();
          setStandardCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Ошибка загрузки стандартных категорий:", error);
      }
    };
    fetchStandardCategories();
  }, []);

  // Загрузка меню
  useEffect(() => {
    const fetchMenuData = async () => {
      if (!activeTeam) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/restaurants/${activeTeam}/menu`,
          { 
            headers: { 
              Authorization: `Bearer ${localStorage.getItem("access_token")}` 
            } 
          }
        );
        
        if (res.ok) {
          const data = await res.json();
          
          // Преобразуем структуру данных
          const allCategories: MenuCategory[] = [];
          const allItems: MenuItem[] = [];
          
          data.categories.forEach((category: any) => {
            allCategories.push({
              id: category.id,
              photo: category.photo,
              name: category.name,
              description: category.description,
              placenum: category.placenum
            });
            
            category.items.forEach((item: any) => {
              allItems.push({
                ...item,
                category_id: category.id
              });
            });
          });
          
          setCategories(allCategories);
          setItems(allItems);
        } else {
          toast.error("Ошибка загрузки меню");
        }
      } catch (error) {
        console.error("Ошибка:", error);
        toast.error("Ошибка загрузки меню");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMenuData();
  }, [activeTeam]);

  // Получение блюд для категории
  const getItemsForCategory = (categoryId: number) => {
    return items
      .filter(item => item.category_id === categoryId)
      .sort((a, b) => a.placenum - b.placenum);
  };

  // Создание категории
  const handleCreateCategory = async (name: string, description: string, placenum?: number) => {
    try {
      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-categories`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ 
            name, 
            description,
            placenum: placenum || categories.length + 1
          }),
        }
      );
      
      if (res.ok) {
        const newCategory = await res.json();
        setCategories([...categories, newCategory]);
        setIsCategoryDialogOpen(false);
        toast.success("Категория добавлена");
      }
    } catch (error) {
      toast.error("Ошибка при создании категории");
    }
  };

  // Обновление категории
  const handleUpdateCategory = async (categoryId: number, updates: Partial<MenuCategory>) => {
    try {
      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-categories/${categoryId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(updates),
        }
      );
      
      if (res.ok) {
        setCategories(categories.map(cat => 
          cat.id === categoryId ? { ...cat, ...updates } : cat
        ));
        setIsCategoryDialogOpen(false);
        setEditingCategory(null);
        toast.success("Категория обновлена");
      }
    } catch (error) {
      toast.error("Ошибка при обновлении категории");
    }
  };

  // Удаление категории
  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm("Удалить категорию и все блюда в ней?")) return;

    try {
      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-categories/${categoryId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }
      );
      
      if (res.ok) {
        setCategories(categories.filter(c => c.id !== categoryId));
        setItems(items.filter(item => item.category_id !== categoryId));
        toast.success("Категория удалена");
      }
    } catch (error) {
      toast.error("Ошибка при удалении категории");
    }
  };

  const handleImportSubmit = async () => {
    if (!activeTeam) {
      toast.error("Выберите заведение");
      return;
    }
    if (!importCategoryId) {
      toast.error("Выберите категорию для импорта");
      return;
    }
    if (!importFile) {
      toast.error("Выберите CSV файл");
      return;
    }

    setIsImporting(true);
    setImportErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch(
        `/api/restaurants/${activeTeam}/menu-categories/${importCategoryId}/import-csv`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let message = "Ошибка импорта CSV";
        if (errorText) {
          try {
            const parsed = JSON.parse(errorText);
            message = parsed.detail || message;
          } catch {
            message = errorText;
          }
        }
        throw new Error(message);
      }

      const data: ImportResponse = await response.json();
      const categoryIdNumber = Number(importCategoryId);

      if (Array.isArray(data.items)) {
        const normalizedItems = data.items
          .map((item) => ({
            ...item,
            category_id: categoryIdNumber
          }))
          .sort((a, b) => a.placenum - b.placenum);

        setItems((prevItems) => {
          const otherItems = prevItems.filter((item) => item.category_id !== categoryIdNumber);
          return [...otherItems, ...normalizedItems];
        });
      }

      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors);
        toast.warning(
          `Импорт завершен с предупреждениями: добавлено ${data.created || 0}, обновлено ${data.updated || 0}`
        );
      } else {
        toast.success(
          `Импорт завершен: добавлено ${data.created || 0}, обновлено ${data.updated || 0}`
        );
        setIsImportDialogOpen(false);
        resetImportState();
      }
    } catch (error: any) {
      console.error("Ошибка импорта CSV:", error);
      toast.error(error?.message || "Ошибка импорта CSV");
    } finally {
      setIsImporting(false);
    }
  };

  // Функция для загрузки фото блюда
  const uploadItemPhoto = async (itemId: number, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-items/${itemId}/upload-photo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error('Ошибка загрузки фото');
      }

      return await res.json();
    } catch (error) {
      console.error('Ошибка загрузки фото:', error);
      throw error;
    }
  };

  // Создание/обновление блюда
  const handleSaveItem = async (itemData: Partial<MenuItem>, photoFile?: File | null) => {
    try {
      if (editingItem) {
        // Обновление существующего блюда
        const res = await fetch(
          `/api/restaurants/${activeTeam}/menu-items/${editingItem.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
            body: JSON.stringify(itemData),
          }
        );
        
        if (res.ok) {
          const updatedItem = await res.json();
          
          // Если есть новое фото, загружаем его
          if (photoFile) {
            await uploadItemPhoto(editingItem.id, photoFile);
          }
          
          setItems(items.map(item => 
            item.id === editingItem.id ? { ...updatedItem, category_id: editingItem.category_id } : item
          ));
          toast.success("Блюдо обновлено");
        }
      } else if (editingCategory) {
        // Создание нового блюда
        const res = await fetch(
          `/api/restaurants/${activeTeam}/menu-categories/${editingCategory.id}/items`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
            body: JSON.stringify({
              ...itemData,
              placenum: getItemsForCategory(editingCategory.id).length + 1
            }),
          }
        );
        
        if (res.ok) {
          const newItem = await res.json();

          const appendItem = (itemToAppend: MenuItem) => {
            setItems((prevItems) => [
              ...prevItems,
              {
                ...itemToAppend,
                category_id: editingCategory.id
              }
            ]);
          };

          // Если есть фото, загружаем его после создания блюда
          if (photoFile) {
            await uploadItemPhoto(newItem.id, photoFile);
            // Обновляем item с актуальным фото
            const updatedRes = await fetch(
              `/api/restaurants/${activeTeam}/menu-items/${newItem.id}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
              }
            );
            if (updatedRes.ok) {
              const updatedItem = await updatedRes.json();
              appendItem(updatedItem);
            } else {
              appendItem(newItem);
            }
          } else {
            appendItem(newItem);
          }

          toast.success("Блюдо добавлено");
        }
      }
      
      setIsItemDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      toast.error("Ошибка при сохранении блюда");
    }
  };

  // Удаление блюда
  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Удалить блюдо?")) return;
    
    try {
      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-items/${itemId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }
      );
      
      if (res.ok) {
        setItems(items.filter(item => item.id !== itemId));
        toast.success("Блюдо удалено");
      }
    } catch (error) {
      toast.error("Ошибка при удалении блюда");
    }
  };

  // Переключение видимости блюда
  const handleToggleItemVisibility = async (itemId: number, currentView: boolean) => {
    try {
      const res = await fetch(
        `/api/restaurants/${activeTeam}/menu-items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ view: !currentView }),
        }
      );
      
      if (res.ok) {
        setItems(items.map(item => 
          item.id === itemId ? { ...item, view: !currentView } : item
        ));
        toast.success("Видимость блюда изменена");
      }
    } catch (error) {
      toast.error("Ошибка при изменении видимости");
    }
  };

  // Обновление порядка категорий
  const handleCategoryDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const reorderedCategories = Array.from(categories);
    const [movedCategory] = reorderedCategories.splice(result.source.index, 1);
    reorderedCategories.splice(result.destination.index, 0, movedCategory);
    
    // Обновляем порядковые номера
    const updatedCategories = reorderedCategories.map((category, index) => ({
      ...category,
      placenum: index + 1
    }));
    
    // Сразу обновляем состояние с правильным порядком
    setCategories(updatedCategories);
    
    // Обновляем порядок на сервере
    try {
      await Promise.all(
        updatedCategories.map((category) =>
          fetch(
            `/api/restaurants/${activeTeam}/menu-categories/${category.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
              },
              body: JSON.stringify({ placenum: category.placenum }),
            }
          )
        )
      );
      toast.success("Порядок категорий сохранен");
    } catch (error) {
      toast.error("Ошибка при сохранении порядка категорий");
      // В случае ошибки возвращаем предыдущее состояние
      setCategories(categories);
    }
  };

  // Обновление порядка блюд
  const handleItemDragEnd = async (result: DropResult, categoryId: number) => {
    if (!result.destination) return;
    
    const categoryItems = getItemsForCategory(categoryId);
    const reorderedItems = Array.from(categoryItems);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);
    
    // Обновляем порядковые номера для всех элементов в категории
    const updatedItemsWithNewOrder = reorderedItems.map((item, index) => ({
      ...item,
      placenum: index + 1
    }));
    
    // Обновляем локальное состояние с правильным порядком
    const updatedItems = items.map(item => {
      const updatedItem = updatedItemsWithNewOrder.find(ui => ui.id === item.id);
      return updatedItem || item;
    });
    
    setItems(updatedItems);
    
    // Обновляем порядок на сервере
    try {
      await Promise.all(
        updatedItemsWithNewOrder.map((item) =>
          fetch(
            `/api/restaurants/${activeTeam}/menu-items/${item.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
              },
              body: JSON.stringify({ placenum: item.placenum }),
            }
          )
        )
      );
      toast.success("Порядок блюд сохранен");
    } catch (error) {
      toast.error("Ошибка при сохранении порядка блюд");
      // В случае ошибки возвращаем предыдущее состояние
      setItems(items);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4">
        <h2 className="text-xl font-bold">Меню заведения</h2>
        <Skeleton className="h-10 w-40" />
        <div className="space-y-6">
          {[1, 2].map((_, catIndex) => (
            <Card key={catIndex}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4" />
                  <div>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48 mt-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((_, itemIndex) => (
                    <Card key={itemIndex} className="p-4 space-y-3">
                      <Skeleton className="w-4 h-4 absolute top-2 right-2" />
                      <div>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="w-20 h-20 rounded-md mt-1" />
                      </div>
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-5 w-16" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </Card>
                  ))}
                  <Skeleton className="h-32 w-full rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-full overflow-x-hidden">
      <h2 className="text-xl font-bold">Меню заведения</h2>

      {/* Диалог импорта блюд */}
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            resetImportState();
          }
        }}
      >
        <DialogContent className="max-w-[95vw] w-full mx-auto sm:max-w-xl rounded-lg">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-lg sm:text-xl text-center sm:text-left">
              Импорт блюд из CSV
            </DialogTitle>
            <DialogDescription className="text-sm">
              Выберите категорию и загрузите CSV файл. Стандартное фото будет установлено автоматически, позже его можно заменить.
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Категория*</Label>
              <Select value={importCategoryId} onValueChange={setImportCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)} className="text-sm">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">CSV файл*</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setImportFile(file);
                }}
              />
              {importFile && (
                <p className="text-xs text-gray-500">Выбран файл: {importFile.name}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a
                  href="/examples/menu_import_template.csv"
                  download
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать пример</span>
                </a>
              </Button>
            </div>

            {importErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 space-y-2">
                <p className="font-medium">Не удалось обработать некоторые строки:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {importErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                resetImportState();
              }}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={isImporting}
              className="flex-1"
              style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
            >
              {isImporting ? "Импорт..." : "Импортировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог для категории */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full mx-auto sm:max-w-md rounded-lg">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-lg sm:text-xl text-center sm:text-left">
              {editingCategory ? "Редактировать категорию" : "Добавить категорию"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <CategoryForm
              category={editingCategory}
              standardCategories={standardCategories}
              existingCategories={categories}
              onSubmit={(data) => {
                if (editingCategory) {
                  handleUpdateCategory(editingCategory.id, data);
                } else {
                  handleCreateCategory(data.name, data.description || "", data.placenum);
                }
              }}
              onCancel={() => {
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог для блюда */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full mx-auto sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-lg sm:text-xl text-center sm:text-left">
              {editingItem ? "Редактировать блюдо" : "Добавить блюдо"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <ItemForm
              item={editingItem}
              activeTeam={activeTeam}
              onSubmit={(data, photoFile) => handleSaveItem(data, photoFile)}
              onCancel={() => {
                setIsItemDialogOpen(false);
                setEditingItem(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Кнопки управления категориями */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            resetImportState();
            setIsImportDialogOpen(true);
          }}
          variant="outline"
          className="w-fit"
          style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
        >
          <Download className="w-4 h-4 mr-2" /> Импорт CSV
        </Button>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setIsCategoryDialogOpen(true);
          }}
          variant="outline"
          className="w-fit"
          style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Добавить категорию
        </Button>
      </div>

      {/* Список категорий с drag-and-drop */}
      <DragDropContext onDragEnd={handleCategoryDragEnd}>
        <Droppable droppableId="categories">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {categories.map((category, index) => (
                <Draggable key={category.id} draggableId={`category-${category.id}`} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="mb-6"
                    >
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap p-4 sm:p-6">
                          <div className="flex items-center gap-2">
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg break-words">{category.name}</CardTitle>
                              {category.description && (
                                <CardDescription className="break-words">{category.description}</CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(category);
                                setIsCategoryDialogOpen(true);
                              }}
                              style={{ backgroundColor: '#FFEA5A', borderColor: '#FFEA5A' }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                              style={{ backgroundColor: '#FFEA5A', borderColor: '#FFEA5A' }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-4 sm:p-6">
                          {/* Блюда категории с drag-and-drop */}
                          <DragDropContext 
                            onDragEnd={(result) => handleItemDragEnd(result, category.id)}
                          >
                            <Droppable droppableId={`items-${category.id}`} direction="horizontal">
                              {(provided) => (
                                <div
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible"
                                >
                                  {getItemsForCategory(category.id).map((item, index) => (
                                    <Draggable
                                      key={item.id}
                                      draggableId={`item-${item.id}`}
                                      index={index}
                                    >
                                      {(provided) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className="min-w-0"
                                        >
                                          <Card className="p-3 sm:p-4 space-y-3 relative break-words max-w-full">
                                            <div {...provided.dragHandleProps} className="absolute top-2 right-2 z-10">
                                              <GripVertical className="w-4 h-4 text-gray-400" />
                                            </div>
                                            
                                            {/* Фото блюда */}
                                            <div>
                                              <Label className="text-sm">Фото блюда</Label>
                                              <div className="flex items-center gap-2 mt-1">
                                                {item.photo ? (
                                                  <img
                                                      src={item.photo}
                                                      alt={item.name || "Фото блюда"}
                                                      width={80}
                                                      height={80}
                                                      loading="lazy"
                                                      decoding="async"
                                                      className="rounded-md object-cover"
                                                    />

                                                ) : (
                                                  <div className="w-20 h-20 bg-gray-200 rounded-md" />
                                                )}
                                              </div>
                                            </div>
                                            
                                            {/* Информация о блюде */}
                                            <h4 className="font-medium break-words text-base">{item.name}</h4>
                                            {item.description && (
                                              <p className="text-sm text-gray-600 break-words line-clamp-2">{item.description}</p>
                                            )}
                                            <p className="text-lg font-bold">{item.price} ₽</p>
                                            
                                            {/* Кнопки управления */}
                                            <div className="flex gap-2 flex-wrap">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setEditingItem(item);
                                                  setIsItemDialogOpen(true);
                                                }}
                                                className="flex-1 min-w-[100px] sm:min-w-[120px]"
                                                style={{ backgroundColor: '#FFEA5A', borderColor: '#FFEA5A' }}
                                              >
                                                <Pencil className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                                <span className="text-xs sm:text-sm">Ред.</span>
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleItemVisibility(item.id, item.view)}
                                                title={item.view ? "Скрыть блюдо" : "Показать блюдо"}
                                                className="flex-shrink-0"
                                                style={{ backgroundColor: '#FFEA5A', borderColor: '#FFEA5A' }}
                                              >
                                                {item.view ? (
                                                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                                ) : (
                                                  <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                                                )}
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="flex-shrink-0"
                                                style={{ backgroundColor: '#FFEA5A', borderColor: '#FFEA5A' }}
                                              >
                                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                              </Button>
                                            </div>
                                          </Card>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  
                                  {/* Кнопка добавления блюда */}
                                  <Button
                                    variant="outline"
                                    className="min-h-5 py-2 self-end"
                                    onClick={() => {
                                      setEditingCategory(category);
                                      setEditingItem(null);
                                      setIsItemDialogOpen(true);
                                    }}
                                    style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
                                  >
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    <span className="text-sm">Добавить блюдо</span>
                                  </Button>
                                </div>
                              )}
                            </Droppable>
                          </DragDropContext>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

// Компонент формы для категории
function CategoryForm({ 
  category, 
  standardCategories, 
  existingCategories, 
  onSubmit, 
  onCancel 
}: {
  category: MenuCategory | null;
  standardCategories: StandardCategory[];
  existingCategories: MenuCategory[];
  onSubmit: (data: { name: string; description?: string; placenum?: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [placenum, setPlacenum] = useState(category?.placenum || existingCategories.length + 1);

  const handleStandardCategorySelect = (selectedName: string) => {
    const standardCat = standardCategories.find(cat => cat.name === selectedName);
    if (standardCat) {
      setName(standardCat.name);
      setDescription(standardCat.description);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Стандартные категории</Label>
        <Select onValueChange={handleStandardCategorySelect}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Выберите стандартную категорию" />
          </SelectTrigger>
          <SelectContent>
            {standardCategories
              .filter(stdCat => !existingCategories.find(c => c.name === stdCat.name))
              .map(cat => (
                <SelectItem key={cat.name} value={cat.name} className="text-sm">
                  {cat.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Название категории*</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите название категории"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Описание</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Введите описание категории"
          className="mt-1 min-h-[80px] resize-none"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="flex-1 order-2 sm:order-1"
        >
          Отмена
        </Button>
        <Button 
          onClick={() => onSubmit({ name, description, placenum })}
          disabled={!name}
          className="flex-1 order-1 sm:order-2"
          style={{ backgroundColor: '#FFEA5A',  color: '#3d3d3d', borderColor: '#FFEA5A' }}
        >
          {category ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </div>
  );
}

// Компонент формы для блюда
function ItemForm({ 
  item, 
  onSubmit, 
  onCancel, 
  activeTeam 
}: {
  item: MenuItem | null;
  onSubmit: (data: Partial<MenuItem>, photoFile?: File | null) => void;
  onCancel: () => void;
  activeTeam: string;
}) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    price: item?.price || 0,
    description: item?.description || "",
    calories: item?.calories || 0,
    proteins: item?.proteins || 0,
    fats: item?.fats || 0,
    carbs: item?.carbs || 0,
    weight: item?.weight || 0,
    view: item?.view ?? true,
    photo: item?.photo || null,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(formData.photo);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData({ ...formData, photo: null });
  };

  const handleSubmit = async () => {
    let photoUrl = formData.photo;

    // Если есть новый файл, загружаем его
    if (selectedFile && item) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedFile);

        const uploadRes = await fetch(
          `/api/restaurants/${activeTeam}/menu-items/${item.id}/upload-photo`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
            body: uploadFormData,
          }
        );

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoUrl = uploadData.photo;
        } else {
          throw new Error("Ошибка загрузки фото");
        }
      } catch (error) {
        console.error("Ошибка загрузки фото:", error);
        toast.error("Ошибка загрузки фото");
        return;
      }
    }

    onSubmit(
      {
        ...formData,
        photo: photoUrl,
        price: Number(formData.price),
        calories: Number(formData.calories),
        proteins: Number(formData.proteins),
        fats: Number(formData.fats),
        carbs: Number(formData.carbs),
        weight: Number(formData.weight),
      },
      selectedFile
    );
  };

  return (
    <div className="space-y-4">
      {/* Фото блюда */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <Label className="text-sm font-medium">Фото блюда</Label>
        <div className="mt-2 flex flex-col items-center gap-3">
          {previewUrl ? (
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-md overflow-hidden border">
              <img
                src={previewUrl}
                alt="Preview"
                className="object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={handleRemovePhoto}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-200 rounded-md flex items-center justify-center border">
              <span className="text-gray-500 text-sm">Нет фото</span>
            </div>
          )}

          <div className="w-full max-w-xs">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Основная информация */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Название*</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Введите название блюда"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Цена*</Label>
            <Input
              type="number"
              value={formData.price === 0 ? "" : formData.price.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, price: value === "" ? 0 : Number(value) });
              }}
              placeholder="0"
              className="mt-1 no-arrows"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Вес (г)</Label>
            <Input
              type="number"
              value={formData.weight === 0 ? "" : formData.weight.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, weight: value === "" ? 0 : Number(value) });
              }}
              placeholder="0"
              className="mt-1 no-arrows"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Ккал</Label>
            <Input
              type="number"
              value={formData.calories === 0 ? "" : formData.calories.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, calories: value === "" ? 0 : Number(value) });
              }}
              placeholder="0"
              className="mt-1 no-arrows"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-sm font-medium">Белки (г)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.proteins === 0 ? "" : formData.proteins.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, proteins: value === "" ? 0 : Number(value) });
                }}
                placeholder="0"
                className="mt-1 no-arrows text-xs"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Жиры (г)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.fats === 0 ? "" : formData.fats.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, fats: value === "" ? 0 : Number(value) });
                }}
                placeholder="0"
                className="mt-1 no-arrows text-xs"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Углев. (г)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.carbs === 0 ? "" : formData.carbs.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, carbs: value === "" ? 0 : Number(value) });
                }}
                placeholder="0"
                className="mt-1 no-arrows text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Статус</Label>
            <Select
              value={formData.view ? "visible" : "hidden"}
              onValueChange={(value) =>
                setFormData({ ...formData, view: value === "visible" })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visible" className="text-sm">Видимое</SelectItem>
                <SelectItem value="hidden" className="text-sm">Скрытое</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Описание */}
      <div>
        <Label className="text-sm font-medium">Описание (до 150 символов)</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Введите описание блюда"
          maxLength={150}
          className="mt-1 min-h-[100px] resize-none"
        />
        <div className="text-xs text-gray-500 text-right mt-1">
          {formData.description.length}/150
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="flex-1 order-2 sm:order-1"
        >
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.name || !formData.price}
          className="flex-1 order-1 sm:order-2"
          style={{ backgroundColor: '#FFEA5A', color: '#3d3d3d', borderColor: '#FFEA5A' }}
        >
          {item ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </div>
  );
}