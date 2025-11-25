import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { WaterReading, Unit, Role } from '../../types';
import { UnitType } from '../../types';
import { useNotification } from '../../App';
import { HomeIcon, StoreIcon, TrendingUpIcon, DropletsIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, SearchIcon, BuildingIcon, UploadIcon, DocumentArrowDownIcon } from '../ui/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseUnitCode, getPreviousPeriod, sortUnitsComparator } from '../../utils/helpers';
import StatCard from '../ui/StatCard';

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
// --- END: Child Components ---

interface WaterPageProps {
    waterReadings: WaterReading[];
    setWaterReadings: (updater: React.SetStateAction<WaterReading[]>, summary?: string) => void;
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
        
        return allUnits
            .map(unit => {
                const reading = readingsForPeriod.get(unit.UnitID);
                const consumption = reading ? Math.max(0, reading.CurrIndex - reading.PrevIndex) : 0;
                const hasBeenRecorded = reading ? reading.CurrIndex > reading.PrevIndex : false;
                const isKios = unit.UnitType === UnitType.KIOS;
                const isBusinessApt = unit.UnitType === UnitType.APARTMENT && unit.Status === 'Business';

                return {
                    unit,
                    reading: reading || { UnitID: unit.UnitID, Period: period, PrevIndex: 0, CurrIndex: 0, Rollover: false },
                    prevIndex: reading?.PrevIndex ?? 0,
                    consumption: consumption,
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
        // Current period calculation
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

        // Previous period calculation
        const prevPeriod = getPreviousPeriod(period);
        const prevReadingsForPeriod = readingsMapByPeriod.get(prevPeriod) || new Map();
        let prevTotalM3 = 0, prevResM3 = 0, prevBusinessM3 = 0;
        
        for (const unit of allUnits) {
            const reading = prevReadingsForPeriod.get(unit.UnitID);
            if (!reading) continue;
            
            const consumption = Math.max(0, reading.CurrIndex - reading.PrevIndex);
            
            prevTotalM3 += consumption;
            const isKios = unit.UnitType === UnitType.KIOS;
            const isBusinessApt = unit.UnitType === UnitType.APARTMENT && unit.Status === 'Business';
            if (isKios || isBusinessApt) {
                prevBusinessM3 += consumption;
            } else {
                prevResM3 += consumption;
            }
        }

        // Trend calculation function
        const calculateTrend = (current: number, previous: number): number => {
            if (previous === 0) {
                return current > 0 ? Infinity : 0;
            }
            return ((current - previous) / previous) * 100;
        };
        
        return {
            totalM3,
            totalM3Residential: resM3,
            totalM3Business,
            avgM3Apts: resCountWithData > 0 ? (resM3 / resCountWithData).toFixed(1) : '0.0',
            totalTrend: calculateTrend(totalM3, prevTotalM3),
            resTrend: calculateTrend(resM3, prevResM3),
            businessTrend: calculateTrend(totalM3Business, prevBusinessM3),
        };
    }, [unitsWithData, period, readingsMapByPeriod, allUnits]);

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
                
                const updatedReadings = [...waterReadings];
                const readingsForPeriodMap = new Map<string, WaterReading>(
                    updatedReadings.filter(r => r.Period === period).map(r => [r.UnitID, r])
                );

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    const unitId = values[unitIdIndex]?.trim().replace(/"/g, '');
                    const currIndexStr = values[currIndexIndex]?.trim().replace(/"/g, '');
                    
                    if (!unitId || currIndexStr == null || currIndexStr === '') {
                        skippedCount++;
                        continue;
                    }

                    const currIndex = parseInt(currIndexStr, 10);
                    const existingReading = readingsForPeriodMap.get(unitId);

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
                        // FIX: Explicitly cast variables to string inside template literal to avoid type inference issues.
                        errors.push(`Dòng ${i + 1}: Chỉ số mới (${currIndex}) của căn hộ ${String(unitId)} nhỏ hơn chỉ số cũ (${String(existingReading.PrevIndex)}).`);
                        continue;
                    }
                    
                    // Update in map
                    readingsForPeriodMap.set(unitId, { ...existingReading, CurrIndex: currIndex });
                    updatedCount++;
                }
                setWaterReadings(prev => [
                    ...prev.filter(r => r.Period !== period),
                    ...Array.from(readingsForPeriodMap.values())
                ]);

                if (errors.length > 0) {
                    showToast(`Hoàn tất. Cập nhật ${updatedCount}, bỏ qua ${skippedCount} dòng. Lỗi: ${errors.join('; ')}`, 'warn', 10000);
                } else {
                    showToast(`Nhập thành công ${updatedCount} chỉ số.`, 'success');
                }
            } catch (error: any) {
                showToast(`Lỗi khi đọc file: ${error.message}`, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(allUnits.filter(u => u.UnitType === UnitType.APARTMENT).map(u => String(parseUnitCode(u.UnitID)?.floor ?? '')))).filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        return [{ value: 'all', label: 'Tất cả các tầng' }, ...floorNumbers.map(f => ({ value: f, label: `Tầng ${f}` })), { value: '99', label: 'KIOS' }];
    }, [allUnits]);

    return (
        <div className="h-full flex flex-col space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`cursor-pointer transition-all rounded-xl ${!kpiFilter ? 'ring-2 ring-primary' : ''}`} onClick={() => setKpiFilter(null)}>
                    <StatCard 
                        label="Tổng tiêu thụ" 
                        value={`${kpiStats.totalM3.toLocaleString('vi-VN')} m³`} 
                        icon={<DropletsIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />} 
                        iconBgClass="bg-blue-100 dark:bg-blue-900/50"
                        trend={kpiStats.totalTrend}
                    />
                </div>
                <div className={`cursor-pointer transition-all rounded-xl ${kpiFilter === 'residential' ? 'ring-2 ring-primary' : ''}`} onClick={() => setKpiFilter('residential')}>
                    <StatCard 
                        label="Hộ dân" 
                        value={`${kpiStats.totalM3Residential.toLocaleString('vi-VN')} m³`} 
                        icon={<HomeIcon className="w-7 h-7 text-green-600 dark:text-green-400" />} 
                        iconBgClass="bg-green-100 dark:bg-green-900/50"
                        trend={kpiStats.resTrend}
                    />
                </div>
                <div className={`cursor-pointer transition-all rounded-xl ${kpiFilter === 'business' ? 'ring-2 ring-primary' : ''}`} onClick={() => setKpiFilter('business')}>
                    <StatCard 
                        label="Kinh doanh" 
                        value={`${kpiStats.totalM3Business.toLocaleString('vi-VN')} m³`} 
                        icon={<StoreIcon className="w-7 h-7 text-orange-600 dark:text-orange-400" />} 
                        iconBgClass="bg-orange-100 dark:bg-orange-900/50"
                        trend={kpiStats.businessTrend}
                    />
                </div>
                <StatCard 
                    label="TB Hộ dân" 
                    value={`${kpiStats.avgM3Apts} m³/hộ`} 
                    icon={<TrendingUpIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />} 
                    iconBgClass="bg-indigo-100 dark:bg-indigo-900/50"
                />
            </div>

             <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <button onClick={() => navigatePeriod('prev')} data-tooltip="Kỳ trước"><ChevronLeftIcon /></button>
                        <button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-40 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md" data-tooltip="Chọn kỳ">
                           {new Date(period + '-02').toLocaleString('vi-VN', { month: '2-digit', year: 'numeric' })}
                        </button>
                         {isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)}/>}
                        <button onClick={() => navigatePeriod('next')} data-tooltip="Kỳ sau"><ChevronRightIcon /></button>
                    </div>

                    <div className="relative flex-grow min-w-[200px]">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input type="text" placeholder="Tìm theo mã căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600"/>
                    </div>
                    
                    <div className="relative min-w-[180px]">
                        <BuildingIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600 appearance-none">
                            {floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleDownloadTemplate} data-tooltip="Tải file mẫu" className="h-10 px-3 font-semibold rounded-lg hover:bg-opacity-80 disabled:opacity-50 flex items-center gap-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-50"><DocumentArrowDownIcon/></button>
                        <button onClick={handleImportClick} data-tooltip="Nhập từ file" disabled={!canEdit} className="h-10 px-3 font-semibold rounded-lg hover:bg-opacity-80 disabled:opacity-50 flex items-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 bg-white dark:bg-transparent"><UploadIcon/></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                <div className="lg:col-span-2 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="overflow-y-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số cũ</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chỉ số mới</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tiêu thụ (m³)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUnits.map((item, index) => (
                                    <tr 
                                        key={item.unit.UnitID} 
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer ${selectedUnitId === item.unit.UnitID ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        onClick={() => setSelectedUnitId(item.unit.UnitID)}
                                    >
                                        <td className="font-medium px-4 py-1 text-gray-900 dark:text-gray-200">{item.unit.UnitID}</td>
                                        <td className="px-4 py-1 text-right">{item.prevIndex.toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-1 text-right">
                                            <input 
                                                ref={el => { if (el) inputRefs.current[item.unit.UnitID] = el }}
                                                type="number"
                                                value={item.reading.CurrIndex}
                                                onChange={e => handleReadingChange(item.unit.UnitID, e.target.value)}
                                                onBlur={() => handleInputBlur(item.unit.UnitID, item.reading.CurrIndex, item.prevIndex)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                disabled={!canEdit}
                                                className={`w-32 text-right p-2 text-sm border rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-primary ${validationErrors[item.unit.UnitID] ? 'border-red-500' : 'border-gray-300'}`}
                                            />
                                        </td>
                                        <td className={`font-bold px-4 py-1 text-right text-lg ${item.consumption > 0 ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            {item.consumption > 0 ? item.consumption.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm p-6 overflow-y-auto">
                    <h3 className="text-lg font-bold mb-4">Lịch sử tiêu thụ 6 kỳ gần nhất</h3>
                    {selectedUnitId && historyData ? (
                        <div>
                            <h4 className="text-xl font-bold text-primary mb-4">{selectedUnitId}</h4>
                             <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={historyData.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => `${value} m³`}/>
                                    <Legend />
                                    <Line type="monotone" dataKey="consumption" name="Tiêu thụ" stroke="#3b82f6" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                             <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                                <div><p className="text-xs text-gray-500">Thấp nhất</p><p className="font-bold text-lg">{historyData.stats.min} m³</p></div>
                                <div><p className="text-xs text-gray-500">Cao nhất</p><p className="font-bold text-lg">{historyData.stats.max} m³</p></div>
                                <div><p className="text-xs text-gray-500">Trung bình</p><p className="font-bold text-lg">{historyData.stats.avg} m³</p></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">Chọn một căn hộ để xem lịch sử</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaterPage;