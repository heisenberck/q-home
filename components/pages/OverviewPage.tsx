import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { Unit, Owner, Vehicle, WaterReading, ChargeRaw, ActivityLog } from '../../types';
import { VehicleTier } from '../../types';
import StatCard from '../ui/StatCard';
import { CarIcon, RevenueIcon, WarningIcon, DropletsIcon, PieChartIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon } from '../ui/Icons';
import { getPreviousPeriod, formatCurrency as formatFullCurrency, timeAgo } from '../../utils/helpers';
import { isProduction } from '../../utils/env';

const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)} tr`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(0)} k`;
    }
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

const formatYAxisLabel = (value: number): string => {
    if (value >= 1_000_000) {
        return `${Math.round(value / 1_000_000)}tr`;
    }
    if (value >= 1_000) {
        return `${Math.round(value / 1_000)}k`;
    }
    return String(value);
};

const COLORS = ['#3b82f6', '#16a34a', '#f97316']; // Blue (Service), Green (Parking), Orange (Water)
const RADIAN = Math.PI / 180;

const renderCombinedLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, value } = props;

    // Inside label: %
    const radiusInside = outerRadius * 0.5;
    const xInside = cx + radiusInside * Math.cos(-midAngle * RADIAN);
    const yInside = cy + radiusInside * Math.sin(-midAngle * RADIAN);

    // Outside label with line
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 20) * cos;
    const my = cy + (outerRadius + 20) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    if (percent < 0.05) return null;

    return (
        <g>
            {/* Inside Label */}
            <text x={xInside} y={yInside} fill="white" textAnchor="middle" dominantBaseline="central" className="font-bold text-sm">
                {`${(percent * 100).toFixed(0)}%`}
            </text>

            {/* Outside Line and Label */}
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9ca3af" fill="none" />
            <circle cx={sx} cy={sy} r={2} fill="#9ca3af" stroke="white" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 4} y={ey} textAnchor={textAnchor} fill="#6b7280" fontSize="12px">
                {name}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 4} y={ey} dy={14} textAnchor={textAnchor} fill="#374151" fontSize="12px" fontWeight="bold">
                {formatFullCurrency(value)}
            </text>
        </g>
    );
};

interface OverviewPageProps {
    allUnits: Unit[];
    allOwners: Owner[];
    allVehicles: Vehicle[];
    allWaterReadings: WaterReading[];
    charges: ChargeRaw[];
    activityLogs: ActivityLog[];
}

const OverviewPage: React.FC<OverviewPageProps> = ({ allUnits, allVehicles, allWaterReadings, charges, activityLogs }) => {
    const [isStatsExpanded, setIsStatsExpanded] = useState(true);

    const dashboardStats = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const previousPeriod = getPreviousPeriod(currentPeriod);
        
        const currentCharges = charges.filter(c => c.Period === currentPeriod);
        const previousCharges = charges.filter(c => c.Period === previousPeriod);

        const currentRevenue = Math.round(currentCharges.reduce((sum, c) => sum + c.TotalPaid, 0));
        const previousRevenue = Math.round(previousCharges.reduce((sum, c) => sum + c.TotalPaid, 0));
        const revenueTrend = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : (currentRevenue > 0 ? Infinity : 0);

        const outstandingUnitsCount = charges.filter(c => c.paymentStatus !== 'paid').length;

        const activeVehicles = allVehicles.filter(v => v.isActive);
        const totalCars = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const totalMotorbikes = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;
        
        const totalWaterConsumption = currentCharges.reduce((sum, c) => sum + c.Water_m3, 0);

        const previousWaterConsumption = previousCharges.reduce((sum, c) => sum + c.Water_m3, 0);
        const waterConsumptionTrend = previousWaterConsumption > 0 
            ? ((totalWaterConsumption - previousWaterConsumption) / previousWaterConsumption) * 100 
            : (totalWaterConsumption > 0 ? Infinity : 0);

        return {
            currentRevenue,
            revenueTrend,
            outstandingUnitsCount,
            totalCars,
            totalMotorbikes,
            totalWaterConsumption,
            waterConsumptionTrend,
        };
    }, [allVehicles, charges]);

    const revenueChartData = useMemo(() => {
        const IS_PROD = isProduction();
        const hasAnyData = charges.length > 0;

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        return months.map(month => {
            const periodStr = `2025-${String(month).padStart(2, '0')}`;
            const chargesForMonth = charges.filter(c => c.Period === periodStr);
            
            let revenue = 0;
            if (chargesForMonth.length > 0) {
                revenue = Math.round(chargesForMonth.reduce((sum, c) => sum + c.TotalDue, 0));
            } else if (!IS_PROD && hasAnyData) {
                 if (month < 11) { // Retain some mock data for past months in dev if not wiped
                    revenue = Math.round(120_000_000 + Math.random() * 60_000_000);
                 }
            }
            
            return { name: `T${month}`, 'Doanh thu tháng': revenue };
        });
    }, [charges]);
    
    const pieChartData = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const chargesForMonth = charges.filter(c => c.Period === currentPeriod);
        
        const IS_PROD = isProduction();
        const hasAnyData = charges.length > 0;

        if (chargesForMonth.length === 0) {
             if (!IS_PROD && hasAnyData) {
                const mockTotal = 150_000_000;
                 return [
                    { name: 'Phí Dịch Vụ', value: Math.round(mockTotal * 0.6) },
                    { name: 'Phí Gửi Xe', value: Math.round(mockTotal * 0.3) },
                    { name: 'Tiền Nước', value: Math.round(mockTotal * 0.1) },
                ];
             }
             return [];
        }

        const totals = chargesForMonth.reduce((acc, charge) => {
            acc.service += charge.ServiceFee_Total;
            acc.parking += charge.ParkingFee_Total;
            acc.water += charge.WaterFee_Total;
            return acc;
        }, { service: 0, parking: 0, water: 0 });

        return [
            { name: 'Phí Dịch Vụ', value: Math.round(totals.service) },
            { name: 'Phí Gửi Xe', value: Math.round(totals.parking) },
            { name: 'Tiền Nước', value: Math.round(totals.water) },
        ].filter(item => item.value > 0);

    }, [charges]);

    const currentMonthAlerts = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const chargesForCurrentMonth = charges.filter(c => c.Period === currentPeriod);

        if (chargesForCurrentMonth.length === 0) {
            return { unpaidCount: 0, unpaidTotal: 0 };
        }

        const unpaidCharges = chargesForCurrentMonth.filter(c => c.paymentStatus !== 'paid');
        const unpaidCount = unpaidCharges.length;
        const unpaidTotal = Math.round(unpaidCharges.reduce((sum, c) => sum + (c.TotalDue - c.TotalPaid), 0));

        return { unpaidCount, unpaidTotal };
    }, [charges]);
    
    const unrecordedWaterUnits = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const checkPeriod = getPreviousPeriod(currentPeriod);
        const readingsForPeriod = new Set(
            allWaterReadings
                .filter(r => r.Period === checkPeriod && r.CurrIndex > r.PrevIndex)
                .map(r => r.UnitID)
        );
        return allUnits.filter(u => !readingsForPeriod.has(u.UnitID));
    }, [allUnits, allWaterReadings]);

    const chargesForCurrentPeriodExist = useMemo(() => {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        return charges.some(c => c.Period === currentPeriod);
    }, [charges]);
    
    const currentMonth = new Date().getMonth() + 1;


    return (
        <div className="space-y-8">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Thống kê nhanh</h2>
                    <button
                        onClick={() => setIsStatsExpanded(p => !p)}
                        className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"
                        data-tooltip={isStatsExpanded ? "Thu gọn" : "Mở rộng"}
                    >
                        {isStatsExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </div>
                {isStatsExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            label={`Doanh thu T${currentMonth}`} 
                            value={formatCurrency(dashboardStats.currentRevenue)} 
                            icon={<RevenueIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400"/>} 
                            iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
                            trend={dashboardStats.revenueTrend}
                        />
                        <StatCard 
                            label="Căn hộ nợ phí" 
                            value={<span className="text-red-600 dark:text-red-400">{dashboardStats.outstandingUnitsCount}</span>}
                            icon={<WarningIcon className="w-7 h-7 text-red-600 dark:text-red-400"/>} 
                            iconBgClass="bg-red-100 dark:bg-red-900/50"
                        />
                        <StatCard 
                            label="Ô tô / Xe máy" 
                            value={`${dashboardStats.totalCars} / ${dashboardStats.totalMotorbikes}`} 
                            icon={<CarIcon className="w-7 h-7 text-amber-600 dark:text-amber-400"/>} 
                            iconBgClass="bg-amber-100 dark:bg-amber-900/50"
                        />
                        <StatCard 
                            label={`Tiêu thụ nước T${currentMonth}`} 
                            value={`${dashboardStats.totalWaterConsumption.toLocaleString('vi-VN')} m³`} 
                            icon={<DropletsIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/>} 
                            iconBgClass="bg-indigo-100 dark:bg-indigo-900/50"
                            trend={dashboardStats.waterConsumptionTrend}
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Doanh thu năm 2025</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={revenueChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border, #e5e7eb)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--light-text-secondary, #6b7280)' }} />
                            <YAxis 
                                tickFormatter={formatYAxisLabel} 
                                tick={{ fill: 'var(--light-text-secondary, #6b7280)' }} 
                                domain={[0, (dataMax: number) => dataMax * 1.2]}
                            />
                            <Tooltip active={false} />
                            <Legend wrapperStyle={{ display: 'none' }} />
                            <Bar 
                                dataKey="Doanh thu tháng" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]}
                                className="cursor-pointer"
                            >
                                <LabelList 
                                    dataKey="Doanh thu tháng" 
                                    position="top" 
                                    formatter={(value: number) => value > 0 ? formatCurrency(value) : ''} 
                                    fill="var(--light-text-secondary, #6b7280)" 
                                    fontSize={10} 
                                    fontWeight="bold" 
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Cơ cấu doanh thu Tháng {currentMonth}/2025</h3>
                    <ResponsiveContainer width="100%" height={300}>
                         {pieChartData.length > 0 ? (
                            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCombinedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatFullCurrency(value)} />
                                <Legend wrapperStyle={{ fontSize: '12px', marginTop: '16px' }} />
                            </PieChart>
                         ) : (
                             <div className="relative w-full h-full">
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-gray-500">
                                     <PieChartIcon className="w-20 h-20 text-gray-300 dark:text-gray-600 opacity-50"/>
                                     <p className="mt-3 text-sm italic whitespace-nowrap">Chưa có dữ liệu cho kỳ này</p>
                                 </div>
                             </div>
                         )}
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                        <PieChartIcon className="w-6 h-6 mr-3 text-primary" />
                        Hoạt động gần đây
                    </h3>
                    <ul className="space-y-4">
                        {activityLogs.slice(0, 5).map(log => (
                            <li key={log.id} className="flex items-start space-x-3">
                                <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2 mt-1">
                                    <CheckCircleIcon className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200">{log.summary}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        bởi {log.actor_email.split('@')[0]} - {timeAgo(log.ts)}
                                    </p>
                                </div>
                            </li>
                        ))}
                        {activityLogs.length === 0 && <p className="text-sm text-gray-500">Chưa có hoạt động nào.</p>}
                    </ul>
                </div>
                <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                        <WarningIcon className="w-6 h-6 mr-3 text-orange-500" />
                        Cảnh báo & Nhắc việc
                    </h3>
                     <div className="space-y-4">
                        {currentMonthAlerts.unpaidCount > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Phí chưa thanh toán (Tháng {currentMonth})</h4>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Có <strong className="text-gray-900 dark:text-gray-100">{currentMonthAlerts.unpaidCount}</strong> hộ chưa hoàn thành thanh toán phí, với tổng số tiền là <strong className="text-gray-900 dark:text-gray-100">{formatFullCurrency(currentMonthAlerts.unpaidTotal)}</strong>.
                                </p>
                            </div>
                        )}

                        {unrecordedWaterUnits.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Chưa chốt số nước kỳ T{new Date(getPreviousPeriod(new Date().toISOString().slice(0,7))).getMonth()+1}</h4>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Có <strong className="text-gray-900 dark:text-gray-100">{unrecordedWaterUnits.length}</strong> căn hộ chưa có số nước, cần cập nhật để tính phí. 
                                    <span className="text-xs italic"> (VD: {unrecordedWaterUnits.slice(0, 5).map(u => u.UnitID).join(', ')}, ...)</span>
                                </p>
                            </div>
                        )}
                        
                        {currentMonthAlerts.unpaidCount === 0 && unrecordedWaterUnits.length === 0 && (
                             chargesForCurrentPeriodExist ? (
                                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                    <CheckCircleIcon className="w-5 h-5" />
                                    <span>Tất cả phí đã được xử lý và số nước đã được ghi đầy đủ.</span>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Chưa có dữ liệu phí cho kỳ này. Vui lòng tính phí để xem cảnh báo.
                                </p>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverviewPage;
