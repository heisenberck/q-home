
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import type { Unit, Owner, Vehicle, WaterReading, ChargeRaw } from '../../types';
import { UnitType, VehicleTier } from '../../types';
import DashboardCard from '../ui/DashboardCard';
import { BuildingIcon, CarIcon, MotorbikeIcon, ResidentIcon, RevenueIcon, WarningIcon, WaterIcon } from '../ui/Icons';

const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN').format(Math.round(value));

interface OverviewPageProps {
    allUnits: Unit[];
    allOwners: Owner[];
    allVehicles: Vehicle[];
    allWaterReadings: WaterReading[];
    charges: ChargeRaw[];
}

const getPreviousPeriod = (p: string) => {
    const [year, month] = p.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatYAxisLabel = (value: number): string => {
    if (value >= 1_000_000) {
        return `${Math.round(value / 1_000_000)}m`;
    }
    if (value >= 1_000) {
        return `${Math.round(value / 1_000)}k`;
    }
    return String(value);
};


const OverviewPage: React.FC<OverviewPageProps> = ({ allUnits, allOwners, allVehicles, allWaterReadings, charges }) => {
    
    const dashboardStats = useMemo(() => {
        const currentPeriod = '2025-11';
        const waterUsagePeriod = getPreviousPeriod(currentPeriod);
        
        const chargesForPeriod = charges.filter(c => c.Period === currentPeriod);

        const activeVehicles = allVehicles.filter(v => v.isActive);
        const totalApartments = allUnits.filter(u => u.UnitType === UnitType.APARTMENT).length;
        const totalKios = allUnits.filter(u => u.UnitType === UnitType.KIOS).length;
        const totalCars = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const totalMotorbikes = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;

        const totalRevenue = chargesForPeriod.reduce((sum, c) => sum + c.TotalDue, 0);
        const unpaidFeesCount = chargesForPeriod.filter(c => c.paymentStatus !== 'paid').length;
        const totalWaterConsumption = chargesForPeriod.reduce((sum, c) => sum + c.Water_m3, 0);
        
        const unitsWithWaterReading = new Set(allWaterReadings.filter(r => r.Period === waterUsagePeriod).map(r => r.UnitID));
        const missingWaterReadings = allUnits.filter(u => !unitsWithWaterReading.has(u.UnitID)).length;

        return {
            totalApartments,
            totalKios,
            totalCars,
            totalMotorbikes,
            totalWaterConsumption,
            missingWaterReadings,
            latestRevenue: totalRevenue,
            unpaidFeesCount: unpaidFeesCount,
        };
    }, [allUnits, allVehicles, allWaterReadings, charges]);

    // Generate data for all 12 months of 2025
    const revenueData = useMemo(() => {
        const currentYear = 2025;
        const months = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2, ..., 12]

        return months.map(month => {
            const periodStr = `${currentYear}-${String(month).padStart(2, '0')}`;
            const revenue = charges
                .filter(c => c.Period === periodStr)
                .reduce((sum, c) => sum + c.TotalDue, 0);
            
            return {
                name: `Thg ${month}`,
                Doanh_thu: revenue,
            };
        });
    }, [charges]);
    
    const feeStructureData = useMemo(() => {
        const chargesForPeriod = charges.filter(c => c.Period === '2025-11');
        if (chargesForPeriod.length === 0) return [];
        
        const service = chargesForPeriod.reduce((sum, c) => sum + c.ServiceFee_Total, 0);
        const parking = chargesForPeriod.reduce((sum, c) => sum + c.ParkingFee_Total, 0);
        const water = chargesForPeriod.reduce((sum, c) => sum + c.WaterFee_Total, 0);

        return [
            { name: 'Dịch vụ', value: service },
            { name: 'Gửi xe', value: parking },
            { name: 'Nước', value: water },
        ].filter(item => item.value > 0);
    }, [charges]);

    const PIE_COLORS = ['#006f3a', '#f6b800', '#00C49F'];

    const renderCustomizedLabel = (props: any) => {
        const { cx, cy, midAngle, outerRadius, value } = props;
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 25;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="var(--color-text-primary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {formatCurrency(value)}
            </text>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard title="Căn hộ / Kios" value={`${dashboardStats.totalApartments} / ${dashboardStats.totalKios}`} icon={<BuildingIcon />} />
                <DashboardCard title={`Doanh thu T${new Date('2025-11-01').getMonth() + 1}`} value={dashboardStats.latestRevenue} icon={<RevenueIcon />} />
                <DashboardCard title="Ô tô & Xe máy" value={`${dashboardStats.totalCars} / ${dashboardStats.totalMotorbikes}`} icon={<CarIcon />} />
                <DashboardCard title={`Nước T${new Date(getPreviousPeriod('2025-11')).getMonth() + 1}`} value={dashboardStats.totalWaterConsumption} suffix=" m³" icon={<WaterIcon />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                     <h3 className="font-semibold mb-4">Biểu đồ doanh thu năm 2025 (VND)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)' }} />
                            <YAxis tickFormatter={formatYAxisLabel} tick={{ fill: 'var(--color-text-secondary)' }} />
                            <Tooltip formatter={(value) => `${new Intl.NumberFormat('vi-VN').format(value as number)} ₫`} />
                            <Bar dataKey="Doanh_thu" name="Doanh thu" fill="#006f3a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="lg:col-span-2 bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                    <h3 className="font-semibold mb-4">Cơ cấu phí (Tháng 11)</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                            <Pie 
                                data={feeStructureData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                outerRadius={80}
                                labelLine={false}
                            >
                                {feeStructureData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                 <LabelList dataKey="value" position="inside" fill="#fff" fontWeight="bold" formatter={(value: number) => {
                                     const total = feeStructureData.reduce((sum, item) => sum + item.value, 0);
                                     if (total === 0) return '0%';
                                     return `${((value / total) * 100).toFixed(0)}%`;
                                 }} />
                            </Pie>
                             <Pie
                                data={feeStructureData}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={80}
                                label={renderCustomizedLabel}
                                fill="transparent"
                            />
                            <Tooltip formatter={(value) => `${formatCurrency(value as number)} ₫`} />
                             <Legend
                                layout="horizontal"
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '24px',
                                    paddingTop: '10px'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                 <h3 className="font-semibold mb-4 flex items-center gap-2"><WarningIcon /> Cảnh báo & Thông báo quan trọng</h3>
                 <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-red-500">{dashboardStats.unpaidFeesCount} căn hộ</span> chưa hoàn thành phí dịch vụ tháng 11/2025.</p>
                    <p><span className="font-semibold text-yellow-500">{dashboardStats.missingWaterReadings} căn hộ</span> chưa được nhập chỉ số nước cho kỳ tháng 10/2025.</p>
                 </div>
            </div>
        </div>
    );
};

export default OverviewPage;
