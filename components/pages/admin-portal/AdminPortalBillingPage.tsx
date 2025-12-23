
import React, { useMemo, useState } from 'react';
import type { ChargeRaw, Unit, Owner } from '../../../types';
import { 
    SearchIcon, BanknotesIcon, CheckCircleIcon, ClockIcon, 
    ChevronRightIcon, XMarkIcon, BellIcon, HomeIcon,
    DropletsIcon, CarIcon, ReceiptIcon, ArrowPathIcon
} from '../../ui/Icons';
import { formatCurrency, getPastelColorForName, parseUnitCode } from '../../../utils/helpers';
import BottomSheet from '../../ui/BottomSheet';

interface AdminPortalBillingPageProps {
    charges?: ChargeRaw[];
    units?: Unit[];
    owners?: Owner[];
}

const AdminPortalBillingPage: React.FC<AdminPortalBillingPageProps> = ({ charges = [], units = [], owners = [] }) => {
    const [search, setSearch] = useState('');
    const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
    const [selectedCharge, setSelectedCharge] = useState<ChargeRaw | null>(null);

    const displayPeriod = useMemo(() => {
        if (!charges || charges.length === 0) return new Date().toISOString().slice(0, 7);
        const periods = Array.from(new Set(charges.map(c => c.Period))).sort().reverse();
        return periods[0]; 
    }, [charges]);

    const currentPeriodCharges = useMemo(() => {
        return (charges || []).filter(c => c.Period === displayPeriod);
    }, [charges, displayPeriod]);

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

    const filtered = useMemo(() => {
        const s = search.toLowerCase().trim();
        let result = currentPeriodCharges;
        if (showUnpaidOnly) result = result.filter(c => !['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus));
        if (s) result = result.filter(c => c.UnitID.toLowerCase().includes(s) || (c.OwnerName || '').toLowerCase().includes(s));
        return result.sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 0, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 0, apt: 0 };
            return pa.floor !== pb.floor ? pa.floor - pb.floor : pa.apt - pb.apt;
        });
    }, [currentPeriodCharges, search, showUnpaidOnly]);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'paid':
            case 'paid_tm':
            case 'paid_ck':
                return { label: 'ĐÃ THU', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
            case 'reconciling':
                return { label: 'CHỜ DUYỆT', classes: 'bg-amber-100 text-amber-700 border-amber-200' };
            default:
                return { label: 'CHƯA NỘP', classes: 'bg-rose-100 text-rose-700 border-rose-200' };
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Stats Header */}
            <div className="p-4 grid grid-cols-1 gap-3 sticky top-0 bg-slate-50 z-20 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Thực thu T{displayPeriod.split('-')[1]}</p>
                        <p className="text-base font-black text-emerald-600 leading-none tabular-nums">{formatCurrency(stats.totalPaid)}</p>
                    </div>

                    <div 
                        onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
                        className={`p-3.5 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex flex-col justify-between ${
                            showUnpaidOnly ? 'bg-rose-600 border-rose-700 ring-4 ring-rose-100' : 'bg-white border-gray-100'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${showUnpaidOnly ? 'text-white' : 'text-gray-400'}`}>Công nợ</p>
                            <p className={`text-[10px] font-black px-1.5 py-0.5 rounded ${showUnpaidOnly ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                {stats.totalUnitsCount - stats.paidUnitsCount} Căn
                            </p>
                        </div>
                        <p className={`text-sm font-black leading-none tabular-nums ${showUnpaidOnly ? 'text-white' : 'text-rose-600'}`}>
                            {formatCurrency(stats.totalDue - stats.totalPaid)}
                        </p>
                    </div>
                </div>

                <div className="relative group">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm Căn hộ, Chủ hộ..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-10 py-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 outline-none text-sm font-bold transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* List View */}
            <div className="px-4 pb-24 space-y-2 pt-2">
                {filtered.map(charge => {
                    const theme = getPastelColorForName(charge.UnitID);
                    const status = getStatusInfo(charge.paymentStatus);
                    const isUnpaid = !['paid', 'paid_tm', 'paid_ck'].includes(charge.paymentStatus);

                    return (
                        <div 
                            key={charge.UnitID} 
                            onClick={() => setSelectedCharge(charge)}
                            className="bg-white p-3 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all border border-transparent active:border-primary/20"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border-2 ${theme.bg} ${theme.text} ${theme.border} bg-white shadow-sm`}>
                                    {charge.UnitID}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-gray-800 truncate">{charge.OwnerName}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-xs font-black tabular-nums ${isUnpaid ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(charge.TotalDue)}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border tracking-wider ${status.classes}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {isUnpaid && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); alert('Gửi nhắc nợ cho ' + charge.UnitID); }}
                                        className="p-3 bg-primary/5 text-primary rounded-xl active:bg-primary/20 transition-all"
                                    >
                                        <BellIcon className="w-5 h-5" />
                                    </button>
                                )}
                                <ChevronRightIcon className="w-5 h-5 text-gray-100" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Billing Breakdown Bottom Sheet */}
            <BottomSheet 
                isOpen={!!selectedCharge} 
                onClose={() => setSelectedCharge(null)} 
                title={`Chi tiết phí: ${selectedCharge?.UnitID}`}
            >
                {selectedCharge && (
                    <div className="space-y-6">
                        {/* Summary Block */}
                        <div className="text-center py-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tổng phí T{selectedCharge.Period.split('-')[1]}</p>
                            <h2 className="text-4xl font-black text-gray-900 tabular-nums tracking-tighter">
                                {formatCurrency(selectedCharge.TotalDue)}
                            </h2>
                            <div className="flex justify-center mt-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${getStatusInfo(selectedCharge.paymentStatus).classes}`}>
                                    {getStatusInfo(selectedCharge.paymentStatus).label}
                                </span>
                            </div>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-3">
                            <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Phân bổ khoản thu</h5>
                            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-4 flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><HomeIcon className="w-5 h-5"/></div>
                                        <span className="text-sm font-bold text-gray-700">Phí dịch vụ</span>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">{formatCurrency(selectedCharge.ServiceFee_Total)}</span>
                                </div>
                                <div className="p-4 flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><CarIcon className="w-5 h-5"/></div>
                                        <span className="text-sm font-bold text-gray-700">Phí gửi xe</span>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">{formatCurrency(selectedCharge.ParkingFee_Total)}</span>
                                </div>
                                <div className="p-4 flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl"><DropletsIcon className="w-5 h-5"/></div>
                                        <span className="text-sm font-bold text-gray-700">Tiền nước</span>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">{formatCurrency(selectedCharge.WaterFee_Total)}</span>
                                </div>
                                {selectedCharge.Adjustments !== 0 && (
                                    <div className="p-4 flex items-center justify-between bg-purple-50/30">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl"><ReceiptIcon className="w-5 h-5"/></div>
                                            <span className="text-sm font-bold text-gray-700">Điều chỉnh</span>
                                        </div>
                                        <span className={`text-sm font-black tabular-nums ${selectedCharge.Adjustments < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {formatCurrency(selectedCharge.Adjustments)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                            {!['paid', 'paid_tm', 'paid_ck'].includes(selectedCharge.paymentStatus) ? (
                                <button className="py-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                    <CheckCircleIcon className="w-5 h-5" /> Xác nhận thu tiền
                                </button>
                            ) : (
                                <button className="py-4 bg-gray-100 text-gray-500 text-xs font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2">
                                    <ArrowPathIcon className="w-5 h-5" /> Hoàn tác thu tiền
                                </button>
                            )}
                            <button className="py-4 bg-primary/10 text-primary text-xs font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <BanknotesIcon className="w-5 h-5" /> Xem phiếu thu (PDF)
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
};

export default AdminPortalBillingPage;
