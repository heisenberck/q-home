
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { WaterReading, Unit, Role, TariffWater, TariffCollection } from '../../types';
import { UnitType } from '../../types';
import { useNotification } from '../../App';
import { HomeIcon, StoreIcon, TrendingUpIcon, DropletsIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, UploadIcon, ListBulletIcon, SparklesIcon, ClipboardDocumentListIcon, DocumentArrowDownIcon, CurrencyDollarIcon } from '../ui/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parseUnitCode, getPreviousPeriod, sortUnitsComparator, formatCurrency } from '../../utils/helpers';
import StatCard from '../ui/StatCard';
import { processImportFile } from '../../utils/importHelpers';
import Modal from '../ui/Modal';

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
    const [period, setPeriod] = useState('2025-11');
    
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
        return waterData.reduce((total, unitData) => {
            if (unitData.consumption === null || unitData.consumption < 0) return total;
            const bill = calculateWaterBill(unitData.consumption, unitData.unitType, tariffs.water);
            return total + bill;
        }, 0);
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
            summary: `Cập nhật số nước cho ${unitId} kỳ ${period}: ${newIndex}`,
            ids: [unitId]
        });
        showToast(`Đã lưu chỉ số nước cho căn hộ ${unitId}.`, 'success');
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const columnMappings = {
                unitId: ['căn hộ', 'unit', 'mã căn'],
                reading: ['chỉ số', 'reading', 'index', 'số nước', 'chỉ số mới'],
            };
            const data = await processImportFile(file, columnMappings);
            
            const newReadings: { unitId: string, newIndex: number }[] = [];
            data.forEach((row: any) => {
                const unitId = String(row.unitId).trim();
                const reading = parseInt(String(row.reading), 10);
                
                if (allUnits.some(u => u.UnitID === unitId) && !isNaN(reading) && reading >= 0) {
                    newReadings.push({ unitId, newIndex: reading });
                } else {
                    showToast(`Dòng không hợp lệ: Căn hộ '${row.unitId}' hoặc chỉ số '${row.reading}'`, 'warn');
                }
            });

            if (newReadings.length > 0) {
                 const prevReadingPeriod = getPreviousPeriod(period);
                 const prevReadingsMap = new Map<string, number>(waterReadings.filter(r => r.Period === prevReadingPeriod).map(r => [r.UnitID, r.CurrIndex]));

                 const readingsToSave: WaterReading[] = newReadings.map(({ unitId, newIndex }) => ({
                    UnitID: unitId,
                    Period: period,
                    PrevIndex: prevReadingsMap.get(unitId) ?? 0,
                    CurrIndex: newIndex,
                    Rollover: false,
                 }));

                 const updater = (prev: WaterReading[]) => {
                    const existingUnitIds = new Set(readingsToSave.map(r => r.UnitID));
                    const otherReadings = prev.filter(r => !(r.Period === period && existingUnitIds.has(r.UnitID)));
                    return [...otherReadings, ...readingsToSave];
                };
                
                setWaterReadings(updater, {
                    module: 'Water', action: 'IMPORT_WATER_READINGS',
                    summary: `Nhập ${readingsToSave.length} chỉ số nước cho kỳ ${period}`,
                    count: readingsToSave.length
                });

                showToast(`Đã nhập thành công ${readingsToSave.length} chỉ số nước.`, 'success');
            }

        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDownloadTemplate = () => {
        if (typeof XLSX === 'undefined') {
            showToast('Thư viện Excel chưa sẵn sàng, vui lòng thử lại sau giây lát.', 'warn');
            return;
        }
        
        const sortedUnits = [...allUnits].sort(sortUnitsComparator);
        const data = sortedUnits.map(unit => ({
            "Căn hộ": unit.UnitID,
            "Chỉ số mới": ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        
        worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }];

        XLSX.writeFile(workbook, `Template_GhiSoNuoc_Ky_${period}.xlsx`);
        showToast('Đã tải xuống file mẫu.', 'success');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {historyModalUnitId && (
                <WaterHistoryModal
                    unitId={historyModalUnitId}
                    allUnitReadings={waterReadingsMap.get(historyModalUnitId) || []}
                    onClose={() => setHistoryModalUnitId(null)}
                />
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" className="hidden" />

            {/* Left Column */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="cursor-pointer" onClick={() => setKpiFilter(null)}>
                        <StatCard label="Tổng tiêu thụ" value={`${kpiStats.totalConsumption.toLocaleString('vi-VN')} m³`} icon={<DropletsIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />} iconBgClass="bg-indigo-100 dark:bg-indigo-900/50" />
                    </div>
                    <div className="cursor-pointer" onClick={() => setKpiFilter('residential')}>
                        <StatCard label="Hộ dân cư" value={`${kpiStats.residentialConsumption.toLocaleString('vi-VN')} m³`} icon={<HomeIcon className="w-7 h-7 text-green-600 dark:text-green-400" />} iconBgClass="bg-green-100 dark:bg-green-900/50" />
                    </div>
                    <div className="cursor-pointer" onClick={() => setKpiFilter('business')}>
                        <StatCard label="Hộ kinh doanh" value={`${kpiStats.businessConsumption.toLocaleString('vi-VN')} m³`} icon={<StoreIcon className="w-7 h-7 text-amber-600 dark:text-amber-400" />} iconBgClass="bg-amber-100 dark:bg-amber-900/50" />
                    </div>
                    <div className="cursor-pointer" onClick={() => setKpiFilter('unrecorded')}>
                        <StatCard label="Chưa ghi nhận" value={`${kpiStats.unrecordedCount} hộ`} icon={<TrendingUpIcon className="w-7 h-7 text-red-600 dark:text-red-400" />} iconBgClass="bg-red-100 dark:bg-red-900/50" />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <button onClick={() => setPeriod(getPreviousPeriod(period))} data-tooltip="Kỳ trước"><ChevronLeftIcon /></button>
                            <button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-32 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md" data-tooltip="Chọn kỳ">
                                {new Date(period + '-02').toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
                            </button>
                            {isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />}
                            <button onClick={() => setPeriod(new Date(new Date(period + '-02').setMonth(new Date(period + '-02').getMonth() + 1)).toISOString().slice(0, 7))} data-tooltip="Kỳ sau"><ChevronRightIcon /></button>
                        </div>
                        <div className="relative flex-grow min-w-[200px]">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Tìm căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
                        </div>
                        <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white">
                            {floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={handleDownloadTemplate} disabled={!canEdit} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md flex items-center gap-2 disabled:bg-gray-400">
                                <DocumentArrowDownIcon /> Template
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} disabled={!canEdit || isDataLocked} className="px-4 py-2 bg-primary text-white font-semibold rounded-md flex items-center gap-2 disabled:bg-gray-400">
                                <UploadIcon /> Import
                            </button>
                        </div>
                    </div>
                    {isDataLocked && <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-3 font-semibold text-center">Đã có dữ liệu cho kỳ sau, không thể chỉnh sửa kỳ này.</p>}
                </div>

                <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="overflow-y-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số cũ (m³)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số mới (m³)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tiêu thụ (m³)</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredWaterData.map(({ unitId, prevIndex, currIndex, consumption }) => (
                                    <tr key={unitId} 
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedUnitId === unitId ? 'bg-blue-50 dark:bg-blue-900/40' : ''}`}
                                        onClick={() => setSelectedUnitId(prev => prev === unitId ? null : unitId)}
                                    >
                                        <td className="font-medium px-4 py-2 text-sm text-gray-900 dark:text-gray-200">{unitId}</td>
                                        <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{prevIndex?.toLocaleString('vi-VN') ?? '-'}</td>
                                        <td className="px-4 py-2 text-right">
                                            <input
                                                ref={el => { if (el) inputRefs.current[unitId] = el; }}
                                                type="number"
                                                defaultValue={currIndex ?? ''}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleSave(unitId, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                disabled={!canEdit || isDataLocked}
                                                className={`w-32 text-right p-2 text-sm border rounded-md bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary disabled:bg-transparent disabled:border-transparent ${validationErrors[unitId] ? 'border-red-500' : ''}`}
                                            />
                                        </td>
                                        <td className={`px-4 py-2 text-right font-bold text-sm ${consumption === 0 && prevIndex === null ? 'text-gray-400' : 'text-primary'}`}>
                                            {consumption === 0 && prevIndex === null ? '-' : consumption?.toLocaleString('vi-VN') ?? '?'}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setHistoryModalUnitId(unitId); }}
                                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                                                data-tooltip="Xem lịch sử"
                                            >
                                                <ListBulletIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm sticky top-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">
                            {selectedUnitId ? `Lịch sử tiêu thụ (Căn hộ ${selectedUnitId})` : 'Lịch sử tiêu thụ 6 tháng'}
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historicalChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border, #e5e7eb)" />
                                    <XAxis dataKey="name" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                    <YAxis unit=" m³" tick={{ fill: 'var(--light-text-secondary, #6b7280)', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--light-bg-secondary, white)', border: '1px solid var(--light-border, #e5e7eb)', borderRadius: '0.5rem' }}
                                        formatter={(value: number) => [`${value.toLocaleString('vi-VN')} m³`, selectedUnitId ? `Tiêu thụ: ${selectedUnitId}` : 'Tổng tiêu thụ']}
                                    />
                                    <Bar dataKey="Tiêu thụ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="border-t dark:border-dark-border pt-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                            <CurrencyDollarIcon/> Tổng tiền nước tháng
                        </h4>
                        <div className="text-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                            <span className="text-3xl font-bold text-primary">
                                {formatCurrency(selectedUnitId ? selectedUnitBill : totalWaterBill)}
                            </span>
                            {selectedUnitId && <p className="text-xs text-gray-500 mt-1">Cho căn hộ {selectedUnitId}</p>}
                        </div>
                    </div>
                    
                    <div className="border-t dark:border-dark-border pt-4">
                        {selectedUnitId && individualUnitAnalytics ? (
                            <div>
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><ClipboardDocumentListIcon/> Thống kê chi tiết (12 tháng)</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md items-center">
                                        <span className="text-gray-500 dark:text-gray-400">Trung bình tháng:</span>
                                        <span className="font-bold text-lg">{individualUnitAnalytics.average.toFixed(1)} m³</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md items-center">
                                        <span className="text-gray-500 dark:text-gray-400">Cao nhất:</span>
                                        {individualUnitAnalytics.highest ? (<span className="font-semibold">{individualUnitAnalytics.highest.consumption} m³ <span className="text-xs text-gray-400 font-normal">({individualUnitAnalytics.highest.period})</span></span>) : <span>N/A</span>}
                                    </div>
                                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md items-center">
                                        <span className="text-gray-500 dark:text-gray-400">Thấp nhất:</span>
                                        {individualUnitAnalytics.lowest ? (<span className="font-semibold">{individualUnitAnalytics.lowest.consumption} m³ <span className="text-xs text-gray-400 font-normal">({individualUnitAnalytics.lowest.period})</span></span>) : <span>N/A</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2"><TrendingUpIcon/> Top 5 tiêu thụ cao</h4>
                                    <ul className="space-y-1 text-sm">
                                        {analyticsData.top5Highest.map(item => (
                                            <li key={item.unitId} className="flex justify-between items-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{item.unitId}</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{item.consumption?.toLocaleString('vi-VN')} m³</span>
                                            </li>
                                        ))}
                                            {analyticsData.top5Highest.length === 0 && <li className="text-center text-gray-500 text-xs py-2">Chưa có dữ liệu</li>}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2"><SparklesIcon/> Top 5 tăng đột biến</h4>
                                    <ul className="space-y-1 text-sm">
                                        {analyticsData.top5Increases.map(item => (
                                            <li key={item.unitId} className="flex justify-between items-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{item.unitId}</span>
                                                <span className="font-bold text-red-500 dark:text-red-400" title={`Kỳ trước: ${item.previous} m³`}>+{item.increase.toLocaleString('vi-VN')} m³</span>
                                            </li>
                                        ))}
                                        {analyticsData.top5Increases.length === 0 && <li className="text-center text-gray-500 text-xs py-2">Chưa có dữ liệu</li>}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaterPage;