
















import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { ChargeRaw, Adjustment, AllData, Role, PaymentStatus, InvoiceSettings } from '../../types';
import { UnitType } from '../../types';
import { LogPayload } from '../../App';
import { useNotification, useLogger } from '../../App';
import { 
    saveChargesBatch as saveChargesBatchAPI, 
    updateChargeStatuses, 
    updateChargePayments,
    confirmSinglePayment,
    updatePaymentStatusBatch
} from '../../services';
import { calculateChargesBatch } from '../../services/feeService';
import NoticePreviewModal from '../NoticePreviewModal';
import StatCard from '../ui/StatCard';
import Spinner from '../ui/Spinner';
import { 
    SearchIcon, TagIcon, BuildingIcon, ChevronLeftIcon, 
    ChevronRightIcon, CheckCircleIcon, WarningIcon,
    CircularArrowRefreshIcon, ActionViewIcon, ActionPaidIcon,
    CalculatorIcon2, LockClosedIcon, ChevronDownIcon,
    DocumentArrowDownIcon, TableCellsIcon, ArrowUpTrayIcon, RevenueIcon, PercentageIcon, PaperAirplaneIcon, ChevronUpIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';
import { formatCurrency, parseUnitCode, generateEmailHtmlForCharge, renderInvoiceHTMLForPdf, formatNumber } from '../../utils/helpers';

declare const jspdf: any;
declare const html2canvas: any;
declare const JSZip: any;
declare const XLSX: any;

interface Attachment {
    name: string;
    data: string;
}

const sendEmailAPI = async (
    recipient: string, 
    subject: string, 
    body: string,
    settings: InvoiceSettings,
    attachment?: Attachment
): Promise<{ success: boolean; error?: string }> => {
    if (!settings.appsScriptUrl) {
        return { success: false, error: 'Chưa cấu hình URL Google Apps Script trong Cài đặt.' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('email', recipient);
        formData.append('subject', subject);
        formData.append('htmlBody', body);
        if (settings.senderName) {
            formData.append('senderName', settings.senderName);
        }

        if (attachment) {
            formData.append('attachmentData', attachment.data);
            formData.append('attachmentName', attachment.name);
        }

        const response = await fetch(settings.appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });
        
        if (!response.ok) {
            let errorMsg = `Server returned an error: ${response.status} ${response.statusText}`;
            try {
                const errorResult = await response.json();
                if (errorResult.error) errorMsg = `Server error: ${errorResult.error}`;
            } catch (e) { /* ignore */ }
            return { success: false, error: errorMsg };
        }
        
        return { success: true };

    } catch (e: any) {
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            return { success: false, error: `Lỗi mạng hoặc CORS. Vui lòng kiểm tra lại URL Google Apps Script và đảm bảo đã public đúng cách.`};
        }
        return { success: false, error: `Lỗi mạng khi gửi yêu cầu: ${e.message}` };
    }
};

interface BillingPageProps {
    charges: ChargeRaw[];
    setCharges: (updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => void;
    allData: AllData;
    onUpdateAdjustments: (updater: React.SetStateAction<Adjustment[]>, logPayload?: LogPayload) => void;
    role: Role;
    invoiceSettings: InvoiceSettings;
}

const BATCH_SIZE = 50; 
type PrimaryActionState = 'calculate' | 'recalculate' | 'locked';

const MonthPicker: React.FC<{
    currentPeriod: string;
    onSelectPeriod: (period: string) => void;
    onClose: () => void;
}> = ({ currentPeriod, onSelectPeriod, onClose }) => {
    const pickerRef = useRef<HTMLDivElement>(null);
    const [displayYear, setDisplayYear] = useState(new Date(currentPeriod + '-02').getFullYear());

    React.useEffect(() => {
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
                            onClick={() => onSelectPeriod(`${displayYear}-${String(index + 1).padStart(2, '0')}`)}
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-200 dark:hover:bg-slate-700'} ${isFuture ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const ExportProgressModal: React.FC<{
    isOpen: boolean;
    done: number;
    total: number;
    onCancel: () => void;
}> = ({ isOpen, done, total, onCancel }) => {
    if (!isOpen) return null;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-xl w-full max-w-md">
                <h4 className="text-lg font-bold mb-4">Exporting Invoices...</h4>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
                </div>
                <div className="text-center my-2 font-semibold">{`${done} / ${total} (${percent}%)`}</div>
                <div className="flex justify-end mt-4">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                </div>
            </div>
        </div>
    );
};

const FilterPill: React.FC<{
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  currentValue: string;
  onValueChange: (value: string) => void;
  tooltip: string;
}> = ({ icon, options, currentValue, onValueChange, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentLabel = options.find(o => o.value === currentValue)?.label || 'Select';

    return (
        <div className="relative" ref={pillRef} data-tooltip={tooltip}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-10 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary rounded-lg flex items-center gap-2 hover:border-primary transition-colors w-full justify-between"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <div className='flex items-center gap-2'>
                    {icon}
                    <span className="text-sm font-medium">{currentLabel}</span>
                </div>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1.5 z-20 bg-light-bg-secondary dark:bg-dark-bg-secondary p-2 rounded-lg shadow-lg border dark:border-dark-border w-full">
                    {options.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onValueChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-md text-sm ${currentValue === option.value ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const BillingPage: React.FC<BillingPageProps> = ({ charges, setCharges, allData, onUpdateAdjustments, role, invoiceSettings }) => {
    const { showToast } = useNotification();
    const { logAction } = useLogger();
    const canCalculate = ['Admin', 'Accountant'].includes(role);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [previewCharge, setPreviewCharge] = useState<ChargeRaw | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [primaryActionState, setPrimaryActionState] = useState<PrimaryActionState>('calculate');
    
    const [lockedPeriods, setLockedPeriods] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('lockedBillingPeriods');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const primaryActionTimeout = useRef<number | null>(null);
    const lastClickTime = useRef(0);

    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [activeKpiFilter, setActiveKpiFilter] = useState<string>('all');
    const [specialFilter, setSpecialFilter] = useState<string | null>(null);
    
    const [exportProgress, setExportProgress] = useState({ isOpen: false, done: 0, total: 0 });
    const cancelExportToken = useRef({ cancelled: false });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [editedPayments, setEditedPayments] = useState<Record<string, number>>({});

    const [isDataStale, setIsDataStale] = useState(false);
    const [dataSnapshot, setDataSnapshot] = useState('');
    const [isStatsExpanded, setIsStatsExpanded] = useState(true);

    const currentISODate = new Date().toISOString().slice(0, 7);
    

    const createSnapshot = useCallback((data: AllData) => {
        return JSON.stringify({
            vehicles: data.vehicles,
            waterReadings: data.waterReadings,
        });
    }, []);

    React.useEffect(() => {
        if (!dataSnapshot) {
            setDataSnapshot(createSnapshot(allData));
            return;
        }
        const currentSnapshot = createSnapshot(allData);
        if (currentSnapshot !== dataSnapshot) {
            setIsDataStale(true);
        }
    }, [allData, dataSnapshot, createSnapshot]);
    
    React.useEffect(() => {
        localStorage.setItem('lockedBillingPeriods', JSON.stringify(Array.from(lockedPeriods)));
    }, [lockedPeriods]);

    React.useEffect(() => {
        if (lockedPeriods.has(period)) {
            setPrimaryActionState('locked');
        } else if (charges.some(c => c.Period === period)) {
            setPrimaryActionState('recalculate');
        } else {
            setPrimaryActionState('calculate');
        }
    }, [period, charges, lockedPeriods]);
    
    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(allData.units.filter(u=>u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0,-2)))).sort((a,b) => parseInt(String(a), 10) - parseInt(String(b), 10));
        return [{value: 'all', label: 'All Floors'}, ...floorNumbers.map(f => ({value: f, label: `Floor ${f}`})), {value: 'KIOS', label: 'KIOS'}];
    }, [allData.units]);

    const [floorFilter, setFloorFilter] = useState('all');

    React.useEffect(() => {
        setSelectedUnits(new Set()); 
        setActiveKpiFilter('all');
        setSpecialFilter(null);
    }, [period]);
    
    const filteredCharges = useMemo(() => {
        return charges.filter(c => {
            if (c.Period !== period) return false;
            
            if (statusFilter !== 'all' && c.paymentStatus !== statusFilter) return false;
            
            const unitInfo = parseUnitCode(c.UnitID);
            if (floorFilter !== 'all') {
                const floor = unitInfo?.floor === 99 ? 'KIOS' : String(unitInfo?.floor);
                if (floor !== floorFilter) return false;
            }

            if (specialFilter === 'has_difference' && (c.TotalDue - c.TotalPaid === 0)) return false;
            if (specialFilter === 'not_paid' && c.paymentStatus === 'paid') return false;

            const s = searchTerm.toLowerCase();
            if (s && !(c.UnitID.toLowerCase().includes(s) || (c.OwnerName || '').toLowerCase().includes(s))) return false;
            
            return true;
        });
    }, [charges, period, searchTerm, statusFilter, floorFilter, specialFilter]);
    
    const sortedAndFilteredCharges = useMemo(() => {
        return [...filteredCharges].sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 100, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 100, apt: 0 };
            if (pa.floor !== pb.floor) return pa.floor - pb.floor;
            return pa.apt - pb.apt;
        });
    }, [filteredCharges]);

    React.useEffect(() => { setSelectedUnits(new Set()); }, [searchTerm, statusFilter, floorFilter, period, specialFilter]);

    const formatPeriodForDisplay = (isoPeriod: string): string => {
        const date = new Date(isoPeriod + '-02');
        return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
    };

    const navigatePeriod = (direction: 'prev' | 'next' | 'current') => {
        if (direction === 'current') { setPeriod(currentISODate); return; }
        const d = new Date(period + '-02');
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        const newPeriodDate = new Date(d.getFullYear(), d.getMonth(), 1);
        const currentPeriodDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (direction === 'next' && newPeriodDate > currentPeriodDate) {
            showToast("Cannot view or calculate for future periods.", "info");
            return;
        }
        setPeriod(d.toISOString().slice(0, 7));
    };
    
    const handleRefreshData = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            setDataSnapshot(createSnapshot(allData));
            setIsDataStale(false);
            showToast('Dữ liệu đã được làm mới.', 'success');
        } catch (error) { 
            showToast('Lỗi khi làm mới dữ liệu.', 'error');
        } 
        finally { setIsRefreshing(false); }
    }, [isRefreshing, allData, showToast, createSnapshot]);

    const executeCalculation = useCallback(async (isRecalculation = false) => {
        setIsLoading(true);
        setProgress({ current: 0, total: allData.units.length });

        try {
            const existingChargesForPeriod = charges.filter(c => c.Period === period);
            const unitsToSkip = isRecalculation
                ? new Set(existingChargesForPeriod.filter(c => c.paymentStatus === 'paid' || c.paymentStatus === 'reconciling').map(c => c.UnitID))
                : new Set<string>();
            
            const unitsToCalculate = allData.units.filter(unit => !unitsToSkip.has(unit.UnitID));

            if (unitsToCalculate.length === 0) {
                showToast('Không có căn hộ nào cần tính lại.', 'info');
                setIsLoading(false);
                return;
            }

            const calculationInputs = unitsToCalculate.map(unit => {
                const owner = allData.owners.find(o => o.OwnerID === unit.OwnerID)!;
                return { unit, owner, vehicles: allData.vehicles.filter(v => v.UnitID === unit.UnitID), adjustments: allData.adjustments.filter(a => a.UnitID === unit.UnitID && a.Period === period) };
            });

            const newChargesFromCalc = await calculateChargesBatch(period, calculationInputs, allData);
            const newChargesWithMeta = newChargesFromCalc.map(c => ({...c, CreatedAt: new Date().toISOString(), Locked: false }));
            
            await saveChargesBatchAPI(newChargesWithMeta);

            const updater = (prev: ChargeRaw[]) => {
                const chargesFromOtherPeriods = prev.filter(c => c.Period !== period);
                const chargesToKeep = isRecalculation
                    ? existingChargesForPeriod.filter(c => unitsToSkip.has(c.UnitID))
                    : [];
                return [...chargesFromOtherPeriods, ...chargesToKeep, ...newChargesWithMeta];
            };

            // FIX: Add before_snapshot for undo functionality
            setCharges(updater, {
                module: 'Billing',
                action: 'CALCULATE_CHARGES',
                summary: `Tính phí cho kỳ ${period} - ${newChargesWithMeta.length} căn hộ`,
                count: newChargesWithMeta.length,
                ids: newChargesWithMeta.map(c => c.UnitID),
                before_snapshot: charges,
            });

            showToast(`Tính phí hoàn tất cho ${newChargesWithMeta.length} căn hộ.`, 'success');
            
            setLockedPeriods(prev => {
                const next = new Set(prev);
                next.add(period);
                return next;
            });
            showToast('Kỳ đã được tự động khoá. Nhấn đúp để mở khoá và tính lại.', 'info');

        } catch (error) {
            console.error("Calculation failed", error);
            showToast('Quá trình tính phí xảy ra lỗi.', 'error');
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    }, [period, allData, setCharges, showToast, charges, setLockedPeriods]);

    const runRecalculation = useCallback(async () => {
        if (lockedPeriods.has(period)) {
            showToast('Đang khoá tính phí. Nhấn đúp nút Locked để mở khoá.', 'warn');
            return;
        }
        await executeCalculation(true);
    }, [period, showToast, lockedPeriods, executeCalculation]);

    const runInitialCalculation = useCallback(async () => {
        if (lockedPeriods.has(period)) {
            showToast('Đang khoá tính phí. Nhấn đúp nút Locked để mở khoá.', 'warn');
            return;
        }
        await executeCalculation(false);
    }, [period, showToast, lockedPeriods, executeCalculation]);
    
    const handlePrimaryAction = useCallback(() => {
        const now = Date.now();
        const isDoubleClick = (now - lastClickTime.current) < 350;
        lastClickTime.current = now;

        if (isDoubleClick) {
            if (primaryActionTimeout.current) clearTimeout(primaryActionTimeout.current);
            if (!canCalculate) { showToast('Bạn không có quyền thực hiện hành động này.', 'error'); return; }
            
            setLockedPeriods(prev => {
                const next = new Set(prev);
                if (next.has(period)) {
                    next.delete(period);
                    showToast('Đã mở khóa chức năng tính phí.', 'success');
                } else {
                    next.add(period);
                    showToast('Đã khóa chức năng tính phí. Các thao tác khác vẫn dùng bình thường.', 'success');
                }
                return next;
            });
        } else {
            primaryActionTimeout.current = window.setTimeout(() => {
                if (isDataStale) {
                    showToast('Dữ liệu nguồn đã thay đổi. Vui lòng bấm "Refresh" trước khi tính toán.', 'warn');
                    return;
                }
                if (primaryActionState === 'locked') {
                    showToast('Kỳ đang bị khóa. Nhấn đúp để mở khóa.', 'info');
                } else if (primaryActionState === 'calculate') {
                    runInitialCalculation();
                } else if (primaryActionState === 'recalculate') {
                    runRecalculation();
                }
            }, 250);
        }
    }, [primaryActionState, period, role, showToast, runInitialCalculation, runRecalculation, isDataStale, setLockedPeriods, canCalculate]);

    const handleBulkSetStatus = useCallback(async (targetStatus: 'paid' | 'unpaid') => {
        if (selectedUnits.size === 0) return;
        if (role === 'Operator') { showToast('Bạn không có quyền.', 'error'); return; }
        
        const unitIds = Array.from(selectedUnits);
        await updatePaymentStatusBatch(period, unitIds, targetStatus, charges);
    
        const updater = (prev: ChargeRaw[]) => prev.map(c => {
            if (c.Period === period && selectedUnits.has(c.UnitID)) {
                const updatedCharge = { ...c, paymentStatus: targetStatus };
                if (targetStatus === 'paid') {
                    updatedCharge.PaymentConfirmed = true;
                    updatedCharge.TotalPaid = c.TotalDue;
                } else {
                    updatedCharge.PaymentConfirmed = false;
                    updatedCharge.TotalPaid = 0;
                }
                return updatedCharge;
            }
            return c;
        });
    
        // FIX: Add before_snapshot for undo functionality
        setCharges(updater, {
            module: 'Billing',
            action: 'BULK_UPDATE_CHARGE_STATUS',
            summary: `Đánh dấu '${targetStatus}' cho ${selectedUnits.size} căn hộ kỳ ${period}`,
            count: selectedUnits.size,
            ids: unitIds,
            before_snapshot: charges,
        });
    
        showToast(`Đã đánh dấu ${targetStatus} cho ${selectedUnits.size} căn`, 'success');
        setSelectedUnits(new Set());
    }, [period, role, selectedUnits, setCharges, showToast, charges]);


    const handleExportReport = useCallback(() => {
        if (primaryActionState === 'calculate') { showToast('Vui lòng tính phí trước khi xuất báo cáo.', 'error'); return; }
        
        const targets = selectedUnits.size > 0 ? charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID)) : sortedAndFilteredCharges;
        if (targets.length === 0) { showToast('Không có dữ liệu để xuất báo cáo.', 'info'); return; }

        const BOM = "\uFEFF";
        const headers = ['Kỳ', 'Căn hộ', 'Chủ hộ', 'Diện tích (m2)', 'Phí Dịch vụ', 'SL Ô tô', 'SL Xe máy', 'Phí Gửi xe', 'Tiêu thụ nước (m3)', 'Tiền nước', 'Điều chỉnh', 'Tổng phải thu', 'Đã nộp', 'Còn nợ', 'Trạng thái'];
        const rows = [headers.join(',')];

        targets.forEach(c => {
            const diff = c.TotalDue - c.TotalPaid;
            let statusText = 'Pending';
            if (c.paymentStatus === 'paid') statusText = 'Paid';
            if (c.paymentStatus === 'unpaid') statusText = 'Unpaid';
            if (c.paymentStatus === 'reconciling') statusText = 'Reconciling';
            
            const line = [`"${c.Period}"`, `"${c.UnitID}"`, `"${c.OwnerName}"`, c.Area_m2, c.ServiceFee_Total, c['#CAR'] + c['#CAR_A'], c['#MOTORBIKE'], c.ParkingFee_Total, c.Water_m3, c.WaterFee_Total, c.Adjustments, c.TotalDue, c.TotalPaid, diff, `"${statusText}"`];
            rows.push(line.join(','));
        });

        const csvContent = BOM + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `BaoCao_Phi_Ky_${period}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Đã xuất báo cáo chi tiết (${targets.length} căn).`, 'success');
    }, [primaryActionState, charges, period, selectedUnits, sortedAndFilteredCharges, showToast]);


    const handleDownloadPDFs = useCallback(async () => {
        if (primaryActionState === 'calculate') { showToast('Vui lòng tính phí trước khi xuất PDF.', 'error'); return; }
        const targets = selectedUnits.size > 0 ? charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID)) : sortedAndFilteredCharges;
        if (targets.length === 0) { showToast('Không có dữ liệu để xuất file.', 'info'); return; }
    
        try {
            await Promise.all([ loadScript('jspdf'), loadScript('html2canvas'), loadScript('jszip') ]);
        } catch (error) {
            showToast('Không thể tải thư viện xuất file. Vui lòng thử lại.', 'error');
            return;
        }

        cancelExportToken.current.cancelled = false;
        setExportProgress({ isOpen: true, done: 0, total: targets.length });
    
        const files: { name: string, blob: Blob }[] = [];
        for (let i = 0; i < targets.length; i++) {
            if (cancelExportToken.current.cancelled) break;
            const charge = targets[i];
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
                document.body.appendChild(host);
                host.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                await new Promise(r => setTimeout(r, 50));
                const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const { jsPDF } = jspdf;
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                host.remove();
                files.push({ name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`, blob: pdf.output('blob') });
            } catch (e) { console.error(`Failed to generate PDF for ${charge.UnitID}`, e); }
            setExportProgress(p => ({ ...p, done: i + 1 }));
        }
    
        setExportProgress({ isOpen: false, done: 0, total: 0 });
        if (cancelExportToken.current.cancelled) { showToast('Export cancelled.', 'info'); return; }
    
        const downloadBlob = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
        if (files.length === 1) { downloadBlob(files[0].blob, files[0].name); }
        else if (files.length > 1) {
            const zip = new JSZip(); files.forEach(f => zip.file(f.name, f.blob));
            downloadBlob(await zip.generateAsync({ type: 'blob' }), `Invoices_${period}.zip`);
        }
        
        if (files.length > 0) {
            showToast(`Successfully downloaded ${files.length} invoices.`, 'success');
            const unitIds = targets.map(t => t.UnitID);
            await updateChargeStatuses(period, unitIds, { isPrinted: true });
            setCharges(prev => prev.map(c => unitIds.includes(c.UnitID) && c.Period === period ? {...c, isPrinted: true} : c));
        }
    }, [primaryActionState, period, selectedUnits, charges, sortedAndFilteredCharges, allData, invoiceSettings, showToast, setCharges]);
    
    const handleBulkSendEmail = useCallback(async () => {
        const recipients = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID) && c.Email);
        if (recipients.length === 0) {
            showToast('Không có căn hộ nào được chọn có địa chỉ email hợp lệ.', 'warn');
            return;
        }
        
        showToast(`Bắt đầu gửi email tới ${recipients.length} người nhận...`, 'info');
        let successCount = 0;
        let failCount = 0;
        const sentUnitIds: string[] = [];

        try {
            await Promise.all([ loadScript('jspdf'), loadScript('html2canvas'), ]);
        } catch(error) {
            showToast('Không thể tải thư viện PDF để đính kèm. Vui lòng thử lại.', 'error');
            return;
        }

        for (const [index, charge] of recipients.entries()) {
            showToast(`[${index + 1}/${recipients.length}] Đang tạo PDF cho ${charge.UnitID}...`, 'info', 3000);
            let attachment: Attachment | undefined;
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
                document.body.appendChild(host);
                host.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                await new Promise(r => setTimeout(r, 50));
                const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const { jsPDF } = jspdf;
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                host.remove();
                
                const base64Data = pdf.output('datauristring').split(',')[1];
                attachment = { name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`, data: base64Data };
            } catch (e) {
                console.error(`Failed to generate PDF for ${charge.UnitID}`, e);
                showToast(`Lỗi tạo PDF cho ${charge.UnitID}, bỏ qua...`, 'error');
                failCount++;
                continue;
            }

            showToast(`[${index + 1}/${recipients.length}] Đang gửi mail cho ${charge.UnitID}...`, 'info', 3000);
            const subjectTemplate = invoiceSettings.emailSubject || '[BQL HUD3] Thông báo phí dịch vụ kỳ {{period}} cho căn hộ {{unit_id}}';
            const personalizedSubject = subjectTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
            const bodyTemplate = invoiceSettings.emailBody || '';
            const personalizedBody = bodyTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
            const emailBodyHtml = generateEmailHtmlForCharge(charge, allData, invoiceSettings, personalizedBody);
            const result = await sendEmailAPI(charge.Email, personalizedSubject, emailBodyHtml, invoiceSettings, attachment);

            if (result.success) {
                successCount++;
                sentUnitIds.push(charge.UnitID);
            } else {
                failCount++;
                showToast(`Gửi mail thất bại cho ${charge.UnitID}: ${result.error}`, 'error', 8000);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (sentUnitIds.length > 0) {
            await updateChargeStatuses(period, sentUnitIds, { isSent: true });
            setCharges(prev => prev.map(c => sentUnitIds.includes(c.UnitID) && c.Period === period ? {...c, isSent: true} : c));
        }

        showToast(`Hoàn tất gửi mail: ${successCount} thành công, ${failCount} thất bại.`, failCount > 0 ? 'warn' : 'success', 10000);
        setSelectedUnits(new Set());
    }, [charges, period, selectedUnits, allData, invoiceSettings, showToast, setCharges]);

    const handleSendSingleEmail = useCallback(async (charge: ChargeRaw) => {
        if (!charge.Email) {
            showToast('Căn hộ này không có địa chỉ email.', 'error');
            return;
        }
        showToast(`Đang chuẩn bị email cho căn hộ ${charge.UnitID}...`, 'info');
        
        try {
            await Promise.all([ loadScript('jspdf'), loadScript('html2canvas'), ]);
        } catch(error) {
            showToast('Không thể tải thư viện PDF để đính kèm. Vui lòng thử lại.', 'error');
            return;
        }

        let attachment: Attachment | undefined;
        try {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; height:148mm; background:#fff; z-index:-1;';
            document.body.appendChild(host);
            host.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
            await new Promise(r => setTimeout(r, 50));
            const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
            host.remove();
            
            const base64Data = pdf.output('datauristring').split(',')[1];
            attachment = { name: `PhieuBaoPhi_${charge.UnitID}_${charge.Period}.pdf`, data: base64Data };
        } catch (e) {
            console.error(`Failed to generate PDF for ${charge.UnitID}`, e);
            showToast(`Lỗi tạo PDF cho ${charge.UnitID}, email sẽ được gửi không có đính kèm.`, 'error');
        }

        const subjectTemplate = invoiceSettings.emailSubject || '[BQL HUD3] Thông báo phí dịch vụ kỳ {{period}} cho căn hộ {{unit_id}}';
        const personalizedSubject = subjectTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
        const bodyTemplate = invoiceSettings.emailBody || '';
        const personalizedBody = bodyTemplate.replace(/{{unit_id}}/g, charge.UnitID).replace(/{{owner_name}}/g, charge.OwnerName).replace(/{{period}}/g, charge.Period).replace(/{{total_due}}/g, formatCurrency(charge.TotalDue));
        const emailBodyHtml = generateEmailHtmlForCharge(charge, allData, invoiceSettings, personalizedBody);
        const result = await sendEmailAPI(charge.Email, personalizedSubject, emailBodyHtml, invoiceSettings, attachment);

        if (result.success) {
            showToast(`Yêu cầu gửi email đã được thực hiện cho ${charge.UnitID}.`, 'success');
            await updateChargeStatuses(period, [charge.UnitID], { isSent: true });
            setCharges(prev => prev.map(c => (c.UnitID === charge.UnitID && c.Period === period) ? {...c, isSent: true} : c));
        } else {
            showToast(`Gửi mail thất bại cho ${charge.UnitID}: ${result.error}`, 'error', 10000);
        }
    }, [allData, invoiceSettings, showToast, period, setCharges]);
    
    const handlePaymentChange = (unitId: string, value: string) => {
        const digits = value.replace(/\D/g, '');
        const amount = parseInt(digits, 10);
        if (digits.length > 9) return;
        setEditedPayments(prev => ({ ...prev, [unitId]: isNaN(amount) ? 0 : amount }));
    };
    
    const handleConfirmPayment = async (charge: ChargeRaw) => {
        const finalPaidAmount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
        
        await confirmSinglePayment(charge, finalPaidAmount);

        // Update local state for charge
        const chargeUpdater = (prev: ChargeRaw[]) => prev.map(c =>
            (c.UnitID === charge.UnitID && c.Period === period)
                ? { ...c, TotalPaid: finalPaidAmount, PaymentConfirmed: true, paymentStatus: 'paid' as PaymentStatus }
                : c
        );
        
        // FIX: Add before_snapshot for undo functionality
        const logPayload: LogPayload = {
            module: 'Billing', action: 'CONFIRM_PAYMENT',
            summary: `Xác nhận thanh toán ${formatNumber(finalPaidAmount)} cho ${charge.UnitID}`,
            count: 1, ids: [charge.UnitID],
            before_snapshot: charges
        };
        setCharges(chargeUpdater, logPayload);

        // Update local state for adjustment if created
        const difference = finalPaidAmount - charge.TotalDue;
        if (difference !== 0) {
            const nextPeriodDate = new Date(period + '-02');
            nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
            const nextPeriod = nextPeriodDate.toISOString().slice(0, 7);
            const newAdjustment: Adjustment = { UnitID: charge.UnitID, Period: nextPeriod, Amount: -difference, Description: `Công nợ kỳ trước`, SourcePeriod: period };
            
            // FIX: Add before_snapshot for undo functionality
            onUpdateAdjustments(
                prev => [...prev.filter(a => !(a.UnitID === newAdjustment.UnitID && a.SourcePeriod === newAdjustment.SourcePeriod)), newAdjustment], 
                {
                    module: 'Billing',
                    action: 'CREATE_ADJUSTMENT',
                    summary: `Tạo điều chỉnh công nợ ${formatNumber(-difference)} cho ${charge.UnitID} từ kỳ ${period}`,
                    ids: [charge.UnitID],
                    before_snapshot: allData.adjustments
                }
            );
            showToast(`Đã tạo khoản điều chỉnh ${formatNumber(-difference)} cho kỳ sau.`, 'info');
        } else {
             showToast(`Đã xác nhận thanh toán đủ cho căn hộ ${charge.UnitID}.`, 'success');
        }
        
        setEditedPayments(prev => { const next = { ...prev }; delete next[charge.UnitID]; return next; });
    };
    
    const handleStatementFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (role === 'Operator' || role === 'Viewer') {
            showToast('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                let headerIndex = -1, colCredit = -1, colDesc = -1;
                for (let i = 0; i < Math.min(20, json.length); i++) {
                    if (Array.isArray(json[i])) {
                        // FIX: Cast row to `any[]` to resolve strict typing issue with `map` on `unknown[]`.
                        const row: string[] = (json[i] as any[]).map(cell => String(cell ?? "").toLowerCase());
                        const cIdx = row.findIndex(cell => cell.includes('so tien ghi co') || cell.includes('credit amount'));
                        const dIdx = row.findIndex(cell => cell.includes('noi dung') || cell.includes('transaction detail') || cell.includes('description'));
                        if (cIdx !== -1 && dIdx !== -1) { headerIndex = i; colCredit = cIdx; colDesc = dIdx; break; }
                    }
                }
                if (headerIndex === -1) throw new Error('Không tìm thấy cột "Số tiền ghi có" hoặc "Nội dung".');

                const amountMap = new Map<string, number>();
                const validUnitSet = new Set(allData.units.map(u => u.UnitID));
                const unitRegex = /(?:^|[^a-zA-Z0-9])(?:P|Ph|Phong|Can|C|Apt|Căn)?\s*([0-9]{3,4})(?=[^0-9]|$)/gi;

                for (let i = headerIndex + 1; i < json.length; i++) {
                    if (!Array.isArray(json[i])) continue;
                    const row = json[i] as unknown[];
                    if (!row[colCredit]) continue;
                    const amount = Math.round(parseFloat(String(row[colCredit]).replace(/,/g, '')));
                    if (isNaN(amount) || amount <= 0) continue;

                    const description = String(row[colDesc] || '');
                    let matchedUnitID = '';
                    let match;
                    unitRegex.lastIndex = 0;
                    while ((match = unitRegex.exec(description)) !== null) {
                        if (validUnitSet.has(match[1])) { matchedUnitID = match[1]; break; }
                    }
                    if (!matchedUnitID) {
                         const kioskRegex = /(?:^|[^0-9])(K\d{2})(?=[^0-9]|$)/gi;
                         if ((match = kioskRegex.exec(description)) && validUnitSet.has(match[1])) { matchedUnitID = match[1]; }
                    }

                    if (matchedUnitID) amountMap.set(matchedUnitID, (amountMap.get(matchedUnitID) || 0) + amount);
                }
                
                const currentPeriodCharges = new Set(charges.filter(c => c.Period === period).map(c => c.UnitID));
                const updatesToApply = new Map<string, number>();
                let totalReconciledAmount = 0;
                
                amountMap.forEach((amount, unitId) => {
                    if (currentPeriodCharges.has(unitId)) {
                        updatesToApply.set(unitId, amount);
                        totalReconciledAmount += amount;
                    }
                });

                if (updatesToApply.size > 0) {
                    await updateChargePayments(period, updatesToApply);
                    
                    const updater = (prev: ChargeRaw[]) => prev.map(charge => {
                        if (charge.Period === period && updatesToApply.has(charge.UnitID)) {
                            return {
                                ...charge,
                                TotalPaid: updatesToApply.get(charge.UnitID)!,
                                paymentStatus: 'reconciling' as PaymentStatus,
                                PaymentConfirmed: false,
                            };
                        }
                        return charge;
                    });
                    
                    // FIX: Add before_snapshot for undo functionality
                    setCharges(updater, {
                        module: 'Billing', action: 'IMPORT_BANK_STATEMENT',
                        summary: `Đối soát ${updatesToApply.size} giao dịch, tổng: ${formatCurrency(totalReconciledAmount)}`,
                        count: updatesToApply.size, ids: Array.from(updatesToApply.keys()),
                        before_snapshot: charges
                    });
                    showToast(`Đã đối soát thành công ${updatesToApply.size} giao dịch. Trạng thái đã chuyển thành "Chờ đối soát".`, 'success');
                } else {
                    showToast('Không tìm thấy giao dịch nào khớp với mã căn hộ trong kỳ này.', 'warn');
                }
            } catch (error: any) {
                showToast(`Lỗi khi đọc file sao kê: ${error.message}`, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportStatementClick = () => { fileInputRef.current?.click(); };
    
    const kpiStats = useMemo(() => {
        const rows = charges.filter(c => c.Period === period);
        if (rows.length === 0) {
            return { totalDue: 0, totalPaid: 0, difference: 0, paidCount: 0, totalCount: 0, progress: 0 };
        }
        const totalDue = Math.round(rows.reduce((s, r) => s + r.TotalDue, 0));
        const paidRows = rows.filter(r => r.paymentStatus === 'paid');
        const totalPaid = Math.round(paidRows.reduce((s, r) => s + r.TotalPaid, 0));
        const difference = totalDue - totalPaid;
        const paidCount = paidRows.length;
        const totalCount = rows.length;
        const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
        
        return { totalDue, totalPaid, difference, paidCount, totalCount, progress };
    }, [charges, period]);

    const clearAllFilters = () => { setStatusFilter('all'); setFloorFilter('all'); setSearchTerm(''); setActiveKpiFilter('all'); setSpecialFilter(null); };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <input type="file" ref={fileInputRef} onChange={handleStatementFileChange} accept=".xlsx, .xls, .csv" className="hidden" />

             <div className="relative bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="absolute top-2 right-2 z-10">
                    <button 
                        onClick={() => setIsStatsExpanded(p => !p)} 
                        className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"
                        data-tooltip={isStatsExpanded ? "Thu gọn" : "Mở rộng"}
                    >
                        {isStatsExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </div>
                {isStatsExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div data-tooltip="Tổng phí của tất cả căn hộ trong kỳ" className={`cursor-pointer transition-all rounded-xl ${activeKpiFilter === 'all' ? 'ring-2 ring-primary' : ''}`} onClick={clearAllFilters}>
                            <StatCard 
                                label="Tổng phải thu" 
                                value={formatCurrency(kpiStats.totalDue)}
                                icon={<RevenueIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />} 
                                iconBgClass="bg-blue-100 dark:bg-blue-900/50" 
                            />
                        </div>
                        <div data-tooltip="Tổng số tiền đã nộp thực tế (đã xác nhận)" className={`cursor-pointer transition-all rounded-xl ${activeKpiFilter === 'paid' ? 'ring-2 ring-primary' : ''}`} onClick={() => { clearAllFilters(); setStatusFilter('paid'); setActiveKpiFilter('paid'); }}>
                            <StatCard 
                                label="Đã thanh toán" 
                                value={formatCurrency(kpiStats.totalPaid)} 
                                icon={<CheckCircleIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />} 
                                iconBgClass="bg-emerald-100 dark:bg-emerald-900/50" 
                            />
                        </div>
                        <div data-tooltip="Lọc các hộ có chênh lệch giữa Phải thu và Đã nộp" className={`cursor-pointer transition-all rounded-xl ${activeKpiFilter === 'difference' ? 'ring-2 ring-primary' : ''}`} onClick={() => { clearAllFilters(); setSpecialFilter('has_difference'); setActiveKpiFilter('difference'); }}>
                             <StatCard 
                                label="Còn nợ / Chênh lệch" 
                                value={formatCurrency(kpiStats.difference)}
                                icon={<WarningIcon className="w-7 h-7 text-red-600 dark:text-red-400" />} 
                                iconBgClass="bg-red-100 dark:bg-red-900/50" 
                            />
                        </div>
                        <div className={`bg-white dark:bg-dark-bg-secondary p-5 rounded-xl shadow-sm flex items-center gap-5 cursor-pointer transition-all h-full ${activeKpiFilter === 'progress' ? 'ring-2 ring-primary' : ''}`} onClick={() => { clearAllFilters(); setSpecialFilter('not_paid'); setActiveKpiFilter('progress'); }}>
                            <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                                <PercentageIcon className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tiến độ thu</p>
                                <div className="mt-1">
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">{kpiStats.progress.toFixed(0)}%</p>
                                        <p className="text-sm font-medium text-gray-500">({kpiStats.paidCount}/{kpiStats.totalCount})</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mt-2">
                                        <div className="bg-purple-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${kpiStats.progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <button onClick={() => navigatePeriod('prev')} data-tooltip="Kỳ trước"><ChevronLeftIcon /></button>
                            <button onClick={() => setIsMonthPickerOpen(p => !p)} className="p-1.5 w-32 font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md" data-tooltip="Chọn kỳ tính phí">
                                {formatPeriodForDisplay(period)}
                            </button>
                            {isMonthPickerOpen && <MonthPicker currentPeriod={period} onSelectPeriod={(p) => { setPeriod(p); setIsMonthPickerOpen(false); }} onClose={() => setIsMonthPickerOpen(false)}/>}
                            <button onClick={() => navigatePeriod('next')} data-tooltip="Kỳ sau"><ChevronRightIcon /></button>
                        </div>
                        <button onClick={() => navigatePeriod('current')} data-tooltip="Về kỳ hiện tại" className="h-10 px-3 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary hover:bg-gray-50 dark:hover:bg-gray-700">Current</button>
                    </div>

                    <div className="flex items-center gap-2 flex-grow">
                        <div className="relative flex-grow min-w-[150px] md:min-w-[200px]">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Tìm theo mã hoặc tên..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"/>
                        </div>
                        <div className="hidden md:block">
                             <FilterPill
                                icon={<TagIcon className="h-5 w-5 text-gray-400" />}
                                currentValue={statusFilter}
                                onValueChange={setStatusFilter}
                                tooltip="Lọc theo trạng thái"
                                options={[
                                    { value: 'all', label: 'All Statuses' },
                                    { value: 'paid', label: 'Paid' },
                                    { value: 'reconciling', label: 'Reconciling' },
                                    { value: 'unpaid', label: 'Unpaid' },
                                    { value: 'pending', label: 'Pending' },
                                ]}
                            />
                        </div>
                        <div className="hidden md:block"><FilterPill icon={<BuildingIcon className="h-5 w-5 text-gray-400" />} currentValue={floorFilter} onValueChange={setFloorFilter} tooltip="Lọc theo tầng" options={floors} /></div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleRefreshData} data-tooltip={isDataStale ? "Dữ liệu nguồn (xe, nước) đã thay đổi. Bấm để cập nhật." : "Làm mới dữ liệu nguồn"} disabled={isRefreshing || isLoading} className={`h-10 w-10 flex items-center justify-center font-semibold rounded-lg hover:bg-opacity-80 disabled:opacity-50 border ${ isDataStale ? 'bg-green-100 dark:bg-green-900/30 border-green-600 text-green-700 dark:text-green-300 animate-pulse' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' }`}> 
                            <CircularArrowRefreshIcon /> 
                        </button>
                        
                        {/* FIX: Replace canLock with canCalculate */}
                        <div className="relative" title={!isLoading && canCalculate ? 'Nhấn đúp để khóa/mở khóa' : ''}>
                             <button onClick={handlePrimaryAction} disabled={isLoading || !canCalculate || isRefreshing} data-tooltip={primaryActionState === 'locked' ? 'Kỳ đang bị khóa. Nhấn đúp để mở.' : 'Tính phí cho kỳ'} className={`h-10 px-4 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed ${primaryActionState === 'locked' ? 'bg-gray-700 hover:bg-gray-800' : (primaryActionState === 'recalculate' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700')}`}>
                                {primaryActionState === 'locked' ? <LockClosedIcon /> : (isLoading ? <Spinner /> : (primaryActionState === 'recalculate' ? <CircularArrowRefreshIcon /> : <CalculatorIcon2 />))}
                                {primaryActionState === 'locked' ? 'Locked' : (isLoading ? 'Calculating...' : (primaryActionState === 'recalculate' ? 'Recalculate' : 'Calculate'))}
                            </button>
                        </div>
                        
                        <button onClick={handleImportStatementClick} data-tooltip="Nhập sao kê để tự động đối soát" disabled={!canCalculate} className="h-10 px-4 font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 bg-white dark:bg-transparent">
                            <ArrowUpTrayIcon className="w-5 h-5" /> <span className="hidden lg:inline">Import</span>
                        </button>
                        <button onClick={handleExportReport} data-tooltip="Xuất báo cáo tổng hợp" disabled={primaryActionState === 'calculate'} className="h-10 px-4 text-sm font-semibold rounded-lg flex items-center gap-2 border border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-500/10 disabled:opacity-50">
                            <TableCellsIcon className="w-5 h-5" /> <span className="hidden lg:inline">Export</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {selectedUnits.size > 0 && (
                     <div className="p-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex items-center gap-4 animate-fade-in-down">
                        <span className="font-semibold text-sm">{selectedUnits.size} đã chọn</span>
                        <button onClick={() => setSelectedUnits(new Set())} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Bỏ chọn</button>
                        <div className="h-5 border-l dark:border-dark-border ml-2"></div>
                        <div className="ml-auto flex items-center gap-4">
                             {(role === 'Admin' || role === 'Accountant') && <>
                                <button onClick={() => handleBulkSetStatus('paid')} className="flex items-center gap-2 text-sm font-semibold text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"><CheckCircleIcon /> Mark Paid</button>
                                <button onClick={() => handleBulkSetStatus('unpaid')} className="flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"><WarningIcon /> Mark Unpaid</button>
                            </>}
                            <button onClick={handleDownloadPDFs} disabled={exportProgress.isOpen} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><DocumentArrowDownIcon className="w-5 h-5" /> Tải PDF (Zip)</button>
                            <button onClick={handleBulkSendEmail} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"><PaperAirplaneIcon /> Send Mail</button>
                        </div>
                    </div>
                )}
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10"><tr>
                            <th className="px-4 py-2 w-12 text-center"><input type="checkbox" onChange={e => setSelectedUnits(e.target.checked ? new Set(sortedAndFilteredCharges.map(c => c.UnitID)) : new Set())} checked={sortedAndFilteredCharges.length > 0 && selectedUnits.size > 0 && sortedAndFilteredCharges.every(c => selectedUnits.has(c.UnitID))} disabled={sortedAndFilteredCharges.length === 0}/></th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chủ SH</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tổng phí</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tổng TT</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">C.Lệch</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Trạng thái</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">H.động</th>
                        </tr></thead>
                        <tbody className="text-sm divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading && primaryActionState !== 'recalculate' ? ( Array.from({ length: 10 }).map((_, i) => ( <tr key={i}><td colSpan={8} className="p-2"><div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md"></div></td></tr> )) ) 
                            : sortedAndFilteredCharges.length === 0 ? ( <tr><td colSpan={8} className="text-center p-8 text-gray-500">{charges.filter(c=>c.Period===period).length > 0 ? 'Không có dữ liệu nào khớp với bộ lọc.' : 'Chưa có dữ liệu cho kỳ này. Vui lòng bấm "Calculate".'}</td></tr> ) 
                            : ( sortedAndFilteredCharges.map(charge => {
                                    const finalPaidAmount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
                                    const difference = finalPaidAmount - charge.TotalDue;
                                    return (
                                    <tr key={charge.UnitID} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                        <td className="w-12 text-center"><input type="checkbox" checked={selectedUnits.has(charge.UnitID)} onChange={(e) => setSelectedUnits(p => { const n = new Set(p); e.target.checked ? n.add(charge.UnitID) : n.delete(charge.UnitID); return n; })} /></td>
                                        <td className="font-medium px-4 py-4 text-gray-900 dark:text-gray-200">{charge.UnitID}</td>
                                        <td className="px-4 py-4 text-gray-900 dark:text-gray-200">{charge.OwnerName}</td>
                                        <td className="font-bold px-4 py-4 text-right text-gray-900 dark:text-gray-200">{formatNumber(charge.TotalDue)}</td>
                                        <td className="px-4 py-4 text-right">
                                            <input 
                                                type="text"
                                                value={new Intl.NumberFormat('vi-VN').format(finalPaidAmount)}
                                                onChange={(e) => handlePaymentChange(charge.UnitID, e.target.value)}
                                                disabled={charge.PaymentConfirmed || role === 'Operator'}
                                                className="w-36 text-right p-2 text-sm border rounded-md bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-primary disabled:bg-transparent disabled:border-transparent disabled:font-semibold disabled:text-emerald-600 dark:disabled:text-emerald-400"
                                            />
                                        </td>
                                         <td className={`font-semibold px-4 py-4 text-right whitespace-nowrap ${difference > 0 ? 'text-green-600' : (difference < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-200')}`}>
                                            {difference !== 0 ? formatNumber(difference) : ''}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {charge.paymentStatus === 'paid' ? <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Paid</span> :
                                             charge.paymentStatus === 'reconciling' ? <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">Reconciling</span> :
                                             (charge.isPrinted && charge.isSent) ? <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:text-blue-300">Printed & Sent</span> :
                                             charge.isSent ? <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">Sent</span> :
                                             charge.isPrinted ? <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">Printed</span> :
                                             <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Pending</span>
                                            }
                                        </td>
                                        <td className="px-4 py-4"><div className="flex justify-center items-center gap-2">
                                            <button 
                                                onClick={() => handleConfirmPayment(charge)}
                                                disabled={charge.paymentStatus === 'paid' || role === 'Operator'}
                                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30"
                                                data-tooltip="Xác nhận thanh toán"
                                            >
                                                <ActionPaidIcon className="w-5 h-5 text-green-500" />
                                            </button>
                                            <button onClick={() => setPreviewCharge(charge)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600" data-tooltip="View & Send"><ActionViewIcon className="text-blue-500 w-5 h-5" /></button>
                                        </div></td>
                                    </tr>
                                )
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ExportProgressModal isOpen={exportProgress.isOpen} done={exportProgress.done} total={exportProgress.total} onCancel={() => { cancelExportToken.current.cancelled = true; showToast('Cancellation requested...', 'info'); }}/>
            {previewCharge && <NoticePreviewModal charge={previewCharge} onClose={() => setPreviewCharge(null)} invoiceSettings={invoiceSettings} allData={allData} onSendEmail={handleSendSingleEmail} />}
        </div>
    );
};

export default BillingPage;