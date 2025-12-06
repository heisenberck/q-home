import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WaterReading, Unit, Role, TariffWater, TariffCollection } from '../../types';
import { UnitType } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    HomeIcon, StoreIcon, TrendingUpIcon, DropletsIcon, ChevronLeftIcon, ChevronRightIcon, 
    SearchIcon, UploadIcon, SparklesIcon, ClipboardDocumentListIcon, 
    DocumentArrowDownIcon, WarningIcon
} from '../ui/Icons';
import { parseUnitCode, getPreviousPeriod, sortUnitsComparator, formatCurrency } from '../../utils/helpers';
import { processImportFile } from '../../utils/importHelpers';

declare const XLSX: any;

// --- START: Child Components ---
const MonthPickerPopover: React.FC<{
    currentPeriod: string;
    onSelectPeriod: (period: string) => void;
    onClose: () => void;
}> = ({ currentPeriod, onSelectPeriod, onClose }) => {
    const pickerRef = useRef<HTMLDivElement>(null);
    const [displayYear, setDisplayYear] = useState(new Date(currentPeriod + '-02').getFullYear());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const now = new Date();
    const currentSystemYear = now.getFullYear();
    const currentSystemMonth = now.getMonth();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-20 bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-xl shadow-lg border dark:border-dark-border w-72">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"><ChevronLeftIcon /></button>
                <span className="font-bold text-lg">{displayYear}</span>
                <button onClick={() => setDisplayYear(y => y + 1)} disabled={displayYear >= currentSystemYear} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronRightIcon /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                    const isFuture = displayYear > currentSystemYear || (displayYear === currentSystemYear && index > currentSystemMonth);
                    const isSelected = displayYear === new Date(currentPeriod + '-02').getFullYear() && index === new Date(currentPeriod + '-02').getMonth();
                    return (
                        <button
                            key={month}
                            disabled={isFuture}
                            onClick={() => { onSelectPeriod(`${displayYear}-${String(index + 1).padStart(2, '0')}`); onClose(); }}
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-200 dark:hover:bg-slate-700'} ${isFuture ? 'opacity-50 cursor-not-allowed' : ''}`}
                            data-tooltip={isFuture ? "Không thể chọn kỳ tương lai" : ''}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const WaterHistoryModal: React.FC<{
    unitId: string;
    allUnitReadings: WaterReading[];
    onClose: () => void;
}> = ({ unitId, allUnitReadings, onClose }) => {
    const historyData = useMemo(() => {
        return allUnitReadings
            .sort((a, b) => a.Period.localeCompare(b.Period))
            .slice(-6) // Get last 6 months
            .map(r => ({
                period: r.Period.slice(5) + '/' + r.Period.slice(2, 4), // Format to MM/YY
                fullPeriod: r.Period,
                prevIndex: r.PrevIndex,
                currIndex: r.CurrIndex,
                consumption: r.CurrIndex - r.PrevIndex,
            }));
    }, [allUnitReadings]);

    return (
        <Modal title={`Lịch sử nước - Căn hộ ${unitId}`} onClose={onClose} size="3xl">
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Biểu đồ tiêu thụ (6 tháng gần nhất)</h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border, #e5e7eb)" />
                                <XAxis dataKey="period" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                <YAxis unit=" m³" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--light-bg-secondary, white)',
                                        border: '1px solid var(--light-border, #e5e7eb)',
                                        borderRadius: '0.5rem',
                                    }}
                                    formatter={(value: number) => [`${value} m³`, 'Tiêu thụ']}
                                />
                                <Bar dataKey="consumption" name="Tiêu thụ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Bảng chi tiết</h4>
                    <div className="overflow-auto border rounded-lg max-h-60 dark:border-dark-border">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Kỳ</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Chỉ số cũ</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Chỉ số mới</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Tiêu thụ (m³)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {historyData.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center p-4 text-gray-500">Chưa có dữ liệu lịch sử.</td></tr>
                                ) : (
                                    historyData.slice().reverse().map(item => (
                                        <tr key={item.fullPeriod}>
                                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-200">{item.fullPeriod}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{item.prevIndex.toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{item.currIndex.toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-2 text-right font-bold text-primary">{item.consumption.toLocaleString('vi-VN')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">
                        Đóng
                    </button>
                </div>
            </div>
        </Modal>
    );
};
// --- END: Child Components ---

// --- START: Bill Calculation Helper ---
const calculateWaterBill = (consumption: number, unitType: UnitType, tariffs: TariffWater[]): number => {
    if (consumption <= 0 || !tariffs || tariffs.length === 0) return 0;

    const sortedTiers = [...tariffs].sort((a, b) => a.From_m3 - b.From_m3);

    if (unitType === UnitType.KIOS) {
        const businessTariff = sortedTiers.find(t => t.To_m3 === null); // Highest tier is business rate
        if (!businessTariff) return 0;
        const net = consumption * businessTariff.UnitPrice;
        const vat = net * (businessTariff.VAT_percent / 100);
        return Math.round(net + vat);
    }

    // Apartment Calculation
    let totalNet = 0;
    let consumptionRemaining = consumption;
    let previousTierEnd = 0;

    for (const tier of sortedTiers) {
        if (consumptionRemaining <= 0) break;

        const currentTierEnd = tier.To_m3 ?? Infinity;
        const tierCapacity = currentTierEnd - previousTierEnd;
        const usageInTier = Math.min(consumptionRemaining, tierCapacity);

        totalNet += usageInTier * tier.UnitPrice;
        consumptionRemaining -= usageInTier;
        previousTierEnd = currentTierEnd;
    }

    const vatPercent = sortedTiers[0]?.VAT_percent ?? 5;
    const totalVat = totalNet * (vatPercent / 100);
    return Math.round(totalNet + totalVat);
};
// --- END: Bill Calculation Helper ---


interface WaterPageProps {
    waterReadings: WaterReading[];
    setWaterReadings: (updater: React.SetStateAction<WaterReading[]>, logPayload?: any) => void;
    allUnits: Unit[];
    role: Role;
    tariffs: TariffCollection;
}

const WaterPage: React.FC<WaterPageProps> = ({ waterReadings, setWaterReadings, allUnits, role, tariffs }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');
    const [kpiFilter, setKpiFilter] = useState<'residential' | 'business' | 'unrecorded' | null>(null);
    
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const inputRefs = useRef<Record<string, HTMLInputElement>>({});
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    
    const [isDataLocked, setIsDataLocked] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [historyModalUnitId, setHistoryModalUnitId] = useState<string | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);


    const waterReadingsMap = useMemo(() => {
        const map = new Map<string, WaterReading[]>();
        waterReadings.forEach(r => {
            if (!map.has(r.UnitID)) map.set(r.UnitID, []);
            map.get(r.UnitID)!.push(r);
        });
        return map;
    }, [waterReadings]);

    useEffect(() => {
        const nextPeriodDate = new Date(period + '-02');
        nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
        const nextPeriod = nextPeriodDate.toISOString().slice(0, 7);
        const hasDataInNextPeriod = waterReadings.some(r => r.Period === nextPeriod);
        setIsDataLocked(hasDataInNextPeriod);
    }, [period, waterReadings]);

    const waterData = useMemo(() => {
        const prevReadingPeriod = getPreviousPeriod(period);
        const prevPeriodReadings = new Map<string, WaterReading>(waterReadings.filter(r => r.Period === prevReadingPeriod).map(r => [r.UnitID, r]));
        const currentPeriodReadings = new Map<string, WaterReading>(waterReadings.filter(r => r.Period === period).map(r => [r.UnitID, r]));
        
        return allUnits
            .map(unit => {
                const prevReading = prevPeriodReadings.get(unit.UnitID);
                const currentReading = currentPeriodReadings.get(unit.UnitID);
                
                const prevIndex = prevReading?.CurrIndex ?? null;
                const currIndex = currentReading?.CurrIndex ?? null;

                let consumption: number | null = null;
                if (prevIndex !== null && currIndex !== null) {
                    consumption = currIndex - prevIndex;
                } else if (prevIndex === null && currIndex !== null) {
                    consumption = 0;
                }
                
                return {
                    unitId: unit.UnitID,
                    unitType: unit.UnitType,
                    prevIndex,
                    currIndex,
                    consumption,
                };
            })
            .sort((a, b) => sortUnitsComparator({ UnitID: a.unitId }, { UnitID: b.unitId }));
    }, [period, waterReadings, allUnits]);

     const historicalChartData = useMemo(() => {
        const data = [];
        let currentPeriodDate = new Date(period + '-02');

        for (let i = 0; i < 6; i++) {
            const p = currentPeriodDate.toISOString().slice(0, 7);
            let consumption = 0;
            
            if (selectedUnitId) {
                const reading = waterReadings.find(r => r.UnitID === selectedUnitId && r.Period === p);
                if (reading) {
                    const prevPeriod = getPreviousPeriod(p);
                    const hasPrev = waterReadings.some(r => r.UnitID === selectedUnitId && r.Period === prevPeriod);
                    consumption = hasPrev ? Math.max(0, reading.CurrIndex - reading.PrevIndex) : 0;
                }
            } else {
                const prevP = getPreviousPeriod(p);
                const readingsForP = waterReadings.filter(r => r.Period === p);
                const prevUnitIds = new Set(waterReadings.filter(r => r.Period === prevP).map(r => r.UnitID));

                consumption = readingsForP.reduce((total, reading) => {
                    if (prevUnitIds.has(reading.UnitID)) {
                        return total + Math.max(0, reading.CurrIndex - reading.PrevIndex);
                    }
                    return total;
                }, 0);
            }

            data.push({
                name: `${String(currentPeriodDate.getMonth() + 1).padStart(2, '0')}/${currentPeriodDate.getFullYear().toString().slice(2)}`,
                'Tiêu thụ': consumption,
            });
            currentPeriodDate.setMonth(currentPeriodDate.getMonth() - 1);
        }
        return data.reverse();
    }, [period, waterReadings, selectedUnitId]);

    const analyticsData = useMemo(() => {
        const currentPeriodData = waterData.filter(d => d.consumption !== null && d.consumption >= 0);

        const top5Highest = [...currentPeriodData]
            .sort((a, b) => (b.consumption ?? 0) - (a.consumption ?? 0))
            .slice(0, 5);

        const prevPeriod = getPreviousPeriod(period);
        const prevPeriodConsumptionMap = new Map<string, number>();
        waterReadings.filter(r => r.Period === prevPeriod).forEach(r => {
            const prevPrevReading = waterReadings.find(pr => pr.UnitID === r.UnitID && pr.Period === getPreviousPeriod(prevPeriod));
            if (prevPrevReading || r.PrevIndex === 0) { // Also count if it's the first real month
                prevPeriodConsumptionMap.set(r.UnitID, Math.max(0, r.CurrIndex - r.PrevIndex));
            }
        });

        const top5Increases = currentPeriodData
            .map(d => {
                const prevConsumption = prevPeriodConsumptionMap.get(d.unitId);
                if (prevConsumption !== undefined && d.consumption! > prevConsumption) {
                    return {
                        unitId: d.unitId,
                        increase: d.consumption! - prevConsumption,
                        current: d.consumption!,
                        previous: prevConsumption
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.increase - a.increase)
            .slice(0, 5);
        
        return { top5Highest, top5Increases };
    }, [waterData, period, waterReadings]);

    const individualUnitAnalytics = useMemo(() => {
        if (!selectedUnitId) return null;

        const readingsForUnit = waterReadings
            .filter(r => r.UnitID === selectedUnitId)
            .sort((a, b) => b.Period.localeCompare(a.Period))
            .slice(0, 12);

        if (readingsForUnit.length === 0) return { highest: null, lowest: null, average: 0 };
        
        const consumptions = readingsForUnit.map(r => {
            const prevP = getPreviousPeriod(r.Period);
            const hasPrev = waterReadings.some(pr => pr.UnitID === r.UnitID && pr.Period === prevP);
            const consumption = hasPrev ? Math.max(0, r.CurrIndex - r.PrevIndex) : 0;
            return { period: r.Period, consumption };
        });
        
        const validConsumptions = consumptions.filter(c => c.consumption > 0);
        if (validConsumptions.length === 0) return { highest: null, lowest: null, average: 0 };
        
        const highest = validConsumptions.reduce((max, current) => current.consumption > max.consumption ? current : max, validConsumptions[0]);
        const lowest = validConsumptions.reduce((min, current) => current.consumption < min.consumption ? current : min, validConsumptions[0]);
        const total = consumptions.reduce((sum, current) => sum + current.consumption, 0);
        const average = total / consumptions.length;

        return { highest, lowest, average };
    }, [selectedUnitId, waterReadings]);
    
    const totalWaterBill = useMemo(() => {
        return Math.round(waterData.reduce((total, unitData) => {
            if (unitData.consumption === null || unitData.consumption < 0) return total;
            const bill = calculateWaterBill(unitData.consumption, unitData.unitType, tariffs.water);
            return total + bill;
        }, 0));
    }, [waterData, tariffs.water]);

    const selectedUnitBill = useMemo(() => {
        if (!selectedUnitId) return 0;
        const selectedUnitData = waterData.find(d => d.unitId === selectedUnitId);
        if (!selectedUnitData || selectedUnitData.consumption === null || selectedUnitData.consumption < 0) return 0;
        return calculateWaterBill(selectedUnitData.consumption, selectedUnitData.unitType, tariffs.water);
    }, [selectedUnitId, waterData, tariffs.water]);

    const filteredWaterData = useMemo(() => {
        return waterData.filter(d => {
            if (kpiFilter) {
                if (kpiFilter === 'residential' && d.unitType !== UnitType.APARTMENT) return false;
                if (kpiFilter === 'business' && d.unitType !== UnitType.KIOS) return false;
                if (kpiFilter === 'unrecorded' && d.currIndex !== null) return false;
            }

            if (floorFilter !== 'all') {
                const floor = parseUnitCode(d.unitId)?.floor;
                const unitFloor = d.unitType === UnitType.KIOS ? 'KIOS' : String(floor);
                if (unitFloor !== floorFilter) return false;
            }

            if (searchTerm && !d.unitId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [waterData, searchTerm, floorFilter, kpiFilter]);

    const kpiStats = useMemo(() => {
        const residentialData = waterData.filter(d => d.unitType === UnitType.APARTMENT);
        const businessData = waterData.filter(d => d.unitType === UnitType.KIOS);
        return {
            totalConsumption: waterData.reduce((acc, d) => acc + (d.consumption ?? 0), 0),
            residentialConsumption: residentialData.reduce((acc, d) => acc + (d.consumption ?? 0), 0),
            businessConsumption: businessData.reduce((acc, d) => acc + (d.consumption ?? 0), 0),
            unrecordedCount: waterData.filter(d => d.currIndex === null).length
        };
    }, [waterData]);

    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(allUnits.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a, b) => parseInt(String(a), 10) - parseInt(String(b), 10));
        return [{ value: 'all', label: 'Tất cả các tầng' }, ...floorNumbers.map(f => ({ value: f, label: `Tầng ${f}` })), { value: 'KIOS', label: 'Kios' }];
    }, [allUnits]);

    const handleSave = (unitId: string, newIndexStr: string) => {
        const newIndex = parseInt(newIndexStr, 10);
        const currentData = waterData.find(d => d.unitId === unitId);
        
        const errors = { ...validationErrors };
        
        if (!currentData || isNaN(newIndex) || newIndex < 0) {
            errors[unitId] = "Chỉ số không hợp lệ.";
            setValidationErrors(errors);
            return;
        }

        const prevReadingPeriod = getPreviousPeriod(period);
        const prevReading = waterReadings.find(r => r.Period === prevReadingPeriod && r.UnitID === unitId);

        if (prevReading && newIndex < prevReading.CurrIndex) {
            errors[unitId] = "Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.";
            setValidationErrors(errors);
            return;
        }

        delete errors[unitId];
        setValidationErrors(errors);

        const newReading: WaterReading = {
            UnitID: unitId,
            Period: period,
            PrevIndex: prevReading?.CurrIndex ?? 0,
            CurrIndex: newIndex,
            Rollover: false,
        };
        
        const updater = (prev: WaterReading[]) => {
            const otherReadings = prev.filter(r => !(r.UnitID === unitId && r.Period === period));
            return [...otherReadings, newReading];
        };

        setWaterReadings(updater, {
            module: 'Water',
            action: 'UPDATE_WATER_READING',
            summary: `Cập nhật số nước cho ${unitId} kỳ ${period}`,
            ids: [unitId],
        });
    
        showToast(`Đã lưu chỉ số mới cho căn hộ ${unitId}.`, 'success');
    };
    
    const handleImportClick = () => {
        if (isDataLocked) {
            showToast('Kỳ đã bị khóa do đã có dữ liệu ở kỳ sau. Không thể nhập.', 'warn');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const parsedData = await processImportFile(file, {
                unitId: ['căn hộ', 'unit'],
                reading: ['chỉ số', 'reading'],
            });

            if (parsedData.length === 0) {
                showToast('Không tìm thấy dữ liệu hợp lệ trong file.', 'warn');
                return;
            }

            const prevPeriod = getPreviousPeriod(period);
            const prevReadingsMap = new Map<string, WaterReading>(
                waterReadings.filter(r => r.Period === prevPeriod).map(r => [r.UnitID, r])
            );
            const allUnitIds = new Set(allUnits.map(u => u.UnitID));
            const newReadings: WaterReading[] = [];
            let successCount = 0;
            let errorCount = 0;

            for (const row of parsedData) {
                const unitId = String(row.unitId).trim();
                const newIndex = parseInt(String(row.reading), 10);

                if (!allUnitIds.has(unitId) || isNaN(newIndex)) {
                    errorCount++;
                    continue;
                }

                const prevIndex = prevReadingsMap.get(unitId)?.CurrIndex ?? 0;
                if (newIndex < prevIndex) {
                    errorCount++;
                    continue;
                }

                newReadings.push({
                    UnitID: unitId,
                    Period: period,
                    PrevIndex: prevIndex,
                    CurrIndex: newIndex,
                    Rollover: false,
                });
                successCount++;
            }

            if (successCount > 0) {
                const updater = (prev: WaterReading[]) => {
                    const otherReadings = prev.filter(r => r.Period !== period);
                    const existingForPeriod = prev.filter(r => r.Period === period);
                    const newReadingsMap = new Map(newReadings.map(r => [r.UnitID, r]));
                    const mergedForPeriod = existingForPeriod.map(r => newReadingsMap.get(r.UnitID) ?? r);
                    const trulyNew = newReadings.filter(r => !existingForPeriod.some(er => er.UnitID === r.UnitID));
                    return [...otherReadings, ...mergedForPeriod, ...trulyNew];
                };
                setWaterReadings(updater, {
                    module: 'Water',
                    action: 'IMPORT_WATER_READINGS',
                    summary: `Nhập ${successCount} chỉ số nước từ file cho kỳ ${period}`,
                    count: successCount,
                });
                showToast(`Nhập thành công ${successCount} chỉ số. ${errorCount} dòng lỗi.`, 'success');
            } else {
                showToast(`Không có chỉ số hợp lệ nào được nhập. ${errorCount} dòng lỗi.`, 'warn');
            }

        } catch (error: any) {
            showToast(`Lỗi khi xử lý file: ${error.message}`, 'error');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDownloadTemplate = () => {
        const data = waterData.map(d => ({
            'Mã Căn Hộ': d.unitId,
            'Chỉ Số Cũ': d.prevIndex ?? 'N/A',
            'Chỉ Số Mới (Nhập vào đây)': ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "WaterReadings");
        XLSX.writeFile(workbook, `Water_Template_${period}.xlsx`);
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
            {historyModalUnitId && (
                <WaterHistoryModal 
                    unitId={historyModalUnitId} 
                    allUnitReadings={waterReadingsMap.get(historyModalUnitId) || []} 
                    onClose={() => setHistoryModalUnitId(null)}
                />
            )}
            
            {/* Left Column: Data Grid */}
            <div className="w-2/3 flex flex-col gap-4 min-w-0">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={() => setKpiFilter(null)} className="cursor-pointer">
                        <StatCard label="Tổng tiêu thụ" value={`${kpiStats.totalConsumption.toLocaleString()} m³`} icon={<DropletsIcon className="w-6 h-6 text-blue-600"/>} />
                    </div>
                    <div onClick={() => setKpiFilter('residential')} className="cursor-pointer">
                        <StatCard label="Hộ dân" value={`${kpiStats.residentialConsumption.toLocaleString()} m³`} icon={<HomeIcon className="w-6 h-6 text-green-600"/>} />
                    </div>
                    <div onClick={() => setKpiFilter('business')} className="cursor-pointer">
                        <StatCard label="Kinh doanh" value={`${kpiStats.businessConsumption.toLocaleString()} m³`} icon={<StoreIcon className="w-6 h-6 text-orange-600"/>} />
                    </div>
                    <div onClick={() => setKpiFilter('unrecorded')} className="cursor-pointer">
                        <StatCard label="Chưa ghi số" value={`${kpiStats.unrecordedCount} hộ`} icon={<WarningIcon className="w-6 h-6 text-red-600"/>} />
                    </div>
                </div>

                {/* Filter & Action Bar */}
                <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm flex-shrink-0">
                     <div className="flex items-center gap-4">
                         <div className="relative flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <button onClick={() => setPeriod(getPreviousPeriod(period))}><ChevronLeftIcon /></button>
                            <button onClick={() => setIsMonthPickerOpen(true)} className="p-1.5 w-32 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md">
                                {new Date(period + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </button>
                            {isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)}/>}
                            <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7);})}><ChevronRightIcon /></button>
                         </div>
                         <div className="relative flex-grow">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Tìm căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600"/>
                         </div>
                         <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="h-10 px-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600">
                            {floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                         </select>
                         <div className="flex items-center gap-2">
                            <button onClick={handleImportClick} disabled={!canEdit} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 bg-white dark:bg-transparent disabled:opacity-50"><UploadIcon /> Import</button>
                            <button onClick={handleDownloadTemplate} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-gray-500 text-gray-700 hover:bg-gray-500/10"><DocumentArrowDownIcon /> Tải mẫu</button>
                        </div>
                    </div>
                    {isDataLocked && <p className="text-center text-xs text-yellow-600 font-semibold mt-2">Đã có dữ liệu ở kỳ sau, không thể chỉnh sửa kỳ này.</p>}
                </div>

                {/* Data Grid */}
                <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="overflow-y-auto pr-2">
                         <table className="min-w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số cũ</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số mới</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tiêu thụ (m³)</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Lịch sử</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                 {filteredWaterData.map(d => (
                                    <tr key={d.unitId} onClick={() => setSelectedUnitId(p => p === d.unitId ? null : d.unitId)} className={`cursor-pointer transition-colors ${selectedUnitId === d.unitId ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="font-semibold px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{d.unitId}</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{d.prevIndex?.toLocaleString('vi-VN') ?? 'N/A'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                ref={el => { if (el) inputRefs.current[d.unitId] = el; }}
                                                type="number"
                                                defaultValue={d.currIndex ?? ''}
                                                onBlur={e => handleSave(d.unitId, e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                disabled={!canEdit || isDataLocked}
                                                className={`w-32 text-right p-2 text-sm border rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary ${validationErrors[d.unitId] ? 'border-red-500' : 'border-gray-300'} disabled:bg-transparent disabled:border-transparent`}
                                            />
                                            {validationErrors[d.unitId] && <p className="text-red-500 text-xs text-right mt-1">{validationErrors[d.unitId]}</p>}
                                        </td>
                                        <td className={`font-bold px-4 py-3 text-right text-sm ${d.consumption && d.consumption > 30 ? 'text-red-600' : (d.consumption && d.consumption > 20 ? 'text-yellow-600' : 'text-primary')}`}>
                                            {d.consumption !== null ? `${d.consumption.toLocaleString('vi-VN')} m³` : 'Chưa có'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={(e) => { e.stopPropagation(); setHistoryModalUnitId(d.unitId); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ClipboardDocumentListIcon className="w-5 h-5 text-gray-500"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>
            </div>

            {/* Right Column: Analytics */}
            <div className="w-1/3 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm overflow-y-auto p-6 space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-200">{selectedUnitId ? `Phân tích: Căn hộ ${selectedUnitId}` : 'Phân tích Chung'}</h3>
                
                <div className="border-t pt-4 dark:border-dark-border">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">{selectedUnitId ? 'Hóa đơn nước (ước tính)' : 'Tổng hóa đơn nước (ước tính)'}</h4>
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedUnitId ? selectedUnitBill : totalWaterBill)}</p>
                    </div>
                    <h4 className="font-semibold mb-2">Tiêu thụ 6 tháng qua</h4>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={historicalChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border, #e5e7eb)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                <YAxis unit=" m³" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                <Tooltip formatter={(v: number) => [`${v} m³`, 'Tiêu thụ']} contentStyle={{ backgroundColor: 'var(--light-bg-secondary, white)', border: '1px solid var(--light-border, #e5e7eb)', borderRadius: '0.5rem' }}/>
                                <Bar dataKey="Tiêu thụ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {selectedUnitId && individualUnitAnalytics && (
                    <div className="border-t pt-4 dark:border-dark-border space-y-3">
                        <h4 className="font-semibold">Thống kê riêng</h4>
                        <div className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md"><span>Tiêu thụ trung bình (12 tháng):</span> <span className="font-bold">{individualUnitAnalytics.average.toFixed(1)} m³</span></div>
                        {individualUnitAnalytics.highest && <div className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md"><span>Tháng cao nhất ({individualUnitAnalytics.highest.period}):</span> <span className="font-bold">{individualUnitAnalytics.highest.consumption} m³</span></div>}
                        {individualUnitAnalytics.lowest && <div className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md"><span>Tháng thấp nhất ({individualUnitAnalytics.lowest.period}):</span> <span className="font-bold">{individualUnitAnalytics.lowest.consumption} m³</span></div>}
                    </div>
                )}

                {!selectedUnitId && (
                    <div className="border-t pt-4 dark:border-dark-border space-y-3">
                        <h4 className="font-semibold flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500"/> Top 5 tiêu thụ cao nhất kỳ này</h4>
                        <ul className="space-y-1 text-sm">{analyticsData.top5Highest.map(d => <li key={d.unitId} className="flex justify-between p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><span>Căn hộ {d.unitId}</span><span className="font-bold">{d.consumption} m³</span></li>)}</ul>
                    </div>
                )}
                {!selectedUnitId && (
                    <div className="border-t pt-4 dark:border-dark-border space-y-3">
                        <h4 className="font-semibold flex items-center gap-2"><TrendingUpIcon className="w-5 h-5 text-red-500"/> Top 5 tăng đột biến so với kỳ trước</h4>
                        <ul className="space-y-1 text-sm">{analyticsData.top5Increases.map(d => <li key={d.unitId} className="flex justify-between p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><span>Căn hộ {d.unitId}</span><span className="font-bold text-red-500">+{d.increase} m³</span></li>)}</ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaterPage;