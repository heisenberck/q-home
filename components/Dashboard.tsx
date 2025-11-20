import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS } from '../constants';
import { UnitType, Vehicle, VehicleTier } from '../types';
import { useTheme } from '../App';


// --- START: Helper Components ---
const CountUp: React.FC<{ end: number, duration?: number }> = ({ end, duration = 1500 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const startTime = performance.now();
        let frameId: number;

        const animate = (currentTime: number) => {
            const elapsedTime = currentTime - startTime;
            if (elapsedTime < duration) {
                const progress = elapsedTime / duration;
                const currentVal = Math.round(start + progress * (end - start));
                setCount(currentVal);
                frameId = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };

        frameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frameId);
    }, [end, duration]);

    return <>{new Intl.NumberFormat('vi-VN').format(count)}</>;
};
// --- END: Helper Components ---

// --- START: Icon Components ---
const ResidentIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
    </svg>
);
const BuildingIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M4 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3.5-.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zM7.5 5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zM4.5 8a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3.5-.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5z"/>
        <path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm11 0H3v14h3v-2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V15h3z"/>
    </svg>
);
const CarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0m10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
        <path d="M2.78 6.792A.5.5 0 0 1 3 6.5h10a.5.5 0 0 1 .22.418l1.24 3.72a.5.5 0 0 1-.44.582H2.98a.5.5 0 0 1-.44-.582zM1.5 6.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v3.428a1.5 1.5 0 0 1-1.372 1.494H2.872A1.5 1.5 0 0 1 1.5 9.928zM3.5 11h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1"/>
    </svg>
);
const MotorbikeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M3.5 10a.5.5 0 0 1-.5-.5V5.986l1.583-1.132a.5.5 0 0 1 .634.766L4.2 6.645h2.825a.5.5 0 0 1 0 1H3.5z"/>
        <path d="m11.94 9.873-.623.89-1.285-.514a.5.5 0 0 0-.623.89l1.45 1.044a.5.5 0 0 0 .853-.52l.623-.89a.5.5 0 0 0-.853-.52ZM5.94 9.873a.5.5 0 0 0-.853-.52l-.623.89-.84-1.12a.5.5 0 0 0-.89.668l.98 1.306a.5.5 0 0 0 .853-.52l.623-.89a.5.5 0 0 0-.853-.52Z"/>
        <path d="M12.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m1-1.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m-8.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m1-1.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m-2.5-4a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5M6.5 5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
    </svg>
);
const WaterIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M8 16a6 6 0 0 0 6-6c0-1.655-1.122-2.904-2.432-4.362C10.254 4.176 8.75 2.503 8 0c-.75.001-2.254 1.676-3.568 3.138C3.122 7.096 2 8.345 2 10a6 6 0 0 0 6 6M8 4.314C7.431 3.69 6.273 2.5 8 1.62C9.727 2.5 8.569 3.69 8 4.314" />
    </svg>
);
const RevenueIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M4 3.06h2.726c1.22 0 2.12.575 2.325 1.724H4v1.051h2.818c1.447 0 2.502.617 2.502 1.875 0 1.402-1.37 1.897-2.734 1.897H4v1.051h3.05c1.464 0 2.67.637 2.67 1.995 0 1.406-1.204 2.01-2.583 2.01H4V14h3.14c1.92 0 3.268-.787 3.268-2.14 0-1.09-.927-1.785-2.084-1.883v-.063c1.24-.14 2.04-.903 2.04-1.925 0-1.132-.95-1.83-2.328-1.83H4.002V3.06z"/>
    </svg>
);
const WarningIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 16 16">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
    </svg>
);
// --- END: Icon Components ---

// --- Info Card Component ---
const InfoCard: React.FC<{
    title: string;
    value: number;
    suffix?: string;
    icon: React.ReactNode;
    onViewList?: () => void;
    isWarning?: boolean;
}> = ({ title, value, suffix, icon, onViewList, isWarning }) => {
    const hasLink = onViewList && (title === 'Ô tô' || title === 'Xe máy');
    const valueColor = isWarning ? 'text-red-600 dark:text-red-400' : 'text-text-primary dark:text-dark-text-primary';

    return (
        <div className={`bg-white dark:bg-dark-secondary p-3 rounded-lg shadow-sm border ${isWarning ? 'border-red-300 dark:border-red-600' : 'dark:border-dark-border-color'} flex items-center gap-3`}>
            {icon}
            <div className="flex-1">
                <h3 className="text-xs font-medium text-text-secondary dark:text-dark-text-secondary whitespace-nowrap">{title}</h3>
                <p className={`text-xl font-bold ${valueColor}`}>
                    <CountUp end={value} />
                    {suffix && <span>{suffix}</span>}
                </p>
                 {hasLink && (
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onViewList?.(); }} 
                        className="text-xs font-semibold text-primary hover:underline"
                    >
                        Xem danh sách
                    </a>
                )}
            </div>
        </div>
    );
};

// --- Vehicle List Modal Component ---
const VehicleListModal: React.FC<{
    title: string;
    vehicles: Vehicle[];
    onClose: () => void;
}> = ({ title, vehicles, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-background dark:bg-dark-secondary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-dark-border-color flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
                        <thead className="bg-gray-50 dark:bg-dark-secondary">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Căn hộ</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Loại xe</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Biển số</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Ngày đăng ký</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
                            {vehicles.map(v => (
                                <tr key={v.VehicleId}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-text-primary dark:text-dark-text-primary">{v.UnitID}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary dark:text-dark-text-secondary">{v.Type}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary dark:text-dark-text-primary">{v.PlateNumber}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary dark:text-dark-text-secondary">{new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const { theme } = useTheme(); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ title: string; vehicles: Vehicle[] }>({ title: '', vehicles: [] });
    
    // Define colors based on the theme for charts
    const themeColors = {
        light: { textPrimary: '#172b4d', textSecondary: '#5e6c84', background: '#ffffff' },
        dark: { textPrimary: '#f1f5f9', textSecondary: '#94a3b8', background: '#1e293b' }
    };
    const currentColors = theme === 'dark' ? themeColors.dark : themeColors.light;
    
    const revenueData = [
        { name: 'Thg 8', revenue: 35000000 },
        { name: 'Thg 9', revenue: 38500000 },
        { name: 'Thg 10', revenue: 41200000 },
        { name: 'Thg 11', revenue: 0 },
    ];
    
    const dashboardStats = useMemo(() => {
        const totalResidents = MOCK_OWNERS.length;
        const totalApartments = MOCK_UNITS.filter(u => u.UnitType === UnitType.APARTMENT).length;
        const allCars = MOCK_VEHICLES.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A);
        const allMotorbikes = MOCK_VEHICLES.filter(v => v.Type === VehicleTier.MOTORBIKE);
        
        const latestPeriod = '2025-10';
        const totalWaterConsumption = MOCK_WATER_READINGS
            .filter(r => r.Period === latestPeriod)
            .reduce((sum, r) => sum + (r.CurrIndex - r.PrevIndex), 0);
            
        const waterReadingsThisPeriod = MOCK_WATER_READINGS.filter(r => r.Period === latestPeriod).length;
        const missingWaterReadings = MOCK_UNITS.length - waterReadingsThisPeriod;

        const latestRevenue = [...revenueData].reverse().find(d => d.revenue > 0)?.revenue || 0;
            
        return {
            totalResidents,
            totalApartments,
            totalCars: allCars.length,
            totalMotorbikes: allMotorbikes.length,
            totalWaterConsumption,
            latestRevenue,
            allCars,
            allMotorbikes,
            unpaidFeesCount: 12, // NOTE: Hardcoded as state is not shared from ChargeCalculation page
            missingWaterReadings,
        };
    }, []);

    const handleViewList = (type: 'cars' | 'motorbikes') => {
        if (type === 'cars') {
            setModalData({ title: 'Danh sách Ô tô', vehicles: dashboardStats.allCars });
        } else {
            setModalData({ title: 'Danh sách Xe máy', vehicles: dashboardStats.allMotorbikes });
        }
        setIsModalOpen(true);
    };

    const feeStructureData = [
        { name: 'Phí Dịch vụ', value: 18500000 },
        { name: 'Phí Gửi xe', value: 13200000 },
        { name: 'Phí Nước', value: 9500000 },
    ];

    const COLORS = ['#006f3a', '#f6b800', '#00C49F'];

    return (
        <div>
            {isModalOpen && (
                <VehicleListModal 
                    title={modalData.title}
                    vehicles={modalData.vehicles}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary mb-6">Tổng quan</h2>
            
            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <InfoCard 
                    title="Cư dân" 
                    value={dashboardStats.totalResidents} 
                    icon={<ResidentIcon className="h-8 w-8 text-primary" />}
                />
                 <InfoCard 
                    title="Căn hộ" 
                    value={dashboardStats.totalApartments} 
                    icon={<BuildingIcon className="h-8 w-8 text-accent" />}
                />
                <InfoCard 
                    title="Doanh thu tháng" 
                    value={dashboardStats.latestRevenue} 
                    icon={<RevenueIcon className="h-8 w-8 text-teal-500" />}
                />
                <InfoCard 
                    title="Tiêu thụ nước" 
                    value={dashboardStats.totalWaterConsumption} 
                    suffix=" m³"
                    icon={<WaterIcon className="h-8 w-8 text-cyan-500" />}
                />
                 <InfoCard 
                    title="Ô tô" 
                    value={dashboardStats.totalCars} 
                    icon={<CarIcon className="h-8 w-8 text-blue-500" />}
                    onViewList={() => handleViewList('cars')}
                />
                 <InfoCard 
                    title="Xe máy" 
                    value={dashboardStats.totalMotorbikes} 
                    icon={<MotorbikeIcon className="h-8 w-8 text-purple-500" />}
                    onViewList={() => handleViewList('motorbikes')}
                />
                <InfoCard 
                    title="Căn hộ chưa nộp phí" 
                    value={dashboardStats.unpaidFeesCount} 
                    icon={<WarningIcon className="h-8 w-8 text-red-500" />}
                    isWarning={true}
                />
                <InfoCard 
                    title="Căn chưa nhập nước" 
                    value={dashboardStats.missingWaterReadings} 
                    icon={<WarningIcon className="h-8 w-8 text-yellow-500" />}
                    isWarning={true}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-dark-secondary p-6 rounded-lg shadow-md">
                    <h3 className="font-semibold mb-4 text-text-primary dark:text-dark-text-primary">Biểu đồ doanh thu (VND)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fill: currentColors.textSecondary }} />
                            <YAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN').format(value as number)} tick={{ fill: currentColors.textSecondary }} />
                            <Tooltip contentStyle={{ backgroundColor: currentColors.background, color: currentColors.textPrimary, border: `1px solid ${currentColors.textSecondary}` }} formatter={(value) => `${new Intl.NumberFormat('vi-VN').format(value as number)} ₫`} />
                            <Legend wrapperStyle={{ color: currentColors.textPrimary }} />
                            <Bar dataKey="revenue" fill="#006f3a" name="Doanh thu"/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-dark-secondary p-6 rounded-lg shadow-md">
                    <h3 className="font-semibold mb-4 text-text-primary dark:text-dark-text-primary">Cơ cấu phí</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={feeStructureData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelStyle={{ fill: currentColors.textPrimary }}
                            >
                                {feeStructureData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                             <Tooltip contentStyle={{ backgroundColor: currentColors.background, color: currentColors.textPrimary, border: `1px solid ${currentColors.textSecondary}` }} formatter={(value) => `${new Intl.NumberFormat('vi-VN').format(value as number)} ₫`} />
                            <Legend wrapperStyle={{ color: currentColors.textPrimary }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;