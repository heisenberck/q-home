
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import type { WaterReading, Unit, Role, TariffWater, TariffCollection } from '../../types';
import { UnitType } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    HomeIcon, StoreIcon, TrendingUpIcon, DropletsIcon, ChevronLeftIcon, ChevronRightIcon, 
    SearchIcon, UploadIcon, SparklesIcon, EyeIcon, 
    DocumentArrowDownIcon, WarningIcon,
    SaveIcon, LockClosedIcon, XMarkIcon, ArrowPathIcon
} from '../ui/Icons';
import { parseUnitCode, getPreviousPeriod, sortUnitsComparator, formatCurrency } from '../../utils/helpers';
import { processImportFile } from '../../utils/importHelpers';
import { setLockStatus, saveWaterReadings, fetchRecentWaterReadings } from '../../services';
import Spinner from '../ui/Spinner';

declare const XLSX: any;

// --- Child Components ---
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

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-20 bg-white p-4 rounded-xl shadow-lg border w-72">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-200"><ChevronLeftIcon /></button>
                <span className="font-bold text-lg">{displayYear}</span>
                <button onClick={() => setDisplayYear(y => y + 1)} disabled={displayYear >= currentSystemYear + 2} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"><ChevronRightIcon /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                    const monthNum = String(index + 1).padStart(2, '0');
                    const value = `${displayYear}-${monthNum}`;
                    const isSelected = value === currentPeriod;
                    return (
                        <button
                            key={month}
                            onClick={() => { onSelectPeriod(value); onClose(); }}
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-200 text-gray-700'}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const ImportModal: React.FC<{
    onClose: () => void;
    onDownloadTemplate: () => void;
    onTriggerUpload: () => void;
}> = ({ onClose, onDownloadTemplate, onTriggerUpload }) => (
    <Modal title="Import Dữ liệu Nước" onClose={onClose} size="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            <button
                onClick={onDownloadTemplate}
                className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-100 hover:border-primary transition-colors"
            >
                <DocumentArrowDownIcon className="w-10 h-10 text-primary mb-2" />
                <span className="font-semibold text-gray-800">Tải File Mẫu</span>
            </button>
            <button
                onClick={onTriggerUpload}
                className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-100 hover:border-primary transition-colors"
            >
                <UploadIcon className="w-10 h-10 text-primary mb-2" />
                <span className="font-semibold text-gray-800">Chọn File từ máy</span>
            </button>
        </div>
    </Modal>
);

const FullListModal: React.FC<{
    title: string;
    data: any[];
    type: 'highest' | 'increase';
    onClose: () => void;
}> = ({ title, data, type, onClose }) => {
    const headers = type === 'highest'
        ? ['Căn hộ', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ']
        : ['Căn hộ', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ', 'Tăng trưởng'];

    return (
        <Modal title={title} onClose={onClose} size="2xl">
            <div className="overflow-auto max-h-[70vh] border rounded-lg bg-white text-gray-900">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            {headers.map(h => <th key={h} className={`px-4 py-2 text-left font-semibold text-gray-600 ${h !== 'Căn hộ' ? 'text-right' : ''}`}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map((item) => (
                            <tr key={item.unitId}>
                                <td className="px-4 py-2 font-medium text-gray-900">{item.unitId}</td>
                                <td className="px-4 py-2 text-right text-gray-800">{item.prevIndex?.toLocaleString('vi-VN')}</td>
                                <td className="px-4 py-2 text-right text-gray-800">{item.currIndex?.toLocaleString('vi-VN')}</td>
                                <td className="px-4 py-2 text-right font-bold text-gray-900">{item.consumption?.toLocaleString('vi-VN')} m³</td>
                                {type === 'increase' && (
                                    <td className="px-4 py-2 text-right font-bold text-red-500">
                                        {isFinite(item.percentIncrease) ? `+${item.percentIncrease.toFixed(1)}%` : 'Mới có số'}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
};
// --- END: Child Components ---

const calculateWaterBill = (consumption: number, unitType: UnitType, tariffs: TariffWater[]): number => {
    if (consumption <= 0 || !tariffs || tariffs.length === 0) return 0;
    const sortedTiers = [...tariffs].sort((a, b) => a.From_m3 - b.From_m3);
    if (unitType === UnitType.KIOS) {
        const businessTariff = sortedTiers.find(t => t.To_m3 === null);
        if (!businessTariff) return 0;
        const net = consumption * businessTariff.UnitPrice;
        const vat = net * (businessTariff.VAT_percent / 100);
        return Math.round(net + vat);
    }
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

interface WaterPageProps {
    waterReadings: WaterReading[];
    setWaterReadings: (updater: React.SetStateAction<WaterReading[]>, logPayload?: any) => void;
    allUnits: Unit[];
    role: Role;
    tariffs: TariffCollection;
    lockedPeriods?: string[];
    refreshData?: (force?: boolean) => void;
}

const WaterPage: React.FC<WaterPageProps> = ({ waterReadings: globalReadings, setWaterReadings, allUnits, role, tariffs, lockedPeriods = [], refreshData }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    
    const [localReadings, setLocalReadings] = useState<WaterReading[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadPeriodData = async () => {
            setIsFetching(true);
            try {
                const prevPeriod = getPreviousPeriod(period);
                const data = await fetchRecentWaterReadings([period, prevPeriod]);
                if (isMounted) setLocalReadings(data);
            } catch (error) {
                console.error("Failed to fetch water readings:", error);
                showToast("Lỗi tải dữ liệu nước.", "error");
            } finally {
                if (isMounted) setIsFetching(false);
            }
        };
        loadPeriodData();
        return () => { isMounted = false; };
    }, [period]);

    const displayReadings = localReadings;
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');
    const [kpiFilter, setKpiFilter] = useState<'residential' | 'business' | 'unrecorded' | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const inputRefs = useRef<Record<string, HTMLInputElement>>({});
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [isLocking, setIsLocking] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [fullListModalData, setFullListModalData] = useState<{title: string; data: any[]; type: 'highest' | 'increase'} | null>(null);
    const [localLockedState, setLocalLockedState] = useState<boolean | null>(null);

    useEffect(() => { setLocalLockedState(null); }, [period]);

    const isLocked = useMemo(() => {
        if (localLockedState !== null) return localLockedState;
        return lockedPeriods.includes(period);
    }, [period, lockedPeriods, localLockedState]);

    const waterReadingsMap = useMemo(() => {
        const map = new Map<string, WaterReading[]>();
        displayReadings.forEach(r => { if (!map.has(r.UnitID)) map.set(r.UnitID, []); map.get(r.UnitID)!.push(r); });
        return map;
    }, [displayReadings]);

    const waterData = useMemo(() => {
        const prevReadingPeriod = getPreviousPeriod(period);
        const prevPeriodReadings = new Map<string, WaterReading>(displayReadings.filter(r => r.Period === prevReadingPeriod).map(r => [r.UnitID, r]));
        const currentPeriodReadings = new Map<string, WaterReading>(displayReadings.filter(r => r.Period === period).map(r => [r.UnitID, r]));
        return allUnits.map(unit => {
            const prevReading = prevPeriodReadings.get(unit.UnitID);
            const currentReading = currentPeriodReadings.get(unit.UnitID);
            return { unitId: unit.UnitID, unitType: unit.UnitType, prevIndex: prevReading?.CurrIndex ?? currentReading?.PrevIndex ?? 0, currIndex: currentReading?.CurrIndex ?? null, consumption: currentReading?.consumption ?? null, };
        }).sort((a, b) => sortUnitsComparator({ UnitID: a.unitId }, { UnitID: b.unitId }));
    }, [period, displayReadings, allUnits]);

    const historicalChartData = useMemo(() => {
        const data = [];
        let currentPeriodDate = new Date(period + '-02');
        for (let i = 0; i < 6; i++) {
            const p = currentPeriodDate.toISOString().slice(0, 7);
            let consumption = 0;
            const inLocal = displayReadings.filter(r => r.Period === p);
            if (inLocal.length > 0) consumption = inLocal.reduce((total, reading) => total + (reading.consumption ?? 0), 0);
            else consumption = globalReadings.filter(r => r.Period === p).reduce((total, reading) => total + (reading.consumption ?? 0), 0);
            data.push({ name: `${String(currentPeriodDate.getMonth() + 1).padStart(2, '0')}/${currentPeriodDate.getFullYear().toString().slice(2)}`, 'Tiêu thụ': consumption });
            currentPeriodDate.setMonth(currentPeriodDate.getMonth() - 1);
        }
        return data.reverse();
    }, [period, displayReadings, globalReadings]);

    const analyticsData = useMemo(() => {
        const prevPeriod = getPreviousPeriod(period);
        const prevPeriodConsumptionMap = new Map<string, number>();
        displayReadings.filter(r => r.Period === prevPeriod).forEach(r => { prevPeriodConsumptionMap.set(r.UnitID, r.consumption ?? 0); });
        const fullHighestList = waterData.filter(d => d.consumption !== null && d.consumption > 0).sort((a, b) => (b.consumption ?? 0) - (a.consumption ?? 0));
        const fullIncreaseList = waterData.map(d => {
            const prevConsumption = prevPeriodConsumptionMap.get(d.unitId);
            if (prevConsumption !== undefined && d.consumption! > prevConsumption) {
                const increase = d.consumption! - prevConsumption;
                const percentIncrease = prevConsumption > 0 ? (increase / prevConsumption) * 100 : Infinity;
                return { ...d, increase, percentIncrease };
            }
            return null;
        }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => b.percentIncrease - a.percentIncrease);
        return { top5Highest: fullHighestList.slice(0, 5), top5Increases: fullIncreaseList.slice(0, 5).map(item => ({ ...item, increase: item.increase, current: item.consumption, previous: item.consumption! - item.increase })), fullHighestList, fullIncreaseList };
    }, [waterData, period, displayReadings]);

    const individualUnitAnalytics = useMemo(() => {
        if (!selectedUnitId) return null;
        const allAvailable = [...displayReadings, ...globalReadings];
        const uniqueMap = new Map();
        allAvailable.forEach(item => uniqueMap.set(`${item.Period}_${item.UnitID}`, item));
        const uniqueReadings = Array.from(uniqueMap.values());
        const readingsForUnit = uniqueReadings.filter(r => r.UnitID === selectedUnitId && r.consumption > 0).sort((a, b) => b.Period.localeCompare(a.Period)).slice(0, 12);
        if (readingsForUnit.length === 0) return { highest: null, lowest: null, average: 0 };
        const highest = readingsForUnit.reduce((max, current) => current.consumption > max.consumption ? current : max, readingsForUnit[0]);
        const lowest = readingsForUnit.reduce((min, current) => current.consumption < min.consumption ? current : min, readingsForUnit[0]);
        const total = readingsForUnit.reduce((sum, current) => sum + current.consumption, 0);
        const average = total / readingsForUnit.length;
        return { highest, lowest, average };
    }, [selectedUnitId, displayReadings, globalReadings]);
    
    const totalWaterBill = useMemo(() => Math.round(waterData.reduce((total, unitData) => (unitData.consumption === null || unitData.consumption < 0) ? total : total + calculateWaterBill(unitData.consumption, unitData.unitType, tariffs.water), 0)), [waterData, tariffs.water]);
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
        return { totalConsumption: waterData.reduce((acc, d) => acc + (d.consumption ?? 0), 0), residentialConsumption: residentialData.reduce((acc, d) => acc + (d.consumption ?? 0), 0), businessConsumption: businessData.reduce((acc, d) => acc + (d.consumption ?? 0), 0), unrecordedCount: waterData.filter(d => d.currIndex === null).length };
    }, [waterData]);

    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(allUnits.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a, b) => parseInt(String(a), 10) - parseInt(String(b), 10));
        return [{ value: 'all', label: 'Tất cả các tầng' }, ...floorNumbers.map(f => ({ value: f, label: `Tầng ${f}` })), { value: 'KIOS', label: 'Kios' }];
    }, [allUnits]);

    const handleSave = async (unitId: string, newIndexStr: string) => {
        const newIndex = parseInt(newIndexStr, 10);
        const errors = { ...validationErrors };
        if (newIndexStr === '' || isNaN(newIndex) || newIndex < 0) {
            delete errors[unitId];
            setValidationErrors(errors);
            setWaterReadings(prev => prev.filter(r => !(r.UnitID === unitId && r.Period === period)), { module: 'Water', action: 'DELETE_WATER_READING', summary: `Xóa số nước cho ${unitId} kỳ ${period}`, ids: [unitId], });
            showToast(`Đã xóa chỉ số cho căn hộ ${unitId}.`, 'info');
            return;
        }
        const prevReadingPeriod = getPreviousPeriod(period);
        const prevReading = localReadings.find(r => r.Period === prevReadingPeriod && r.UnitID === unitId);
        const prevIndex = prevReading?.CurrIndex ?? 0;
        if (newIndex < prevIndex) {
            errors[unitId] = "Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.";
            setValidationErrors(errors);
            return;
        }
        delete errors[unitId];
        setValidationErrors(errors);
        const consumption = newIndex - prevIndex;
        const newReading: WaterReading = { UnitID: unitId, Period: period, PrevIndex: prevIndex, CurrIndex: newIndex, Rollover: false, consumption: Math.max(0, consumption) };
        
        try {
            await saveWaterReadings([newReading]);
            setLocalReadings(prev => [...prev.filter(r => !(r.UnitID === unitId && r.Period === period)), newReading]);
            if (refreshData) refreshData(true);
            showToast(`Đã lưu chỉ số mới cho căn hộ ${unitId}.`, 'success');
        } catch (error) {
            showToast('Lỗi khi lưu dữ liệu.', 'error');
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const parsedData = await processImportFile(file, { unitId: ['căn hộ', 'unit'], reading: ['chỉ số', 'reading', 'số nước', 'mới'] });
            if (parsedData.length === 0) { showToast('Không tìm thấy dữ liệu hợp lệ trong file.', 'warn'); return; }
            const prevPeriod = getPreviousPeriod(period);
            const prevReadingsMap = new Map<string, WaterReading>(localReadings.filter(r => r.Period === prevPeriod).map(r => [r.UnitID, r]));
            const unitIdMap = new Map<string, string>();
            allUnits.forEach(u => {
                const s = u.UnitID.toLowerCase().trim();
                if (s.startsWith('k')) { const num = parseInt(s.replace(/\D/g, '') || '0', 10); unitIdMap.set(`k${num}`, u.UnitID); }
                else unitIdMap.set(s, u.UnitID);
            });
            const newReadings: WaterReading[] = [];
            let successCount = 0; const errors: string[] = [];
            for (const row of parsedData) {
                const rawId = String(row.unitId).trim().toLowerCase();
                let targetUnitId = unitIdMap.get(rawId);
                if (!targetUnitId && rawId.startsWith('k')) { const num = parseInt(rawId.replace(/\D/g, '') || '0', 10); targetUnitId = unitIdMap.get(`k${num}`); }
                if (!targetUnitId) { errors.push(`Không tìm thấy căn hộ: ${row.unitId}`); continue; }
                const readingStr = String(row.reading).trim();
                const newIndex = parseInt(readingStr.replace(/\D/g, ''), 10);
                if (isNaN(newIndex) || newIndex < 0) { errors.push(`${targetUnitId}: Chỉ số không hợp lệ`); continue; }
                const prevReading = prevReadingsMap.get(targetUnitId);
                const prevIndex = prevReading?.CurrIndex ?? 0;
                if (newIndex < prevIndex) { errors.push(`${targetUnitId}: Chỉ số mới nhỏ hơn cũ`); continue; }
                const consumption = newIndex - prevIndex;
                newReadings.push({ UnitID: targetUnitId, Period: period, PrevIndex: prevIndex, CurrIndex: newIndex, Rollover: false, consumption: Math.max(0, consumption) });
                successCount++;
            }
            if (successCount > 0) {
                await saveWaterReadings(newReadings);
                const freshData = await fetchRecentWaterReadings([period, prevPeriod]);
                setLocalReadings(freshData);
                if(refreshData) refreshData(true);
                showToast(`Nhập thành công ${successCount} chỉ số.${errors.length > 0 ? ` Có ${errors.length} lỗi.` : ''}`, 'success');
            } else { showToast(`Không có chỉ số hợp lệ nào.`, 'error'); }
        } catch (error: any) { showToast(`Lỗi khi xử lý file: ${error.message}`, 'error'); } 
        finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    
    const handleDownloadTemplate = () => {
        const data = waterData.map(d => ({ 'Căn hộ': d.unitId, 'Chỉ số': '' }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "WaterReadings");
        XLSX.writeFile(workbook, `Mau_Nhap_So_Nuoc_${period}.xlsx`);
    };

    const handleLock = async () => {
        if (isLocked || !canEdit || isLocking) return;
        setIsLocking(true);
        try {
            await setLockStatus(period, true);
            setLocalLockedState(true); 
            if (refreshData) refreshData(true);
            showToast(`Đã chốt sổ kỳ ${period}. Dữ liệu sẽ không thể chỉnh sửa.`, 'success');
        } catch (e) { 
            showToast('Lỗi khi chốt sổ.', 'error'); 
            setLocalLockedState(null); 
        } finally { 
            setIsLocking(false); 
        }
    };

    const handleUnlock = async () => {
        if (!isLocked || !canEdit || isLocking) return;
        setIsLocking(true);
        try {
            await setLockStatus(period, false);
            setLocalLockedState(false); 
            if (refreshData) refreshData(true);
            showToast(`Đã mở lại sổ kỳ ${period}.`, 'success');
        } catch (e) { 
            showToast('Lỗi khi mở sổ.', 'error'); 
            setLocalLockedState(null); 
        } finally { 
            setIsLocking(false); 
        }
    };

    const handleManualRefresh = async () => {
        setIsFetching(true);
        try {
            const prev = getPreviousPeriod(period);
            const data = await fetchRecentWaterReadings([period, prev]);
            setLocalReadings(data);
            showToast("Đã cập nhật dữ liệu mới nhất.", "success");
        } catch(e) { showToast("Lỗi khi tải dữ liệu.", "error"); } 
        finally { setIsFetching(false); }
    };

    const handleImportClick = () => fileInputRef.current?.click();
    const handleTriggerUpload = () => { setIsImportModalOpen(false); handleImportClick(); };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
            {fullListModalData && <FullListModal {...fullListModalData} onClose={() => setFullListModalData(null)} />}
            {isImportModalOpen && <ImportModal onClose={() => setIsImportModalOpen(false)} onDownloadTemplate={handleDownloadTemplate} onTriggerUpload={handleTriggerUpload} />}

            <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={() => setKpiFilter(null)} className="cursor-pointer"><StatCard label="Tổng tiêu thụ" value={`${kpiStats.totalConsumption.toLocaleString()} m³`} icon={<DropletsIcon className="w-6 h-6 text-blue-600"/>} className="border-l-4 border-blue-500" iconBgClass="bg-blue-100" /></div>
                    <div onClick={() => setKpiFilter('residential')} className="cursor-pointer"><StatCard label="Hộ dân" value={`${kpiStats.residentialConsumption.toLocaleString()} m³`} icon={<HomeIcon className="w-6 h-6 text-green-600"/>} className="border-l-4 border-green-500" iconBgClass="bg-green-100"/></div>
                    <div onClick={() => setKpiFilter('business')} className="cursor-pointer"><StatCard label="Kinh doanh" value={`${kpiStats.businessConsumption.toLocaleString()} m³`} icon={<StoreIcon className="w-6 h-6 text-purple-600"/>} className="border-l-4 border-purple-500" iconBgClass="bg-purple-100"/></div>
                    <div onClick={() => setKpiFilter('unrecorded')} className="cursor-pointer"><StatCard label="Chưa ghi số" value={<span className="font-bold text-red-600">{`${kpiStats.unrecordedCount} hộ`}</span>} icon={<WarningIcon className="w-6 h-6 text-red-600"/>} className="border-l-4 border-red-500" iconBgClass="bg-red-100"/></div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm flex-shrink-0">
                     <div className="flex items-center gap-2 md:gap-4">
                         <div className="relative flex items-center gap-1 p-1 bg-gray-100 rounded-lg"><button onClick={() => setPeriod(getPreviousPeriod(period))} disabled={isFetching}><ChevronLeftIcon /></button><button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-32 font-semibold hover:bg-gray-200 rounded-md">{isFetching ? <Spinner className="w-4 h-4 mx-auto"/> : new Date(period + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</button>{isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)}/>}<button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7);})} disabled={isFetching}><ChevronRightIcon /></button></div>
                         <div className="relative flex-grow min-w-[150px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-primary"/></div>
                         <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="h-10 px-3 border rounded-lg bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary">{floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                         <div className="flex items-center gap-2">
                            <button onClick={handleManualRefresh} className="h-10 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 border border-transparent" title="Làm mới dữ liệu"><ArrowPathIcon className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} /></button>
                            {isLocked ? (
                                <button onDoubleClick={handleUnlock} disabled={!canEdit || isLocking} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 bg-gray-400 text-white border border-gray-400 disabled:opacity-50 hover:bg-gray-500 cursor-pointer select-none shadow-sm transition-colors" title="Dữ liệu đã chốt. Nhấn đúp để mở khóa."><LockClosedIcon className="w-5 h-5" /> Đã chốt</button>
                            ) : (
                                <button onClick={handleLock} disabled={!canEdit || isLocking} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 bg-primary text-white hover:bg-primary-focus shadow-sm disabled:opacity-50 transition-colors" title="Chốt số liệu kỳ này"><SaveIcon className="w-5 h-5" /> Chốt sổ</button>
                            )}
                            <button onClick={() => setIsImportModalOpen(true)} disabled={!canEdit || isLocked} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 bg-white disabled:opacity-50"><UploadIcon /> Import</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden"><div className="overflow-y-auto pr-2"><table className="min-w-full"><thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Căn hộ</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Chỉ số cũ</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Chỉ số mới</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Tiêu thụ (m³)</th><th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Lịch sử</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredWaterData.map(d => (<tr key={d.unitId} className={`transition-colors text-sm ${selectedUnitId === d.unitId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="font-semibold px-4 py-3 text-gray-900">{d.unitId}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{d.prevIndex?.toLocaleString('vi-VN') ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-right"><input ref={el => { if (el) inputRefs.current[d.unitId] = el; }} type="number" defaultValue={d.currIndex ?? ''} key={`${d.unitId}-${d.currIndex}`} onBlur={e => handleSave(d.unitId, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} disabled={!canEdit || isLocked || isFetching} className={`w-32 text-right p-2 border rounded-md bg-gray-50 focus:bg-white text-gray-900 focus:ring-2 focus:ring-primary ${validationErrors[d.unitId] ? 'border-red-500' : 'border-gray-300'} disabled:bg-transparent disabled:border-transparent`}/>{validationErrors[d.unitId] && <p className="text-red-500 text-xs text-right mt-1">{validationErrors[d.unitId]}</p>}</td>
                    <td className={`font-bold px-4 py-3 text-right ${d.consumption && d.consumption > 30 ? 'text-red-600' : (d.consumption && d.consumption > 20 ? 'text-yellow-600' : 'text-green-600')}`}>{d.consumption !== null ? `${d.consumption.toLocaleString('vi-VN')} m³` : 'Chưa có'}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => setSelectedUnitId(d.unitId)} className="p-2 rounded-full hover:bg-gray-200"><EyeIcon className="w-5 h-5 text-blue-600"/></button></td>
                </tr>))}</tbody></table></div></div>
            </div>

            <div className="w-1/3 bg-white rounded-xl shadow-sm overflow-y-auto p-6 space-y-6 relative border-l">
                {selectedUnitId ? (
                    <div className="animate-fade-in-down">
                        <button onClick={() => setSelectedUnitId(null)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-200 z-10" data-tooltip="Quay lại Phân tích chung"><XMarkIcon /></button>
                        <h3 className="text-xl font-bold text-gray-900">Lịch sử: Căn hộ {selectedUnitId}</h3>
                        <div className="border-t pt-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Hóa đơn nước (ước tính)</h4>
                                <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedUnitBill)}</p>
                            </div>
                            <h4 className="font-semibold mb-2">Tiêu thụ 6 tháng</h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={waterReadingsMap.get(selectedUnitId)?.slice(-6).map(r => ({name: r.Period.slice(5,7), 'Tiêu thụ': r.consumption})) || []} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis unit=" m³" tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v: number) => [`${v} m³`, 'Tiêu thụ']} />
                                        <Bar dataKey="Tiêu thụ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {individualUnitAnalytics && (
                            <div className="border-t pt-4 mt-4 space-y-3">
                                <h4 className="font-semibold">Thống kê riêng (12 tháng)</h4>
                                <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-md"><span>Tiêu thụ trung bình:</span> <span className="font-bold">{individualUnitAnalytics.average.toFixed(1)} m³</span></div>
                                {individualUnitAnalytics.highest && <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-md"><span>Tháng cao nhất ({individualUnitAnalytics.highest.Period}):</span> <span className="font-bold">{individualUnitAnalytics.highest.consumption} m³</span></div>}
                                {individualUnitAnalytics.lowest && <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-md"><span>Tháng thấp nhất ({individualUnitAnalytics.lowest.Period}):</span> <span className="font-bold">{individualUnitAnalytics.lowest.consumption} m³</span></div>}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-fade-in-down">
                        <div className="pt-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Tổng hóa đơn:</h4>
                                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalWaterBill)}</p>
                            </div>
                            <h4 className="font-semibold mb-2">Tổng tiêu thụ 6 tháng</h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historicalChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis unit=" m³" tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v: number) => [`${v.toLocaleString('vi-VN')} m³`, 'Tổng tiêu thụ']} />
                                        <Legend />
                                        <Line type="monotone" dataKey="Tiêu thụ" stroke="#3b82f6" activeDot={{ r: 8 }} strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="border-t pt-4 mt-4 space-y-3">
                            <h4 onClick={() => setFullListModalData({ title: 'Tất cả căn hộ tiêu thụ cao', data: analyticsData.fullHighestList, type: 'highest' })} className="font-semibold flex items-center gap-2 cursor-pointer hover:text-primary"><SparklesIcon className="w-5 h-5 text-purple-500"/> Top 5 tiêu thụ cao nhất kỳ này</h4>
                            <ul className="space-y-1 text-sm">{analyticsData.top5Highest.map(d => <li key={d.unitId} className="flex justify-between p-1.5 rounded hover:bg-gray-100"><span>Căn hộ {d.unitId}</span><span className="font-bold">{d.consumption} m³</span></li>)}</ul>
                        </div>
                        <div className="border-t pt-4 mt-4 space-y-3">
                            <h4 onClick={() => setFullListModalData({ title: 'Tất cả căn hộ tăng đột biến', data: analyticsData.fullIncreaseList, type: 'increase' })} className="font-semibold flex items-center gap-2 cursor-pointer hover:text-primary"><TrendingUpIcon className="w-5 h-5 text-red-500"/> Top 5 tăng đột biến so với kỳ trước</h4>
                            <ul className="space-y-1 text-sm">{analyticsData.top5Increases.map(d => <li key={d.unitId} className="flex justify-between p-1.5 rounded hover:bg-gray-100"><span>Căn hộ {d.unitId}</span><span className="font-bold text-red-500">+{d.increase} m³</span></li>)}</ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaterPage;
