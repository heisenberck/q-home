
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    BanknotesIcon, CarIcon, StoreIcon, TrashIcon, 
    CalendarDaysIcon, PlusIcon, ClockIcon,
    DocumentArrowDownIcon, ChevronUpIcon, ChevronDownIcon,
    ChevronLeftIcon, ChevronRightIcon,
    PercentIcon, PiggyBankIcon,
    MotorbikeIcon,
    ArchiveBoxIcon,
    CheckCircleIcon
} from '../ui/Icons';
import { formatCurrency } from '../../utils/helpers';
import { useNotification, useAuth } from '../../App';
import { addMiscRevenue, getMiscRevenues, getMonthlyMiscRevenues, deleteMiscRevenue } from '../../services';
import type { MiscRevenue, MiscRevenueType } from '../../types';
import Spinner from '../ui/Spinner';

declare const XLSX: any;

const formatInputNumber = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return Number(raw).toLocaleString('vi-VN');
};

const parseInputNumber = (val: string) => {
    return parseInt(val.replace(/\D/g, "")) || 0;
};

// --- Sub-Component: Mini Stat Card ---
const MiniStatCard: React.FC<{ 
    label: string; 
    value: number; 
    icon: React.ReactNode; 
    colorClass: string; 
}> = ({ label, value, icon, colorClass }) => (
    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
        <div className={`p-2 rounded-xl ${colorClass} text-white shadow-sm`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
        </div>
        <div className="min-w-0">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-sm font-black text-gray-800 leading-none truncate">{formatCurrency(value)}</p>
        </div>
    </div>
);

// --- Sub-Component: Date Picker Popover ---
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
        const handleClickOutside = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    const handleMonthNav = (dir: number) => {
        let newMonth = viewMonth + dir; let newYear = viewYear;
        if (newMonth < 0) { newMonth = 11; newYear--; } else if (newMonth > 11) { newMonth = 0; newYear++; }
        setViewMonth(newMonth); setViewYear(newYear);
    };

    return (
        <div ref={popoverRef} className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72 animate-fade-in-down">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => handleMonthNav(-1)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeftIcon className="w-4 h-4"/></button>
                <div className="text-sm font-black text-gray-800 uppercase tracking-tight">{months[viewMonth]} {viewYear}</div>
                <button onClick={() => handleMonthNav(1)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map(d => <span key={d} className="text-[10px] font-black text-gray-400">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{blanks.map(b => <div key={`b-${b}`} />)}{days.map(d => {
                const fsStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSelected = fsStr === selectedDate;
                const isToday = fsStr === new Date().toISOString().split('T')[0];
                return <button key={d} onClick={() => { onSelect(fsStr); onClose(); }} className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-primary text-white shadow-md' : isToday ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'hover:bg-gray-100 text-gray-600'}`}>{d}</button>;
            })}</div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center"><button onClick={() => { onSelect(new Date().toISOString().split('T')[0]); onClose(); }} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Quay về hôm nay</button></div>
        </div>
    );
};

const ValueAddedServicesPage: React.FC = () => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    
    // --- State Management ---
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyRevenues, setDailyRevenues] = useState<MiscRevenue[]>([]);
    const [monthlyRevenues, setMonthlyRevenues] = useState<MiscRevenue[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<MiscRevenueType>('PARKING');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs
    const [parkingMoto, setParkingMoto] = useState('');
    const [parkingCar, setParkingCar] = useState('');
    const [kioskName, setKioskName] = useState('');
    const [kioskAmount, setKioskAmount] = useState('');
    const [vasName, setVasName] = useState('');
    const [vasAmount, setVasAmount] = useState('');
    const [otherName, setOtherName] = useState('');
    const [otherAmount, setOtherAmount] = useState('');

    const typeLabels: Record<MiscRevenueType, string> = { PARKING: 'Xe lượt', KIOS: 'Kios', VAT_SERVICE: 'GTGT', OTHER: 'Khác' };
    const tabColors: Record<MiscRevenueType, string> = { PARKING: 'bg-blue-600', KIOS: 'bg-amber-500', VAT_SERVICE: 'bg-purple-600', OTHER: 'bg-rose-500' };

    const fetchData = async (date: string) => {
        setIsLoading(true);
        try {
            const [daily, monthly] = await Promise.all([getMiscRevenues(date), getMonthlyMiscRevenues(date.substring(0, 7))]);
            setDailyRevenues(daily); setMonthlyRevenues(monthly);
        } catch { showToast('Lỗi tải dữ liệu.', 'error'); } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(selectedDate); }, [selectedDate]);

    // --- Action Handlers ---
    const handleAddTransaction = async () => {
        let type = activeTab;
        let amount = 0;
        let description = '';

        if (type === 'PARKING') {
            const moto = parseInputNumber(parkingMoto);
            const car = parseInputNumber(parkingCar);
            amount = moto + car;
            description = `Xe máy: ${formatCurrency(moto)} | Ô tô: ${formatCurrency(car)}`;
            if (amount <= 0) { showToast('Vui lòng nhập doanh thu gửi xe.', 'warn'); return; }
        } else if (type === 'KIOS') {
            amount = parseInputNumber(kioskAmount);
            description = kioskName.trim();
        } else if (type === 'VAT_SERVICE') {
            amount = parseInputNumber(vasAmount);
            description = vasName.trim();
        } else if (type === 'OTHER') {
            amount = parseInputNumber(otherAmount);
            description = otherName.trim();
        }

        if (type !== 'PARKING' && (amount <= 0 || !description)) {
            showToast('Vui lòng nhập đầy đủ nội dung và số tiền.', 'warn'); return;
        }

        setIsSubmitting(true);
        try {
            const payload = { type, amount, description, date: selectedDate, createdBy: user?.Email || 'system' };
            const id = await addMiscRevenue(payload);
            const newItem = { ...payload, id, createdAt: new Date().toISOString() };
            setDailyRevenues(prev => [newItem, ...prev]); 
            setMonthlyRevenues(prev => [newItem, ...prev]);
            showToast('Đã thêm giao dịch thành công.', 'success');
            
            // Clear inputs
            if (type === 'PARKING') { setParkingMoto(''); setParkingCar(''); }
            else if (type === 'KIOS') { setKioskName(''); setKioskAmount(''); }
            else if (type === 'VAT_SERVICE') { setVasName(''); setVasAmount(''); }
            else if (type === 'OTHER') { setOtherName(''); setOtherAmount(''); }
        } catch { showToast('Lỗi khi lưu.', 'error'); } finally { setIsSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xác nhận xóa khoản thu này?')) return;
        try { 
            await deleteMiscRevenue(id); 
            setDailyRevenues(prev => prev.filter(r => r.id !== id)); 
            setMonthlyRevenues(prev => prev.filter(r => r.id !== id)); 
            showToast('Đã xóa giao dịch.', 'success'); 
        } catch { showToast('Lỗi khi xóa.', 'error'); }
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
            XLSX.utils.book_append_sheet(wb, wsSummary, "Doanh thu VAS"); 
            XLSX.writeFile(wb, `Bao_cao_VAS_Thang_${monthLabel}.xlsx`); 
            showToast('Xuất báo cáo thành công.', 'success');
        } catch { showToast('Lỗi khi xuất file Excel.', 'error'); }
    };

    // --- Compute Totals ---
    const monthlyTotal = useMemo(() => monthlyRevenues.reduce((sum, r) => sum + r.amount, 0), [monthlyRevenues]);
    const getTypedDailyTotal = (type: MiscRevenueType) => dailyRevenues.filter(r => r.type === type).reduce((sum, r) => sum + r.amount, 0);

    const inputLabelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block";
    const inputFieldStyle = "w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            {/* Header / Toolbar */}
            <div className="bg-white border-b border-gray-100 p-4 shrink-0 shadow-sm z-30">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-gray-100 p-1 rounded-xl flex items-center shadow-inner border border-gray-200">
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500"><ChevronLeftIcon className="w-4 h-4"/></button>
                            <div className="relative">
                                <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="px-4 py-2 text-xs font-black uppercase tracking-tight text-gray-800 flex items-center gap-2">
                                    <CalendarDaysIcon className="w-4 h-4 text-primary" />
                                    {new Date(selectedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    <ChevronDownIcon className="w-3 h-3 opacity-40" />
                                </button>
                                {isDatePickerOpen && <DatePickerPopover selectedDate={selectedDate} onSelect={setSelectedDate} onClose={() => setIsDatePickerOpen(false)} />}
                            </div>
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500"><ChevronRightIcon className="w-4 h-4"/></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
                            <DocumentArrowDownIcon className="w-4 h-4 opacity-40"/> Báo cáo tháng
                        </button>
                        <div className="h-10 px-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 shadow-inner">
                            <PiggyBankIcon className="w-5 h-5 text-emerald-600"/>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-emerald-600/60 uppercase leading-none mb-0.5">Tổng thu tháng</span>
                                <span className="text-sm font-black text-emerald-700 leading-none tabular-nums">{formatCurrency(monthlyTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Split View */}
            <div className="flex-1 overflow-hidden p-6 max-w-7xl mx-auto w-full flex gap-8">
                
                {/* LEFT COLUMN: INPUT STATION (1/3) */}
                <div className="w-1/3 flex flex-col gap-6 animate-fade-in-down h-full">
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-gray-100 flex flex-col h-full overflow-hidden">
                        {/* Tab Headers */}
                        <div className="grid grid-cols-4 border-b border-gray-50 bg-gray-50/50 p-1">
                            {(Object.keys(typeLabels) as MiscRevenueType[]).map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setActiveTab(type)}
                                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all gap-1 ${
                                        activeTab === type 
                                            ? `bg-white shadow-md text-gray-900 border border-gray-100` 
                                            : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    {type === 'PARKING' && <CarIcon className={`w-5 h-5 ${activeTab === type ? 'text-blue-600' : ''}`} />}
                                    {type === 'KIOS' && <StoreIcon className={`w-5 h-5 ${activeTab === type ? 'text-amber-500' : ''}`} />}
                                    {type === 'VAT_SERVICE' && <PercentIcon className={`w-5 h-5 ${activeTab === type ? 'text-purple-600' : ''}`} />}
                                    {type === 'OTHER' && <ArchiveBoxIcon className={`w-5 h-5 ${activeTab === type ? 'text-rose-500' : ''}`} />}
                                    <span className="text-[9px] font-black uppercase tracking-tight">{typeLabels[type]}</span>
                                </button>
                            ))}
                        </div>

                        {/* Form Content */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-2 h-2 rounded-full ${tabColors[activeTab]}`}></div>
                                <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Thêm {typeLabels[activeTab]}</h3>
                            </div>

                            {activeTab === 'PARKING' && (
                                <div className="space-y-4 animate-fade-in-down">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                                        <div className="p-2 bg-white rounded-lg shrink-0 h-fit text-blue-600 shadow-sm"><MotorbikeIcon className="w-5 h-5"/></div>
                                        <div className="flex-1">
                                            <label className={inputLabelStyle}>Doanh thu Xe máy</label>
                                            <input type="text" value={parkingMoto} onChange={e => setParkingMoto(formatInputNumber(e.target.value))} className={inputFieldStyle} placeholder="0 VNĐ" />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                                        <div className="p-2 bg-white rounded-lg shrink-0 h-fit text-blue-600 shadow-sm"><CarIcon className="w-5 h-5"/></div>
                                        <div className="flex-1">
                                            <label className={inputLabelStyle}>Doanh thu Ô tô</label>
                                            <input type="text" value={parkingCar} onChange={e => setParkingCar(formatInputNumber(e.target.value))} className={inputFieldStyle} placeholder="0 VNĐ" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'KIOS' && (
                                <div className="space-y-4 animate-fade-in-down">
                                    <div>
                                        <label className={inputLabelStyle}>Tên Kios / Cửa hàng</label>
                                        <input type="text" value={kioskName} onChange={e => setKioskName(e.target.value)} className={inputFieldStyle} placeholder="VD: Kios 05 - Circle K" />
                                    </div>
                                    <div>
                                        <label className={inputLabelStyle}>Số tiền thanh toán</label>
                                        <input type="text" value={kioskAmount} onChange={e => setKioskAmount(formatInputNumber(e.target.value))} className={inputFieldStyle} placeholder="0 VNĐ" />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'VAT_SERVICE' && (
                                <div className="space-y-4 animate-fade-in-down">
                                    <div>
                                        <label className={inputLabelStyle}>Loại dịch vụ gia tăng</label>
                                        <input type="text" value={vasName} onChange={e => setVasName(e.target.value)} className={inputFieldStyle} placeholder="VD: Phí sửa chữa điện nước" />
                                    </div>
                                    <div>
                                        <label className={inputLabelStyle}>Số tiền</label>
                                        <input type="text" value={vasAmount} onChange={e => setVasAmount(formatInputNumber(e.target.value))} className={inputFieldStyle} placeholder="0 VNĐ" />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'OTHER' && (
                                <div className="space-y-4 animate-fade-in-down">
                                    <div>
                                        <label className={inputLabelStyle}>Nội dung thu khác</label>
                                        <input type="text" value={otherName} onChange={e => setOtherName(e.target.value)} className={inputFieldStyle} placeholder="Nhập chi tiết nội dung..." />
                                    </div>
                                    <div>
                                        <label className={inputLabelStyle}>Số tiền</label>
                                        <input type="text" value={otherAmount} onChange={e => setOtherAmount(formatInputNumber(e.target.value))} className={inputFieldStyle} placeholder="0 VNĐ" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="p-6 border-t border-gray-50 shrink-0">
                            <button 
                                onClick={handleAddTransaction}
                                disabled={isSubmitting}
                                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 text-white ${tabColors[activeTab]} shadow-${tabColors[activeTab].split('-')[1]}/20 disabled:opacity-50`}
                            >
                                {isSubmitting ? <Spinner /> : <><PlusIcon className="w-5 h-5" /> Thêm khoản thu</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: HISTORY & STATS (2/3) */}
                <div className="w-2/3 flex flex-col gap-6 h-full overflow-hidden">
                    
                    {/* Top Row: Daily Summary Stats */}
                    <div className="grid grid-cols-4 gap-4 shrink-0">
                        <MiniStatCard label="Xe lượt" value={getTypedDailyTotal('PARKING')} icon={<CarIcon />} colorClass="bg-blue-600" />
                        <MiniStatCard label="Thu Kios" value={getTypedDailyTotal('KIOS')} icon={<StoreIcon />} colorClass="bg-amber-500" />
                        <MiniStatCard label="Dịch vụ GTGT" value={getTypedDailyTotal('VAT_SERVICE')} icon={<PercentIcon />} colorClass="bg-purple-600" />
                        <MiniStatCard label="Thu khác" value={getTypedDailyTotal('OTHER')} icon={<ArchiveBoxIcon />} colorClass="bg-rose-500" />
                    </div>

                    {/* Main Activity Area */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-400">
                                    <ClockIcon className="w-4 h-4"/>
                                </div>
                                <h3 className="font-black text-gray-800 text-[10px] uppercase tracking-widest">Hoạt động trong ngày</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tabular-nums">{dailyRevenues.length} giao dịch</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="py-20 flex justify-center"><Spinner /></div>
                            ) : dailyRevenues.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-4 opacity-60">
                                    <ArchiveBoxIcon className="w-16 h-16"/>
                                    <p className="font-black uppercase tracking-widest text-xs">Chưa có giao dịch nào</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-sm">
                                        <tr className="text-left text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                            <th className="px-6 py-3.5 w-24">Thời gian</th>
                                            <th className="px-6 py-3.5 w-32">Phân loại</th>
                                            <th className="px-6 py-3.5">Nội dung chi tiết</th>
                                            <th className="px-6 py-3.5 text-right w-40">Số tiền</th>
                                            <th className="px-6 py-3.5 w-12 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {dailyRevenues.map(rev => {
                                            const time = new Date(rev.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                            const colors: any = { 
                                                PARKING: 'bg-blue-50 text-blue-700 border-blue-100', 
                                                KIOS: 'bg-amber-50 text-amber-700 border-amber-100', 
                                                VAT_SERVICE: 'bg-purple-50 text-purple-700 border-purple-100', 
                                                OTHER: 'bg-rose-50 text-rose-700 border-rose-100' 
                                            };
                                            return (
                                                <tr key={rev.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400 font-bold">{time}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border whitespace-nowrap shadow-sm ${colors[rev.type]}`}>
                                                            {typeLabels[rev.type]}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-bold text-gray-700 leading-snug line-clamp-1">{rev.description}</p>
                                                        <p className="text-[9px] text-gray-400 font-medium mt-0.5 italic">{rev.createdBy.split('@')[0]}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-gray-900 tabular-nums">
                                                        {formatCurrency(rev.amount)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button 
                                                            onClick={() => handleDelete(rev.id)} 
                                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90 p-1.5 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Summary Footer for history panel */}
                        {!isLoading && dailyRevenues.length > 0 && (
                            <div className="bg-emerald-600 p-4 flex justify-between items-center text-white shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tổng thu ngày hôm nay</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-black tabular-nums tracking-tighter">
                                        {formatCurrency(dailyRevenues.reduce((sum, r) => sum + r.amount, 0))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValueAddedServicesPage;
