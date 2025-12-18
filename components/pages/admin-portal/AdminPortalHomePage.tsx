import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { 
    BanknotesIcon, CarIcon, DropletsIcon, 
    MegaphoneIcon, WarningIcon, CheckCircleIcon, TrendingUpIcon,
    MotorbikeIcon, ChevronRightIcon, ClockIcon
} from '../../ui/Icons';
import { formatCurrency, formatNumber } from '../../../utils/helpers';
import type { Unit, Vehicle, ChargeRaw, MonthlyStat, NewsItem, WaterReading } from '../../../types';

interface AdminPortalHomePageProps {
    units?: Unit[];
    vehicles?: Vehicle[];
    charges?: ChargeRaw[];
    monthlyStats?: MonthlyStat[];
    news?: NewsItem[];
    waterReadings?: WaterReading[];
}

const StatCard: React.FC<{ label: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string; bgColor: string }> = ({ label, value, subValue, icon, color, bgColor }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between active:scale-[0.98] transition-transform">
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2.5 rounded-xl ${bgColor} ${color} shadow-sm`}>
                {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
            </div>
            {subValue && (
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{subValue}</span>
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
    waterReadings = [] 
}) => {
    const currentPeriod = useMemo(() => new Date().toISOString().slice(0, 7), []);
    
    const stats = useMemo(() => {
        const periodCharges = (charges || []).filter(c => c.Period === currentPeriod);
        const totalDue = periodCharges.reduce((s, c) => s + (c.TotalDue || 0), 0);
        const totalPaid = periodCharges.reduce((s, c) => s + (c.TotalPaid || 0), 0);
        
        const paidCount = periodCharges.filter(c => ['paid', 'paid_tm', 'paid_ck'].includes(c.paymentStatus)).length;
        const totalUnits = (units && units.length > 0) ? units.length : 320;

        const activeVehicles = (vehicles || []).filter(v => v.isActive);
        const cars = activeVehicles.filter(v => v.Type.includes('car')).length;
        const motos = activeVehicles.filter(v => v.Type === 'motorbike' || v.Type === 'ebike').length;

        const waterConsumption = (waterReadings || [])
            .filter(r => r.Period === currentPeriod)
            .reduce((sum, r) => sum + (r.consumption || 0), 0);

        return { totalDue, totalPaid, paidCount, totalUnits, cars, motos, waterConsumption };
    }, [units, vehicles, charges, currentPeriod, waterReadings]);

    const chartData = useMemo(() => {
        const last6 = (monthlyStats || []).slice(-6);
        return last6.map(s => ({
            name: s.period ? `T${s.period.split('-')[1]}` : '---',
            val: Math.round((s.totalDue || 0) / 1000000)
        }));
    }, [monthlyStats]);

    const alerts = useMemo(() => {
        const recordedCount = (waterReadings || []).filter(r => r.Period === currentPeriod).length;
        const unrecordedWater = Math.max(0, stats.totalUnits - recordedCount);
        return [
            { text: `${unrecordedWater} căn hộ chưa chốt nước`, icon: <WarningIcon className="text-red-500"/>, type: 'critical' },
            { text: `${(vehicles || []).filter(v => v.parkingStatus === 'Xếp lốt').length} xe đang chờ lốt`, icon: <ClockIcon className="text-orange-500"/>, type: 'info' },
            { text: 'Phát hành thông báo phí mới', icon: <MegaphoneIcon className="text-blue-500"/>, type: 'action' }
        ];
    }, [stats, waterReadings, currentPeriod, vehicles]);

    return (
        <div className="p-4 space-y-5">
            {/* 1. StatCards 2x2 */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
                <StatCard 
                    label="Tài chính" 
                    value={formatCurrency(stats.totalPaid)} 
                    subValue={formatCurrency(stats.totalDue)}
                    icon={<BanknotesIcon />} 
                    color="text-emerald-600" 
                    bgColor="bg-emerald-50" 
                />
                <StatCard 
                    label="Tiến độ thu" 
                    value={`${Math.round((stats.paidCount / (stats.totalUnits || 1)) * 100)}%`} 
                    subValue={`${stats.paidCount}/${stats.totalUnits}`}
                    icon={<CheckCircleIcon />} 
                    color="text-primary" 
                    bgColor="bg-primary/10" 
                />
                <StatCard 
                    label="Xe Ôtô / Máy" 
                    value={`${stats.cars} / ${stats.motos}`} 
                    icon={<CarIcon />} 
                    color="text-blue-600" 
                    bgColor="bg-blue-50" 
                />
                <StatCard 
                    label="Nước sạch" 
                    value={`${formatNumber(stats.waterConsumption)} m³`} 
                    icon={<DropletsIcon />} 
                    color="text-cyan-600" 
                    bgColor="bg-cyan-50" 
                />
            </div>

            {/* 2. Revenue Chart (Sync with Desktop) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest flex items-center gap-2">
                        <TrendingUpIcon className="w-4 h-4 text-emerald-500"/> Doanh thu 6 tháng (Tr. VNĐ)
                    </h3>
                </div>
                <div className="h-44 w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 10, fontWeight: '900', fill: '#94a3b8'}} 
                                axisLine={false} 
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis hide />
                            <Tooltip 
                                cursor={{fill: '#f8fafc', radius: 4}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-gray-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-xl ring-2 ring-white/10">
                                                {payload[0].value} TRIỆU
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="val" fill="#006f3a" radius={[6, 6, 0, 0]} barSize={28} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Latest News */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest">Tin tức quản trị mới</h3>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                </div>
                <div className="divide-y divide-gray-50">
                    {(news || []).slice(0, 2).map(n => (
                        <div key={n.id} className="p-4 active:bg-gray-50 transition-colors">
                            <p className="font-black text-sm text-gray-800 line-clamp-1">{n.title}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                    n.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                }`}>
                                    {n.category}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter italic">
                                    {n.date ? new Date(n.date).toLocaleDateString('vi-VN') : '--'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {(news || []).length === 0 && <p className="p-8 text-center text-xs text-gray-400 italic">Chưa có bản tin mới.</p>}
                </div>
            </div>

            {/* 4. Alerts & To-Do */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest">Cảnh báo & Việc cần làm</h3>
                </div>
                <div className="p-5 space-y-4">
                    {alerts.map((alert, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                            <div className="shrink-0 w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center group-active:scale-90 transition-transform border border-gray-100">
                                {React.cloneElement(alert.icon as React.ReactElement, { className: 'w-4.5 h-4.5' })}
                            </div>
                            <span className="text-sm font-bold text-gray-700 flex-1">{alert.text}</span>
                            <ChevronRightIcon className="w-4 h-4 text-gray-200" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminPortalHomePage;
