
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Unit, Vehicle, WaterReading, ChargeRaw, ActivityLog, Owner, FeedbackItem, MonthlyStat } from '../../types';
import { VehicleTier } from '../../types';
import {
    BuildingIcon, BanknotesIcon, CarIcon, DropletsIcon, ChatBubbleLeftEllipsisIcon,
    WarningIcon, ClockIcon, UserCircleIcon, ChatBubbleLeftRightIcon
} from '../ui/Icons';
import { getPreviousPeriod, timeAgo } from '../../utils/helpers';
import type { AdminPage } from '../../App';

// --- Local Components & Helpers ---

const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
    if (value === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${value / 1_000_000}tr`;
    if (value === 0) return '0';
    return `${value / 1_000}k`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    if (total === 0) return <div className="bg-white p-3 border rounded-lg shadow-lg text-sm"><p className="font-bold mb-1">{`Tháng ${label.replace('T', '')}`}</p><p className="text-gray-500">Không có doanh thu</p></div>;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold mb-2">{`Tháng ${label.replace('T', '')}`}</p>
        <p className="font-bold mb-2 text-base border-b pb-1">{`Tổng: ${formatCurrency(total)}`}</p>
        <div className="space-y-1 mt-2">{payload.map((entry: any, index: number) => (<div key={`item-${index}`} className="flex justify-between items-center"><div className="flex items-center"><div style={{ backgroundColor: entry.color }} className="w-2.5 h-2.5 rounded-full mr-2"></div><span>{entry.name}:</span></div><span className="font-semibold ml-4">{`${formatCurrency(entry.value)} (${(total > 0 ? (entry.value / total) * 100 : 0).toFixed(1)}%)`}</span></div>))}</div>
      </div>
    );
  }
  return null;
};

interface ModuleCardProps { title: string; icon: React.ReactNode; borderColor: string; children: React.ReactNode; }
const ModuleCard: React.FC<ModuleCardProps> = ({ title, icon, borderColor, children }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor} flex flex-col h-full transition-transform hover:shadow-md active:scale-95`}>
        <header className="p-4 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-800">{title}</h3>
            {icon}
        </header>
        <main className="p-4 flex-grow flex flex-col justify-between">{children}</main>
    </div>
);

const ProgressBar: React.FC<{ value: number }> = ({ value }) => ( <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${value}%` }}></div></div>);

const DashboardFooter: React.FC<{
    activityLogs: ActivityLog[];
    feedback: FeedbackItem[];
    onNavigate: (page: AdminPage) => void;
}> = ({ activityLogs, feedback, onNavigate }) => {
    const [tickerKey, setTickerKey] = useState(0);
    const [showActivityPopup, setShowActivityPopup] = useState(false);
    const [showMsgPopup, setShowMsgPopup] = useState(false);
    
    const latestLogs = useMemo(() => activityLogs.slice(0, 5), [activityLogs]);
    const currentLog = latestLogs.length > 0 ? latestLogs[tickerKey % Math.min(latestLogs.length, 3)] : null;

    const unreadMessages = useMemo(() => feedback.filter(f => f.status === 'Pending').slice(0, 5), [feedback]);
    const pendingFeedbackCount = feedback.filter(f => f.status === 'Pending').length;

    useEffect(() => {
        if (latestLogs.length === 0) return;
        const interval = setInterval(() => { setTickerKey(prev => prev + 1); }, 5000);
        return () => clearInterval(interval);
    }, [latestLogs.length]);

    return (
        <div className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 h-7 flex items-center justify-between px-6 text-gray-600 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex-1 flex items-center relative max-w-2xl" onClick={(e) => { e.stopPropagation(); setShowActivityPopup(!showActivityPopup); setShowMsgPopup(false); }}>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 py-0.5 px-3 rounded-lg transition-colors w-full">
                    {currentLog ? (
                        <>
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </div>
                            <div key={tickerKey} className="flex items-center text-[10px] text-gray-600 truncate animate-fade-in-down w-full">
                                <span className="font-bold text-gray-800 mr-2">{currentLog.actor_email.split('@')[0]}</span>
                                <span className="truncate mr-2">{currentLog.summary}</span>
                                <span className="text-gray-400 text-[9px] whitespace-nowrap bg-gray-50 px-1 rounded border border-gray-200">{timeAgo(currentLog.ts)}</span>
                            </div>
                        </>
                    ) : (
                        <span className="text-[10px] text-gray-400 italic pl-1">Không có hoạt động gần đây.</span>
                    )}
                </div>
            </div>

            <div className="flex items-center relative" onClick={(e) => { e.stopPropagation(); setShowMsgPopup(!showMsgPopup); setShowActivityPopup(false); }}>
                <button className={`relative flex items-center gap-2 px-3 py-0.5 rounded-lg text-[11px] font-bold transition-colors ${showMsgPopup ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    <span>Tin nhắn</span>
                    {pendingFeedbackCount > 0 && (<span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold ring-1 ring-white shadow-sm">{pendingFeedbackCount}</span>)}
                </button>
            </div>
        </div>
    );
};

interface OverviewPageProps {
    allUnits: Unit[];
    allOwners: Owner[];
    allVehicles: Vehicle[];
    allWaterReadings: WaterReading[];
    charges: ChargeRaw[];
    activityLogs: ActivityLog[];
    feedback: any[];
    onNavigate: (page: string) => void;
    monthlyStats?: MonthlyStat[];
    quickStats?: { totalUnits: number; activeVehicles: number };
}

const OverviewPage: React.FC<OverviewPageProps> = ({ 
    allUnits, allVehicles, allWaterReadings, charges, 
    activityLogs, feedback, onNavigate, monthlyStats = [],
    quickStats = { totalUnits: 0, activeVehicles: 0 }
}) => {

    const commandCenterStats = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const previousPeriod = getPreviousPeriod(currentPeriod);
        
        // 1. Optimized Totals (Priority: Aggregated Data > Document List)
        const totalUnits = quickStats.totalUnits || allUnits.length;
        
        // Count Resident Breakdown (O(n) - only if list exists)
        const residentBreakdown = { Owner: 0, Rent: 0, Business: 0 };
        let occupiedUnits = 0;
        if (allUnits.length > 0) {
            for (const u of allUnits) {
                if (u.OwnerID) occupiedUnits++;
                residentBreakdown[u.Status]++;
            }
        }
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
        
        // 2. Finance Stats
        const currentMonthStat = monthlyStats.find(s => s.period === currentPeriod);
        let totalDue = currentMonthStat?.totalDue ?? 0;
        const currentCharges = charges.filter(c => c.Period === currentPeriod);
        const totalPaid = currentCharges.reduce((sum, c) => sum + c.TotalPaid, 0);
        if (totalDue === 0) totalDue = currentCharges.reduce((sum, c) => sum + c.TotalDue, 0);

        const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
        
        // 3. Water Stats
        const currentWater = allWaterReadings.filter(r => r.Period === currentPeriod);
        const recordedCount = currentWater.length;
        const totalConsumption = currentWater.reduce((sum, r) => sum + (r.consumption ?? 0), 0);
        
        const prevTotalConsumption = allWaterReadings
            .filter(r => r.Period === previousPeriod)
            .reduce((sum, r) => sum + (r.consumption ?? 0), 0);
        const waterTrend = prevTotalConsumption > 0 ? ((totalConsumption - prevTotalConsumption) / prevTotalConsumption) * 100 : 0;
        
        // 4. Optimized Chart Data (Using pre-aggregated stats)
        const revenueChartData = Array.from({ length: 6 }).map((_, i) => { 
            const d = new Date(); 
            d.setMonth(d.getMonth() - i); 
            const p = d.toISOString().slice(0, 7); 
            const stat = monthlyStats.find(s => s.period === p);
            return stat ? { 
                name: `T${d.getMonth() + 1}`, 
                'Dịch vụ': stat.totalService, 
                'Gửi xe': stat.totalParking, 
                'Nước': stat.totalWater
            } : { name: `T${d.getMonth() + 1}`, 'Dịch vụ': 0, 'Gửi xe': 0, 'Nước': 0 };
        }).reverse();

        const unrecordedWaterCount = Math.max(0, totalUnits - recordedCount);

        return { 
            residentStats: { totalUnits, occupancyRate, breakdown: residentBreakdown }, 
            financeStats: { totalRevenue: totalPaid, totalDebt: totalDue - totalPaid, collectionRate }, 
            vehicleStats: { activeCount: quickStats.activeVehicles || allVehicles.length }, 
            waterStats: { recorded: recordedCount, total: totalUnits, consumption: totalConsumption, trend: waterTrend }, 
            feedbackStats: { new: feedback.filter(f => f.status === 'Pending').length }, 
            revenueChartData, 
            unrecordedWaterCount
        };
    }, [allUnits, allVehicles, allWaterReadings, charges, feedback, monthlyStats, quickStats]);

    return (
        <div className="space-y-6 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <div onClick={() => onNavigate('residents')}>
                    <ModuleCard title="Cư dân" icon={<BuildingIcon className="w-6 h-6 text-blue-600"/>} borderColor="border-blue-500">
                        <div><p className="text-sm text-gray-500">Tổng số căn hộ</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.residentStats.totalUnits}</p></div>
                        <div><p className="text-sm font-semibold text-gray-600 mb-2">Lấp đầy: {commandCenterStats.residentStats.occupancyRate.toFixed(0)}%</p><ProgressBar value={commandCenterStats.residentStats.occupancyRate} /></div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('billing')}>
                    <ModuleCard title="Tài chính" icon={<BanknotesIcon className="w-6 h-6 text-green-600"/>} borderColor="border-green-500">
                        <div><p className="text-sm text-gray-500">Thực thu tháng này</p><p className="text-3xl font-bold text-gray-800">{formatCurrency(commandCenterStats.financeStats.totalRevenue)}</p></div>
                        <div><p className="text-sm font-semibold text-gray-600">Tỷ lệ: {commandCenterStats.financeStats.collectionRate.toFixed(0)}%</p></div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('vehicles')}>
                    <ModuleCard title="Phương tiện" icon={<CarIcon className="w-6 h-6 text-orange-600"/>} borderColor="border-orange-500">
                        <div><p className="text-sm text-gray-500">Xe đang hoạt động</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.vehicleStats.activeCount}</p></div>
                        <div className="text-xs text-gray-400 font-bold uppercase">Quản lý bãi đỗ xe</div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('water')}>
                    <ModuleCard title="Nước sạch" icon={<DropletsIcon className="w-6 h-6 text-purple-600"/>} borderColor="border-purple-500">
                        <div><p className="text-sm text-gray-500">Tổng tiêu thụ</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.waterStats.consumption.toLocaleString('vi-VN')} m³</p></div>
                        <div className={`text-xs font-bold ${commandCenterStats.waterStats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {commandCenterStats.waterStats.trend >= 0 ? '+' : ''}{commandCenterStats.waterStats.trend.toFixed(1)}% vs tháng trước
                        </div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('feedbackManagement')}>
                    <ModuleCard title="Phản hồi" icon={<ChatBubbleLeftEllipsisIcon className="w-6 h-6 text-rose-600"/>} borderColor="border-rose-500">
                        <div><p className="text-sm text-gray-500">Phản hồi mới</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.feedbackStats.new} tin</p></div>
                        <div className="text-xs text-gray-400 font-bold uppercase">Chăm sóc cư dân</div>
                    </ModuleCard>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Biểu đồ doanh thu (6 tháng gần nhất)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={commandCenterStats.revenueChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatYAxis} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(243, 244, 246, 0.7)' }} /><Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconSize={10} /><Bar dataKey="Dịch vụ" stackId="revenue" fill="#3b82f6" /><Bar dataKey="Gửi xe" stackId="revenue" fill="#10b981" /><Bar dataKey="Nước" stackId="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Cảnh báo & Việc cần làm</h3>
                    <ul className="space-y-4">
                        {commandCenterStats.unrecordedWaterCount > 0 && (
                            <li className="flex items-center gap-3">
                                <WarningIcon className="w-5 h-5 text-red-500"/>
                                <span className="text-sm font-medium text-gray-700">{commandCenterStats.unrecordedWaterCount} căn chưa chốt số nước</span>
                            </li>
                        )}
                        <li className="flex items-center gap-3">
                            <ClockIcon className="w-5 h-5 text-blue-500"/>
                            <span className="text-sm font-medium text-gray-700">Kiểm tra thông báo phí kỳ mới</span>
                        </li>
                    </ul>
                </div>
            </div>
            
            <DashboardFooter activityLogs={activityLogs} feedback={feedback} onNavigate={onNavigate as (page: AdminPage) => void} />
        </div>
    );
};

export default OverviewPage;
