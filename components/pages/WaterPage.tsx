import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { WaterReading, Unit, Role } from '../../types';
import { UnitType } from '../../types';
import { useNotification } from '../../App';
import { HomeIcon, StoreIcon, TrendingUpIcon, DropletsIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, SearchIcon, BuildingIcon, UploadIcon, DocumentArrowDownIcon } from '../ui/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseUnitCode, getPreviousPeriod } from '../../utils/helpers';

// --- START: Helper Functions ---
const sortUnitsComparator = (a: { UnitID: string }, b: { UnitID: string }) => {
    const pa = parseUnitCode(a.UnitID) || { floor: 999, apt: 999 };
    const pb = parseUnitCode(b.UnitID) || { floor: 999, apt: 999 };
    if (pa.floor !== pb.floor) return pa.floor - pb.floor;
    return pa.apt - pb.apt;
};
// --- END: Helper Functions ---


// --- START: Child Components ---
const KpiCard: React.FC<{ title: string; tooltip: string; value: string | number; icon: React.ReactNode; onClick?: () => void; isActive: boolean }> = ({ title, tooltip, value, icon, onClick, isActive }) => (
    <div
        className={`stat-card cursor-pointer ${isActive ? 'ring-2 ring-primary' : ''}`}
        data-tooltip={tooltip}
        onClick={onClick}
    >
        <div className="stat-icon">{icon}</div>
        <p className="stat-value">{value}</p>
        <span className="stat-label">{title}</span>
    </div>
);

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
// --- END: Child Components ---

interface WaterPageProps {
    waterReadings: WaterReading[];
    setWaterReadings: (updater: (readings: WaterReading[]) => WaterReading[]) => void;
    allUnits: Unit[];
    role: Role;
}

const WaterPage: React.FC<WaterPageProps> = ({ waterReadings, setWaterReadings, allUnits, role }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    const currentISODate = new Date().toISOString().slice(0, 7);
    const [period, setPeriod] = useState('2025-11');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');
    const [kpiFilter, setKpiFilter] = useState<'residential' | 'business' | null>(null);
    
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const inputRefs = useRef<Record<string, HTMLInputElement>>({});
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Hydrate readings for the current period
    useEffect(() => {
        const previousPeriod = getPreviousPeriod(period);
        const previousReadingsMap = new Map<string, WaterReading>(waterReadings.filter(r => r.Period === previousPeriod).map(r => [r.UnitID, r]));
        const unitsWithCurrentReading = new Set(waterReadings.filter(r => r.Period === period).map(r => r.UnitID));

        const newReadingsForCurrentPeriod = allUnits
            .filter(unit => !unitsWithCurrentReading.has(unit.UnitID))
            .map(unit => {
                const prevReading = previousReadingsMap.get(unit.UnitID);
                const prevIndex = prevReading ? prevReading.CurrIndex : 0;
                return {
                    UnitID: unit.UnitID, Period: period,
                    PrevIndex: prevIndex, CurrIndex: prevIndex,
                    Rollover: false,
                };
            });
        
        if (newReadingsForCurrentPeriod.length > 0) {
            setWaterReadings(prev => [...prev, ...newReadingsForCurrentPeriod]);
        }
        setSelectedUnitId(null); // Reset selection on period change
    }, [period, allUnits, waterReadings, setWaterReadings]);

    const readingsMapByPeriod = useMemo(() => {
        const map = new Map<string, Map<string, WaterReading>>();
        waterReadings.forEach(r => {
            if (!map.has(r.Period)) map.set(r.Period, new Map());
            map.get(r.Period)!.set(r.UnitID, r);
        });
        return map;
    }, [waterReadings]);

    const unitsWithData = useMemo(() => {
        const readingsForPeriod = readingsMapByPeriod.get(period) || new Map();
        const prevReadingsForPeriod = readingsMapByPeriod.get(getPreviousPeriod(period)) || new Map();
        
        return allUnits
            .map(unit => {
                const reading = readingsForPeriod.get(unit.UnitID);
                const prevReading = prevReadingsForPeriod.get(unit.UnitID);
                
                const consumption = reading ? Math.max(0, reading.CurrIndex - reading.PrevIndex) : 0;

                const hasBeenRecorded = reading ? reading.CurrIndex > (prevReading?.CurrIndex ?? (reading.PrevIndex || 0)) : false;
                
                const isKios = unit.UnitType === UnitType.KIOS;
                const isBusinessApt = unit.UnitType === UnitType.APARTMENT && unit.Status === 'Business';

                return {
                    unit,
                    reading: reading || { UnitID: unit.UnitID, Period: period, PrevIndex: prevReading?.CurrIndex ?? 0, CurrIndex: prevReading?.CurrIndex ?? 0, Rollover: false },
                    prevIndex: prevReading?.CurrIndex ?? 0,
                    consumption: consumption,
                    hasNoPrevious: !!reading && !prevReading,
                    isRecorded: hasBeenRecorded,
                    isBusiness: isKios || isBusinessApt,
                    isResidential: unit.UnitType === UnitType.APARTMENT && unit.Status !== 'Business',
                };
            })
            .sort((a, b) => sortUnitsComparator(a.unit, b.unit));
    }, [allUnits, period, readingsMapByPeriod]);
    
    const filteredUnits = useMemo(() => {
        return unitsWithData.filter(item => {
            const floor = String(parseUnitCode(item.unit.UnitID)?.floor);
            if (floorFilter !== 'all' && floor !== floorFilter && !(floorFilter === '99' && item.unit.UnitID.startsWith('K'))) return false;
            
            if (kpiFilter === 'business' && !item.isBusiness) return false;
            if (kpiFilter === 'residential' && !item.isResidential) return false;
            
            if (searchTerm && !item.unit.UnitID.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            
            return true;
        });
    }, [unitsWithData, floorFilter, searchTerm, kpiFilter]);

    const kpiStats = useMemo(() => {
        let totalM3 = 0, totalM3Business = 0, resM3 = 0, resCountWithData = 0;

        for (const item of unitsWithData) {
            const m3 = item.consumption;
            totalM3 += m3;
            if(item.isBusiness) totalM3Business += m3;
            if(item.isResidential) {
                resM3 += m3;
                if(item.isRecorded) resCountWithData++;
            }
        }
        
        return {
            totalM3: totalM3.toLocaleString('vi-VN'),
            totalLitersResidential: (resM3 * 1000).toLocaleString('vi-VN'),
            totalM3Business: totalM3Business.toLocaleString('vi-VN'),
            avgM3Apts: resCountWithData > 0 ? (resM3 / resCountWithData).toFixed(1) : '0.0',
        };
    }, [unitsWithData]);

    const historyData = useMemo(() => {
        if (!selectedUnitId) return null;

        const data = [];
        let currentPeriodForChart = period;
        for (let i = 0; i < 6; i++) {
            const reading = readingsMapByPeriod.get(currentPeriodForChart)?.get(selectedUnitId);
            
            const consumption = reading ? Math.max(0, reading.CurrIndex - reading.PrevIndex) : 0;
            
            const monthName = new Date(currentPeriodForChart + '-02').toLocaleString('en-US', { month: 'short' });
            data.unshift({ name: monthName, consumption });
            
            currentPeriodForChart = getPreviousPeriod(currentPeriodForChart);
        }
        
        const consumptions = data.map(d => d.consumption);
        const validConsumptions = consumptions.filter(c => c > 0);
        
        return {
            chartData: data,
            stats: {
                max: validConsumptions.length > 0 ? Math.max(...validConsumptions) : 0,
                min: validConsumptions.length > 0 ? Math.min(...validConsumptions) : 0,
                avg: validConsumptions.length > 0 ? (validConsumptions.reduce((a, b) => a + b, 0) / validConsumptions.length).toFixed(1) : '0.0',
            }
        };
    }, [selectedUnitId, period, readingsMapByPeriod]);


    const handleReadingChange = (unitId: string, value: string) => {
        if (!canEdit) return;
        const numericValue = parseInt(value, 10);
        
        setWaterReadings(prev => {
            const currentReading = prev.find(r => r.UnitID === unitId && r.Period === period);
            const prevIndexForThisUnit = currentReading?.PrevIndex ?? 0;
            return prev.map(r => (r.UnitID === unitId && r.Period === period) ? { ...r, CurrIndex: isNaN(numericValue) ? prevIndexForThisUnit : numericValue } : r);
        });
    };

    const handleInputBlur = (unitId: string, currentIndex: number, previousIndex: number) => {
        if (currentIndex < previousIndex) {
            setValidationErrors(prev => ({ ...prev, [unitId]: `Chỉ số phải ≥ ${previousIndex}` }));
        } else {
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[unitId];
                return next;
            });
            showToast(`Đã cập nhật chỉ số cho căn hộ ${unitId}`, 'success', 2000);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextUnit = filteredUnits[currentIndex + 1];
            if (nextUnit) {
                inputRefs.current[nextUnit.unit.UnitID]?.focus();
            }
        }
    };

    const navigatePeriod = (direction: 'prev' | 'next') => {
        const d = new Date(period + '-02');
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        const newPeriodDate = new Date(d.getFullYear(), d.getMonth(), 1);
        const currentPeriodDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (direction === 'next' && newPeriodDate > currentPeriodDate) {
            showToast("Không thể xem kỳ tương lai.", "info");
            return;
        }
        setPeriod(d.toISOString().slice(0, 7));
    };

    const handleDownloadTemplate = () => {
        const headers = ['UnitID', 'PrevIndex', 'CurrIndex'].join(',');
        
        const rows = unitsWithData.map(item => {
            return [
                item.unit.UnitID,
                item.reading.PrevIndex,
                '' // Leave current index blank for user to fill
            ].join(',');
        });

        const csvString = [headers, ...rows].join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `water_template_${period}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Đã tải xuống file template.', 'success');
    };

    const handleImportClick = () => {
        if (!canEdit) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) throw new Error("File rỗng hoặc không có dữ liệu.");

                const headerLine = lines[0].toLowerCase();
                const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
                
                const unitIdIndex = headers.indexOf('unitid');
                const currIndexIndex = headers.indexOf('currindex');

                if (unitIdIndex === -1 || currIndexIndex === -1) {
                    throw new Error("File CSV phải có cột 'UnitID' và 'CurrIndex'.");
                }
                
                let updatedCount = 0;
                let skippedCount = 0;
                const errors: string[] = [];

                const currentPeriodReadingsMap = new Map<string, WaterReading>();
                waterReadings.filter(r => r.Period === period).forEach(r => currentPeriodReadingsMap.set(r.UnitID, r));

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    const unitId = values[unitIdIndex]?.trim().replace(/"/g, '');
                    const currIndexStr = values[currIndexIndex]?.trim().replace(/"/g, '');
                    
                    if (!unitId || currIndexStr === '') {
                        skippedCount++;
                        continue;
                    }

                    const currIndex = parseInt(currIndexStr, 10);
                    const existingReading = currentPeriodReadingsMap.get(unitId);

                    if (!existingReading) {
                        skippedCount++;
                        errors.push(`Dòng ${i + 1}: Căn hộ ${unitId} không tồn tại trong kỳ này.`);
                        continue;
                    }

                    if (isNaN(currIndex) || currIndex < 0) {
                        skippedCount++;
                        errors.push(`Dòng ${i + 1}: Chỉ số mới '${currIndexStr}' của căn hộ ${unitId} không hợp lệ.`);
                        continue;
                    }

                    if (currIndex < existingReading.PrevIndex) {
                        skippedCount++;
                        errors.push(`Dòng ${i + 1}: Chỉ số mới (${currIndex}) của căn hộ ${unitId} nhỏ hơn chỉ số cũ (${existingReading.PrevIndex}).`);
                        continue;
                    }
                    
                    currentPeriodReadingsMap.set(unitId, { ...existingReading, CurrIndex: currIndex });
                    updatedCount++;
                }

                setWaterReadings(prevReadings => {
                    const otherPeriodReadings = prevReadings.filter(r => r.Period !== period);
                    const updatedPeriodReadings = Array.from(currentPeriodReadingsMap.values());
                    return [...otherPeriodReadings, ...updatedPeriodReadings];
                });

                if (errors.length > 0) {
                     showToast(`Hoàn tất: ${updatedCount} cập nhật, ${skippedCount} bỏ qua. Một số dòng có lỗi.`, 'warn', 8000);
                     console.warn("CSV Import errors:", errors);
                } else {
                     showToast(`Nhập thành công ${updatedCount} chỉ số nước.`, 'success');
                }

            } catch (error: any) {
                showToast(`Lỗi xử lý file CSV: ${error.message}`, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    
    const floors = ['all', ...Array.from(new Set(allUnits.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10)), '99'];

    return (
        <div className="h-full flex flex-col space-y-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
            />
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-light-bg dark:bg-dark-bg -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:-mx-8 pt-4 pb-2 space-y-3">
                {/* KPI Bar */}
                <div className="stats-row">
                    <KpiCard title="Total m³" tooltip="Tổng tiêu thụ (m³) toàn bộ toà trong kỳ" value={kpiStats.totalM3} icon={<DropletsIcon className="h-5 w-5 text-cyan-500" />} isActive={!kpiFilter} onClick={() => setKpiFilter(null)} />
                    <KpiCard title="Residential Liters" tooltip="Tổng nước sinh hoạt (lít) – chỉ căn hộ thường" value={kpiStats.totalLitersResidential} icon={<HomeIcon className="h-5 w-5 text-sky-500" />} isActive={kpiFilter === 'residential'} onClick={() => setKpiFilter('residential')} />
                    <KpiCard title="Business m³" tooltip="Tổng tiêu thụ (m³) áp giá kinh doanh" value={kpiStats.totalM3Business} icon={<StoreIcon className="h-5 w-5 text-amber-500" />} isActive={kpiFilter === 'business'} onClick={() => setKpiFilter('business')} />
                    <KpiCard title="Avg Apartment m³" tooltip="M³ bình quân – chỉ khối căn hộ thường" value={kpiStats.avgM3Apts} icon={<TrendingUpIcon className="h-5 w-5 text-lime-500" />} isActive={false} />
                </div>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-4 p-2 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-xl border dark:border-dark-border shadow-sm">
                    <div className="relative flex items-center gap-1 p-1 bg-light-bg dark:bg-dark-bg rounded-lg">
                        <button onClick={() => navigatePeriod('prev')} data-tooltip="Kỳ trước"><ChevronLeftIcon /></button>
                        <button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-40 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md" data-tooltip="Chọn kỳ chốt nước">
                            {new Date(period + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </button>
                         {isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />}
                        <button onClick={() => navigatePeriod('next')} data-tooltip="Kỳ sau"><ChevronRightIcon /></button>
                    </div>
                    <button onClick={() => setPeriod(currentISODate)} data-tooltip="Trở về tháng hiện tại" className={`p-2 rounded-md text-sm font-semibold flex items-center gap-1 ${period === currentISODate ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}><CalendarDaysIcon /> Current</button>

                    <div className="relative flex-grow min-w-[200px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm theo mã căn..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"/></div>
                    <div className="flex items-center gap-2" data-tooltip="Lọc theo tầng">
                        <BuildingIcon className="w-5 w-5 text-gray-500" />
                        <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg">
                            {floors.map(f => <option key={f} value={f}>{f === 'all' ? 'All Floors' : (f === '99' ? 'KIOS' : `Floor ${f}`)}</option>)}
                        </select>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={handleDownloadTemplate} className="h-9 px-3 text-sm bg-gray-600 text-white font-semibold rounded-lg shadow-sm hover:bg-gray-700 flex items-center gap-2"><DocumentArrowDownIcon/> Tải Template</button>
                        <button onClick={handleImportClick} disabled={!canEdit} className="h-9 px-3 text-sm bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-focus disabled:bg-gray-400 flex items-center gap-2"><UploadIcon/> Nhập CSV</button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
                <div className="lg:col-span-2 bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md h-full flex flex-col overflow-hidden">
                    <div className="overflow-y-auto">
                        <table className="min-w-full themed-table">
                            <thead className="sticky top-0 z-10">
                                <tr><th>Căn hộ</th><th className="text-right">Chỉ số tháng</th><th className="text-right whitespace-nowrap">Tiêu thụ (m³)</th></tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredUnits.map((item, index) => (
                                    <tr key={item.unit.UnitID} onClick={() => setSelectedUnitId(item.unit.UnitID)} className={`cursor-pointer ${selectedUnitId === item.unit.UnitID ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                                        <td className="font-medium py-3 px-4">{item.unit.UnitID}</td>
                                        <td className="text-right py-3 px-4">
                                            <input
                                                ref={el => el ? (inputRefs.current[item.unit.UnitID] = el) : delete inputRefs.current[item.unit.UnitID]}
                                                type="number"
                                                value={item.reading.CurrIndex}
                                                onChange={e => handleReadingChange(item.unit.UnitID, e.target.value)}
                                                onBlur={() => handleInputBlur(item.unit.UnitID, item.reading.CurrIndex, item.prevIndex)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                disabled={!canEdit}
                                                className={`w-32 p-1 text-sm text-right border rounded-md bg-light-bg dark:bg-dark-bg ${validationErrors[item.unit.UnitID] ? 'border-red-500' : 'border-light-border dark:border-dark-border'}`}
                                            />
                                            {validationErrors[item.unit.UnitID] && <p className="text-red-500 text-xs text-right">{validationErrors[item.unit.UnitID]}</p>}
                                        </td>
                                        <td className="text-right font-semibold py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.hasNoPrevious && item.isRecorded && <span data-tooltip="Chưa có kỳ trước" className="px-1.5 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded-full">!</span>}
                                                {item.consumption}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="lg:col-span-1 bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md">
                    {historyData && selectedUnitId ? (
                        <div>
                            <h3 className="font-bold text-lg mb-2">Lịch sử tiêu thụ: {selectedUnitId}</h3>
                            <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-md"><div className="font-bold">{historyData.stats.max}</div><div className="text-xs">Cao nhất</div></div>
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md"><div className="font-bold">{historyData.stats.avg}</div><div className="text-xs">Trung bình</div></div>
                                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-md"><div className="font-bold">{historyData.stats.min}</div><div className="text-xs">Thấp nhất</div></div>
                            </div>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={historyData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)' }} fontSize={12} />
                                    <YAxis tick={{ fill: 'var(--color-text-secondary)' }} fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)' }} />
                                    <Line type="monotone" dataKey="consumption" stroke="#006f3a" strokeWidth={2} name="Tiêu thụ (m³)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500">
                            <p>Chọn một căn hộ để xem lịch sử tiêu thụ 6 tháng gần nhất.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaterPage;
