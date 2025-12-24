
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { 
    BanknotesIcon, CarIcon, DropletsIcon, 
    MegaphoneIcon, WarningIcon, CheckCircleIcon, TrendingUpIcon,
    ChevronRightIcon, ClockIcon, SearchIcon, XMarkIcon,
    UserIcon, PhoneArrowUpRightIcon, ChevronDownIcon, ChevronUpIcon,
    MotorbikeIcon, BikeIcon, EBikeIcon, HomeIcon, ShieldCheckIcon,
    TrendingDownIcon, SparklesIcon
} from '../../ui/Icons';
import { formatCurrency, formatNumber, getPastelColorForName, translateVehicleType } from '../../../utils/helpers';
import type { Unit, Vehicle, ChargeRaw, MonthlyStat, NewsItem, WaterReading, Owner, MiscRevenue, OperationalExpense } from '../../../types';
import { AdminPortalPage } from '../../layout/AdminMobileLayout';

interface AdminPortalHomePageProps {
    units?: Unit[];
    vehicles?: Vehicle[];
    charges?: ChargeRaw[];
    monthlyStats?: MonthlyStat[];
    news?: NewsItem[];
    waterReadings?: WaterReading[];
    owners?: Owner[];
    miscRevenues?: MiscRevenue[];
    expenses?: OperationalExpense[];
    onNavigate?: (page: AdminPortalPage) => void;
}

const getStatusVN = (status: string) => {
    switch (status) {
        case 'Owner': return 'Chính chủ';
        case 'Rent': return 'Hộ thuê';
        case 'Business': return 'Kinh doanh';
        default: return status;
    }
};

const getVehicleIcon = (type: string) => {
    if (type === 'car' || type === 'car_a') return <CarIcon className="w-5 h-5" />;
    if (type === 'motorbike') return <MotorbikeIcon className="w-5 h-5" />;
    if (type === 'ebike') return <EBikeIcon className="w-5 h-5" />;
    if (type === 'bicycle') return <BikeIcon className="w-5 h-5" />;
    return <CarIcon className="w-5 h-5" />;
};

const StatCard: React.FC<{ label: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string; bgColor: string; onClick?: () => void }> = ({ label, value, subValue, icon, color, bgColor, onClick }) => (
    <div onClick={onClick} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between active:scale-[0.98] transition-transform ${onClick ? 'cursor-pointer' : ''}`}>
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2.5 rounded-xl ${bgColor} ${color} shadow-sm`}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
            </div>
            {subValue && (
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{subValue}</span>
                </div>
            )}
        </div>
        <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-base font-black text-gray-800 truncate">{value}</p>
        </div>
    </div>
);

const AdminPortalHomePage: React.FC<AdminPortalHomePageProps> = ({ 
    units = [], 
    vehicles = [], 
    charges = [], 
    monthlyStats = [], 
    news = [], 
    waterReadings = [],
    owners = [],
    miscRevenues = [],
    expenses = [],
    onNavigate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    
    const stats = useMemo(() => {
        const periodCharges = charges.filter(c => c.Period === currentPeriod);
        const totalDue = periodCharges.reduce((s, c) => s + (c.TotalDue || 0), 0);
        const totalPaid = periodCharges.reduce((s, c) => s + (c.TotalPaid || 0), 0);
        const paidCount = periodCharges.filter(c => ['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)).length;
        const totalUnits = units.length || 0;
        
        const vasTotal = miscRevenues.reduce((sum, r) => sum + r.amount, 0);
        const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
        
        return { totalDue, totalPaid, paidCount, totalUnits, vasTotal, expenseTotal };
    }, [units, vehicles, charges, currentPeriod, miscRevenues, expenses]);

    const searchResults = useMemo(() => {
        if (searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();
        const results: any[] = [];
        
        const matchedUnits = units.filter(u => {
            const owner = owners.find(o => o.OwnerID === u.OwnerID);
            return u.UnitID.toLowerCase().includes(q) || (owner?.OwnerName || '').toLowerCase().includes(q);
        });

        matchedUnits.forEach(u => {
            const owner = owners.find(o => o.OwnerID === u.OwnerID);
            const unitVehicles = vehicles.filter(v => v.UnitID === u.UnitID && v.isActive);
            results.push({ type: 'unit', id: `unit_${u.UnitID}`, targetId: u.UnitID, owner, unit: u, vehicles: unitVehicles });
        });

        const matchedVehicles = vehicles.filter(v => 
            v.isActive && 
            v.PlateNumber.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').includes(q.replace(/[^a-zA-Z0-9]/g, '')) &&
            !matchedUnits.some(u => u.UnitID === v.UnitID)
        );

        matchedVehicles.forEach(v => {
            const unit = units.find(u => u.UnitID === v.UnitID);
            const owner = owners.find(o => o.OwnerID === unit?.OwnerID);
            results.push({ type: 'vehicle', id: `veh_${v.VehicleId}`, targetId: v.VehicleId, vehicle: v, unit, owner });
        });

        return results.slice(0, 10);
    }, [searchQuery, units, owners, vehicles]);

    const handleJumpToDetail = (page: AdminPortalPage, targetId: string) => {
        localStorage.setItem('admin_portal_focus_id', targetId);
        onNavigate?.(page);
    };

    const chartData = useMemo(() => {
        return monthlyStats.slice(-6).map(s => ({
            name: s.period ? `T${s.period.split('-')[1]}` : '---',
            val: Math.round((s.totalDue || 0) / 1000000)
        }));
    }, [monthlyStats]);

    return (
        <div className="p-4 space-y-5">
            <div className="grid grid-cols-2 gap-3 shrink-0">
                <StatCard label="Thực thu tháng" value={formatCurrency(stats.totalPaid)} subValue={formatCurrency(stats.totalDue)} icon={<BanknotesIcon />} color="text-emerald-600" bgColor="bg-emerald-50" onClick={() => onNavigate?.('adminPortalBilling')} />
                <StatCard label="Tiến độ thu" value={`${Math.round((stats.paidCount / (stats.totalUnits || 1)) * 100)}%`} subValue={`${stats.paidCount}/${stats.totalUnits}`} icon={<CheckCircleIcon />} color="text-primary" bgColor="bg-primary/10" onClick={() => onNavigate?.('adminPortalBilling')} />
                {/* Cập nhật điều hướng trực tiếp bên dưới */}
                <StatCard label="Doanh thu GTGT" value={formatCurrency(stats.vasTotal)} icon={<SparklesIcon />} color="text-amber-600" bgColor="bg-amber-50" onClick={() => onNavigate?.('adminPortalVAS')} />
                <StatCard label="Chi phí VH" value={formatCurrency(stats.expenseTotal)} icon={<TrendingDownIcon />} color="text-rose-600" bgColor="bg-rose-50" onClick={() => onNavigate?.('adminPortalExpenses')} />
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest flex items-center gap-2 mb-5">
                    <TrendingUpIcon className="w-4 h-4 text-emerald-500"/> Doanh thu 6 tháng (Tr. VNĐ)
                </h3>
                <div className="h-40 w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: '900', fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={5} />
                            <YAxis hide />
                            <Tooltip cursor={{fill: '#f8fafc', radius: 4}} content={({ active, payload }) => active && payload?.[0] ? <div className="bg-gray-900 text-white px-2 py-1 rounded-lg text-[9px] font-black shadow-xl">{payload[0].value} TRIỆU</div> : null} />
                            <Bar dataKey="val" fill="#006f3a" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-primary/20 overflow-hidden ring-4 ring-primary/5">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-primary w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm Căn hộ, Biển số xe..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setExpandedResultId(null); }}
                        className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all font-bold"
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setExpandedResultId(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {searchQuery.length >= 2 && (
                    <div className="mt-3 divide-y divide-gray-50 border-t border-gray-50 -mx-4 -mb-4">
                        {searchResults.length > 0 ? searchResults.map(res => {
                            const isExpanded = expandedResultId === res.id;
                            const theme = getPastelColorForName(res.targetId || 'HUD3');
                            const vType = res.type === 'vehicle' ? res.vehicle?.Type : '';
                            const isCar = vType === 'car' || vType === 'car_a';
                            
                            return (
                                <div key={res.id} className={`transition-all ${isExpanded ? 'bg-slate-50 shadow-inner' : 'bg-white'}`}>
                                    <button 
                                        onClick={() => setExpandedResultId(isExpanded ? null : res.id)}
                                        className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-100 transition-colors"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-transform ${
                                            isExpanded ? 'scale-110 shadow-sm' : ''
                                        } ${theme.bg} ${theme.text} ${theme.border}`}>
                                            {res.type === 'unit' ? res.targetId : getVehicleIcon(vType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-800 truncate">
                                                {res.type === 'unit' ? res.owner?.OwnerName : res.vehicle?.PlateNumber}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                                {res.type === 'unit' ? `Căn hộ ${res.targetId}` : `${translateVehicleType(res.vehicle?.Type)} • Căn ${res.unit?.UnitID}`}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-gray-300" /> : <ChevronDownIcon className="w-4 h-4 text-gray-300" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 animate-fade-in-down">
                                            <div className="space-y-3 pt-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <a href={`tel:${res.owner?.Phone}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 text-blue-600">
                                                        <PhoneArrowUpRightIcon className="w-4 h-4" />
                                                        <span className="text-xs font-black">{res.owner?.Phone || '---'}</span>
                                                    </a>
                                                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 text-gray-700">
                                                        <HomeIcon className="w-4 h-4" />
                                                        <span className="text-xs font-black truncate">{res.type === 'unit' ? getStatusVN(res.unit?.Status) : `Căn ${res.unit?.UnitID}`}</span>
                                                    </div>
                                                </div>

                                                {res.type === 'vehicle' && (
                                                    <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Trạng thái lốt</span>
                                                            <span className={`text-xs font-black ${isCar ? 'text-primary' : 'text-gray-400'}`}>
                                                                {isCar ? (res.vehicle?.parkingStatus || 'Không lốt') : 'N/A'}
                                                            </span>
                                                        </div>
                                                        {isCar && res.vehicle?.documents?.vehiclePhoto?.url && (
                                                            <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 aspect-video bg-gray-50">
                                                                <img src={res.vehicle.documents.vehiclePhoto.url} alt="Xe" className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => handleJumpToDetail(res.type === 'unit' ? 'adminPortalResidents' : 'adminPortalVehicles', res.targetId)}
                                                    className="w-full mt-1 py-2.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-md active:bg-primary-focus transition-all flex items-center justify-center gap-2"
                                                >
                                                    CHI TIẾT <ChevronRightIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : <p className="text-xs text-gray-400 text-center py-8 italic">Không tìm thấy kết quả.</p>}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest">Việc cần xử lý</h3>
                </div>
                <div className="p-4 space-y-4 text-gray-700">
                    <div className="flex items-center gap-4 group">
                        <div className="shrink-0 w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 text-red-500"><WarningIcon className="w-4 h-4" /></div>
                        <span className="text-xs font-bold flex-1">{Math.max(0, units.length - waterReadings.filter(r => r.Period === currentPeriod).length)} căn chưa chốt nước</span>
                        <ChevronRightIcon className="w-3 h-3 text-gray-300" />
                    </div>
                    <div className="flex items-center gap-4 group" onClick={() => onNavigate?.('adminPortalVehicles')}>
                        <div className="shrink-0 w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 text-orange-500"><ClockIcon className="w-4 h-4" /></div>
                        <span className="text-xs font-bold flex-1">{vehicles.filter(v => v.parkingStatus === 'Xếp lốt').length} xe đang chờ lốt đỗ</span>
                        <ChevronRightIcon className="w-3 h-3 text-gray-300" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPortalHomePage;
