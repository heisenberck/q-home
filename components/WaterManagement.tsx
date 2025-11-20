import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_WATER_READINGS, MOCK_UNITS } from '../constants';
import type { WaterReading } from '../types';
import { UnitType } from '../types';
import { useAuth, useNotification, useTheme } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ChevronUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);


const WaterManagement: React.FC = () => {
    const { role } = useAuth();
    // FIX: The `useNotification` hook returns `showToast`, not `showNotification`. Aliasing to match usage in the component.
    const { showToast: showNotification } = useNotification();
    const { theme } = useTheme();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    
    const [period, setPeriod] = useState('2025-10');
    const [waterReadings, setWaterReadings] = useState<WaterReading[]>(MOCK_WATER_READINGS);
    const [searchTerm, setSearchTerm] = useState('');
    const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | 'Apartment' | 'KIOS'>('all');
    const [isChartVisible, setIsChartVisible] = useState(true);


    // Helper to get the previous period string (e.g., '2025-10' -> '2025-09')
    const getPreviousPeriod = (currentPeriod: string): string => {
        const [year, month] = currentPeriod.split('-').map(Number);
        const d = new Date(year, month - 1, 1);
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    // Effect to auto-populate previous readings when period changes
    useEffect(() => {
        const previousPeriod = getPreviousPeriod(period);

        setWaterReadings(currentReadings => {
            // 1. Create a map of the previous period's readings for quick lookup
            const previousReadingsMap = new Map<string, WaterReading>();
            currentReadings
                .filter(r => r.Period === previousPeriod)
                .forEach(r => previousReadingsMap.set(r.UnitID, r));
            
            // 2. Find which units already have a reading for the new, current period
            const unitsWithExistingReading = new Set(
                currentReadings.filter(r => r.Period === period).map(r => r.UnitID)
            );

            // 3. For units that DON'T have a reading, create a new one, populating PrevIndex from the previous month
            const newReadingsForCurrentPeriod = MOCK_UNITS
                .filter(unit => !unitsWithExistingReading.has(unit.UnitID))
                .map(unit => {
                    const previousReading = previousReadingsMap.get(unit.UnitID);
                    const newPrevIndex = previousReading ? previousReading.CurrIndex : 0;
                    return {
                        UnitID: unit.UnitID,
                        Period: period,
                        PrevIndex: newPrevIndex,
                        CurrIndex: newPrevIndex, // Default CurrIndex to PrevIndex to avoid negative consumption
                        Rollover: false,
                    };
                });

            // 4. Return the combination of old readings and the newly created ones
            return [...currentReadings, ...newReadingsForCurrentPeriod];
        });
    }, [period]);

    // Sort function to keep unit order consistent
    const sortUnits = (a: { UnitID: string }, b: { UnitID: string }): number => {
        const getFloor = (unitId: string) => {
            if (unitId.startsWith('K')) return 99; // Kios last
            return parseInt(unitId.slice(0, -2), 10) || 0;
        }
        const getAptNum = (unitId: string) => {
            if (unitId.startsWith('K')) return parseInt(unitId.substring(1));
            return parseInt(unitId.slice(-2), 10) || 0;
        }
        const floorA = getFloor(a.UnitID);
        const floorB = getFloor(b.UnitID);
        if (floorA !== floorB) return floorA - floorB;
        return getAptNum(a.UnitID) - getAptNum(b.UnitID);
    };

    const readingsForPeriod = useMemo(() => {
        const unitTypeMap = new Map<string, UnitType>(MOCK_UNITS.map(u => [u.UnitID, u.UnitType]));

        return waterReadings
            .filter(r => {
                if (r.Period !== period) return false;

                // Filter by unit type
                const unitType = unitTypeMap.get(r.UnitID);
                if (unitTypeFilter !== 'all' && unitType !== unitTypeFilter) {
                    return false;
                }

                // Filter by search term
                if (searchTerm && !r.UnitID.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }

                return true;
            })
            .sort(sortUnits);
    }, [period, waterReadings, searchTerm, unitTypeFilter]);

    // Data for the consumption chart
    const chartData = useMemo(() => {
        const last6Periods: string[] = [];
        let currentPeriod = period;
        for (let i = 0; i < 6; i++) {
            last6Periods.unshift(currentPeriod);
            currentPeriod = getPreviousPeriod(currentPeriod);
        }

        const filteredUnitIDs = new Set(
            MOCK_UNITS
                .filter(u => unitTypeFilter === 'all' || u.UnitType === unitTypeFilter)
                .map(u => u.UnitID)
        );

        return last6Periods.map(p => {
            const totalConsumption = MOCK_WATER_READINGS
                .filter(r => r.Period === p && filteredUnitIDs.has(r.UnitID))
                .reduce((sum, r) => sum + (r.CurrIndex - r.PrevIndex), 0);
            
            const [year, month] = p.split('-');
            return {
                name: `${month}/${year}`,
                'Tiêu thụ': totalConsumption,
            };
        });
    }, [period, unitTypeFilter]);
    
    // Theme-based colors for the chart
    const themeColors = {
        light: { textSecondary: '#5e6c84', background: '#ffffff' },
        dark: { textSecondary: '#94a3b8', background: '#1e293b' }
    };
    const currentChartColors = theme === 'dark' ? themeColors.dark : themeColors.light;


    const handleReadingChange = (unitId: string, field: 'CurrIndex' | 'PrevIndex', value: string) => {
        if (!canEdit) return;
        
        const numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 0) return;

        setWaterReadings(prevReadings => {
            const existingIndex = prevReadings.findIndex(r => r.UnitID === unitId && r.Period === period);
            if (existingIndex > -1) {
                // Update existing
                const newReadings = [...prevReadings];
                newReadings[existingIndex] = { ...newReadings[existingIndex], [field]: numericValue };
                return newReadings;
            } else {
                // Add new (fallback, should be handled by useEffect)
                const newReading: WaterReading = {
                    UnitID: unitId,
                    Period: period,
                    PrevIndex: field === 'PrevIndex' ? numericValue : 0,
                    CurrIndex: field === 'CurrIndex' ? numericValue : 0,
                    Rollover: false,
                };
                return [...prevReadings, newReading];
            }
        });
    };
    
    const handleSaveChanges = () => {
        if (!canEdit) {
            showNotification('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
        // In a real app, this would be an API call
        showNotification('Chỉ số nước đã được lưu!', 'success');
    };

    return (
        <div className="bg-background dark:bg-dark-secondary p-4 sm:p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary">Quản lý Ghi số Nước</h2>
                <div className="flex items-center gap-4">
                    <label htmlFor="period-select" className="font-semibold">Kỳ:</label>
                    <input 
                        type="month"
                        id="period-select"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-background dark:bg-dark-background dark:border-dark-border-color text-text-primary dark:text-dark-text-primary"
                    />
                     <button
                        onClick={handleSaveChanges}
                        disabled={!canEdit}
                        className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400"
                    >
                        Lưu thay đổi
                    </button>
                </div>
            </div>

             {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-dark-secondary/50 rounded-lg border dark:border-dark-border-color">
                <div className="flex-grow">
                    <label htmlFor="search-unit" className="sr-only">Tìm căn hộ</label>
                    <input
                        id="search-unit"
                        type="text"
                        placeholder="Tìm theo mã căn hộ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-background dark:bg-dark-background dark:border-dark-border-color text-text-primary dark:text-dark-text-primary"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Lọc theo loại:</span>
                    <button onClick={() => setUnitTypeFilter('all')} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>Tất cả</button>
                    <button onClick={() => setUnitTypeFilter(UnitType.APARTMENT)} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === UnitType.APARTMENT ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>{UnitType.APARTMENT}</button>
                    <button onClick={() => setUnitTypeFilter(UnitType.KIOS)} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === UnitType.KIOS ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>{UnitType.KIOS}</button>
                </div>
            </div>

            {/* Consumption Chart */}
            <div className="my-6 p-4 border rounded-lg dark:border-dark-border-color bg-white dark:bg-dark-background shadow-md">
                <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary mb-4 flex justify-between items-center">
                    <span>Biểu đồ tiêu thụ nước 6 tháng gần nhất (m³)</span>
                     <button
                        onClick={() => setIsChartVisible(!isChartVisible)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark p-1 rounded-md"
                        aria-expanded={isChartVisible}
                    >
                        <span>{isChartVisible ? 'Ẩn' : 'Hiện'}</span>
                        {isChartVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </h3>
                {isChartVisible && (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fill: currentChartColors.textSecondary }} />
                            <YAxis tick={{ fill: currentChartColors.textSecondary }} />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: currentChartColors.background, 
                                    border: `1px solid ${currentChartColors.textSecondary}` 
                                }}
                                formatter={(value: number) => `${value.toLocaleString('vi-VN')} m³`}
                            />
                            <Legend wrapperStyle={{ color: currentChartColors.textSecondary }} />
                            <Bar dataKey="Tiêu thụ" fill="#006f3a" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>


            <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
                    <thead className="bg-gray-50 dark:bg-dark-secondary sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Căn hộ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Chỉ số cũ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Chỉ số mới</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Tiêu thụ (m³)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
                        {readingsForPeriod.length === 0 ? (
                             <tr>
                                <td colSpan={4} className="text-center py-8 text-text-secondary dark:text-dark-text-secondary">
                                    Không tìm thấy dữ liệu phù hợp.
                                </td>
                            </tr>
                        ) : (
                            readingsForPeriod.map(reading => {
                                const consumption = reading.CurrIndex - reading.PrevIndex;
                                return (
                                    <tr key={reading.UnitID}>
                                        <td className="px-4 py-4 whitespace-nowrap font-medium text-text-primary dark:text-dark-text-primary">{reading.UnitID}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <input
                                                type="number"
                                                value={reading.PrevIndex}
                                                onChange={(e) => handleReadingChange(reading.UnitID, 'PrevIndex', e.target.value)}
                                                disabled={!canEdit}
                                                className="w-24 p-1 border border-gray-300 rounded-md bg-background dark:bg-dark-secondary dark:border-dark-border-color text-text-primary dark:text-dark-text-primary disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                            />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <input
                                                type="number"
                                                value={reading.CurrIndex}
                                                onChange={(e) => handleReadingChange(reading.UnitID, 'CurrIndex', e.target.value)}
                                                disabled={!canEdit}
                                                className="w-24 p-1 border border-gray-300 rounded-md bg-background dark:bg-dark-secondary dark:border-dark-border-color text-text-primary dark:text-dark-text-primary disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                            />
                                        </td>
                                        <td className={`px-4 py-4 whitespace-nowrap font-semibold ${consumption < 0 ? 'text-red-500' : 'text-text-primary dark:text-dark-text-primary'}`}>
                                            {consumption}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WaterManagement;