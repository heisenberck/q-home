
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Unit, Vehicle, WaterReading, ChargeRaw, ActivityLog, Owner, FeedbackItem, MonthlyStat } from '../../types';
import { VehicleTier } from '../../types';
import {
    BuildingIcon, BanknotesIcon, CarIcon, DropletsIcon, ChatBubbleLeftEllipsisIcon,
    WarningIcon, ClockIcon, UserCircleIcon
} from '../ui/Icons';
import { getPreviousPeriod, timeAgo } from '../../utils/helpers';
import type { AdminPage } from '../../App';
import { isProduction } from '../../utils/env';

// --- Local Components & Helpers ---

const ChatBubbleLeftRightIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 12c0-2.515-2.035-4.545-4.545-4.545H5.25a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25H9m11.25-8.25a2.25 2.25 0 0 0-2.25-2.25H13.5a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25H18a2.25 2.25 0 0 0 2.25-2.25V12.75Z" />
    </svg>
);

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
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor} flex flex-col h-full`}>
        <header className="p-4 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-800">{title}</h3>
            {icon}
        </header>
        <main className="p-4 flex-grow flex flex-col justify-between">{children}</main>
    </div>
);

const ProgressBar: React.FC<{ value: number }> = ({ value }) => ( <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${value}%` }}></div></div>);

// --- NEW Dashboard Footer Component ---
const DashboardFooter: React.FC<{
    activityLogs: ActivityLog[];
    feedback: FeedbackItem[];
    onNavigate: (page: AdminPage) => void;
}> = ({ activityLogs, feedback, onNavigate }) => {
    const [tickerKey, setTickerKey] = useState(0);
    const [showActivityPopup, setShowActivityPopup] = useState(false);
    const [showMsgPopup, setShowMsgPopup] = useState(false);
    
    // Logic: Activity Log (Latest 5 for popup, 1 for ticker)
    const latestLogs = useMemo(() => activityLogs.slice(0, 5), [activityLogs]);
    const currentLog = latestLogs.length > 0 ? latestLogs[tickerKey % Math.min(latestLogs.length, 3)] : null;

    // Logic: Unread Messages (Pending)
    const unreadMessages = useMemo(() => feedback.filter(f => f.status === 'Pending').slice(0, 5), [feedback]);
    const pendingFeedbackCount = feedback.filter(f => f.status === 'Pending').length;

    useEffect(() => {
        if (latestLogs.length === 0) return;
        const interval = setInterval(() => { setTickerKey(prev => prev + 1); }, 5000); // Slower ticker
        return () => clearInterval(interval);
    }, [latestLogs.length]);

    // Close popups when clicking outside (Simple implementation using state toggle backdrop)
    useEffect(() => {
        const close = () => { setShowActivityPopup(false); setShowMsgPopup(false); };
        if(showActivityPopup || showMsgPopup) document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [showActivityPopup, showMsgPopup]);

    return (
        <div className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 h-12 flex items-center justify-between px-6 text-gray-600 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            
            {/* LEFT: Activity Log Area */}
            <div className="flex-1 flex items-center relative max-w-2xl" onClick={(e) => { e.stopPropagation(); setShowActivityPopup(!showActivityPopup); setShowMsgPopup(false); }}>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 py-1.5 px-3 rounded-lg transition-colors w-full">
                    {currentLog ? (
                        <>
                            <div className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </div>
                            <div key={tickerKey} className="flex items-center text-xs text-gray-600 truncate animate-fade-in-down w-full">
                                <span className="font-bold text-gray-800 mr-2">{currentLog.actor_email.split('@')[0]}</span>
                                <span className="truncate mr-2">{currentLog.summary}</span>
                                <span className="text-gray-400 text-[10px] whitespace-nowrap bg-gray-50 px-1.5 rounded border border-gray-200">{timeAgo(currentLog.ts)}</span>
                            </div>
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 italic pl-1">Không có hoạt động gần đây.</span>
                    )}
                </div>

                {/* Activity Popup */}
                {showActivityPopup && latestLogs.length > 0 && (
                    <div className="absolute bottom-14 left-0 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 p-1 animate-slide-up z-40" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hoạt động gần nhất</span>
                            <span className="text-[10px] text-gray-400">Tự động cập nhật</span>
                        </div>
                        <ul className="max-h-64 overflow-y-auto py-1">
                            {latestLogs.map(log => (
                                <li key={log.id} className="px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <span className="text-xs font-bold text-gray-800">{log.actor_email}</span>
                                        <span className="text-[10px] text-gray-400">{timeAgo(log.ts)}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-snug">{log.summary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* RIGHT: Messages Area */}
            <div className="flex items-center relative" onClick={(e) => { e.stopPropagation(); setShowMsgPopup(!showMsgPopup); setShowActivityPopup(false); }}>
                <button className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${showMsgPopup ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    <span>Tin nhắn</span>
                    {pendingFeedbackCount > 0 && (<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white shadow-sm">{pendingFeedbackCount}</span>)}
                </button>

                {/* Messages Popup */}
                {showMsgPopup && (
                    <div className="absolute bottom-14 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-1 animate-slide-up z-40" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tin nhắn chưa đọc</span>
                            <button onClick={() => onNavigate('feedbackManagement')} className="text-[10px] text-blue-600 hover:underline">Xem tất cả</button>
                        </div>
                        {unreadMessages.length > 0 ? (
                            <ul className="max-h-64 overflow-y-auto py-1">
                                {unreadMessages.map(msg => (
                                    <li key={msg.id} onClick={() => onNavigate('feedbackManagement')} className="px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 cursor-pointer group">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="text-xs font-bold text-gray-800 group-hover:text-blue-700">{msg.residentId}</span>
                                            <span className="text-[10px] text-gray-400">{timeAgo(msg.date)}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-gray-700 truncate">{msg.subject}</p>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{msg.content}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-6 text-center text-gray-400">
                                <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                                <p className="text-xs">Không có tin nhắn mới</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Page Component ---
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
}

const OverviewPage: React.FC<OverviewPageProps> = ({ allUnits, allOwners, allVehicles, allWaterReadings, charges, activityLogs, feedback, onNavigate, monthlyStats = [] }) => {

    const commandCenterStats = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const previousPeriod = getPreviousPeriod(currentPeriod);
        
        // 1. Resident Stats
        const totalUnits = allUnits.length;
        const occupiedUnits = allUnits.filter(u => u.OwnerID).length;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
        const residentBreakdown = allUnits.reduce((acc, unit) => { acc[unit.Status] = (acc[unit.Status] || 0) + 1; return acc; }, {} as Record<Unit['Status'], number>);
        
        // 2. Finance Stats (Current Period)
        const currentCharges = charges.filter(c => c.Period === currentPeriod);
        const totalPaid = currentCharges.reduce((sum, c) => sum + c.TotalPaid, 0);
        const totalDue = currentCharges.reduce((sum, c) => sum + c.TotalDue, 0);
        const totalDebt = totalDue - totalPaid;
        const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
        
        // 3. Vehicle Stats
        const activeVehicles = allVehicles.filter(v => v.isActive);
        const carSlotsUsed = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const motoCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE).length;
        const ebikeCount = activeVehicles.filter(v => v.Type === VehicleTier.EBIKE).length;
        const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
        const waitingCount = activeVehicles.filter(v => v.parkingStatus === 'Xếp lốt').length;
        
        // 4. Water Stats
        const recordedCount = allWaterReadings.filter(r => r.Period === currentPeriod).length;
        const totalConsumption = allWaterReadings.filter(r => r.Period === currentPeriod).reduce((sum, r) => sum + (r.consumption || 0), 0);
        const prevTotalConsumption = allWaterReadings.filter(r => r.Period === previousPeriod).reduce((sum, r) => sum + (r.consumption || 0), 0);
        const waterTrend = prevTotalConsumption > 0 ? ((totalConsumption - prevTotalConsumption) / prevTotalConsumption) * 100 : 0;
        
        // 5. Feedback Stats
        const newFeedbackCount = feedback.filter(f => f.status === 'Pending').length;
        const processingFeedbackCount = feedback.filter(f => f.status === 'Processing').length;
        
        // 6. Revenue Chart Data (Optimized with MonthlyStats)
        const revenueChartData = Array.from({ length: 6 }).map((_, i) => { 
            const d = new Date(); 
            d.setMonth(d.getMonth() - i); 
            const p = d.toISOString().slice(0, 7); 
            
            // Try to find stats in the optimized collection first
            const stat = monthlyStats.find(s => s.period === p);
            
            if (stat) {
                return { 
                    name: `T${d.getMonth() + 1}`, 
                    'Dịch vụ': stat.totalService, 
                    'Gửi xe': stat.totalParking, 
                    'Nước': stat.totalWater
                };
            } else {
                // Fallback to calculation from charges array (backward compatibility or missing stat)
                // Note: 'charges' now only contains current month data in prod, so this is mainly for Mock Mode or recent data fallback
                const chargesForP = charges.filter(c => c.Period === p); 
                return { 
                    name: `T${d.getMonth() + 1}`, 
                    'Dịch vụ': chargesForP.reduce((s,c)=>s+c.ServiceFee_Total,0), 
                    'Gửi xe': chargesForP.reduce((s,c)=>s+c.ParkingFee_Total,0), 
                    'Nước': chargesForP.reduce((s,c)=>s+c.WaterFee_Total,0)
                }; 
            }
        }).reverse();

        const unrecordedWaterCount = totalUnits - recordedCount;
        const alertItems = [
            unrecordedWaterCount > 0 && { text: `${unrecordedWaterCount} căn chưa chốt số nước`, icon: <WarningIcon className="w-5 h-5 text-red-500"/> }, 
            waitingCount > 0 && { text: `${waitingCount} xe đang trong danh sách chờ`, icon: <WarningIcon className="w-5 h-5 text-orange-500"/>}, 
            { text: 'Thông báo cắt điện chưa gửi', icon: <WarningIcon className="w-5 h-5 text-blue-500"/> },
        ].filter(Boolean);

        return { residentStats: { totalUnits, occupancyRate, breakdown: residentBreakdown }, financeStats: { totalRevenue: totalPaid, totalDebt, collectionRate }, vehicleStats: { carSlotsUsed, motoCount, ebikeCount, bicycleCount, waiting: waitingCount }, waterStats: { recorded: recordedCount, total: totalUnits, consumption: totalConsumption, trend: waterTrend }, feedbackStats: { new: newFeedbackCount, processing: processingFeedbackCount }, revenueChartData, alertItems, };
    }, [allUnits, allOwners, allVehicles, allWaterReadings, charges, activityLogs, feedback, monthlyStats]);

    return (
        <div className="space-y-6 pb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <div onClick={() => onNavigate('residents')} className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-[1.03] hover:shadow-lg rounded-xl">
                    <ModuleCard title="Cư dân" icon={<BuildingIcon className="w-6 h-6 text-blue-600"/>} borderColor="border-blue-500">
                        <div><p className="text-sm text-gray-500">Tổng số căn hộ</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.residentStats.totalUnits}</p></div>
                        <div><p className="text-sm font-semibold text-gray-600 mb-2">Tỷ lệ lấp đầy: {commandCenterStats.residentStats.occupancyRate.toFixed(0)}%</p><ProgressBar value={commandCenterStats.residentStats.occupancyRate} /><p className="text-xs text-gray-500 mt-2">{commandCenterStats.residentStats.breakdown.Owner || 0} Chính chủ | {commandCenterStats.residentStats.breakdown.Rent || 0} Cho thuê</p></div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('billing')} className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-[1.03] hover:shadow-lg rounded-xl">
                    <ModuleCard title="Tài chính" icon={<BanknotesIcon className="w-6 h-6 text-green-600"/>} borderColor="border-green-500">
                        <div><p className="text-sm text-gray-500">Thực thu tháng này</p><p className="text-3xl font-bold text-gray-800">{formatCurrency(commandCenterStats.financeStats.totalRevenue)}</p></div>
                        <div><p className="text-sm font-semibold text-gray-600">Tỷ lệ thu: {commandCenterStats.financeStats.collectionRate.toFixed(0)}%</p><p className="text-sm text-gray-500 mt-1">Công nợ: <span className="font-bold text-red-600">{formatCurrency(commandCenterStats.financeStats.totalDebt)}</span></p></div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('vehicles')} className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-[1.03] hover:shadow-lg rounded-xl">
                    <ModuleCard title="Phương tiện" icon={<CarIcon className="w-6 h-6 text-orange-600"/>} borderColor="border-orange-500">
                        <div><p className="text-sm text-gray-500">Tổng số ô tô</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.vehicleStats.carSlotsUsed}</p></div>
                        <div><p className="text-sm font-semibold text-gray-600">Xe máy/Xe điện: {commandCenterStats.vehicleStats.motoCount}/{commandCenterStats.vehicleStats.ebikeCount}</p><p className="text-sm font-semibold text-gray-600">Xe đạp: {commandCenterStats.vehicleStats.bicycleCount}</p>{commandCenterStats.vehicleStats.waiting > 0 && (<p className="text-xs text-red-600 mt-1 font-bold">{commandCenterStats.vehicleStats.waiting} xe đang chờ lốt</p>)}</div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('water')} className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-[1.03] hover:shadow-lg rounded-xl">
                    <ModuleCard title="Nước sạch" icon={<DropletsIcon className="w-6 h-6 text-purple-600"/>} borderColor="border-purple-500">
                        <div><p className="text-sm text-gray-500">Tổng tiêu thụ</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.waterStats.consumption.toLocaleString('vi-VN')} <span className="text-xl">m³</span></p></div>
                        <div><p className="text-sm font-semibold text-gray-600">Đã chốt: {commandCenterStats.waterStats.recorded}/{commandCenterStats.waterStats.total} căn</p><p className={`text-xs mt-1 font-bold ${commandCenterStats.waterStats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>{commandCenterStats.waterStats.trend >= 0 ? '+' : ''}{commandCenterStats.waterStats.trend.toFixed(1)}% so với tháng trước</p></div>
                    </ModuleCard>
                </div>
                <div onClick={() => onNavigate('feedbackManagement')} className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-[1.03] hover:shadow-lg rounded-xl">
                    <ModuleCard title="Phản hồi" icon={<ChatBubbleLeftEllipsisIcon className="w-6 h-6 text-rose-600"/>} borderColor="border-rose-500">
                        <div><p className="text-sm text-gray-500">Phản hồi mới</p><p className="text-3xl font-bold text-gray-800">{commandCenterStats.feedbackStats.new} tin</p></div>
                        <div><p className="text-sm font-semibold text-gray-600">{commandCenterStats.feedbackStats.processing} đang xử lý</p></div>
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
                    <ul className="space-y-4">{commandCenterStats.alertItems.map((item: any, index: number) => (<li key={index} className="flex items-center gap-3">{item.icon}<span className="text-sm font-medium text-gray-700">{item.text}</span></li>))}</ul>
                </div>
            </div>
            
            <DashboardFooter activityLogs={activityLogs} feedback={feedback} onNavigate={onNavigate as (page: AdminPage) => void} />
        </div>
    );
};

export default OverviewPage;
