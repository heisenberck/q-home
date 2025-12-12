
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Unit, Vehicle, WaterReading, ChargeRaw, ActivityLog, Owner, FeedbackItem } from '../../types';
import { VehicleTier } from '../../types';
import {
    BuildingIcon, BanknotesIcon, CarIcon, DropletsIcon, ChatBubbleLeftEllipsisIcon,
    WarningIcon,
} from '../ui/Icons';
import { getPreviousPeriod } from '../../utils/helpers';
import type { AdminPage } from '../../types';
import ActivityBar from '../dashboard/ActivityBar';

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
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor} flex flex-col h-full`}>
        <header className="p-4 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-800">{title}</h3>
            {icon}
        </header>
        <main className="p-4 flex-grow flex flex-col justify-between">{children}</main>
    </div>
);

const ProgressBar: React.FC<{ value: number }> = ({ value }) => ( <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${value}%` }}></div></div>);

// --- Main Page Component ---
interface OverviewPageProps {
    allUnits: Unit[];
    allOwners: Owner[];
    allVehicles: Vehicle[];
    allWaterReadings: WaterReading[];
    charges: ChargeRaw[];
    activityLogs: ActivityLog[];
    feedback: FeedbackItem[];
    onNavigate: (page: string) => void;
}

const OverviewPage: React.FC<OverviewPageProps> = ({ allUnits, allOwners, allVehicles, allWaterReadings, charges, activityLogs, feedback, onNavigate }) => {

    const commandCenterStats = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const previousPeriod = getPreviousPeriod(currentPeriod);
        const totalUnits = allUnits.length;
        const occupiedUnits = allUnits.filter(u => u.OwnerID).length;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
        const residentBreakdown = allUnits.reduce((acc, unit) => { acc[unit.Status] = (acc[unit.Status] || 0) + 1; return acc; }, {} as Record<Unit['Status'], number>);
        const currentCharges = charges.filter(c => c.Period === currentPeriod);
        const totalPaid = currentCharges.reduce((sum, c) => sum + c.TotalPaid, 0);
        const totalDue = currentCharges.reduce((sum, c) => sum + c.TotalDue, 0);
        const totalDebt = totalDue - totalPaid;
        const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
        const activeVehicles = allVehicles.filter(v => v.isActive);
        const carSlotsUsed = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const motoCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE).length;
        const ebikeCount = activeVehicles.filter(v => v.Type === VehicleTier.EBIKE).length;
        const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
        const waitingCount = activeVehicles.filter(v => v.parkingStatus === 'Xếp lốt').length;
        const recordedCount = allWaterReadings.filter(r => r.Period === currentPeriod).length;
        const totalConsumption = allWaterReadings.filter(r => r.Period === currentPeriod).reduce((sum, r) => sum + (r.consumption || 0), 0);
        const prevTotalConsumption = allWaterReadings.filter(r => r.Period === previousPeriod).reduce((sum, r) => sum + (r.consumption || 0), 0);
        const waterTrend = prevTotalConsumption > 0 ? ((totalConsumption - prevTotalConsumption) / prevTotalConsumption) * 100 : 0;
        const newFeedbackCount = feedback.filter(f => f.status === 'Pending').length;
        const processingFeedbackCount = feedback.filter(f => f.status === 'Processing').length;
        const revenueChartData = Array.from({ length: 6 }).map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); const p = d.toISOString().slice(0, 7); const chargesForP = charges.filter(c => c.Period === p); return { name: `T${d.getMonth() + 1}`, 'Dịch vụ': chargesForP.reduce((s,c)=>s+c.ServiceFee_Total,0), 'Gửi xe': chargesForP.reduce((s,c)=>s+c.ParkingFee_Total,0), 'Nước': chargesForP.reduce((s,c)=>s+c.WaterFee_Total,0)}; }).reverse();
        const unrecordedWaterCount = totalUnits - recordedCount;
        const alertItems = [unrecordedWaterCount > 0 && { text: `${unrecordedWaterCount} căn chưa chốt số nước`, icon: <WarningIcon className="w-5 h-5 text-red-500"/> }, waitingCount > 0 && { text: `${waitingCount} xe đang trong danh sách chờ`, icon: <WarningIcon className="w-5 h-5 text-orange-500"/>}, { text: 'Thông báo cắt điện chưa gửi', icon: <WarningIcon className="w-5 h-5 text-blue-500"/> },].filter(Boolean);
        return { residentStats: { totalUnits, occupancyRate, breakdown: residentBreakdown }, financeStats: { totalRevenue: totalPaid, totalDebt, collectionRate }, vehicleStats: { carSlotsUsed, motoCount, ebikeCount, bicycleCount, waiting: waitingCount }, waterStats: { recorded: recordedCount, total: totalUnits, consumption: totalConsumption, trend: waterTrend }, feedbackStats: { new: newFeedbackCount, processing: processingFeedbackCount }, revenueChartData, alertItems, };
    }, [allUnits, allOwners, allVehicles, allWaterReadings, charges, activityLogs, feedback]);

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
            
            <ActivityBar onNavigate={onNavigate as (page: AdminPage) => void} feedback={feedback} />
        </div>
    );
};

export default OverviewPage;