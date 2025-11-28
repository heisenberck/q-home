

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { Unit, Owner, Vehicle, WaterReading, ChargeRaw, ActivityLog } from '../../types';
import { VehicleTier } from '../../types';
import StatCard from '../ui/StatCard';
import { CarIcon, RevenueIcon, WarningIcon, DropletsIcon, PieChartIcon, CheckCircleIcon } from '../ui/Icons';
import { getPreviousPeriod, formatCurrency as formatFullCurrency } from '../../utils/helpers';

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
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't render label for small slices

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold text-xs">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} năm trước`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} tháng trước`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} ngày trước`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} giờ trước`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} phút trước`;
    return `${Math.floor(seconds)} giây trước`;
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
    const [selectedMonth, setSelectedMonth] = useState<number>(11);

    const dashboardStats = useMemo(() => {
        const currentPeriod = '2025-11';
        const previousPeriod = getPreviousPeriod(currentPeriod);
        
        const currentCharges = charges.filter(c => c.Period === currentPeriod);
        const previousCharges = charges.filter(c => c.Period === previousPeriod);

        const currentRevenue = currentCharges.reduce((sum, c) => sum + c.TotalPaid, 0);
        const previousRevenue = previousCharges.reduce((sum, c) => sum + c.TotalPaid, 0);
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
    }, [allUnits, allVehicles, allWaterReadings, charges]);

    const revenueChartData = useMemo(() => {
        const generateMockRevenue = () => 120_000_000 + Math.random() * 60_000_000;

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        return months.map(month => {
            const periodStr = `2025-${String(month).padStart(2, '0')}`;
            const chargesForMonth = charges.filter(c => c.Period === periodStr);
            
            let revenue = 0;
            if (chargesForMonth.length > 0) {
                revenue = chargesForMonth.reduce((sum, c) => sum + c.TotalDue, 0);
            } else if (month < 11) {
                revenue = generateMockRevenue();
            }
            
            return { name: `T${month}`, 'Doanh thu tháng': revenue };
        });
    }, [charges]);
    
    const pieChartData = useMemo(() => {
        if (!selectedMonth) return [];

        const period = `2025-${String(selectedMonth).padStart(2, '0')}`;
        const chargesForMonth = charges.filter(c => c.Period === period);

        const barDataForMonth = revenueChartData.find(d => d.name === `T${selectedMonth}`);
        if (chargesForMonth.length === 0 && barDataForMonth && barDataForMonth['Doanh thu tháng'] > 0) {
            const mockTotal = barDataForMonth['Doanh thu tháng'];
            return [
                { name: 'Phí Dịch Vụ', value: mockTotal * 0.6 },
                { name: 'Phí Gửi Xe', value: mockTotal * 0.3 },
                { name: 'Tiền Nước', value: mockTotal * 0.1 },
            ];
        }

        if (chargesForMonth.length === 0) return [];

        const totals = chargesForMonth.reduce((acc, charge) => {
            acc.service += charge.ServiceFee_Total;
            acc.parking += charge.ParkingFee_Total;
            acc.water += charge.WaterFee_Total;
            return acc;
        }, { service: 0, parking: 0, water: 0 });

        return [
            { name: 'Phí Dịch Vụ', value: totals.service },
            { name: 'Phí Gửi Xe', value: totals.parking },
            { name: 'Tiền Nước', value: totals.water },
        ].filter(item => item.value > 0);

    }, [charges, selectedMonth, revenueChartData]);

    const currentMonthAlerts = useMemo(() => {
        const currentPeriod = '2025-11';
        const chargesForCurrentMonth = charges.filter(c => c.Period === currentPeriod);

        if (chargesForCurrentMonth.length === 0) {
            return { unpaidCount: 0, unpaidTotal: 0 };
        }

        const unpaidCharges = chargesForCurrentMonth.filter(c => c.paymentStatus !== 'paid');
        const unpaidCount = unpaidCharges.length;
        const unpaidTotal = unpaidCharges.reduce((sum, c) => sum + (c.TotalDue - c.TotalPaid), 0);

        return { unpaidCount, unpaidTotal };
    }, [charges]);
    
    const unrecordedWaterUnits = useMemo(() => {
        const checkPeriod = getPreviousPeriod('2025-11'); // '2025-10'
        const readingsForPeriod = new Set(
            allWaterReadings
                .filter(r => r.Period === checkPeriod && r.CurrIndex > r.PrevIndex)
                .map(r => r.UnitID)
        );
        return allUnits.filter(u => !readingsForPeriod.has(u.UnitID));
    }, [allUnits, allWaterReadings]);

    const chargesForCurrentPeriodExist = useMemo(() => {
        const currentPeriod = '2025-11';
        return charges.some(c => c.Period === currentPeriod);
    }, [charges]);


    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label={`Doanh thu T${new Date('2025-11-01').getMonth() + 1}`} 
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
                    label={`Tiêu thụ nước T${new Date(getPreviousPeriod('2025-11')).getMonth() + 1}`} 
                    value={`${dashboardStats.totalWaterConsumption.toLocaleString('vi-VN')} m³`} 
                    icon={<DropletsIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/>} 
                    iconBgClass="bg-indigo-100 dark:bg-indigo-900/50"
                    trend={dashboardStats.waterConsumptionTrend}
                />
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
                                onClick={(data) => {
                                    const monthNum = parseInt(data.name.substring(1));
                                    if (!isNaN(monthNum)) setSelectedMonth(monthNum);
                                }}
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
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Cơ cấu doanh thu Tháng {selectedMonth}/2025</h3>
                    <ResponsiveContainer width="100%" height={300}>
                         {pieChartData.length > 0 ? (
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number, name: string, props: any) => {
                                    const formattedValue = formatFullCurrency(value);
                                    const percent = (props.payload.percent * 100).toFixed(0);
                                    return [`${formattedValue} (${percent}%)`, name];
                                }} />
                                <Legend />
                            </PieChart>
                         ) : (
                             <div className="relative w-full h-full">
                                 <div className="absolute top-1/2 left-3/4 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-gray-500">
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
                                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Phí chưa thanh toán (Tháng {new Date('2025-11').getMonth() + 1})</h4>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Có <strong className="text-gray-900 dark:text-gray-100">{currentMonthAlerts.unpaidCount}</strong> hộ chưa hoàn thành thanh toán phí, với tổng số tiền là <strong className="text-gray-900 dark:text-gray-100">{formatFullCurrency(currentMonthAlerts.unpaidTotal)}</strong>.
                                </p>
                            </div>
                        )}

                        {unrecordedWaterUnits.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Chưa chốt số nước kỳ T{new Date(getPreviousPeriod('2025-11')).getMonth()+1}</h4>
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