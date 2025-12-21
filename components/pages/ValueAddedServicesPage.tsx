
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    BanknotesIcon, CarIcon, StoreIcon, TrashIcon, 
    CalendarDaysIcon, PlusIcon, ClockIcon,
    DocumentArrowDownIcon, ChevronUpIcon, ChevronDownIcon,
    ChevronLeftIcon, ChevronRightIcon
} from '../ui/Icons';
import { formatCurrency } from '../../utils/helpers';
import { useNotification, useAuth } from '../../App';
import { addMiscRevenue, getMiscRevenues, getMonthlyMiscRevenues, deleteMiscRevenue } from '../../services';
import type { MiscRevenue, MiscRevenueType } from '../../types';
import Spinner from '../ui/Spinner';

// Declare SheetJS global
declare const XLSX: any;

// --- Local Icons ---
const PercentIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 14.25 6-6m4.5-3.493V21.75l-3.75-2.25-3.75 2.25-3.75-2.25-3.75 2.25V3.75c0-1.105.895-2 2-2h12c1.105 0 2 .895 2 2Z" />
    </svg>
);

const PiggyBankIconLocal: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

// --- Helpers for formatting ---
const formatInputNumber = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return Number(raw).toLocaleString('vi-VN');
};

const parseInputNumber = (val: string) => {
    return parseInt(val.replace(/\D/g, "")) || 0;
};

// --- Custom Date Picker Popover ---
const DatePickerPopover: React.FC<{
    selectedDate: string;
    onSelect: (date: string) => void;
    onClose: () => void;
}> = ({ selectedDate, onSelect, onClose }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const date = new Date(selectedDate);
    const [viewMonth, setViewMonth] = useState(date.getMonth());
    const [viewYear, setViewYear] = useState(date.getFullYear());

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    // Adjust for Monday start if desired, but 0-6 is standard. 
    // We'll use a simple grid.
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    const handleMonthNav = (dir: number) => {
        let newMonth = viewMonth + dir;
        let newYear = viewYear;
        if (newMonth < 0) { newMonth = 11; newYear--; }
        else if (newMonth > 11) { newMonth = 0; newYear++; }
        setViewMonth(newMonth);
        setViewYear(newYear);
    };

    return (
        <div ref={popoverRef} className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72 animate-fade-in-down">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => handleMonthNav(-1)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeftIcon className="w-4 h-4"/></button>
                <div className="text-sm font-black text-gray-800 uppercase tracking-tight">
                    {months[viewMonth]} {viewYear}
                </div>
                <button onClick={() => handleMonthNav(1)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map(d => (
                    <span key={d} className="text-[10px] font-black text-gray-400">{d}</span>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {blanks.map(b => <div key={`b-${b}`} />)}
                {days.map(d => {
                    const fullDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = fullDateStr === selectedDate;
                    const isToday = fullDateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                        <button
                            key={d}
                            onClick={() => { onSelect(fullDateStr); onClose(); }}
                            className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center
                                ${isSelected ? 'bg-primary text-white shadow-md shadow-primary/20 scale-110' : 
                                  isToday ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
                <button 
                    onClick={() => { onSelect(new Date().toISOString().split('T')[0]); onClose(); }}
                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                    Quay về hôm nay
                </button>
            </div>
        </div>
    );
};

// --- Input Card Component ---
const InputCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    colorClass: string;
    children: React.ReactNode;
    onAdd: () => void;
    actionLabel?: string;
    loading?: boolean;
    isCollapsed?: boolean;
    typeTotal: number;
}> = ({ title, icon, colorClass, children, onAdd, actionLabel = "Thêm", loading, isCollapsed, typeTotal }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300 ${isCollapsed ? 'max-h-11 border-transparent shadow-none' : 'max-h-96 shadow-md'}`}>
        <div className={`px-3 py-2 ${colorClass} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
                <div className={`p-1 bg-white/20 rounded text-white transition-transform ${isCollapsed ? 'scale-75' : ''}`}>
                    {React.cloneElement(icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
                </div>
                <div>
                    <h3 className={`font-bold text-white uppercase tracking-wider transition-all ${isCollapsed ? 'text-[8px]' : 'text-[10px]'}`}>{title}</h3>
                    {isCollapsed && typeTotal > 0 && (
                        <p className="text-[10px] font-black text-white/90 leading-none animate-fade-in-down tabular-nums">{formatCurrency(typeTotal)}</p>
                    )}
                </div>
            </div>
            {isCollapsed && !loading && (
                <button onClick={onAdd} className="p-1 hover:bg-white/20 rounded-full text-white">
                    <PlusIcon className="w-3 h-3" />
                </button>
            )}
        </div>
        
        <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 scale-95 pointer-events-none h-0' : 'opacity-100 scale-100 p-3 h-auto'}`}>
            <div className="space-y-2.5 mb-3">
                {children}
            </div>
            <button 
                onClick={onAdd}
                disabled={loading}
                className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 ${colorClass} text-white hover:brightness-90 active:scale-95 disabled:opacity-50`}
            >
                {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlusIcon className="w-3 h-3" />}
                {actionLabel}
            </button>
        </div>
    </div>
);

const ValueAddedServicesPage: React.FC = () => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);
    
    // --- State ---
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyRevenues, setDailyRevenues] = useState<MiscRevenue[]>([]);
    const [monthlyRevenues, setMonthlyRevenues] = useState<MiscRevenue[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState<MiscRevenueType | 'PARKING_BTN' | null>(null);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    // Form States
    const [parkingMoto, setParkingMoto] = useState('');
    const [parkingCar, setParkingCar] = useState('');
    const [kioskName, setKioskName] = useState('');
    const [kioskAmount, setKioskAmount] = useState('');
    const [vasName, setVasName] = useState('');
    const [vasAmount, setVasAmount] = useState('');
    const [otherName, setOtherName] = useState('');
    const [otherAmount, setOtherAmount] = useState('');

    const typeLabels: Record<MiscRevenueType, string> = {
        PARKING: 'Xe lượt',
        KIOS: 'Kios',
        VAT_SERVICE: 'GTGT',
        OTHER: 'Khác'
    };

    // --- Data Loading ---
    const fetchData = async (date: string) => {
        setIsLoading(true);
        try {
            const [daily, monthly] = await Promise.all([
                getMiscRevenues(date),
                getMonthlyMiscRevenues(date.substring(0, 7))
            ]);
            setDailyRevenues(daily);
            setMonthlyRevenues(monthly);
        } catch (error) {
            showToast('Lỗi tải dữ liệu.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedDate);
    }, [selectedDate]);

    // --- Handlers ---
    const handleAddRevenue = async (type: MiscRevenueType, amountStr: string, description: string) => {
        const amount = parseInputNumber(amountStr);
        if (amount <= 0 || !description.trim()) {
            showToast('Vui lòng nhập đầy đủ nội dung và số tiền.', 'warn');
            return;
        }
        setIsSubmitting(type);
        try {
            const payload = { type, amount, description, date: selectedDate, createdBy: user?.Email || 'system' };
            const id = await addMiscRevenue(payload);
            const newItem = { ...payload, id, createdAt: new Date().toISOString() };
            setDailyRevenues(prev => [newItem, ...prev]);
            setMonthlyRevenues(prev => [newItem, ...prev]);
            showToast('Đã thêm thành công.', 'success');
            if (type === 'KIOS') { setKioskName(''); setKioskAmount(''); }
            if (type === 'VAT_SERVICE') { setVasName(''); setVasAmount(''); }
            if (type === 'OTHER') { setOtherName(''); setOtherAmount(''); }
        } catch (error) { showToast('Lỗi khi lưu.', 'error'); } finally { setIsSubmitting(null); }
    };

    const handleParkingSave = async () => {
        const moto = parseInputNumber(parkingMoto);
        const car = parseInputNumber(parkingCar);
        const total = moto + car;
        if (total <= 0) { showToast('Nhập doanh thu gửi xe.', 'warn'); return; }
        setIsSubmitting('PARKING_BTN' as any);
        try {
            const payload = { type: 'PARKING' as MiscRevenueType, amount: total, description: `Xe máy: ${formatCurrency(moto)} | Ô tô: ${formatCurrency(car)}`, date: selectedDate, createdBy: user?.Email || 'system' };
            const id = await addMiscRevenue(payload);
            const newItem = { ...payload, id, createdAt: new Date().toISOString() };
            setDailyRevenues(prev => [newItem, ...prev]);
            setMonthlyRevenues(prev => [newItem, ...prev]);
            showToast('Đã lưu doanh thu xe.', 'success');
            setParkingMoto(''); setParkingCar('');
        } catch (error) { showToast('Lỗi.', 'error'); } finally { setIsSubmitting(null); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xác nhận xóa khoản thu?')) return;
        try {
            await deleteMiscRevenue(id);
            setDailyRevenues(prev => prev.filter(r => r.id !== id));
            setMonthlyRevenues(prev => prev.filter(r => r.id !== id));
            showToast('Đã xóa.', 'success');
        } catch (error) { showToast('Lỗi.', 'error'); }
    };

    const navigateDay = (direction: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + direction);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleExport = () => {
        if (monthlyRevenues.length === 0) { showToast('Không có dữ liệu tháng này.', 'info'); return; }

        try {
            const wb = XLSX.utils.book_new();
            const monthLabel = selectedDate.substring(0, 7);

            const summaryData = monthlyRevenues.map((r, i) => ({
                STT: i + 1,
                'Ngày': r.date,
                'Giờ': new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                'Phân loại': typeLabels[r.type] || r.type,
                'Nội dung': r.description,
                'Số tiền': r.amount,
                'Người tạo': r.createdBy
            }));
            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng hợp Tháng");

            XLSX.writeFile(wb, `Bao_cao_VAS_Thang_${monthLabel}.xlsx`);
            showToast('Xuất báo cáo tháng thành công.', 'success');
        } catch (error) {
            showToast('Lỗi khi xuất file Excel.', 'error');
        }
    };

    // --- Calculations ---
    const monthlyTotal = useMemo(() => monthlyRevenues.reduce((sum, r) => sum + r.amount, 0), [monthlyRevenues]);
    const getTypedDailyTotal = (type: MiscRevenueType) => dailyRevenues.filter(r => r.type === type).reduce((sum, r) => sum + r.amount, 0);

    const inputStyle = "w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-primary";
    const labelStyle = "text-[9px] font-black text-gray-400 uppercase ml-1 block mb-0.5";

    const formattedDate = useMemo(() => {
        const d = new Date(selectedDate);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }, [selectedDate]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/30">
            {/* 1. FIXED TOOLBAR */}
            <div className="flex-none bg-white/90 backdrop-blur-md z-20 p-3 border-b border-gray-100 sticky top-0 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    {/* Date Navigation & Dropdown Selection */}
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                        <button 
                            onClick={() => navigateDay(-1)}
                            className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-gray-500"
                            title="Ngày trước"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-800 outline-none hover:border-primary/30 transition-all min-w-[120px]"
                            >
                                <CalendarDaysIcon className="text-primary w-4 h-4" />
                                {formattedDate}
                                <ChevronDownIcon className={`w-3 h-3 ml-auto transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isDatePickerOpen && (
                                <DatePickerPopover 
                                    selectedDate={selectedDate} 
                                    onSelect={setSelectedDate} 
                                    onClose={() => setIsDatePickerOpen(false)} 
                                />
                            )}
                        </div>

                        <button 
                            onClick={() => navigateDay(1)}
                            className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-gray-500"
                            title="Ngày sau"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchData(selectedDate)} className="p-2 bg-gray-50 border border-gray-200 text-gray-400 rounded-xl hover:text-primary hover:bg-white transition-all shadow-sm" title="Làm mới">
                            <ClockIcon className="w-4 h-4" />
                        </button>
                        
                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 font-bold text-[10px] rounded-xl hover:bg-gray-50 uppercase tracking-wider transition-all shadow-sm"
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5 opacity-60" /> Export Tháng
                        </button>

                        <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-inner">
                            <div className="p-1 bg-emerald-600 rounded text-white flex-shrink-0">
                                <BanknotesIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-emerald-600/60 uppercase leading-none mb-0.5">Tổng thu tháng</span>
                                <span className="text-xs font-black text-emerald-700 leading-none tabular-nums">{formatCurrency(monthlyTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. SCROLLABLE CONTENT */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-smooth"
            >
                <div className="max-w-7xl mx-auto p-3 md:p-4 space-y-4 pb-20">
                    
                    {/* INPUT SECTION HEADER */}
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Nhập liệu doanh thu ngày {formattedDate}</h2>
                        <button 
                            onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-95"
                        >
                            {isManuallyCollapsed ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronUpIcon className="w-3.5 h-3.5" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {isManuallyCollapsed ? 'Mở rộng' : 'Thu nhỏ'}
                            </span>
                        </button>
                    </div>

                    {/* INPUT CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <InputCard title="Xe lượt" icon={<CarIcon />} colorClass="bg-blue-600" isCollapsed={isManuallyCollapsed} typeTotal={getTypedDailyTotal('PARKING')} actionLabel="Lưu" onAdd={handleParkingSave} loading={isSubmitting === 'PARKING_BTN' as any}>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelStyle}>Xe máy</label><input type="text" value={parkingMoto} onChange={e => setParkingMoto(formatInputNumber(e.target.value))} className={inputStyle} placeholder="0" /></div>
                                <div><label className={labelStyle}>Ô tô</label><input type="text" value={parkingCar} onChange={e => setParkingCar(formatInputNumber(e.target.value))} className={inputStyle} placeholder="0" /></div>
                            </div>
                        </InputCard>

                        <InputCard title="Kios" icon={<StoreIcon />} colorClass="bg-amber-600" isCollapsed={isManuallyCollapsed} typeTotal={getTypedDailyTotal('KIOS')} onAdd={() => handleAddRevenue('KIOS', kioskAmount, kioskName)} loading={isSubmitting === 'KIOS'}>
                            <div><label className={labelStyle}>Tên Kios</label><input type="text" value={kioskName} onChange={e => setKioskName(e.target.value)} className={inputStyle} placeholder="Kios 01..." /></div>
                            <div className="mt-2"><label className={labelStyle}>Số tiền</label><input type="text" value={kioskAmount} onChange={e => setKioskAmount(formatInputNumber(e.target.value))} className={inputStyle} placeholder="0" /></div>
                        </InputCard>

                        <InputCard title="GTGT" icon={<PercentIcon />} colorClass="bg-purple-600" isCollapsed={isManuallyCollapsed} typeTotal={getTypedDailyTotal('VAT_SERVICE')} onAdd={() => handleAddRevenue('VAT_SERVICE', vasAmount, vasName)} loading={isSubmitting === 'VAT_SERVICE'}>
                            <div><label className={labelStyle}>Nội dung</label><input type="text" value={vasName} onChange={e => setVasName(e.target.value)} className={inputStyle} placeholder="Dịch vụ..." /></div>
                            <div className="mt-2"><label className={labelStyle}>Số tiền</label><input type="text" value={vasAmount} onChange={e => setVasAmount(formatInputNumber(e.target.value))} className={inputStyle} placeholder="0" /></div>
                        </InputCard>

                        <InputCard title="Khác" icon={<PiggyBankIconLocal />} colorClass="bg-rose-600" isCollapsed={isManuallyCollapsed} typeTotal={getTypedDailyTotal('OTHER')} onAdd={() => handleAddRevenue('OTHER', otherAmount, otherName)} loading={isSubmitting === 'OTHER'}>
                            <div><label className={labelStyle}>Nội dung</label><input type="text" value={otherName} onChange={e => setOtherName(e.target.value)} className={inputStyle} placeholder="Nội dung khác..." /></div>
                            <div className="mt-2"><label className={labelStyle}>Số tiền</label><input type="text" value={otherAmount} onChange={e => setOtherAmount(formatInputNumber(e.target.value))} className={inputStyle} placeholder="0" /></div>
                        </InputCard>
                    </div>

                    {/* HISTORY TABLE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                        <table className="w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-10 bg-white shadow-sm ring-1 ring-black/5">
                                <tr className="text-left text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-5 py-3 w-20">Giờ</th>
                                    <th className="px-5 py-3 w-28">Loại hình</th>
                                    <th className="px-5 py-3">Nội dung</th>
                                    <th className="px-5 py-3 text-right w-36">Số tiền</th>
                                    <th className="px-5 py-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="py-20 text-center"><Spinner /></td></tr>
                                ) : dailyRevenues.length === 0 ? (
                                    <tr><td colSpan={5} className="py-32 text-center text-gray-300 font-bold uppercase tracking-widest text-[10px]">Chưa ghi nhận giao dịch ngày {formattedDate}</td></tr>
                                ) : (
                                    <>
                                        {dailyRevenues.map(rev => {
                                            const time = new Date(rev.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                            const colors: any = { 
                                                PARKING: 'bg-blue-100 text-blue-700', 
                                                KIOS: 'bg-amber-100 text-amber-700', 
                                                VAT_SERVICE: 'bg-purple-100 text-purple-700', 
                                                OTHER: 'bg-rose-100 text-rose-700' 
                                            };
                                            return (
                                                <tr key={rev.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-3.5 font-mono text-[10px] text-gray-400">{time}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase border border-current whitespace-nowrap ${colors[rev.type] || 'bg-gray-100'}`}>
                                                            {typeLabels[rev.type] || rev.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-700">{rev.description}</td>
                                                    <td className="px-5 py-3.5 text-right font-black text-gray-900 tabular-nums">{formatCurrency(rev.amount)}</td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <button onClick={() => handleDelete(rev.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* INLINE TOTAL */}
                                        <tr className="bg-emerald-50/30">
                                            <td colSpan={3} className="px-5 py-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    Tổng thu ngày {formattedDate}
                                                </div>
                                            </td>
                                            <td className="px-5 py-6 text-right">
                                                <p className="text-[10px] text-emerald-600/60 font-bold leading-none mb-1">{dailyRevenues.length} giao dịch</p>
                                                <p className="text-xl font-black text-emerald-700 tabular-nums leading-none tracking-tighter">{formatCurrency(dailyRevenues.reduce((sum, r) => sum + r.amount, 0))}</p>
                                            </td>
                                            <td></td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* BACK TO TOP */}
            <button 
                onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="fixed bottom-6 right-6 p-2.5 bg-primary text-white rounded-full shadow-lg hover:bg-primary-focus transition-all active:scale-90 z-50"
                title="Quay lại phía trên"
            >
                <ChevronUpIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default ValueAddedServicesPage;
