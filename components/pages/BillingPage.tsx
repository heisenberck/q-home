
// ... existing imports ...
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ChargeRaw, Adjustment, AllData, Role, PaymentStatus, InvoiceSettings, Owner, LogPayload } from '../../types';
import { UnitType } from '../../types';
// FIX: Import from Context directly to avoid cycle
import { useNotification } from '../../contexts/AppContext'; 
import { 
    confirmSinglePayment,
    loadAllData,
    updateChargePayments
} from '../../services';
// ... rest of the file ...
import { calculateChargesBatch } from '../../services/feeService';
import NoticePreviewModal from '../NoticePreviewModal';
import Spinner from '../ui/Spinner';
import { 
    SearchIcon, ChevronLeftIcon, ChevronRightIcon, 
    CheckCircleIcon, CalculatorIcon2, LockClosedIcon,
    ArrowDownTrayIcon, BanknotesIcon, ArrowUpTrayIcon,
    PaperAirplaneIcon, TrashIcon, PrinterIcon, EnvelopeIcon, ArrowUturnLeftIcon,
    ActionViewIcon, ChevronDownIcon, ChevronUpIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';
import { formatCurrency, parseUnitCode, renderInvoiceHTMLForPdf, formatNumber, sortUnitsComparator } from '../../utils/helpers';
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

const CreditCardIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
);

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
}

const BillingPage: React.FC<BillingPageProps> = ({ charges, setCharges, allData, onUpdateAdjustments, role, invoiceSettings }) => {
    const { showToast } = useNotification();
    const canCalculate = ['Admin', 'Accountant'].includes(role);
    const IS_PROD = isProduction();

    // State
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [lockedPeriods, setLockedPeriods] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('lockedBillingPeriods');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
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
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const primaryActionTimeout = useRef<number | null>(null);
    const lastClickTime = useRef(0);

    const isPeriodLocked = lockedPeriods.has(period);
    
    // Logic: Disable calculation for future periods
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const isFuturePeriod = period > currentMonthStr;

    // Persist Lock
    useEffect(() => {
        localStorage.setItem('lockedBillingPeriods', JSON.stringify(Array.from(lockedPeriods)));
    }, [lockedPeriods]);

    // Data Filtering
    const floors = useMemo(() => {
        const nums = Array.from(new Set(allData.units.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a,b) => parseInt(a,10) - parseInt(b,10));
        return [{value: 'all', label: 'Tất cả tầng'}, ...nums.map(f => ({value: f, label: `Tầng ${f}`})), {value: 'KIOS', label: 'KIOS'}];
    }, [allData.units]);

    const filteredCharges = useMemo(() => {
        return (charges as ExtendedCharge[]).filter(c => {
            if (c.Period !== period) return false;
            
            if (statusFilter !== 'all') {
                if (statusFilter === 'paid') {
                    // Include both payment methods in generic "paid" filter
                    if (!['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)) return false;
                } else if (statusFilter === 'debt') {
                    if (['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)) return false;
                } else if (statusFilter === 'pending') {
                    if (c.paymentStatus !== 'pending') return false;
                } else if (statusFilter === 'unpaid') {
                    if (c.paymentStatus !== 'unpaid') return false;
                } else {
                    // Specific status matches (paid_tm, paid_ck)
                    if (c.paymentStatus !== statusFilter) return false;
                }
            }

            if (floorFilter !== 'all') {
                const floor = c.UnitID.startsWith('K') ? 'KIOS' : parseUnitCode(String(c.UnitID))?.floor?.toString();
                if (floor !== floorFilter) return false;
            }
            const s = searchTerm.toLowerCase();
            if (s && !(c.UnitID.toLowerCase().includes(s) || (c.OwnerName || '').toLowerCase().includes(s))) return false;
            return true;
        }).sort(sortUnitsComparator);
    }, [charges, period, searchTerm, statusFilter, floorFilter]);

    // Stats
    const stats = useMemo(() => {
        const currentCharges = charges.filter(c => c.Period === period);
        const totalDue = currentCharges.reduce((s, c) => s + c.TotalDue, 0);
        const totalPaid = currentCharges.reduce((s, c) => s + c.TotalPaid, 0);
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

    // --- Logic: Calculation & Lock ---

    const handleCalculate = async () => {
        if (isPeriodLocked) {
            showToast('Kỳ này đã khóa. Nhấn đúp để mở.', 'error');
            return;
        }
        if (isFuturePeriod) {
            showToast('Không thể tính phí cho kỳ tương lai.', 'error');
            return;
        }

        setIsLoading(true);
        showToast('Đang tính toán lại phí...', 'info');

        try {
            // 1. Fetch fresh data
            const freshData = await loadAllData();
            
            // 2. Separate existing PAID charges (Preserve them)
            const existingPaid = charges.filter(c => c.Period === period && ['paid', 'paid_tm', 'paid_ck', 'reconciling'].includes(c.paymentStatus));
            const paidUnitIds = new Set(existingPaid.map(c => c.UnitID));

            // 3. Identify units needing calculation
            const unitsToCalc = freshData.units.filter(u => !paidUnitIds.has(u.UnitID));
            
            const inputs = unitsToCalc.map(unit => ({ 
                unit, 
                owner: (freshData.owners.find(o => o.OwnerID === unit.OwnerID) || { OwnerID: unit.OwnerID, OwnerName: 'Unknown', Phone: '', Email: '' }) as Owner,
                vehicles: freshData.vehicles.filter(v => v.UnitID === unit.UnitID), 
                adjustments: freshData.adjustments.filter(a => a.UnitID === unit.UnitID && a.Period === period) 
            }));

            // 4. Calculate
            const newCharges = await calculateChargesBatch(period, inputs, freshData);
            
            // 5. Enhance with Meta & Auto-fill TotalPaid for convenience
            const finalNewCharges = newCharges.map(c => ({
                ...c,
                CreatedAt: new Date().toISOString(),
                Locked: false,
                paymentStatus: 'pending' as PaymentStatus,
                PaymentConfirmed: false,
                TotalPaid: c.TotalDue, // Auto-fill Input
                isPrinted: false,
                isSent: false,
                sentCount: 0 // New field
            }));

            // 6. Update State
            setCharges(prev => {
                const otherPeriodCharges = prev.filter(c => c.Period !== period);
                return [...otherPeriodCharges, ...existingPaid, ...finalNewCharges];
            }, {
                module: 'Billing', action: 'CALCULATE',
                summary: `Tính phí kỳ ${period} cho ${finalNewCharges.length} căn`,
                before_snapshot: charges
            });

            // 7. Auto-Lock
            setLockedPeriods(prev => new Set(prev).add(period));
            showToast(`Đã tính xong và khóa kỳ ${period}.`, 'success');

        } catch (e: any) {
            showToast(`Lỗi: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLockToggle = () => {
        const now = Date.now();
        if ((now - lastClickTime.current) < 350) { // Double click
            setLockedPeriods(prev => {
                const next = new Set(prev);
                if (next.has(period)) next.delete(period);
                else next.add(period);
                return next;
            });
            showToast(isPeriodLocked ? 'Đã mở khóa tính toán.' : 'Đã khóa kỳ thu.', 'success');
        } else { // Single Click
            primaryActionTimeout.current = window.setTimeout(() => {
                if (isPeriodLocked) showToast('Nhấn đúp để mở khóa.', 'info');
                else handleCalculate();
            }, 250);
        }
        lastClickTime.current = now;
    };

    // --- Logic: Bank Import ---
    const handleStatementFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                // Fix: Cast workbook to any to allow loose typing on SheetNames
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
                    const rowArray = json[i] as any[];
                    // Explicit casts to handle potential 'unknown' types from XLSX
                    const rawAmt = rowArray[colCredit];
                    const amtStr: string = String(rawAmt ?? '0');
                    const amount = Math.round(parseFloat(amtStr.replace(/[^0-9.-]+/g,"")));
                    const rawDesc = rowArray[colDesc];
                    const desc: string = String(rawDesc ?? '');
                    
                    if (amount > 0) {
                        let match;
                        unitRegex.lastIndex = 0;
                        while ((match = unitRegex.exec(desc)) !== null) {
                            if (validUnits.has(match[1])) {
                                updates.set(match[1], (updates.get(match[1]) || 0) + amount);
                                break; // Found unit, stop matching
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

    // --- Logic: Print PDF ---
    const handleDownloadPDFs = async () => {
        const targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;

        setIsLoading(true);
        showToast('Đang tạo PDF...', 'info');

        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas'), loadScript('jszip')]);
            const { jsPDF } = jspdf;
            const JSZip = (window as any).JSZip;
            
            // Temporary Container
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            document.body.appendChild(container);

            // A5 Landscape Configuration
            const pdfConfig = { orientation: 'landscape', unit: 'mm', format: 'a5' };

            if (targets.length === 1) {
                // SINGLE FILE MODE
                const charge = targets[0];
                container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                const element = container.firstElementChild as HTMLElement;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
                const pdf = new jsPDF('l', 'mm', 'a5'); // Landscape
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                // A5 Landscape: 210mm x 148mm
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 148);
                pdf.save(`PhieuThu_${charge.UnitID}_${period}.pdf`);
                showToast('Đã tải xuống PDF.', 'success');
            } else {
                // ZIP MODE
                const zip = new JSZip();
                for (const charge of targets) {
                    container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                    const element = container.firstElementChild as HTMLElement;
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
                    const pdf = new jsPDF('l', 'mm', 'a5'); // Landscape
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
            console.error(e);
            showToast('Lỗi tạo PDF.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Logic: Broadcast (App Notification) ---
    const handleBroadcastNotification = async (singleCharge?: ExtendedCharge) => {
        let targets: ExtendedCharge[] = [];
        if (singleCharge) {
            targets = [singleCharge];
        } else {
            targets = (charges as ExtendedCharge[]).filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        }

        if (targets.length === 0) return;
        
        if (!singleCharge && !window.confirm(`Gửi thông báo phí qua App cho ${targets.length} căn hộ?`)) return;

        setIsLoading(true);

        try {
            if (IS_PROD) {
                // Chunking logic (max 500 ops per batch, using 400 for safety)
                const chunkSize = 400;
                for (let i = 0; i < targets.length; i += chunkSize) {
                    const chunk = targets.slice(i, i + chunkSize);
                    const batch = writeBatch(db);
                    
                    chunk.forEach(c => {
                        const chargeId = `${c.Period}_${c.UnitID}`;
                        
                        // 1. Create Notification
                        const notifRef = doc(collection(db, 'notifications'));
                        batch.set(notifRef, {
                            type: 'bill',
                            title: `Thông báo phí T${c.Period.split('-')[1]}`,
                            body: `Tổng: ${formatCurrency(c.TotalDue)}. Vui lòng thanh toán.`,
                            userId: c.UnitID, // Targeting UnitID string e.g. "202"
                            isRead: false,
                            createdAt: serverTimestamp(),
                            link: 'portalBilling',
                            chargeId: chargeId
                        });

                        // 2. Update Charge Status
                        const chargeRef = doc(db, 'charges', chargeId);
                        batch.update(chargeRef, {
                            isSent: true,
                            sentCount: increment(1)
                        });
                    });
                    
                    await batch.commit();
                }
            }

            // Optimistic UI Update
            const targetedUnitIds = new Set(targets.map(t => t.UnitID));
            setCharges(prev => prev.map(c => {
                if (c.Period === period && targetedUnitIds.has(c.UnitID)) {
                    return { 
                        ...c, 
                        isSent: true,
                        sentCount: ((c as ExtendedCharge).sentCount || 0) + 1 
                    };
                }
                return c;
            }));

            showToast(`Đã gửi thông báo cho ${targets.length} căn hộ.`, 'success');
        } catch (e: any) {
            console.error("Broadcast Error:", e);
            showToast('Lỗi gửi thông báo: ' + e.message, 'error');
        } finally {
            setIsLoading(false);
            if (!singleCharge) setSelectedUnits(new Set());
        }
    };

    // --- Logic: Send Email (Original) ---
    const handleBulkSendEmail = async (singleUnitId?: string) => {
        let targets = [];
        if (singleUnitId) {
            targets = charges.filter(c => c.Period === period && c.UnitID === singleUnitId);
        } else {
            targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        }

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

                // 1. Generate PDF Blob
                container.innerHTML = renderInvoiceHTMLForPdf(charge, allData, invoiceSettings);
                const element = container.firstElementChild as HTMLElement;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                const pdf = new jsPDF('l', 'mm', 'a5'); // Landscape A5
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 148);
                const pdfBlob = pdf.output('blob');

                // 2. Convert Blob to Base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(pdfBlob);
                });
                const base64 = await base64Promise;

                // 3. Send
                const subject = (invoiceSettings.emailSubject || 'THONG BAO PHI').replace('{{period}}', period).replace('{{unit_id}}', charge.UnitID);
                const body = (invoiceSettings.emailBody || '').replace('{{owner_name}}', charge.OwnerName).replace('{{unit_id}}', charge.UnitID).replace('{{period}}', period).replace('{{total_due}}', formatCurrency(charge.TotalDue));
                
                const res = await sendEmailAPI(charge.Email, subject, body, invoiceSettings, base64, `PhieuThu_${charge.UnitID}.pdf`);
                if (res.success) successCount++;
            }
            document.body.removeChild(container);
            
            // Mark as sent
            if (IS_PROD) {
                const batch = writeBatch(db);
                targets.forEach(c => {
                    if (c.Email) batch.update(doc(db, 'charges', `${c.Period}_${c.UnitID}`), { isSent: true });
                });
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

    // --- Logic: CSV Export (FULL REPORT) ---
    const handleExportReport = () => {
        const targets = filteredCharges;
        if (targets.length === 0) {
            showToast('Không có dữ liệu để xuất.', 'warn');
            return;
        }
        
        // Define Columns
        const header = "Kỳ,Căn hộ,Chủ hộ,Diện tích,Phí DV,SL Ô tô,SL Xe máy,Phí Gửi xe,Tiêu thụ nước,Tiền nước,Điều chỉnh,Tổng phải thu,Đã nộp,Còn nợ,Trạng thái\n";
        
        const rows = targets.map(c => {
            const debt = c.TotalDue - c.TotalPaid;
            const carCount = c['#CAR'] + c['#CAR_A'];
            const motoCount = c['#MOTORBIKE'];
            
            // Handle CSV injection/escaping
            const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

            return [
                c.Period,
                c.UnitID,
                escape(c.OwnerName),
                c.Area_m2,
                c.ServiceFee_Total,
                carCount,
                motoCount,
                c.ParkingFee_Total,
                c.Water_m3,
                c.WaterFee_Total,
                c.Adjustments,
                c.TotalDue,
                c.TotalPaid,
                debt,
                c.paymentStatus
            ].join(',');
        }).join('\n');

        const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Bao_cao_phi_ky_${period}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Actions ---
    const handleDeleteBulk = async () => {
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
        const targets = charges.filter(c => c.Period === period && selectedUnits.has(c.UnitID));
        if (targets.length === 0) return;
        
        setIsLoading(true);
        try {
            if (IS_PROD) {
                const batch = writeBatch(db);
                targets.forEach(c => {
                    const update = {
                        paymentStatus: method,
                        PaymentConfirmed: method !== 'pending',
                        TotalPaid: method === 'pending' ? 0 : c.TotalDue
                    };
                    batch.update(doc(db, 'charges', `${period}_${c.UnitID}`), update);
                });
                await batch.commit();
            }
            
            setCharges(prev => prev.map(c => {
                if (c.Period === period && selectedUnits.has(c.UnitID)) {
                    return {
                        ...c,
                        paymentStatus: method as PaymentStatus,
                        PaymentConfirmed: method !== 'pending',
                        TotalPaid: method === 'pending' ? 0 : c.TotalDue
                    };
                }
                return c;
            }));
            showToast('Cập nhật trạng thái thành công.', 'success');
        } finally {
            setIsLoading(false);
            setSelectedUnits(new Set());
        }
    };

    const handleSinglePayment = async (charge: ChargeRaw, method: 'paid_tm' | 'paid_ck') => {
        const amount = editedPayments[charge.UnitID] ?? charge.TotalPaid;
        await confirmSinglePayment(charge, amount, method);
        setCharges(prev => prev.map(c => c.UnitID === charge.UnitID && c.Period === period ? { ...c, paymentStatus: method, PaymentConfirmed: true, TotalPaid: amount } : c));
        showToast(`Đã thu ${formatCurrency(amount)} cho căn ${charge.UnitID}`, 'success');
    };

    const formatPeriod = (p: string) => { const d = new Date(p + '-02'); return `T${d.getMonth() + 1}/${d.getFullYear()}`; };
    
    return (
        <div className="space-y-4 h-full flex flex-col relative">
            <input type="file" ref={fileInputRef} onChange={handleStatementFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
            
            {/* 1. StatCards (Toggleable) */}
            <div className="relative">
                <button 
                    onClick={() => setShowStats(!showStats)} 
                    className="absolute right-0 -top-8 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs font-semibold z-10"
                >
                    {showStats ? <><ChevronUpIcon className="w-4 h-4" /> Thu gọn</> : <><ChevronDownIcon className="w-4 h-4" /> Mở rộng</>}
                </button>
                
                {showStats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-down mb-4">
                        <MinimalStatCard label="Doanh thu dự kiến" value={formatCurrency(stats.totalDue)} colorClass="border-blue-500" onClick={() => setStatusFilter('all')} />
                        <MinimalStatCard label="Thực thu" value={formatCurrency(stats.totalPaid)} colorClass="border-emerald-500" onClick={() => setStatusFilter('paid')} />
                        <MinimalStatCard label="Công nợ" value={formatCurrency(stats.debt)} colorClass="border-red-500" onClick={() => setStatusFilter('debt')} />
                        
                        {/* Custom Progress Card */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-4 hover:shadow-md transition-shadow">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tiến độ thu</p>
                            <div className="flex justify-between items-end mt-1">
                                <p className="text-2xl font-bold text-gray-800">{stats.progress.toFixed(0)}%</p>
                                <p className="text-xs text-gray-500 font-medium mb-1">{stats.paidCount}/{stats.count} căn</p>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                                <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-500 ease-out" 
                                    style={{ width: `${stats.progress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Toolbar */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-3">
                
                {/* Month Picker */}
                <div className="relative flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })} className="p-1.5 hover:bg-gray-200 rounded"><ChevronLeftIcon /></button>
                    <button 
                        onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                        className="px-3 font-bold text-gray-800 text-sm w-24 text-center hover:bg-gray-200 rounded py-1.5"
                    >
                        {formatPeriod(period)}
                    </button>
                    {isMonthPickerOpen && (
                        <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />
                    )}
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); })} className="p-1.5 hover:bg-gray-200 rounded"><ChevronRightIcon /></button>
                </div>

                {/* Search */}
                <div className="relative flex-grow min-w-[200px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Tìm căn hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white text-gray-900" />
                </div>

                {/* Filter Floors */}
                <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 outline-none">
                    {floors.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>

                {/* Filter Status */}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 outline-none">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Đang chờ</option>
                    <option value="paid">Đã thu (Tất cả)</option>
                    <option value="paid_tm">Đã thu (TM)</option>
                    <option value="paid_ck">Đã thu (CK)</option>
                    <option value="debt">Còn nợ</option>
                </select>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 border-l pl-3">
                    <button 
                        onClick={handleLockToggle}
                        disabled={isLoading || !canCalculate || (isFuturePeriod && !isPeriodLocked)}
                        title={isPeriodLocked ? "Bấm đúp để mở khoá" : "Bấm để tính phí cho kỳ hiện tại"}
                        className={`h-9 px-4 rounded-lg font-bold text-sm flex items-center gap-2 text-white shadow-sm transition-colors ${
                            isPeriodLocked ? 'bg-gray-500 hover:bg-gray-600' : 
                            isFuturePeriod ? 'bg-gray-300 cursor-not-allowed' :
                            'bg-[#006f3a] hover:bg-[#005a2f]'
                        }`}
                    >
                        {isLoading ? <Spinner /> : isPeriodLocked ? <LockClosedIcon className="w-4 h-4"/> : <CalculatorIcon2 className="w-4 h-4"/>}
                        {isPeriodLocked ? "Đã khóa" : "Tính phí"}
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        title="Nhập sao kê để đối soát"
                        className="h-9 px-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4"/> Import
                    </button>
                    <button 
                        onClick={handleExportReport} 
                        title="Xuất báo cáo"
                        className="h-9 px-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4"/> Export
                    </button>
                </div>
            </div>

            {/* 3. Table */}
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
                                    
                                    // Status Badge Logic
                                    let statusBadge;
                                    if (charge.paymentStatus === 'paid_tm') {
                                        statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">Đã thu (TM)</span>;
                                    } else if (charge.paymentStatus === 'paid_ck' || charge.paymentStatus === 'paid') {
                                        statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Đã thu (CK)</span>;
                                    } else if (charge.paymentStatus === 'reconciling') {
                                        statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-pink-100 text-pink-800 border border-pink-200">Chờ đối soát</span>;
                                    } else if (charge.sentCount && charge.sentCount > 0) {
                                        const color = charge.sentCount > 1 ? 'text-blue-800 bg-blue-100 border-blue-200' : 'text-cyan-800 bg-cyan-100 border-cyan-200';
                                        statusBadge = <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${color}`}>Đã gửi - {charge.sentCount}</span>;
                                    } else {
                                        statusBadge = <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200">Đang chờ</span>;
                                    }

                                    // Input Styling Logic
                                    const inputClass = isPaid
                                        ? "w-full text-right p-1.5 text-sm border border-green-200 rounded-md bg-green-50 text-green-700 font-bold focus:outline-none"
                                        : "w-full text-right p-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-[#006f3a] focus:border-transparent outline-none";

                                    return (
                                        <tr key={charge.UnitID} className={`hover:bg-gray-50 transition-colors ${selectedUnits.has(charge.UnitID) ? 'bg-blue-50' : ''}`}>
                                            <td className="px-4 py-3 text-center"><input type="checkbox" checked={selectedUnits.has(charge.UnitID)} onChange={() => setSelectedUnits(p => { const n = new Set(p); if(n.has(charge.UnitID)) n.delete(charge.UnitID); else n.add(charge.UnitID); return n; })} className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"/></td>
                                            <td className="px-4 py-3 font-bold text-gray-900">{charge.UnitID}</td>
                                            <td className="px-4 py-3 text-gray-700">{charge.OwnerName}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNumber(charge.TotalDue)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <input 
                                                    type="text" 
                                                    value={formatNumber(finalPaid)} 
                                                    onChange={e => { 
                                                        if (!isPaid) {
                                                            const val = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); 
                                                            setEditedPayments(prev => ({ ...prev, [charge.UnitID]: val })); 
                                                        }
                                                    }}
                                                    readOnly={isPaid}
                                                    className={inputClass}
                                                />
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${diff === 0 ? 'text-gray-300' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>{diff === 0 ? '-' : formatNumber(diff)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {statusBadge}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => setPreviewCharge(charge)} title="Xem chi tiết" className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"><ActionViewIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => handleBroadcastNotification(charge)} title="Gửi App Notification" className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700"><PaperAirplaneIcon className="w-4 h-4"/></button>
                                                    <QuickActionMenu 
                                                        onSelect={(m) => handleSinglePayment(charge, m)} 
                                                        disabled={role === 'Operator'} 
                                                        trigger={
                                                            <button title="Xác nhận thu" className="p-1.5 rounded hover:bg-green-50 text-green-500 hover:text-green-700">
                                                                <CheckCircleIcon className="w-4 h-4"/>
                                                            </button>
                                                        }
                                                    />
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

            {/* 4. Floating Action Bar */}
            {selectedUnits.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-2xl border border-gray-200 p-2 flex items-center gap-4 z-50 animate-fade-in-down">
                    <div className="pl-4 pr-3 border-r border-gray-200 flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{selectedUnits.size}</span>
                        <button onClick={() => setSelectedUnits(new Set())} className="text-xs text-red-500 hover:underline">Bỏ chọn</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleMarkPaid('paid_tm')} disabled={isLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 text-xs font-bold"><BanknotesIcon className="w-4 h-4"/> Thu TM</button>
                        <button onClick={() => handleMarkPaid('paid_ck')} disabled={isLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold"><CreditCardIcon className="w-4 h-4"/> Thu CK</button>
                        <button onClick={() => handleMarkPaid('pending')} disabled={isLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-bold"><ArrowUturnLeftIcon className="w-4 h-4"/> Hủy thu</button>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                        <button onClick={() => handleBroadcastNotification()} disabled={isLoading} className="p-2 rounded-full hover:bg-cyan-50 text-cyan-600" title="Gửi App"><PaperAirplaneIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleBulkSendEmail()} disabled={isLoading} className="p-2 rounded-full hover:bg-indigo-50 text-indigo-600" title="Gửi Email"><EnvelopeIcon className="w-5 h-5"/></button>
                        <button onClick={handleDownloadPDFs} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-100 text-gray-700" title="Tải PDF"><PrinterIcon className="w-5 h-5"/></button>
                    </div>
                    <div className="pl-2 border-l border-gray-200 pr-2">
                        <button onClick={handleDeleteBulk} disabled={isLoading} className="p-2 rounded-full hover:bg-red-50 text-red-600" title="Xóa"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                </div>
            )}

            {previewCharge && (
                <NoticePreviewModal 
                    charge={previewCharge} 
                    onClose={() => setPreviewCharge(null)} 
                    invoiceSettings={invoiceSettings} 
                    allData={allData} 
                    onSendEmail={() => handleBulkSendEmail(previewCharge.UnitID)}
                />
            )}
        </div>
    );
};

export default BillingPage;
