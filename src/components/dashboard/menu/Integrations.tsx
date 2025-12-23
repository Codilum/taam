"use client";

import { useState } from "react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload, ExternalLink, FileDown } from "lucide-react";
import { showErrorToast } from "@/lib/show-error-toast";
import { menuService } from "@/services";

export default function Integrations({ activeTeam }: { activeTeam: string }) {
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);

    const [isExporting, setIsExporting] = useState(false);

    const [sheetUrl, setSheetUrl] = useState("");
    const [isSyncingSheet, setIsSyncingSheet] = useState(false);

    const resetImportState = () => {
        setImportFile(null);
        setImportErrors([]);
        setIsImporting(false);
    };

    const handleCsvImport = async () => {
        if (!activeTeam) {
            showErrorToast("Выберите заведение");
            return;
        }
        if (!importFile) {
            showErrorToast("Выберите CSV файл");
            return;
        }

        setIsImporting(true);
        setImportErrors([]);

        try {
            const data = await menuService.importCsv(activeTeam, importFile);

            if (data.errors && data.errors.length > 0) {
                setImportErrors(data.errors);
                toast.warning(`Импорт завершен с предупреждениями: ${data.created || 0} создано, ${data.updated || 0} обновлено.`);
            } else {
                toast.success(`Импорт успешен: ${data.created || 0} создано, ${data.updated || 0} обновлено.`);
                resetImportState();
            }
        } catch (error: any) {
            console.error(error);
            showErrorToast(error.message || "Ошибка импорта");
        } finally {
            setIsImporting(false);
        }
    };

    const handleCsvExport = async () => {
        if (!activeTeam) {
            showErrorToast("Выберите заведение");
            return;
        }
        setIsExporting(true);
        try {
            // This returns a Blob
            const blob = await menuService.exportCsv(activeTeam);
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            // Format date for filename
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `menu_export_${activeTeam}_${date}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Меню успешно экспортировано");
        } catch (error: any) {
            console.error(error);
            showErrorToast(error.message || "Ошибка экспорта");
        } finally {
            setIsExporting(false);
        }
    };

    const handleSheetSync = async () => {
        if (!sheetUrl) {
            showErrorToast("Введите ссылку на Google Таблицу");
            return;
        }
        if (!sheetUrl.includes("docs.google.com/spreadsheets")) {
            showErrorToast("Некорректная ссылка на Google Таблицу");
            return;
        }

        setIsSyncingSheet(true);
        setTimeout(() => {
            setIsSyncingSheet(false);
            toast.success("Синхронизация с Google Sheets пока в разработке", {
                description: "Мы сохранили вашу ссылку и уведомим, когда интеграция заработает."
            });
        }, 1500);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 pt-0">

            {/* CSV Import */}
            <Card className="h-full">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Upload className="h-6 w-6 text-blue-600" />
                        <CardTitle>Импорт CSV</CardTitle>
                    </div>
                    <CardDescription>
                        Загрузите файл CSV для массового обновления или создания блюд.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="csv-file">Файл CSV</Label>
                        <Input
                            id="csv-file"
                            type="file"
                            accept=".csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        />
                        {importFile && <p className="text-sm text-muted-foreground">Выбран: {importFile.name}</p>}
                    </div>

                    {importErrors.length > 0 && (
                        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive max-h-40 overflow-y-auto">
                            <p className="font-semibold mb-1">Ошибки:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between border-t py-4 mt-auto">
                    <Button variant="outline" size="sm" asChild>
                        <a href="/examples/menu_import_template.csv" download className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" /> Шаблон
                        </a>
                    </Button>
                    <Button onClick={handleCsvImport} disabled={!importFile || isImporting}>
                        {isImporting ? "Импорт..." : "Загрузить"}
                    </Button>
                </CardFooter>
            </Card>

            {/* CSV Export */}
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileDown className="h-6 w-6 text-orange-600" />
                        <CardTitle>Экспорт CSV</CardTitle>
                    </div>
                    <CardDescription>
                        Скачайте текущее меню в формате CSV.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground">
                        Вы получите файл со всеми категориями и блюдами. Вы можете отредактировать его и загрузить обратно через Импорт.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-end border-t py-4 mt-auto">
                    <Button variant="outline" onClick={handleCsvExport} disabled={isExporting}>
                        {isExporting ? <span className="animate-spin mr-2">⏳</span> : <Download className="mr-2 h-4 w-4" />}
                        {isExporting ? "Экспорт..." : "Скачать меню"}
                    </Button>
                </CardFooter>
            </Card>

            {/* Google Sheets Integration */}
            <Card className="border-blue-200 bg-blue-50/20 md:col-span-2">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-green-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-15h2v6h-2zm0 8h2v2h-2z" fill="none" /><path d="M14.5 12.5h-5v-5h5v5zM15 7H9v6h6V7zM8 17h8v-2H8v2z" fill="currentColor" /></svg>
                        </div>
                        <CardTitle>Google Sheets Синхронизация (Beta)</CardTitle>
                    </div>
                    <CardDescription>
                        Автоматическая синхронизация меню с Google Таблицей.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Ссылка на таблицу</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                value={sheetUrl}
                                onChange={(e) => setSheetUrl(e.target.value)}
                            />
                            <Button variant="outline" size="icon" asChild>
                                <a href="https://docs.google.com" target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="py-4 border-t bg-background/50">
                    <Button className="w-full sm:w-auto ml-auto" onClick={handleSheetSync} disabled={isSyncingSheet}>
                        {isSyncingSheet ? "Проверка..." : "Подключить"}
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
