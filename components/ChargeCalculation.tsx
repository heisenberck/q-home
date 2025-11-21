import React, { useState, useCallback, useMemo, useEffect } from 'react';
// FIX: The function calculateChargesBatch is exported from feeService, not geminiService.
import { calculateChargesBatch } from '../services/feeService';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS } from '../constants';
// FIX: Add AllData and InvoiceSettings to the import to correctly type the data object for the modal.
import type { Unit, ChargeRaw, UnitType, Vehicle, WaterReading, Adjustment, Owner, AllData, InvoiceSettings } from '../types';
import { useNotification, useAuth } from '../App';
import NoticePreviewModal from './NoticePreviewModal';

type PaymentStatus = 'pending' | 'unpaid' | 'paid';

interface ChargeWithStatus extends ChargeRaw {
    paymentStatus: PaymentStatus;
}

// NEW: Type for invoice settings is now imported from types.ts
// interface InvoiceSettings {
//     logoUrl: string;
//     accountName: string;
//     accountNumber: string;
//     bankName: string;
// }

const BATCH_SIZE = 50; // Process 50 units per API call for performance
const LOCAL_STORAGE_KEY = 'apartmentManagementCharges';

// Use a base64 encoded logo to ensure it always loads correctly
const saspLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const ChargeCalculation: React.FC = () => {
    // FIX: The `useNotification` hook returns `showToast`, not `showNotification`. Aliasing to match usage in the component.
    const { showToast: showNotification } = useNotification();
    const { role } = useAuth();
    const canCalculate = ['Admin', 'Accountant'].includes(role);

    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    
    const [charges, setCharges] = useState<ChargeWithStatus[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [previewCharge, setPreviewCharge] = useState<ChargeWithStatus | null>(null);
    const [filter, setFilter] = useState<'all' | 'unpaid_apartment' | 'unpaid_kios'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | 'Apartment' | 'KIOS'>('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    
    // FIX: Add `senderEmail` to satisfy the full InvoiceSettings type.
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
        logoUrl: saspLogoBase64,
        accountName: 'Công ty cổ phần cung cấp Dịch vụ và Giải pháp',
        accountNumber: '020704070042387',
        bankName: 'HDBank - Chi nhánh Hoàn Kiếm',
        senderEmail: 'default@example.com',
    });

    // Load charges from localStorage on initial render
    useEffect(() => {
        try {
            const storedCharges = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedCharges) {
                setCharges(JSON.parse(storedCharges));
            }
        } catch (error) {
            console.error("Failed to load charges from localStorage", error);
            showNotification("Không thể tải dữ liệu đã lưu.", "error");
        }
    }, [showNotification]);

    // Save charges to localStorage only when they have actually changed
    useEffect(() => {
        try {
            const currentChargesJSON = JSON.stringify(charges);
            // Avoid writing to localStorage if the data hasn't actually changed.
            if (currentChargesJSON !== localStorage.getItem(LOCAL_STORAGE_KEY)) {
                localStorage.setItem(LOCAL_STORAGE_KEY, currentChargesJSON);
            }
        } catch (error) {
            console.error("Failed to save charges to localStorage", error);
            showNotification("Lỗi khi lưu dữ liệu.", "error");
        }
    }, [charges, showNotification]);


    // Function to change period with buttons
    const navigatePeriod = (direction: 'prev' | 'next' | 'current') => {
        if (direction === 'current') {
            setPeriod(new Date().toISOString().slice(0, 7));
            return;
        }
        const [year, month] = period.split('-').map(Number);
        const d = new Date(year, month - 1, 1);
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        const newPeriod = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        setPeriod(newPeriod);
    };

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

        if (floorA !== floorB) {
            return floorA - floorB;
        }
        return getAptNum(a.UnitID) - getAptNum(b.UnitID);
    };
    
    const sortedUnits = useMemo(() => MOCK_UNITS.slice().sort(sortUnits), []);

    // --- OPTIMIZATION: Memoized maps for faster data lookup ---
    const unitsMap = useMemo(() => new Map<string, Unit>(MOCK_UNITS.map(u => [u.UnitID, u])), []);
    const ownersMap = useMemo(() => new Map<string, Owner>(MOCK_OWNERS.map(o => [o.OwnerID, o])), []);
    const vehiclesByUnitMap = useMemo(() => {
        const map = new Map<string, Vehicle[]>();
        MOCK_VEHICLES.forEach(vehicle => {
            const existing = map.get(vehicle.UnitID) || [];
            map.set(vehicle.UnitID, [...existing, vehicle]);
        });
        return map;
    }, []);
    const waterReadingsByUnitMap = useMemo(() => {
        const map = new Map<string, WaterReading>();
        MOCK_WATER_READINGS.forEach(reading => {
            if (reading.Period === period) {
                map.set(reading.UnitID, reading);
            }
        });
        return map;
    }, [period]);
    const adjustmentsByUnitMap = useMemo(() => {
        const map = new Map<string, Adjustment[]>();
        MOCK_ADJUSTMENTS.forEach(adj => {
            if (adj.Period === period) {
                const existing = map.get(adj.UnitID) || [];
                map.set(adj.UnitID, [...existing, adj]);
            }
        });
        return map;
    }, [period]);
    // --- End Optimization ---

    // FIX: Construct allData object from mock data to pass to the preview modal and calculation engine.
    // Moved before `runCalculations` to be in scope.
    const allData: AllData = useMemo(() => ({
        units: MOCK_UNITS,
        owners: MOCK_OWNERS,
        vehicles: MOCK_VEHICLES,
        waterReadings: MOCK_WATER_READINGS,
        tariffs: {
            service: MOCK_TARIFFS_SERVICE,
            parking: MOCK_TARIFFS_PARKING,
            water: MOCK_TARIFFS_WATER,
        },
        adjustments: MOCK_ADJUSTMENTS,
    }), []);


    // --- Main Calculation Logic ---
    const runCalculations = useCallback(async (unitsToCalc: string[]) => {
        if (!canCalculate) {
            showNotification('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
        if (unitsToCalc.length === 0) return;

        // Pre-calculation check for missing data using the optimized map
        const unitsWithMissingWater = unitsToCalc.filter(unitId => 
            !waterReadingsByUnitMap.has(unitId)
        );

        if (unitsWithMissingWater.length > 0) {
            const confirmation = window.confirm(
                `CẢNH BÁO: Tìm thấy ${unitsWithMissingWater.length} căn hộ thiếu chỉ số nước cho kỳ ${period}:\n\n` +
                `${unitsWithMissingWater.slice(0, 10).join(', ')}${unitsWithMissingWater.length > 10 ? '...' : ''}\n\n` +
                `Việc tính toán cho các căn này sẽ thất bại. Bạn có muốn tiếp tục?`
            );
            if (!confirmation) return;
        }

        setIsLoading(true);
        setProgress({ current: 0, total: unitsToCalc.length });
        
        // 1. Create batches of unit IDs
        const batches: string[][] = [];
        for (let i = 0; i < unitsToCalc.length; i += BATCH_SIZE) {
            batches.push(unitsToCalc.slice(i, i + BATCH_SIZE));
        }

        let totalErrorCount = 0;

        // 2. Map each batch to a promise that resolves with its calculated charges
        const batchPromises = batches.map(batchUnitIds => {
            const calculationInputs = batchUnitIds.map(unitId => {
                const unit = unitsMap.get(unitId);
                const owner = unit ? ownersMap.get(unit.OwnerID) : undefined;
                const vehicles = vehiclesByUnitMap.get(unitId) || [];
                const waterReading = waterReadingsByUnitMap.get(unitId);
                const adjustments = adjustmentsByUnitMap.get(unitId) || [];
                
                if (!unit || !owner || !waterReading) {
                    totalErrorCount++;
                    return null;
                }
                return { unit, owner, vehicles, waterReading, adjustments };
            }).filter(Boolean);

            if (calculationInputs.length === 0) {
                setProgress(prev => ({ ...prev, current: prev.current + batchUnitIds.length }));
                return Promise.resolve([]);
            }

            // FIX: Pass the complete `allData` object as expected by the function signature.
            return calculateChargesBatch(
                period,
                calculationInputs as any,
                allData
            )
            .then(batchResults => {
                setProgress(prev => ({ ...prev, current: prev.current + batchUnitIds.length }));
                return batchResults;
            })
            .catch(error => {
                console.error(`Batch calculation failed for units ${batchUnitIds.join(', ')}:`, error);
                setProgress(prev => ({ ...prev, current: prev.current + batchUnitIds.length }));
                totalErrorCount += calculationInputs.length;
                return []; // Return empty array so Promise.all doesn't reject
            });
        });
        
        // 3. Await all promises in parallel
        const allBatchResults = await Promise.all(batchPromises);

        // 4. Flatten results and add metadata
        const allNewCharges: ChargeWithStatus[] = allBatchResults
            .flat()
            .map(charge => ({
                ...charge,
                CreatedAt: new Date().toISOString(),
                Locked: false,
                paymentStatus: 'pending' as PaymentStatus,
            }));

        // 5. Update state once
        setCharges(prev => {
            const recalculatedUnitIds = new Set(unitsToCalc);
            const otherCharges = prev.filter(c => 
                !(c.Period === period && recalculatedUnitIds.has(c.UnitID))
            );
            return [...otherCharges, ...allNewCharges].sort(sortUnits);
        });
        
        // 6. Reset UI
        setIsLoading(false);
        setProgress({ current: 0, total: 0 });
        setSelectedUnits(new Set());

        if (totalErrorCount > 0) {
             showNotification(`Hoàn tất! ${allNewCharges.length} thành công, ${totalErrorCount} thất bại/thiếu dữ liệu.`, 'error');
        } else {
             showNotification(`Đã tính phí xong cho ${allNewCharges.length} căn hộ.`, 'success');
        }

    }, [
        period, 
        showNotification, 
        canCalculate, 
        unitsMap, 
        ownersMap, 
        vehiclesByUnitMap, 
        waterReadingsByUnitMap, 
        adjustmentsByUnitMap,
        allData
    ]);
    
    // NEW: Handle logo file upload and conversion to base64
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (result) {
                    setInvoiceSettings(s => ({...s, logoUrl: result}));
                    showNotification('Logo đã được cập nhật.', 'success');
                } else {
                     showNotification('Không thể đọc file logo.', 'error');
                }
            };
            reader.onerror = () => {
                showNotification('Lỗi khi đọc file logo.', 'error');
            }
            reader.readAsDataURL(file);
        }
    };

    const chargesForPeriod = useMemo(() => charges.filter(c => c.Period === period), [charges, period]);
    const isPeriodCalculated = useMemo(() => chargesForPeriod.length > 0, [chargesForPeriod]);

    const summaryStats = useMemo(() => {
        const totalCount = chargesForPeriod.length;
        if (totalCount === 0) {
            return { unpaidApartments: 0, unpaidKios: 0, totalDue: 0, totalPaid: 0, totalDebt: 0, paidPercentage: 0 };
        }
        
        const unpaidApartments = chargesForPeriod.filter(c => {
            const unit = unitsMap.get(c.UnitID);
            return (c.paymentStatus === 'unpaid' || c.paymentStatus === 'pending') && unit?.UnitType === 'Apartment';
        }).length;

        const unpaidKios = chargesForPeriod.filter(c => {
            const unit = unitsMap.get(c.UnitID);
            return (c.paymentStatus === 'unpaid' || c.paymentStatus === 'pending') && unit?.UnitType === 'KIOS';
        }).length;

        const totalDue = chargesForPeriod.reduce((sum, c) => sum + c.TotalDue, 0);
        const totalPaid = chargesForPeriod.filter(c => c.paymentStatus === 'paid').reduce((sum, c) => sum + c.TotalDue, 0);
        const totalDebt = totalDue - totalPaid;
        const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

        return { unpaidApartments, unpaidKios, totalDue, totalPaid, totalDebt, paidPercentage };
    }, [chargesForPeriod, unitsMap]);

    const filteredCharges = useMemo(() => {
        return chargesForPeriod.filter(c => {
                const unit = unitsMap.get(c.UnitID);
                if (!unit) return false;

                if (filter !== 'all') {
                    const isUnpaid = c.paymentStatus === 'unpaid' || c.paymentStatus === 'pending';
                    if (filter === 'unpaid_apartment' && (!isUnpaid || unit.UnitType !== 'Apartment')) return false;
                    if (filter === 'unpaid_kios' && (!isUnpaid || unit.UnitType !== 'KIOS')) return false;
                }
                
                if (paymentStatusFilter !== 'all' && c.paymentStatus !== paymentStatusFilter) return false;
                if (unitTypeFilter !== 'all' && unit.UnitType !== unitTypeFilter) return false;
                
                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    if (!c.UnitID.toLowerCase().includes(lowerSearch) && !c.OwnerName.toLowerCase().includes(lowerSearch)) {
                         return false;
                    }
                }
                return true;
            });
    }, [chargesForPeriod, filter, searchTerm, unitTypeFilter, paymentStatusFilter, unitsMap]);

    // --- SELECTION & BATCH ACTIONS ---
    const handleSelectUnit = (unitId: string, isSelected: boolean) => {
        const newSelection = new Set(selectedUnits);
        if (isSelected) {
            newSelection.add(unitId);
        } else {
            newSelection.delete(unitId);
        }
        setSelectedUnits(newSelection);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedUnits(new Set(filteredCharges.map(c => c.UnitID)));
        } else {
            setSelectedUnits(new Set());
        }
    };
    
    const handleBatchSendEmail = () => {
        if (selectedUnits.size === 0) {
            showNotification('Vui lòng chọn ít nhất một căn hộ để gửi mail.', 'error');
            return;
        }
        const recipients = Array.from(selectedUnits)
            .map(unitId => charges.find(c => c.UnitID === unitId)?.Email)
            .filter(Boolean);
        
        if (recipients.length === 0) {
            showNotification('Không tìm thấy email hợp lệ cho các căn hộ đã chọn.', 'error');
            return;
        }

        showNotification(`Đang mở trình gửi mail cho ${recipients.length} người nhận...`, 'success');
        const subject = `[BQL] Thông báo phí tháng ${period}`;
        const body = `Kính gửi Quý Cư dân,\n\nBan Quản lý tòa nhà trân trọng gửi tới Quý Cư dân thông báo phí dịch vụ tháng ${period}.\n\nChi tiết phí của từng căn hộ đã được gửi riêng.\n\nTrân trọng cảm ơn!`;
        window.location.href = `mailto:?bcc=${recipients.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const getStatusText = (status: PaymentStatus) => {
        switch (status) {
            case 'paid': return { text: 'Đã nộp', class: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
            case 'unpaid': return { text: 'Chưa nộp', class: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
            case 'pending':
            default:
                return { text: 'Chờ xử lý', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
        }
    };
    
     const handleStatusChange = (unitId: string, newStatus: PaymentStatus) => {
        setCharges(prev => prev.map(c => 
            (c.UnitID === unitId && c.Period === period) ? { ...c, paymentStatus: newStatus } : c
        ));
        showNotification(`Cập nhật trạng thái cho căn ${unitId} thành công.`, 'success');
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
    
    const isAllVisibleSelected = filteredCharges.length > 0 && selectedUnits.size === filteredCharges.length && filteredCharges.every(c => selectedUnits.has(c.UnitID));


    return (
        <div className="bg-background dark:bg-dark-secondary p-4 sm:p-6 rounded-lg shadow-md h-full flex flex-col">
            <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary mb-6">Tính phí &amp; Gửi phiếu báo</h2>

            {/* Top control section */}
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div className="p-4 border border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10 rounded-lg flex-grow flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <label htmlFor="period-select" className="block font-semibold text-text-secondary dark:text-dark-text-secondary">Kỳ tính phí:</label>
                        <input type="month" id="period-select" value={period} onChange={(e) => setPeriod(e.target.value)} className="p-2 border rounded-md bg-background dark:bg-dark-background border-border-color dark:border-dark-border-color"/>
                        <button onClick={() => navigatePeriod('prev')} className="px-2 py-2 text-sm bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300">&lt; Trước</button>
                        <button onClick={() => navigatePeriod('current')} className="px-2 py-2 text-sm bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300">Hiện tại</button>
                        <button onClick={() => navigatePeriod('next')} className="px-2 py-2 text-sm bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300">Sau &gt;</button>
                    </div>
                     <div className="flex flex-wrap gap-2">
                        {isPeriodCalculated ? (
                            <>
                                <button
                                    onClick={() => {
                                        if (window.confirm(`Bạn có chắc muốn TÍNH LẠI TOÀN BỘ phí cho kỳ ${period}? Dữ liệu cũ sẽ bị ghi đè.`)) {
                                            runCalculations(sortedUnits.map(u => u.UnitID));
                                        }
                                    }}
                                    disabled={isLoading || !canCalculate}
                                    className="flex-grow sm:flex-grow-0 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-wait"
                                >
                                    {isLoading ? 'Đang tính lại...' : 'Tính lại toàn bộ'}
                                </button>
                                {selectedUnits.size > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Bạn có chắc muốn TÍNH LẠI phí cho ${selectedUnits.size} căn đã chọn? Dữ liệu cũ của các căn này sẽ bị ghi đè.`)) {
                                                runCalculations(Array.from(selectedUnits));
                                            }
                                        }}
                                        disabled={isLoading || !canCalculate}
                                        className="flex-grow sm:flex-grow-0 px-4 py-2 bg-orange-500 text-white font-semibold rounded-md shadow-sm hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-wait"
                                    >
                                        {isLoading ? 'Đang tính...' : `Tính lại cho ${selectedUnits.size} căn đã chọn`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <button 
                                onClick={() => runCalculations(sortedUnits.map(u => u.UnitID))} 
                                disabled={isLoading || !canCalculate} 
                                className="flex-grow sm:flex-grow-0 px-6 py-2 bg-primary text-white font-bold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-wait"
                            >
                                {isLoading ? `Đang tính...` : `Tính phí cho Kỳ ${period}`}
                            </button>
                        )}
                    </div>
                    {isLoading && (
                        <div className="w-full bg-gray-200 rounded-full dark:bg-gray-700">
                            <div className="bg-primary text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}>
                                {`${progress.current}/${progress.total}`}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border rounded-lg dark:border-dark-border-color bg-gray-50 dark:bg-dark-background/30 flex-grow">
                    <h3 className="font-semibold mb-3 text-md text-text-primary dark:text-dark-text-primary">Tổng hợp công nợ Kỳ {period}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div>
                            <p className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Doanh thu</p>
                            <p className="text-lg font-bold text-primary dark:text-green-400">{formatCurrency(summaryStats.totalDue)}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Đã nộp</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-500">{formatCurrency(summaryStats.totalPaid)}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Còn nợ</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-500">{formatCurrency(summaryStats.totalDebt)}</p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Tỷ lệ nộp</p>
                            <p className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{summaryStats.paidPercentage.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* UPDATED: Invoice Settings Section with File Upload */}
            <details className="mb-4">
                <summary className="cursor-pointer font-semibold text-primary">Cài đặt Phiếu báo</summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-gray-50 dark:bg-dark-secondary/50 rounded-lg border dark:border-dark-border-color">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">Logo Phiếu báo</label>
                        <div className="flex items-center gap-4">
                            <img src={invoiceSettings.logoUrl} alt="Logo Preview" className="h-12 w-auto border p-1 rounded-md bg-white object-contain"/>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="hidden"
                                id="logo-upload"
                            />
                            <label htmlFor="logo-upload" className="cursor-pointer px-3 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 text-sm">
                                Thay đổi...
                            </label>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="accountName" className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">Tên chủ TK</label>
                        <input id="accountName" type="text" placeholder="Tên chủ TK" value={invoiceSettings.accountName} onChange={e => setInvoiceSettings(s => ({...s, accountName: e.target.value}))} className="p-2 border rounded-md dark:bg-dark-background dark:border-dark-border-color w-full"/>
                    </div>
                    <div>
                        <label htmlFor="accountNumber" className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">Số tài khoản</label>
                        <input id="accountNumber" type="text" placeholder="Số tài khoản" value={invoiceSettings.accountNumber} onChange={e => setInvoiceSettings(s => ({...s, accountNumber: e.target.value}))} className="p-2 border rounded-md dark:bg-dark-background dark:border-dark-border-color w-full"/>
                    </div>
                    <div>
                        <label htmlFor="bankName" className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">Tên ngân hàng</label>
                        <input id="bankName" type="text" placeholder="Tên ngân hàng" value={invoiceSettings.bankName} onChange={e => setInvoiceSettings(s => ({...s, bankName: e.target.value}))} className="p-2 border rounded-md dark:bg-dark-background dark:border-dark-border-color w-full"/>
                    </div>
                </div>
            </details>


            {/* Search and Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-dark-secondary/50 rounded-lg border dark:border-dark-border-color">
                <div className="flex-grow">
                     <input id="search-unit" type="text" placeholder="Tìm theo mã căn hộ, tên chủ hộ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 p-2 border rounded-md dark:bg-dark-background dark:border-dark-border-color"/>
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="status-filter" className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Trạng thái:</label>
                    <select id="status-filter" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | PaymentStatus)} className="p-2 border rounded-md dark:bg-dark-background dark:border-dark-border-color">
                        <option value="all">Tất cả</option>
                        <option value="pending">Chờ xử lý</option>
                        <option value="unpaid">Chưa nộp</option>
                        <option value="paid">Đã nộp</option>
                    </select>
                </div>
            </div>

            {/* Table section */}
            <div className="p-4 border rounded-lg dark:border-dark-border-color flex-1 flex flex-col overflow-hidden">
                 <div className="overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
                        <thead className="bg-gray-50 dark:bg-dark-secondary sticky top-0">
                            <tr>
                                <th className="px-2 py-3 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllVisibleSelected} className="rounded"/></th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase">Căn hộ</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase">Chủ hộ</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase">Tổng cộng</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase">Trạng thái</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
                            {isLoading && chargesForPeriod.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-8">Đang tính toán cho kỳ {period}...</td></tr>
                            )}
                            {!isLoading && filteredCharges.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-8">Không có dữ liệu. {isPeriodCalculated ? 'Hãy thử bộ lọc khác.' : 'Vui lòng bấm "Tính phí" để bắt đầu.'}</td></tr>
                            )}
                            {filteredCharges.map(charge => {
                                const status = getStatusText(charge.paymentStatus);
                                return (
                                <tr key={charge.UnitID} className="hover:bg-gray-50 dark:hover:bg-dark-secondary">
                                    <td className="px-2 py-4 text-center"><input type="checkbox" checked={selectedUnits.has(charge.UnitID)} onChange={(e) => handleSelectUnit(charge.UnitID, e.target.checked)} className="rounded"/></td>
                                    <td className="px-4 py-4 whitespace-nowrap font-medium text-text-primary dark:text-dark-text-primary">{charge.UnitID}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary dark:text-dark-text-secondary">{charge.OwnerName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-text-primary dark:text-dark-text-primary">{formatCurrency(charge.TotalDue)}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>{status.text}</span></td>
                                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm space-x-2">
                                        <button onClick={() => handleStatusChange(charge.UnitID, 'unpaid')} className="text-red-500 hover:text-red-700 font-semibold" title="Đánh dấu Chưa nộp">Chưa nộp</button>
                                        <button onClick={() => handleStatusChange(charge.UnitID, 'paid')} className="text-green-500 hover:text-green-700 font-semibold" title="Đánh dấu Đã nộp">Đã nộp</button>
                                        <button onClick={() => setPreviewCharge(charge)} className="text-primary hover:text-primary-dark font-semibold">Xem &amp; Gửi</button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 {selectedUnits.size > 0 && (
                    <div className="mt-4 p-2 bg-gray-100 dark:bg-dark-secondary/50 rounded-md flex items-center justify-between">
                        <span className="text-sm font-semibold">{selectedUnits.size} căn hộ đã chọn</span>
                        <button onClick={handleBatchSendEmail} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700">
                            Gửi Email hàng loạt
                        </button>
                    </div>
                )}
            </div>
            
            {previewCharge && (
                <NoticePreviewModal 
                    charge={previewCharge}
                    onClose={() => setPreviewCharge(null)}
                    invoiceSettings={invoiceSettings}
                    // FIX: Pass the allData object to the modal.
                    allData={allData}
                />
            )}
        </div>
    );
};

export default ChargeCalculation;
