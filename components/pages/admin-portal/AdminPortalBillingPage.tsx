
import React, { useMemo, useState } from 'react';
import type { ChargeRaw, Unit, Owner } from '../../../types';
import { 
    SearchIcon, BanknotesIcon, CheckCircleIcon, ClockIcon, 
    MagnifyingGlassIcon, ArrowPathIcon, ChevronRightIcon, XMarkIcon 
} from '../../ui/Icons';
import { formatCurrency, getPastelColorForName, parseUnitCode } from '../../../utils/helpers';

interface AdminPortalBillingPageProps {
    charges?: ChargeRaw[];
    units?: Unit[];
    owners?: Owner[];
}

const AdminPortalBillingPage: React.FC<AdminPortalBillingPageProps> = ({ charges = [], units = [], owners = [] }) => {
    const [search, setSearch] = useState('');
    const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

    // 1. Tự động xác định Kỳ (Period) hiển thị: Ưu tiên kỳ có dữ liệu mới nhất
    const displayPeriod = useMemo(() => {
        if (!charges || charges.length === 0) return new Date().toISOString().slice(0, 7);
        const periods = Array.from(new Set(charges.map(c => c.Period))).sort().reverse();
        return periods[0]; 
    }, [charges]);

    // 2. Lọc dữ liệu theo kỳ đã chọn
    const currentPeriodCharges = useMemo(() => {
        return (charges || []).filter(c => c.Period === displayPeriod);
    }, [charges, displayPeriod]);

    // 3. Logic Thống kê
    const stats = useMemo(() => {
        const totalDue = currentPeriodCharges.reduce((sum, c) => sum + (c.TotalDue || 0), 0);
        const totalPaid = currentPeriodCharges.reduce((sum, c) => sum + (c.TotalPaid || 0), 0);
        
        const totalUnitsCount = (units && units.length > 0) ? units.length : currentPeriodCharges.length;
        const paidUnitsCount = currentPeriodCharges.filter(c => 
            ['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)
        ).length;
        
        const progressPercent = totalUnitsCount > 0 ? (paidUnitsCount / totalUnitsCount) * 100 : 0;

        return { totalDue, totalPaid, totalUnitsCount, paidUnitsCount, progressPercent };
    }, [currentPeriodCharges, units]);

    // 4. Logic Tìm kiếm & Bộ lọc & Sắp xếp
    const filtered = useMemo(() => {
        const s = search.toLowerCase().trim();
        let result = currentPeriodCharges;

        if (showUnpaidOnly) {
            result = result.filter(c => !['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus));
        }

        if (s) {
            result = result.filter(c => 
                c.UnitID.toLowerCase().includes(s) || 
                (c.OwnerName || '').toLowerCase().includes(s)
            );
        }

        return result.sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 0, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 0, apt: 0 };
            if (pa.floor !== pb.floor) return pa.floor - pb.floor;
            return pa.apt - pb.apt;
        });
    }, [currentPeriodCharges, search, showUnpaidOnly]);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'paid':
            case 'paid_tm':
            case 'paid_ck':
                return { label: 'Đã thu', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
            case 'reconciling':
                return { label: 'Chờ duyệt', classes: 'bg-amber-100 text-amber-700 border-amber-200' };
            default:
                return { label: 'Chưa nộp', classes: 'bg-orange-100 text-orange-700 border-orange-200' };
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-4 grid grid-cols-1 gap-3 sticky top-0 bg-slate-50 z-20">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Thực thu / Phải thu</p>
                        <div className="space-y-0.5">
                            <p className="text-sm font-black text-emerald-600 leading-none">{formatCurrency(stats.totalPaid)}</p>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-400">trên</span>
                                <span className="text-[10px] font-bold text-gray-600">{formatCurrency(stats.totalDue)}</span>
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
                        className={`p-3.5 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex flex-col justify-between ${
                            showUnpaidOnly ? 'bg-primary border-primary ring-4 ring-primary/10' : 'bg-white border-gray-100'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${showUnpaidOnly ? 'text-white/80' : 'text-gray-400'}`}>Tiến độ thu</p>
                            <p className={`text-[10px] font-black px-1.5 py-0.5 rounded ${showUnpaidOnly ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                {stats.paidUnitsCount}/{stats.totalUnitsCount}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <div className={`w-full h-2 rounded-full overflow-hidden ${showUnpaidOnly ? 'bg-white/20' : 'bg-gray-100'}`}>
                                <div 
                                    className={`h-full transition-all duration-700 ease-out ${showUnpaidOnly ? 'bg-white' : 'bg-primary shadow-[0_0_8px_rgba(0,111,58,0.3)]'}`} 
                                    style={{ width: `${stats.progressPercent}%` }}
                                />
                            </div>
                            <p className={`text-[9px] font-bold text-right ${showUnpaidOnly ? 'text-white' : 'text-gray-400'}`}>
                                {showUnpaidOnly ? 'Đang hiện Căn chưa nộp' : `${Math.round(stats.progressPercent)}% đã nộp`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative group mt-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Tìm mã căn hộ (VD: 202, 1504...)" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4 pb-24 space-y-3">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <XMarkIcon className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-gray-400 text-sm italic px-10">
                            {showUnpaidOnly ? "Tất cả các căn đã nộp phí!" : "Không tìm thấy dữ liệu."}
                        </p>
                    </div>
                ) : (
                    filtered.map(charge => {
                        const theme = getPastelColorForName(charge.UnitID);
                        const status = getStatusInfo(charge.paymentStatus);

                        return (
                            <div 
                                key={charge.UnitID} 
                                className="bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm border-2 ${theme.bg} ${theme.text} ${theme.border} bg-white shadow-sm`}>
                                        {charge.UnitID}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800 line-clamp-1">{charge.OwnerName}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Tổng phí:</span>
                                            <span className="text-xs font-black text-gray-700">{formatCurrency(charge.TotalDue)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end gap-1.5">
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider shadow-sm ${status.classes}`}>
                                        {status.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AdminPortalBillingPage;
