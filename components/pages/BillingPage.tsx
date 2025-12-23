
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ChargeRaw, Adjustment, AllData, Role, PaymentStatus, InvoiceSettings, Owner, MonthlyStat } from '../../types';
import { UnitType } from '../../types';
import { LogPayload } from '../../App';
import { useNotification } from '../../App';
import { 
    confirmSinglePayment,
    updateChargePayments,
    saveChargesBatch, 
    updateChargeStatuses,
    updatePaymentStatusBatch,
    getBillingLockStatus,
    setBillingLockStatus
} from '../../services';
import { calculateChargesBatch } from '../../services/feeService';
import NoticePreviewModal from '../NoticePreviewModal';
import VerificationModal from '../VerificationModal';
import Spinner from '../ui/Spinner';
import { 
    SearchIcon, ChevronLeftIcon, ChevronRightIcon, 
    CheckCircleIcon, CalculatorIcon2, LockClosedIcon,
    ArrowDownTrayIcon, BanknotesIcon, ArrowUpTrayIcon,
    PaperAirplaneIcon, TrashIcon, PrinterIcon, EnvelopeIcon, ArrowUturnLeftIcon,
    ActionViewIcon, ChevronDownIcon, ChevronUpIcon, SaveIcon,
    MagnifyingGlassIcon, ArrowPathIcon, CreditCardIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';
import { formatCurrency, parseUnitCode, renderInvoiceHTMLForPdf, formatNumber } from '../../utils/helpers';
import { writeBatch, collection, query, where, getDocs, doc, addDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { isProduction } from '../../utils/env';

// --- Types & Globals ---
declare const jspdf: any;
declare const html2canvas: any;
declare const JSZip: any;
declare const XLSX: any;

// Extend ChargeRaw locally to support sentCount
type ExtendedCharge = ChargeRaw & { sentCount?: number };

// --- Helper: Send Email API ---
const sendEmailAPI = async (
    recipient: string,
    subject: string,
    body: string,
    settings: InvoiceSettings,
    attachmentBase64?: string,
    attachmentName?: string
): Promise<{ success: boolean; error?: string }> => {
    if (!settings.appsScriptUrl) return { success: false, error: 'Chưa cấu hình URL Google Apps Script.' };

    try {
        const formData = new URLSearchParams();
        formData.append('email', recipient);
        formData.append('subject', subject);
        formData.append('htmlBody', body);
        if (settings.senderName) formData.append('senderName', settings.senderName);
        if (attachmentBase64 && attachmentName) {
            formData.append('attachmentBase64', attachmentBase64);
            formData.append('attachmentName', attachmentName);
            formData.append('attachmentMimeType', 'application/pdf');
        }

        const response = await fetch(settings.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (!response.ok) return { success: false, error: `Server error: ${response.status}` };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

// --- Components ---

const MinimalStatCard: React.FC<{ label: string; value: string; colorClass: string; onClick?: () => void }> = ({ label, value, colorClass, onClick }) => (
    <div onClick={onClick} className={`bg-white rounded-xl shadow-sm border-l-4 ${colorClass} p-4 cursor-pointer hover:shadow-md transition-shadow`}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
);

const QuickActionMenu: React.FC<{ onSelect: (method: 'paid_tm' | 'paid_ck') => void; disabled?: boolean; trigger: React.ReactNode }> = ({ onSelect, disabled, trigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
                {trigger}
            </div>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-50 animate-fade-in-down overflow-hidden">
                    <button onClick={() => { onSelect('paid_tm'); setIsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2">
                        <BanknotesIcon className="w-4 h-4" /> Tiền mặt
                    </button>
                    <button onClick={() => { onSelect('paid_ck'); setIsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 border-t border-gray-50">
                        <CreditCardIcon className="w-4 h-4" /> Chuyển khoản
                    </button>
                </div>
            )}
        </div>
    );
};

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

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-20 bg-white p-4 rounded-xl shadow-lg border border-gray-200 w-72">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeftIcon /></button>
                <span className="font-bold text-lg text-gray-800">{displayYear}</span>
                <button onClick={() => setDisplayYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronRightIcon /></button>
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
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Page ---

interface BillingPageProps {
    charges: ChargeRaw[];
    setCharges: (updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => void;
    allData: AllData;
    onUpdateAdjustments: (updater: React.SetStateAction<Adjustment[]>, logPayload?: LogPayload) => void;
    role: Role;
    invoiceSettings: InvoiceSettings;
    onRefresh?: () => void;
}

const BillingPage: React.FC<BillingPageProps> = ({ charges, setCharges, allData, onUpdateAdjustments, role, invoiceSettings, onRefresh }) => {
    const { showToast } = useNotification();
    const canCalculate = ['Admin', 'Accountant'].includes(role);
    const IS_PROD = isProduction();

    // State
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [isBillingLocked, setIsBillingLocked] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [floorFilter, setFloorFilter] = useState('all');
    const [previewCharge, setPreviewCharge] = useState<ChargeRaw | null>(null);
    const [editedPayments, setEditedPayments] = useState<Record<string, number>>({});
    
    // UI State
    const [showStats, setShowStats] = useState(true);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [verifyCharge, setVerifyCharge] = useState<ChargeRaw | null>(null);
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastClickTime = useRef(0);

    // Fetch Lock Status on Period Change
    useEffect(() => {
        const fetchLock = async () => {
            try {
                const status = await getBillingLockStatus(period);
                setIsBillingLocked(status);
            } catch (e) {
                console.error("Error fetching lock status", e);
            }
        };
        fetchLock();
    }, [period]);
    
    // Logic: Disable calculation for future periods
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const isFuturePeriod = period > currentMonthStr;

    // Data Filtering
    const floors = useMemo(() => {
        const nums = Array.from(new Set(allData.units.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a: string, b: string) => parseInt(a,10) - parseInt(b,10));
        return [{value: 'all', label: 'Tất cả tầng'}, ...nums.map(f => ({value: f, label: `Tầng ${f}`})), {value: 'KIOS', label: 'KIOS'}];
    }, [allData.units]);

    const filteredCharges = useMemo(() => {
        return (charges as ExtendedCharge[]).filter(c => {
            if (c.Period !== period) return false;
            
            if (statusFilter !== 'all') {
                if (statusFilter === 'paid') {
                    if (!['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)) return false;
                } else if (statusFilter === 'debt') {
                    if (['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)) return false;
                } else if (statusFilter === 'pending') {
                    if (c.paymentStatus !== 'pending') return false;
                } else if (statusFilter === 'unpaid') {
                    if (c.paymentStatus !== 'unpaid') return false;
                } else if (statusFilter === 'reconciling') {
                    if (c.paymentStatus !== 'reconciling') return false;
                } else {
                    if (c.paymentStatus !== statusFilter) return false;
                }
            }

            if (floorFilter !== 'all') {
                const floor = c.UnitID.startsWith('K') ? 'KIOS' : parseUnitCode(c.UnitID)?.floor?.toString();
                if (floor !== floorFilter) return false;
            }
            const s = searchTerm.toLowerCase();
            if (s && !(c.UnitID.toLowerCase().includes(s) || (c.OwnerName || '').toLowerCase().includes(s))) return false;
            return true;
        }).sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 100, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 100, apt: 0 };
            if (pa.floor !== pb.floor) return pa.floor - pb.floor;
            return pa.apt - pb.apt;
        });
    }, [charges, period, searchTerm, statusFilter, floorFilter]);

    // Stats
    const stats = useMemo(() => {
        const currentCharges = charges.filter(c => c.Period === period);
        const totalDue = currentCharges.reduce((sum, c) => sum + (c.TotalDue || 0), 0);
        const totalPaid = currentCharges.reduce((sum, c) => sum + (c.TotalPaid || 0), 0);
        const debt = totalDue - totalPaid;
        const count = currentCharges.length;
        const paidCount = currentCharges.filter(c => ['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)).length;
        
        return { 
            totalDue, 
            totalPaid, 
            debt, 
            progress: count > 0 ? (paidCount / count) * 100 : 0,
            count,
            paidCount
        };
    }, [charges, period]);

    // --- Logic: Calculation ---

    const handleCalculate = async () => {
        if (isBillingLocked) {
            showToast('Kỳ này đã chốt sổ. Không thể tính toán lại.', 'error');
            return;
        }
        if (isFuturePeriod) {
            showToast('Không thể tính phí cho kỳ tương lai.', 'error');
            return;
        }

        setIsLoading(true);
        showToast('Đang tính toán lại phí...', 'info');

        try {
            const freshData = allData;
            const existingPaid = charges.filter(c => c.Period === period && ['paid', 'paid_tm', 'paid_ck', 'reconciling'].includes(c.paymentStatus));
            const paidUnitIds = new Set(existingPaid.map(c => c.UnitID));
            const unitsToCalc = freshData.units.filter(u => !paidUnitIds.has(u.UnitID));
            
            const inputs = unitsToCalc.map(unit => ({ 
                unit, 
                owner: (freshData.owners.find(o => o.OwnerID === unit.OwnerID) || { OwnerID: unit.OwnerID, OwnerName: 'Unknown', Phone: '', Email: '' }) as Owner,
                vehicles: freshData.vehicles.filter(v => v.UnitID === unit.UnitID), 
                adjustments: freshData.adjustments.filter(a => a.UnitID === unit.UnitID && a.Period === period) 
            }));

            const newCharges = await calculateChargesBatch(period, inputs, freshData);
            
            const finalNewCharges = newCharges.map(c => ({
                ...c,
                CreatedAt: new Date().toISOString(),
                Locked: false,
                paymentStatus: 'pending' as PaymentStatus,
                PaymentConfirmed: false,
                TotalPaid: c.TotalDue,
                isPrinted: false,
                isSent: false,
                sentCount: 0 
            }));

            const allChargesForPeriod = [...existingPaid, ...finalNewCharges];
            const monthlyStat: MonthlyStat = {
                period: period,
                totalService: allChargesForPeriod.reduce((sum, c) => sum + c.ServiceFee_Total, 0),
                totalParking: allChargesForPeriod.reduce((sum, c) => sum + c.ParkingFee_Total, 0),
                totalWater: allChargesForPeriod.reduce((sum, c) => sum + c.WaterFee_Total, 0),
                totalDue: allChargesForPeriod.reduce((sum, c) => sum + c.TotalDue, 0),
                updatedAt: new Date().toISOString()
            };

            await saveChargesBatch(finalNewCharges, monthlyStat);

            setCharges(prev => {
                const otherPeriodCharges = prev.filter(c => c.Period !== period);
                return [...otherPeriodCharges, ...allChargesForPeriod];
            });

            showToast(`Đã tính xong phí kỳ ${period}. Thống kê đã được cập nhật.`, 'success');

        } catch (e: any) {
            showToast(`Lỗi: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLock = async () => {
        if (!canCalculate) return;

        if (isBillingLocked) {
            const now = Date.now();
            if (now - lastClickTime.current < 350) {
                try {
                    await setBillingLockStatus(period, false);
                    setIsBillingLocked(false);
                    showToast('Đã mở khóa sổ. Có thể chỉnh sửa dữ liệu.', 'success');
                } catch (e) {
                    showToast('Lỗi khi mở khóa.', 'error');
                }
            } else {
                showToast('Nhấn đúp để mở khóa sổ.', 'info');
            }
            lastClickTime.current = now;
        } else {
            if (window.confirm(`Xác nhận chốt sổ kỳ ${period}? Sau khi chốt, dữ liệu sẽ không thể chỉnh sửa.`)) {
                try {
                    await setBillingLockStatus(period, true);
                    setIsBillingLocked(true);
                    showToast('Đã chốt sổ kỳ này.', 'success');
                } catch (e) {
                    showToast('Lỗi khi chốt sổ.', 'error');
                }
            }
        }
    };

    const handleStatementFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook: any = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                let headerIndex = -1, colCredit = -1, colDesc = -1;
                for (let i = 0; i < Math.min(20, json.length); i++) {
                    const rowArray = json[i] as any[];
                    if (!Array.isArray(rowArray)) continue;
                    const row: string[] = rowArray.map((c: any) => String(c ?? "").toLowerCase());
                    if (row.some(c => c.includes('credit') || c.includes('ghi co') || c.includes('số tiền')) && row.some(c => c.includes('noi dung') || c.includes('desc') || c.includes('diễn giải'))) {
                        headerIndex = i;
                        colCredit = row.findIndex(c => c.includes('credit') || c.includes('ghi co') || c.includes('số tiền'));
                        colDesc = row.findIndex(c => c.includes('noi dung') || c.includes('desc') || c.includes('diễn giải'));
                        break;
                    }
                }
                
                if (headerIndex === -1) throw new Error('Không tìm thấy cột "Số tiền" và "Nội dung" trong 20 dòng đầu.');

                const updates = new Map<string, number>();
                const unitRegex = /(?:^|[^a-zA-Z0-9])(?:P|Ph|Phong|Can|C|Apt|Căn)?\s*([0-9]{3,4}|K[0-9]{2})(?=[^0-9]|$)/gi;
                const validUnits = new Set(allData.units.map(u => u.UnitID));

                for (let i = headerIndex + 1; i < json.length; i++) {
                    const rawAmt = json[i][colCredit];
                    const amtStr = typeof rawAmt === 'string' ? rawAmt : String(rawAmt ?? '0'); 
                    const amount = Math.round(parseFloat(amtStr.replace(/[^0-9.-]+/g,"")));
                    const desc = String(json[i][colDesc] || '');
                    
                    if (amount > 0) {
                        let match;
                        unitRegex.lastIndex = 0;
                        while ((match = unitRegex.exec(desc)) !== null) {
                            if (validUnits.has(match[1])) {
                                updates.set(match[1], (updates.get(match[1]) || 0) + amount);
                                break; 
                            }
                        }
                    }
                }

                if (updates.size > 0) {
                    await updateChargePayments(period, updates);
                    setCharges(prev => prev.map(c => 
                        (c.Period === period && updates.has(c.UnitID)) 
                        ? { ...c, TotalPaid: updates.get(c.UnitID)!, paymentStatus: 'reconciling', PaymentConfirmed: false } 
                        : c
                    ));
                    showToast(`Đã đối soát ${updates.size} giao dịch.`, 'success');
                } else {
                    showToast('Không tìm thấy giao dịch phù hợp.', 'warn');
                }
            } catch (err: any) {
                showToast(err.message, 'error');
            } finally {
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadPDFs = async () => {
        const targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;
        setIsLoading(true);
        showToast('Đang tạo PDF...', 'info');
        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas'), loadScript('jszip')]);
            const { jsPDF } = jspdf;
            const JSZip = (window as any).JSZip;
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            document.body.appendChild(container);
            if (targets.length === 1) {
                const charge = targets[0];
                container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                const element = container.firstElementChild as HTMLElement;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
                const pdf = new jsPDF('l', 'mm', 'a5'); 
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 148);
                pdf.save(`PhieuThu_${charge.UnitID}_${period}.pdf`);
                showToast('Đã tải xuống PDF.', 'success');
            } else {
                const zip = new JSZip();
                for (const charge of targets) {
                    container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                    const element = container.firstElementChild as HTMLElement;
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
                    const pdf = new jsPDF('l', 'mm', 'a5');
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 148);
                    zip.file(`PhieuThu_${charge.UnitID}_${period}.pdf`, pdf.output('blob'));
                }
                const content = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `PhieuThu_${period}.zip`;
                link.click();
                showToast('Tải xuống ZIP hoàn tất.', 'success');
            }
            document.body.removeChild(container);
            setSelectedUnits(new Set());
        } catch (e) {
            showToast('Lỗi tạo PDF.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBroadcastNotification = async (singleCharge?: ExtendedCharge) => {
        let targets: ExtendedCharge[] = [];
        if (singleCharge) targets = [singleCharge];
        else targets = (charges as ExtendedCharge[]).filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;
        if (!singleCharge && !window.confirm(`Gửi thông báo phí qua App cho ${targets.length} căn hộ?`)) return;
        setIsLoading(true);
        try {
            if (IS_PROD) {
                const chunkSize = 400;
                for (let i = 0; i < targets.length; i += chunkSize) {
                    const chunk = targets.slice(i, i + chunkSize);
                    const batch = writeBatch(db);
                    chunk.forEach(c => {
                        const chargeId = `${c.Period}_${c.UnitID}`;
                        const notifRef = doc(collection(db, 'notifications'));
                        batch.set(notifRef, {
                            type: 'bill', title: `Thông báo phí T${c.Period.split('-')[1]}`,
                            body: `Tổng: ${formatCurrency(c.TotalDue)}. Vui lòng thanh toán.`,
                            userId: c.UnitID, isRead: false, createdAt: serverTimestamp(), link: 'portalBilling', chargeId: chargeId
                        });
                        const chargeRef = doc(db, 'charges', chargeId);
                        batch.update(chargeRef, { isSent: true, sentCount: increment(1) });
                    });
                    await batch.commit();
                }
            }
            const targetedUnitIds = new Set(targets.map(t => t.UnitID));
            setCharges(prev => prev.map(c => {
                if (c.Period === period && targetedUnitIds.has(c.UnitID)) {
                    return { ...c, isSent: true, sentCount: ((c as ExtendedCharge).sentCount || 0) + 1 };
                }
                return c;
            }));
            showToast(`Đã gửi thông báo cho ${targets.length} căn hộ.`, 'success');
        } catch (e: any) {
            showToast('Lỗi gửi thông báo: ' + e.message, 'error');
        } finally {
            setIsLoading(false);
            if (!singleCharge) setSelectedUnits(new Set());
        }
    };

    const handleBulkSendEmail = async (singleUnitId?: string) => {
        let targets = [];
        if (singleUnitId) targets = charges.filter(c => c.Period === period && c.UnitID === singleUnitId);
        else targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;
        if (!invoiceSettings.appsScriptUrl) { showToast('Chưa cấu hình Email Server.', 'error'); return; }
        if (!singleUnitId && !window.confirm(`Gửi email cho ${targets.length} căn hộ?`)) return;
        setIsLoading(true);
        let successCount = 0;
        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas')]);
            const { jsPDF } = jspdf;
            const container = document.createElement('div');
            container.style.position = 'absolute'; container.style.left = '-9999px';
            document.body.appendChild(container);
            for (const charge of targets) {
                if (!charge.Email) continue;
                container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                const element = container.firstElementChild as HTMLElement;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                const pdf = new jsPDF('l', 'mm', 'a5');
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                const pdfBlob = pdf.output('blob');
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(pdfBlob);
                });
                const base64 = await base64Promise;
                const subject = (invoiceSettings.emailSubject || 'THONG BAO PHI').replace('{{period}}', period).replace('{{unit_id}}', charge.UnitID);
                const body = (invoiceSettings.emailBody || '').replace('{{owner_name}}', charge.OwnerName).replace('{{unit_id}}', charge.UnitID).replace('{{period}}', period).replace('{{total_due}}', formatCurrency(charge.TotalDue));
                const res = await sendEmailAPI(charge.Email, subject, body, invoiceSettings, base64, `PhieuThu_${charge.UnitID}.pdf`);
                if (res.success) successCount++;
            }
            document.body.removeChild(container);
            if (IS_PROD) {
                const batch = writeBatch(db);
                targets.forEach(c => { if (c.Email) batch.update(doc(db, 'charges', `${c.Period}_${c.UnitID}`), { isSent: true }); });
                await batch.commit();
            }
            setCharges(prev => prev.map(c => targets.find(t => t.UnitID === c.UnitID) && c.Email ? { ...c, isSent: true } : c));
            showToast(singleUnitId ? 'Đã gửi email.' : `Đã gửi thành công ${successCount}/${targets.length} email.`, 'success');
        } catch (e: any) {
            showToast('Lỗi gửi email: ' + e.message, 'error');
        } finally {
            setIsLoading(false);
            if (!singleUnitId) setSelectedUnits(new Set());
        }
    };

    const handleExportReport = () => {
        const targets = filteredCharges;
        if (targets.length === 0) { showToast('Không có dữ liệu để xuất.', 'warn'); return; }
        const header = "Kỳ,Căn hộ,Chủ hộ,Diện tích,Phí DV,SL Ô tô,SL Xe máy,Phí Gửi xe,Tiêu thụ nước,Tiền nước,Điều chỉnh,Tổng phải thu,Đã nộp,Còn nợ,Trạng thái\n";
        const rows = targets.map(c => {
            const debt = c.TotalDue - c.TotalPaid;
            const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
            return [c.Period, c.UnitID, escape(c.OwnerName), c.Area_m2, c.ServiceFee_Total, c['#CAR'] + c['#CAR_A'], c['#MOTORBIKE'], c.ParkingFee_Total, c.Water_m3, c.WaterFee_Total, c.Adjustments, c.TotalDue, c.TotalPaid, debt, c.paymentStatus].join(',');
        }).join('\n');
        const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.setAttribute("download", `Bao_cao_phi_ky_${period}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleDeleteBulk = async () => {
        if (isBillingLocked) return;
        if (!window.confirm("Bạn có chắc muốn xóa các dòng phí đã chọn?")) return;
        const targetIds = Array.from(selectedUnits);
        if (IS_PROD) {
            const batch = writeBatch(db);
            targetIds.forEach(id => batch.delete(doc(db, 'charges', `${period}_${id}`)));
            await batch.commit();
        }
        setCharges(prev => prev.filter(c => !(c.Period === period && selectedUnits.has(c.UnitID))));
        setSelectedUnits(new Set());
        showToast('Đã xóa dữ liệu.', 'success');
    };

    const handleMarkPaid = async (method: 'paid_tm' | 'paid_ck' | 'pending') => {
        if (isBillingLocked) return;
        const targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;
        setIsLoading(true);
        try {
            if (IS_PROD) {
                const batch = writeBatch(db);
                targets.forEach(c => {
                    const update = { paymentStatus: method, PaymentConfirmed: method !== 'pending', TotalPaid: method === 'pending' ? 0 : c.TotalDue };
                    batch.update(doc(db, 'charges', `${period}_${c.UnitID}`), update);
                });
                await batch.commit();
            }
            setCharges(prev => prev.map(c => (c.Period === period && selectedUnits.has(c.UnitID)) ? { ...c, paymentStatus: method as PaymentStatus, PaymentConfirmed: method !== 'pending', TotalPaid: method === 'pending' ? 0 : c.TotalDue } : c));
            showToast('Cập nhật trạng thái thành công.', 'success');
        } finally {
            setIsLoading(false);
            setSelectedUnits(new Set());
        }
    };

    const handleSinglePayment = async (charge: ChargeRaw, method: 'paid_tm' | 'paid_ck') => {
        if (isBillingLocked) return;
        if (method === 'paid_ck' && (charge.paymentStatus === 'reconciling' || charge.proofImage)) {
            setVerifyCharge(charge); return;
        }
        const amount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
        await confirmSinglePayment(charge, amount, method);
        setCharges(prev => prev.map(c => c.UnitID === charge.UnitID && c.Period === period ? { ...c, paymentStatus: method, PaymentConfirmed: true, TotalPaid: amount } : c));
        showToast(`Đã thu ${formatCurrency(amount)} cho căn ${charge.UnitID}`, 'success');
    };

    const handleVerifyConfirm = async (charge: ChargeRaw, finalAmount: number) => {
        await confirmSinglePayment(charge, finalAmount, 'paid_ck');
        setCharges(prev => prev.map(c => c.UnitID === charge.UnitID && c.Period === period ? { ...c, paymentStatus: 'paid_ck', PaymentConfirmed: true, TotalPaid: finalAmount } : c));
        showToast(`Đã xác thực và thu ${formatCurrency(finalAmount)}`, 'success');
        setVerifyCharge(null);
    };

    const formatPeriod = (p: string) => { const d = new Date(p + '-02'); return `T${d.getMonth() + 1}/${d.getFullYear()}`; };
    
    return (
        <div className="space-y-4 h-full flex flex-col relative">
            <input type="file" ref={fileInputRef} onChange={handleStatementFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
            <div className="relative">
                <button onClick={() => setShowStats(!showStats)} className="absolute right-0 -top-8 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs font-semibold z-10">
                    {showStats ? <><ChevronUpIcon className="w-4 h-4" /> Thu gọn</> : <><ChevronDownIcon className="w-4 h-4" /> Mở rộng</>}
                </button>
                {showStats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-down mb-4">
                        <MinimalStatCard label="Doanh thu dự kiến" value={formatCurrency(stats.totalDue)} colorClass="border-blue-500" onClick={() => setStatusFilter('all')} />
                        <MinimalStatCard label="Thực thu" value={formatCurrency(stats.totalPaid)} colorClass="border-emerald-500" onClick={() => setStatusFilter('paid')} />
                        <MinimalStatCard label="Công nợ" value={formatCurrency(stats.debt)} colorClass="border-red-500" onClick={() => setStatusFilter('debt')} />
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-4 hover:shadow-md transition-shadow">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tiến độ thu</p>
                            <div className="flex justify-between items-end mt-1">
                                <p className="text-2xl font-bold text-gray-800">{stats.progress.toFixed(0)}%</p>
                                <p className="text-xs text-gray-500 font-medium mb-1">{stats.paidCount}/{stats.count} căn</p>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                                <div className="bg-purple-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${stats.progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })} className="p-1.5 hover:bg-gray-200 rounded"><ChevronLeftIcon /></button>
                    <button onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} className="px-3 font-bold text-gray-800 text-sm w-24 text-center hover:bg-gray-200 rounded py-1.5">{formatPeriod(period)}</button>
                    {isMonthPickerOpen && <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />}
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); })} className="p-1.5 hover:bg-gray-200 rounded"><ChevronRightIcon /></button>
                </div>
                <div className="relative flex-grow min-w-[200px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Tìm căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white text-gray-900" />
                </div>
                <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 outline-none">{floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 outline-none"><option value="all">Tất cả trạng thái</option><option value="pending">Đang chờ</option><option value="reconciling">Chờ xác nhận (CK)</option><option value="paid">Đã thu (Tất cả)</option><option value="paid_tm">Đã thu (TM)</option><option value="paid_ck">Đã thu (CK)</option><option value="debt">Còn nợ</option></select>
                <div className="flex items-center gap-2 border-l pl-3">
                    {onRefresh && <button onClick={onRefresh} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 border border-transparent hover:border-gray-200" title="Làm mới dữ liệu"><ArrowPathIcon className="w-5 h-5" /></button>}
                    <button onClick={handleCalculate} disabled={isLoading || !canCalculate || (isFuturePeriod && !isBillingLocked) || isBillingLocked} title={isBillingLocked ? "Đã khóa sổ" : "Tính lại phí"} className={`h-9 px-4 rounded-lg font-bold text-sm flex items-center gap-2 text-white shadow-sm transition-colors ${isBillingLocked ? 'bg-gray-400 cursor-not-allowed' : isFuturePeriod ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#006f3a] hover:bg-[#005a2f]'}`}>{isLoading ? <Spinner /> : <CalculatorIcon2 className="w-4 h-4"/>}{isBillingLocked ? "Đã tính" : "Tính phí"}</button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isBillingLocked} title="Nhập sao kê để đối soát" className={`h-9 px-3 border border-gray-300 font-semibold rounded-lg flex items-center gap-1 text-sm ${isBillingLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}><ArrowUpTrayIcon className="w-4 h-4"/> Import</button>
                    <button onClick={handleExportReport} className="h-9 px-3 border border-gray-300 font-semibold rounded-lg flex items-center gap-1 text-sm bg-white text-gray-700 hover:bg-gray-50" title="Xuất báo cáo chi tiết (CSV)"><ArrowDownTrayIcon className="w-4 h-4"/> Export</button>
                    <div className="ml-2 border-l pl-3">
                        <button onClick={handleToggleLock} disabled={!canCalculate} className={`h-9 px-4 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors ${isBillingLocked ? 'bg-gray-600 text-white hover:bg-gray-700 border-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'}`} title={isBillingLocked ? "Đã chốt sổ. Nhấn đúp để mở khóa" : "Chốt sổ (Khóa dữ liệu)"}>{isBillingLocked ? <LockClosedIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}{isBillingLocked ? "Đã chốt" : "Chốt sổ"}</button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
                <div className="overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="w-10 px-4 py-3 text-center"><input type="checkbox" checked={selectedUnits.size > 0 && selectedUnits.size === filteredCharges.length} onChange={() => setSelectedUnits(prev => prev.size === filteredCharges.length ? new Set() : new Set(filteredCharges.map(c => c.UnitID)))} className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"/></th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Căn hộ</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Chủ hộ</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-600">Tổng phí</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-600 w-32">Thực thu</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-600">C.Lệch</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600">Trạng thái</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-600 w-32">H.Động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredCharges.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Chưa có dữ liệu.</td></tr>
                            ) : (
                                (filteredCharges as ExtendedCharge[]).map(charge => {
                                    const finalPaid = editedPayments[charge.UnitID] ?? charge.TotalPaid;
                                    const diff = finalPaid - charge.TotalDue;
                                    const isPaid = ['paid', 'paid_tm', 'paid_ck'].includes(charge.paymentStatus);
                                    let statusBadge;
                                    if (charge.paymentStatus === 'paid_tm') statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">Đã thu (TM)</span>;
                                    else if (charge.paymentStatus === 'paid_ck' || charge.paymentStatus === 'paid') statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Đã thu (CK)</span>;
                                    else if (charge.paymentStatus === 'reconciling') statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 flex items-center gap-1 justify-center"><MagnifyingGlassIcon className="w-3 h-3"/> Chờ đối soát</span>;
                                    else if (charge.sentCount && charge.sentCount > 0) statusBadge = <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${charge.sentCount > 1 ? 'text-blue-800 bg-blue-100 border-blue-200' : 'text-cyan-800 bg-cyan-100 border-cyan-200'}`}>Đã gửi - {charge.sentCount}</span>;
                                    else statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200">Đang chờ</span>;

                                    return (
                                        <tr key={charge.UnitID} className={`hover:bg-gray-50 transition-colors ${selectedUnits.has(charge.UnitID) ? 'bg-blue-50' : ''}`}>
                                            <td className="px-4 py-3 text-center"><input type="checkbox" checked={selectedUnits.has(charge.UnitID)} onChange={() => setSelectedUnits(p => { const n = new Set(p); if(n.has(charge.UnitID)) n.delete(charge.UnitID); else n.add(charge.UnitID); return n; })} className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"/></td>
                                            <td className="px-4 py-3 font-bold text-gray-900">{charge.UnitID}</td>
                                            <td className="px-4 py-3 text-gray-700 flex items-center gap-2">{charge.paymentStatus === 'reconciling' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Có biên lai cần duyệt"></div>}{charge.OwnerName}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNumber(charge.TotalDue)}</td>
                                            <td className="px-4 py-3 text-right"><input type="text" value={formatNumber(finalPaid)} onChange={e => { if (!isPaid && !isBillingLocked) { const val = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); setEditedPayments(prev => ({ ...prev, [charge.UnitID]: val })); } }} readOnly={isPaid || isBillingLocked} className={isPaid ? "w-full text-right p-1.5 text-sm border border-green-200 rounded-md bg-green-50 text-green-700 font-bold focus:outline-none" : "w-full text-right p-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-[#006f3a] focus:border-transparent outline-none"}/></td>
                                            <td className={`px-4 py-3 text-right font-bold ${diff === 0 ? 'text-gray-300' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>{diff === 0 ? '-' : formatNumber(diff)}</td>
                                            <td className="px-4 py-3 text-center">{statusBadge}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => setPreviewCharge(charge)} title="Xem chi tiết" className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"><ActionViewIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => handleBroadcastNotification(charge)} disabled={isBillingLocked} title="Gửi App Notification" className={`p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}><PaperAirplaneIcon className="w-4 h-4"/></button>
                                                    <QuickActionMenu onSelect={(m) => handleSinglePayment(charge, m)} disabled={role === 'Operator' || isBillingLocked} trigger={<button title="Xác nhận thu" className={`p-1.5 rounded hover:bg-green-50 text-green-500 hover:text-green-700 ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>{charge.paymentStatus === 'reconciling' ? <MagnifyingGlassIcon className="w-4 h-4 text-purple-600"/> : <CheckCircleIcon className="w-4 h-4"/>}</button>}/>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUnits.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-2xl border border-gray-200 p-2 flex items-center gap-4 z-50 animate-fade-in-down">
                    <div className="pl-4 pr-3 border-r border-gray-200 flex items-center gap-2"><span className="text-sm font-bold text-gray-800">{selectedUnits.size}</span><button onClick={() => setSelectedUnits(new Set())} className="text-xs text-red-500 hover:underline">Bỏ chọn</button></div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleMarkPaid('paid_tm')} disabled={isLoading || isBillingLocked} className={`flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 text-xs font-bold ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}><BanknotesIcon className="w-4 h-4"/> Thu TM</button>
                        <button onClick={() => handleMarkPaid('paid_ck')} disabled={isLoading || isBillingLocked} className={`flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}><CreditCardIcon className="w-4 h-4"/> Thu CK</button>
                        <button onClick={() => handleMarkPaid('pending')} disabled={isLoading || isBillingLocked} className={`flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-bold ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}><ArrowUturnLeftIcon className="w-4 h-4"/> Hủy thu</button>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                        <button onClick={() => handleBroadcastNotification()} disabled={isLoading || isBillingLocked} className={`p-2 rounded-full hover:bg-cyan-50 text-cyan-600 ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`} title="Gửi App"><PaperAirplaneIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleBulkSendEmail()} disabled={isLoading || isBillingLocked} className={`p-2 rounded-full hover:bg-indigo-50 text-indigo-600 ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`} title="Gửi Email"><EnvelopeIcon className="w-5 h-5"/></button>
                        <button onClick={handleDownloadPDFs} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-100 text-gray-700" title="Tải PDF"><PrinterIcon className="w-5 h-5"/></button>
                    </div>
                    <div className="pl-2 border-l border-gray-200 pr-2"><button onClick={handleDeleteBulk} disabled={isLoading || isBillingLocked} className={`p-2 rounded-full hover:bg-red-50 text-red-600 ${isBillingLocked ? 'opacity-50 cursor-not-allowed' : ''}`} title="Xóa"><TrashIcon className="w-5 h-5"/></button></div>
                </div>
            )}
            {previewCharge && <NoticePreviewModal charge={previewCharge} onClose={() => setPreviewCharge(null)} invoiceSettings={invoiceSettings} allData={allData} onSendEmail={() => handleBulkSendEmail(previewCharge.UnitID)}/>}
            {verifyCharge && <VerificationModal charge={verifyCharge} onClose={() => setVerifyCharge(null)} onConfirm={handleVerifyConfirm}/>}
        </div>
    );
};

export default BillingPage;
