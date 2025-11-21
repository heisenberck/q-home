import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Unit, Owner, Vehicle, Role, UserPermission } from '../../types';
import { UnitType, VehicleTier } from '../../types';
import Modal from '../ui/Modal';
import { useNotification } from '../../App';
import { 
    EyeIcon, PencilSquareIcon, BuildingIcon, TagIcon, CheckCircleIcon, UploadIcon, UserGroupIcon, 
    UserIcon, KeyIcon, StoreIcon, CarIcon, PrinterIcon, TrashIcon,
    MotorbikeIcon, DocumentArrowDownIcon, ActionViewIcon, TableCellsIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';

// Declare external libraries
declare const jspdf: any;
declare const html2canvas: any;
declare const JSZip: any;
declare const XLSX: any; // SheetJS

const parseUnitCode = (code: string) => {
    const s = String(code).trim();
    if (s.startsWith('K')) return { floor: 99, apt: parseInt(s.substring(1), 10) || 0 };
    if (!/^\d{3,4}$/.test(s)) return null;
    let floor, apt;
    if (s.length === 3) {
        floor = parseInt(s.slice(0, 1), 10);
        apt = parseInt(s.slice(1), 10);
    } else { // 4 digits
        floor = parseInt(s.slice(0, 2), 10);
        apt = parseInt(s.slice(2), 10);
    }
    return { floor, apt };
};

type ResidentData = {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
};

interface ResidentsPageProps {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    onSaveResident: (data: { unit: Unit, owner: Owner, vehicles: Vehicle[] }) => void;
    onImportData: (updates: any[]) => void;
    onDeleteResidents: (unitIds: Set<string>) => void;
    role: Role;
    currentUser: UserPermission;
}

type VehicleErrors = {
    plateNumber?: string;
};

// --- START: PDF Generation Helper ---
const translateVehicleType = (type: VehicleTier): string => {
    switch (type) {
        case VehicleTier.CAR:
        case VehicleTier.CAR_A:
            return 'Ô tô';
        case VehicleTier.MOTORBIKE:
        case VehicleTier.EBIKE:
            return 'Xe máy';
        case VehicleTier.BICYCLE:
            return 'Xe đạp';
        default:
            return type;
    }
};

const renderResidentToHTML = (resident: ResidentData): string => {
    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return 'Chính chủ';
            case 'Rent': return 'Hộ thuê';
            case 'Business': return 'Kinh doanh';
        }
    };
    const activeVehicles = resident.vehicles.filter(v => v.isActive);

    const vehicleRows = activeVehicles.length > 0
        ? activeVehicles.map(v => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #333;">${translateVehicleType(v.Type)}</td>
                <td style="padding: 8px; color: #333;">${v.VehicleName || ''}</td>
                <td style="padding: 8px; color: #333; font-family: monospace;">${v.PlateNumber}</td>
                <td style="padding: 8px; color: #333;">${v.parkingStatus || ''}</td>
                <td style="padding: 8px; color: #333;">${new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding: 12px; font-style: italic; color: #777; text-align: center;">Chưa đăng ký phương tiện nào.</td></tr>';
    
    const unitTypeDisplay = resident.unit.UnitType === UnitType.APARTMENT ? 'Căn hộ' : 'Kios';

    return `
    <div style="font-family: 'Inter', Arial, sans-serif; color: #1f2937; padding: 40px; background-color: white; max-width: 210mm; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px;">
            <h2 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 8px 0; text-transform: uppercase;">HỒ SƠ CƯ DÂN</h2>
            <p style="font-size: 16px; color: #6b7280; margin: 0;">Căn hộ: <span style="font-weight: 600; color: #374151;">${resident.unit.UnitID}</span></p>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Chủ hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Họ và tên:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${resident.owner.OwnerName}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Số điện thoại:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${resident.owner.Phone}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Email:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${resident.owner.Email}</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Căn hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Mã căn:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${resident.unit.UnitID}</td>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500; padding-left: 24px;">Loại hình:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${unitTypeDisplay}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Trạng thái:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${getTypeDisplay(resident.unit.Status)}</td>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500; padding-left: 24px;">Diện tích:</td>
                    <td style="padding: 6px 0; font-weight: 600;">${resident.unit.Area_m2} m²</td>
                </tr>
            </table>
        </div>
        
        <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Danh sách Phương tiện (${activeVehicles.length})</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e5e7eb;">
                <thead style="background-color: #f9fafb;">
                    <tr>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Loại xe</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Tên xe</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Biển số</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Trạng thái đỗ</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Ngày ĐK</th>
                    </tr>
                </thead>
                <tbody>${vehicleRows}</tbody>
            </table>
        </div>
    </div>
    `;
};
// --- END: PDF Generation Helper ---


// --- NEW: Resident View Modal ---
const ResidentViewModal: React.FC<{
    resident: ResidentData;
    onClose: () => void;
}> = ({ resident, onClose }) => {
    const printContentRef = useRef<HTMLDivElement>(null);
    const { showToast } = useNotification();

    const handleExportPdf = async () => {
        const content = printContentRef.current;
        if (!content) return;
        
        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas')]);

            showToast("Đang tạo PDF...", "info");
            const { jsPDF } = jspdf;
            const canvas = await html2canvas(content, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.8); 
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`HoSoCuDan_${resident.unit.UnitID}.pdf`);
            showToast("Tải file PDF thành công!", "success");
        } catch (error) {
            console.error("Single PDF export failed:", error);
            showToast("Không thể tạo PDF. Vui lòng thử lại.", "error");
        }
    };

    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return 'Chính chủ';
            case 'Rent': return 'Hộ thuê';
            case 'Business': return 'Kinh doanh';
        }
    };
    
    const activeVehicles = resident.vehicles.filter(v => v.isActive);
    const unitTypeDisplay = resident.unit.UnitType === UnitType.APARTMENT ? 'Căn hộ' : 'Kios';

    return (
        <Modal title={`Hồ sơ Cư dân - Căn hộ ${resident.unit.UnitID}`} onClose={onClose} size="4xl">
            <div className="bg-gray-100 dark:bg-gray-900 p-4 overflow-auto max-h-[75vh]">
                <div ref={printContentRef} className="p-8 bg-white text-gray-800 rounded-sm shadow-lg max-w-[210mm] mx-auto min-h-[297mm]">
                    <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
                        <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">HỒ SƠ CƯ DÂN</h2>
                        <p className="text-lg text-gray-500 mt-1">Căn hộ: <span className="font-bold text-gray-700">{resident.unit.UnitID}</span></p>
                    </div>
                    <div className="space-y-8">
                        <section>
                            <h3 className="text-lg font-bold text-primary border-b border-gray-200 pb-2 mb-4 uppercase tracking-wide">Thông tin Chủ hộ</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Họ và tên:</span><span className="font-semibold text-gray-800">{resident.owner.OwnerName}</span></div>
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Số điện thoại:</span><span className="font-semibold text-gray-800">{resident.owner.Phone}</span></div>
                                <div className="flex justify-between border-b border-gray-100 py-2 md:col-span-2"><span className="font-medium text-gray-500">Email:</span><span className="font-semibold text-gray-800">{resident.owner.Email}</span></div>
                            </div>
                        </section>
                        <section>
                            <h3 className="text-lg font-bold text-primary border-b border-gray-200 pb-2 mb-4 uppercase tracking-wide">Thông tin Căn hộ</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Mã căn:</span><span className="font-semibold text-gray-800">{resident.unit.UnitID}</span></div>
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Loại hình:</span><span className="font-semibold text-gray-800">{unitTypeDisplay}</span></div>
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Trạng thái:</span><span className="font-semibold text-gray-800">{getTypeDisplay(resident.unit.Status)}</span></div>
                                <div className="flex justify-between border-b border-gray-100 py-2"><span className="font-medium text-gray-500">Diện tích:</span><span className="font-semibold text-gray-800">{resident.unit.Area_m2} m²</span></div>
                            </div>
                        </section>
                        <section>
                            <h3 className="text-lg font-bold text-primary border-b border-gray-200 pb-2 mb-4 uppercase tracking-wide">Danh sách Phương tiện ({activeVehicles.length})</h3>
                            {activeVehicles.length > 0 ? (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Loại xe</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên xe</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Biển số</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Trạng thái đỗ</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày ĐK</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {activeVehicles.map((vehicle) => (
                                                <tr key={vehicle.VehicleId}>
                                                    <td className="px-4 py-3 text-gray-800">{translateVehicleType(vehicle.Type)}</td>
                                                    <td className="px-4 py-3 text-gray-800">{vehicle.VehicleName}</td>
                                                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{vehicle.PlateNumber}</td>
                                                    <td className="px-4 py-3 text-gray-800">{vehicle.parkingStatus || '-'}</td>
                                                    <td className="px-4 py-3 text-gray-600">{new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic text-center py-4 border border-dashed border-gray-300 rounded-lg">Chưa đăng ký phương tiện nào.</p>
                            )}
                        </section>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-light-bg dark:bg-dark-bg-secondary border-t dark:border-dark-border mt-auto">
                <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 transition-colors">
                    <DocumentArrowDownIcon /> Export PDF
                </button>
                 <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    Đóng
                </button>
            </div>
        </Modal>
    );
};


// --- Resident Detail/Edit Modal (View & Edit) ---
const ResidentDetailModal: React.FC<{
    resident: ResidentData;
    onClose: () => void;
    onSave: (updatedData: { unit: Unit, owner: Owner, vehicles: Vehicle[] }) => void;
}> = ({ resident, onClose, onSave }) => {
    const { showToast } = useNotification();
    
    const [formData, setFormData] = useState<{unit: Unit, owner: Owner, vehicles: Vehicle[]}>({
        ...resident,
        vehicles: JSON.parse(JSON.stringify(resident.vehicles.filter(v => v.isActive)))
    });
    const [errors, setErrors] = useState<Record<number, VehicleErrors>>({});
    const [isSaving, setIsSaving] = useState(false);

    const vehicleLimits = useMemo(() => {
        const isOwner = formData.unit.Status === 'Owner';
        const isRenter = formData.unit.Status === 'Rent';

        const carCount = formData.vehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const motorbikeCount = formData.vehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;

        const canAddCar = !isRenter && (!isOwner || carCount < 1);

        return {
            isOwner,
            isRenter,
            carCount,
            motorbikeCount,
            canAddCar,
            showMotorbikeWarning: isOwner && motorbikeCount > 5,
        };
    }, [formData.unit.Status, formData.vehicles]);


    const formElementStyle = `w-full p-2 border rounded-md bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed`;

    const validateVehicle = useCallback((vehicle: Vehicle): VehicleErrors => {
        const vErrors: VehicleErrors = {};
        const isBicycle = vehicle.Type === VehicleTier.BICYCLE;
        const plate = vehicle.PlateNumber?.trim() || '';
        
        if (!isBicycle && !plate) {
            vErrors.plateNumber = "Biển số là bắt buộc.";
        } else if (plate && !isBicycle) {
            const isCar = vehicle.Type === VehicleTier.CAR || vehicle.Type === VehicleTier.CAR_A;
            const isMoto = vehicle.Type === VehicleTier.MOTORBIKE || vehicle.Type === VehicleTier.EBIKE;
            const carRegex = /^\d{2}[A-Z]-\d{5}$/;
            const motoRegex = /^\d{2}[A-Z]\d?-?\d{5}$/;

            if (isCar && !carRegex.test(plate)) vErrors.plateNumber = "Biển số không hợp lệ. Ví dụ: 30E-43699";
            if (isMoto && !motoRegex.test(plate)) vErrors.plateNumber = "Biển số không hợp lệ. Ví dụ: 29H1-49307";
        }
        return vErrors;
    }, []);
    
    useEffect(() => {
        const allErrors: Record<number, VehicleErrors> = {};
        formData.vehicles.forEach((v, index) => {
            const vErrors = validateVehicle(v);
            if (Object.keys(vErrors).length > 0) allErrors[index] = vErrors;
        });
        setErrors(allErrors);
    }, [formData.vehicles, validateVehicle]);
    
    const handleOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, owner: { ...p.owner, [e.target.name]: e.target.value } }));
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData(p => ({ ...p, unit: { ...p.unit, [e.target.name]: e.target.value as any }}));
    const handleVehicleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [name]: value as any };
        setFormData(p => ({ ...p, vehicles: updatedVehicles }));
    };

    const handleLicensePlateBlur = (index: number, e: React.FocusEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const vehicle = formData.vehicles[index];
        const isCar = vehicle.Type === VehicleTier.CAR || vehicle.Type === VehicleTier.CAR_A;
        
        let formattedPlate = value.trim().toUpperCase().replace(/\s/g, '');
        if (isCar && /^\d{2}[A-Z]\d{5}$/.test(formattedPlate)) {
            formattedPlate = formattedPlate.slice(0, 3) + '-' + formattedPlate.slice(3);
        }
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index].PlateNumber = formattedPlate;
        setFormData(p => ({ ...p, vehicles: updatedVehicles }));
    };

    const handleAddVehicle = () => {
        const newVehicle: Vehicle = {
            VehicleId: `VEH_NEW_${Date.now()}`,
            UnitID: formData.unit.UnitID,
            Type: VehicleTier.MOTORBIKE,
            VehicleName: '',
            PlateNumber: '',
            StartDate: new Date().toISOString().split('T')[0],
            isActive: true,
        };
        setFormData(p => ({...p, vehicles: [...p.vehicles, newVehicle]}));
    };
    
    const handleRemoveVehicle = (index: number) => setFormData(p => ({ ...p, vehicles: p.vehicles.filter((_, i) => i !== index) }));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (Object.keys(errors).length > 0) {
            showToast('Vui lòng sửa các lỗi trong biểu mẫu trước khi lưu.', 'error');
            return;
        }
        setIsSaving(true);
        onSave(formData);
        onClose();
    };

    return (
        <Modal title={`Sửa thông tin - Căn hộ ${resident.unit.UnitID}`} onClose={onClose} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <section>
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4">Thông tin cư dân</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="font-medium text-sm">Tên chủ hộ</label><input name="OwnerName" value={formData.owner.OwnerName} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div><label className="font-medium text-sm">Số điện thoại</label><input name="Phone" value={formData.owner.Phone} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div><label className="font-medium text-sm">Email</label><input type="email" name="Email" value={formData.owner.Email} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div>
                            <label className="font-medium text-sm">Loại căn hộ</label>
                            <select name="Status" value={formData.unit.Status} onChange={handleUnitChange} className={formElementStyle}>
                                <option value="Owner">Chính chủ</option><option value="Rent">Hộ thuê</option><option value="Business">Kinh doanh</option>
                            </select>
                        </div>
                    </div>
                </section>
                
                <section>
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4">Phương tiện</h3>
                    {vehicleLimits.showMotorbikeWarning && (
                        <div className="p-3 mb-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-r-md">
                            <p className="font-bold">Cảnh báo: Hộ chính chủ đã đăng ký quá 5 xe máy.</p>
                        </div>
                    )}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {formData.vehicles.map((vehicle, index) => (
                            <div key={vehicle.VehicleId || index} className="grid grid-cols-1 md:grid-cols-10 gap-2 items-start p-2 bg-light-bg dark:bg-dark-bg rounded-md border dark:border-dark-border">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold">Loại xe</label>
                                    <select name="Type" value={vehicle.Type} onChange={e => handleVehicleChange(index, e)} className={formElementStyle}>
                                        <option value={VehicleTier.CAR} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR} title={!vehicleLimits.canAddCar ? 'Đã đạt giới hạn ô tô cho phép' : ''}>Ô tô</option>
                                        <option value={VehicleTier.CAR_A} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR_A} title={!vehicleLimits.canAddCar ? 'Đã đạt giới hạn ô tô cho phép' : ''}>Ô tô hạng A</option>
                                        <option value="motorbike">Xe máy</option>
                                        <option value={VehicleTier.EBIKE}>Xe điện</option>
                                        <option value={VehicleTier.BICYCLE}>Xe đạp</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3"><label className="text-xs font-semibold">Tên xe</label><input type="text" name="VehicleName" placeholder={vehicle.Type.includes('car') ? 'Toyota Vios...' : 'Honda SH...'} value={vehicle.VehicleName || ''} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                <div className="md:col-span-2"><label className="text-xs font-semibold">Biển số</label><input type="text" name="PlateNumber" value={vehicle.PlateNumber} onBlur={(e) => handleLicensePlateBlur(index, e)} onChange={e => handleVehicleChange(index, e)} className={`${formElementStyle} ${errors[index]?.plateNumber ? 'border-red-500' : ''}`} /><p className="text-red-500 text-xs mt-1 h-3">{errors[index]?.plateNumber}</p></div>
                                <div className="md:col-span-2"><label className="text-xs font-semibold">Ngày ĐK</label><input type="date" name="StartDate" value={vehicle.StartDate} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                <div className="md:col-span-1 text-center self-center pt-5"><button type="button" onClick={() => handleRemoveVehicle(index)} className="text-red-500 hover:underline font-semibold">Xóa</button></div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddVehicle} className="mt-4 px-3 py-1 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-focus">+ Thêm xe</button>
                </section>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-dark-border"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button><button type="submit" disabled={isSaving || Object.keys(errors).length > 0} className="px-4 py-2 bg-primary text-white rounded-md disabled:bg-gray-400">{isSaving ? 'Đang lưu...' : 'Lưu'}</button></div>
            </form>
        </Modal>
    );
};

// --- IMPROVED: Smart Data Import Modal ---
const DataImportModal: React.FC<{
    onClose: () => void;
    onImport: (updates: any[]) => void;
}> = ({ onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [mappedHeaders, setMappedHeaders] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const { showToast } = useNotification();

    // Mapping configuration: Field -> Keywords
    const fieldKeywords: Record<string, string[]> = {
        unitId: ['ma can', 'can ho', 'unit', 'room', 'phong', 'apartment'],
        area: ['dien tich', 'm2', 'area', 'sqm'],
        ownerName: ['chu ho', 'ho ten', 'owner', 'name', 'ten', 'full name'],
        phone: ['sdt', 'so dien thoai', 'dien thoai', 'mobile', 'tel', 'phone'],
        email: ['email', 'mail', 'thu dien tu'],
        status: ['trang thai', 'status', 'loai', 'type'],
    };

    // Keywords to detect vehicle columns (e.g. "Biển số xe 1", "Xe máy", "Ô tô")
    const vehicleKeywords = ['bien so', 'bs', 'plate', 'xe', 'car', 'oto', 'o to', 'moto'];

    const normalizeHeader = (header: string) => {
        if (!header) return '';
        return String(header).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                processData(data);
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const processData = (data: Uint8Array) => {
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Convert to array of arrays to get headers first
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (jsonData.length < 2) {
                setErrors(["File không có dữ liệu."]);
                setPreview([]);
                return;
            }

            const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
            const mapResult: Record<string, number> = {};
            const vehicleCols: { index: number; header: string }[] = [];
            const detectedFields: string[] = [];

            // Smart Mapping
            headers.forEach((header, index) => {
                const normalized = normalizeHeader(header);
                if (!normalized) return;
                let matched = false;

                // Check standard fields
                for (const [field, keywords] of Object.entries(fieldKeywords)) {
                    if (keywords.some(k => normalized.includes(k))) {
                        if (mapResult[field] === undefined) { // Take first match
                             mapResult[field] = index;
                             detectedFields.push(`${header} -> ${field}`);
                             matched = true;
                        }
                    }
                }

                // Check vehicle fields
                if (vehicleKeywords.some(k => normalized.includes(k))) {
                    vehicleCols.push({ index, header: normalized });
                    if (!matched) detectedFields.push(`${header} -> Vehicle Info`);
                }
            });

            setMappedHeaders(detectedFields);

            if (mapResult.unitId === undefined) {
                setErrors(["Không tìm thấy cột 'Mã căn hộ' (Unit ID). Vui lòng kiểm tra lại file."]);
                setPreview([]);
                return;
            }

            // Process Rows
            const processedRows: any[] = [];
            const rows = jsonData.slice(1); // Skip header

            rows.forEach((row: any[]) => {
                if (!row || row.length === 0) return;
                
                const unitId = row[mapResult.unitId];
                if (!unitId) return; // Skip empty unit IDs

                const vehicles: { Type: VehicleTier, PlateNumber: string, VehicleName: string }[] = [];
                
                vehicleCols.forEach(col => {
                    const cellVal = String(row[col.index] || '').trim();
                    if (!cellVal || cellVal === '0' || cellVal.toLowerCase() === 'nan') return;

                    const parts = cellVal.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                    parts.forEach(part => {
                        let type: VehicleTier = VehicleTier.MOTORBIKE;
                        if (col.header.includes('oto') || col.header.includes('car')) {
                            type = VehicleTier.CAR;
                        } else if (/^\d{2}[A-Z]-\d{4,5}$/.test(part)) { // Heuristic for car plate
                            type = VehicleTier.CAR;
                        }
                        
                        vehicles.push({ Type: type, PlateNumber: part, VehicleName: '' });
                    });
                });

                processedRows.push({
                    unitId: String(unitId),
                    area: mapResult.area !== undefined ? row[mapResult.area] : undefined,
                    ownerName: mapResult.ownerName !== undefined ? row[mapResult.ownerName] : undefined,
                    phone: mapResult.phone !== undefined ? String(row[mapResult.phone]) : undefined,
                    email: mapResult.email !== undefined ? row[mapResult.email] : undefined,
                    status: mapResult.status !== undefined ? row[mapResult.status] : undefined,
                    vehicles: vehicles
                });
            });

            setPreview(processedRows);
            setErrors([]);

        } catch (e: any) {
            console.error(e);
            setErrors([`Lỗi đọc file: ${e.message}`]);
        }
    };

    const handleConfirmImport = () => {
        if (errors.length > 0 || preview.length === 0) return;
        onImport(preview);
        onClose();
    };

    return (
        <Modal title="Nhập dữ liệu từ Excel/CSV" onClose={onClose} size="4xl">
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 text-sm">
                    <p className="font-bold mb-1">Hướng dẫn:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Hệ thống sẽ <strong>tự động nhận diện</strong> các cột dựa trên tên tiêu đề.</li>
                        <li>Các cột quan trọng: <strong>Mã căn hộ (bắt buộc)</strong>, Chủ hộ, SĐT, Email, Diện tích.</li>
                        <li>Thông tin xe: Các cột chứa từ khoá "Biển số", "Xe", "Ô tô", "Car" sẽ được quét để lấy biển số xe.</li>
                        <li>Hỗ trợ file <strong>.xlsx, .xls, .csv</strong>.</li>
                    </ul>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-sm">Chọn file dữ liệu:</label>
                    <input 
                        type="file" 
                        accept=".csv, .xlsx, .xls" 
                        onChange={handleFileChange} 
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-focus"
                    />
                </div>

                {mappedHeaders.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border text-xs font-mono max-h-24 overflow-y-auto">
                        <p className="font-bold text-gray-600 dark:text-gray-400 mb-1">Các trường đã nhận diện:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                            {mappedHeaders.map((h, i) => <div key={i}>✓ {h}</div>)}
                        </div>
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
                        <p className="font-bold">Lỗi:</p>
                        <ul className="list-disc list-inside text-sm">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                )}

                {preview.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b font-semibold text-sm flex justify-between items-center">
                            <span>Xem trước ({preview.length} dòng)</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Căn hộ</th>
                                        <th className="px-3 py-2 text-left">Chủ hộ</th>
                                        <th className="px-3 py-2 text-left">SĐT</th>
                                        <th className="px-3 py-2 text-left">Xe (detected)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                    {preview.slice(0, 20).map((row, i) => (
                                        <tr key={i}>
                                            <td className="px-3 py-2 font-medium">{row.unitId}</td>
                                            <td className="px-3 py-2">{row.ownerName || '-'}</td>
                                            <td className="px-3 py-2">{row.phone || '-'}</td>
                                            <td className="px-3 py-2 text-gray-500">
                                                {row.vehicles.map((v: any) => `${v.PlateNumber} (${v.Type})`).join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {preview.length > 20 && <div className="p-2 text-center text-xs text-gray-500 font-style-italic">... và {preview.length - 20} dòng khác</div>}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t dark:border-dark-border gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-300">Hủy</button>
                    <button 
                        onClick={handleConfirmImport} 
                        disabled={errors.length > 0 || preview.length === 0} 
                        className="px-6 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Xác nhận Nhập
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- Main Page Component ---
const ResidentsPage: React.FC<ResidentsPageProps> = ({ units, owners, vehicles, onSaveResident, onImportData, onDeleteResidents, role, currentUser }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const [selectedUnitIDs, setSelectedUnitIDs] = useState<Set<string>>(new Set());
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingResident, setEditingResident] = useState<ResidentData | null>(null);
    const [viewingResident, setViewingResident] = useState<ResidentData | null>(null);

    const [kpiFilter, setKpiFilter] = useState<string | null>(null);

    const kpis = useMemo(() => {
        const activeVehicles = vehicles.filter(v => v.isActive);
        return {
            total: units.length,
            owners: units.filter(u => u.Status === 'Owner').length,
            tenants: units.filter(u => u.Status === 'Rent').length,
            business: units.filter(u => u.Status === 'Business').length,
            cars: activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length,
            motorbikes: activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length,
        };
    }, [units, vehicles]);
    
    const kpiConfig = [
        { id: 'total', label: 'Tổng cư dân', icon: <UserGroupIcon className="h-5 w-5 text-blue-500" />, value: kpis.total, filter: null },
        { id: 'owners', label: 'Chính chủ', icon: <UserIcon className="h-5 w-5 text-green-500" />, value: kpis.owners, filter: 'Owner' },
        { id: 'tenants', label: 'Hộ thuê', icon: <KeyIcon className="h-5 w-5 text-yellow-500" />, value: kpis.tenants, filter: 'Rent' },
        { id: 'business', label: 'Kinh doanh', icon: <StoreIcon className="h-5 w-5 text-orange-500" />, value: kpis.business, filter: 'Business' },
        { id: 'cars', label: 'Ô tô', icon: <CarIcon className="h-5 w-5 text-indigo-500" />, value: kpis.cars, filter: 'cars' },
        { id: 'motorbikes', label: 'Xe máy', icon: <MotorbikeIcon className="h-5 w-5 text-purple-500" />, value: kpis.motorbikes, filter: 'motorbikes' },
    ];

    const handleKpiClick = (filter: string | null) => {
        setSearchTerm('');
        setFloorFilter('all');
        setTypeFilter('all');
        setStatusFilter('all');
        
        if (filter === 'Owner' || filter === 'Rent' || filter === 'Business') {
            setTypeFilter(filter);
            setKpiFilter(null);
        } else {
            setKpiFilter(filter);
        }
    };

    const residentData = useMemo(() => units.map(unit => ({
        unit: unit, owner: owners.find(o => o.OwnerID === unit.OwnerID)!,
        vehicles: vehicles.filter(v => v.UnitID === unit.UnitID),
    })), [units, owners, vehicles]);
    
    const floors = useMemo(() => ['all', ...Array.from(new Set(units.filter(u => u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0, -2)))).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10))], [units]);

    const filteredResidents = useMemo(() => {
        return residentData.filter(res => {
            const floor = res.unit.UnitID.startsWith('K') ? 'KIOS' : res.unit.UnitID.slice(0, -2);
            if (floorFilter !== 'all' && floor !== floorFilter) return false;
            if (typeFilter !== 'all' && res.unit.Status !== typeFilter) return false;
            if (statusFilter !== 'all' && res.unit.displayStatus !== statusFilter) return false;
            
            if (kpiFilter) {
                if (kpiFilter === 'cars') {
                    const hasCar = res.vehicles.some(v => v.isActive && (v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A));
                    if (!hasCar) return false;
                }
                if (kpiFilter === 'motorbikes') {
                    const hasMoto = res.vehicles.some(v => v.isActive && (v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE));
                    if (!hasMoto) return false;
                }
            }

            const s = searchTerm.toLowerCase();
            // FIX: Handle undefined OwnerName safely to prevent crashes during search
            if (s && !(res.unit.UnitID.toLowerCase().includes(s) || (res.owner.OwnerName || '').toLowerCase().includes(s) || (res.owner.Phone || '').includes(s))) return false;
            return true;
        }).sort((a, b) => {
            const pa = parseUnitCode(a.unit.UnitID);
            const pb = parseUnitCode(b.unit.UnitID);
            if (!pa || !pb) return 0;
            if (pa.floor !== pb.floor) return pa.floor - pb.floor;
            return pa.apt - pb.apt;
        });
    }, [residentData, searchTerm, floorFilter, typeFilter, statusFilter, kpiFilter]);

    const handleSelectUnit = (unitId: string, isSelected: boolean) => {
        setSelectedUnitIDs(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(unitId);
            } else {
                newSet.delete(unitId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedUnitIDs(new Set(filteredResidents.map(r => r.unit.UnitID)));
        } else {
            setSelectedUnitIDs(new Set());
        }
    };
    
    const isAllVisibleSelected = filteredResidents.length > 0 && selectedUnitIDs.size === filteredResidents.length;
    
    const handleExportCSV = () => {
        const selectedData = selectedUnitIDs.size > 0 
            ? residentData.filter(r => selectedUnitIDs.has(r.unit.UnitID))
            : filteredResidents;

        if (selectedData.length === 0) {
            showToast('Không có dữ liệu để xuất file.', 'info');
            return;
        }

        const headers = ['Mã căn hộ', 'Tên chủ hộ', 'Số điện thoại', 'Email', 'Trạng thái', 'Diện tích (m2)', 'SL ô tô', 'SL xe máy', 'SL xe đạp', 'Biển số xe'];
        const csvRows = [headers.join(',')];

        selectedData.forEach(res => {
            const activeVehicles = res.vehicles.filter(v => v.isActive);
            const carCount = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
            const motoCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;
            const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
            const allPlates = activeVehicles.map(v => v.PlateNumber).filter(plate => plate && plate !== 'N/A').join(', ');
            
            const row = [
                res.unit.UnitID, `"${res.owner.OwnerName}"`, res.owner.Phone, res.owner.Email,
                res.unit.Status, res.unit.Area_m2, carCount, motoCount, bicycleCount, `"${allPlates}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `DanhSachCuDan_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Đã xuất thành công ${selectedData.length} hồ sơ.`, 'success');
    };

    const handleExportPDFs = async () => {
        const selectedData = residentData.filter(r => selectedUnitIDs.has(r.unit.UnitID));
        if (selectedData.length === 0) { showToast('Vui lòng chọn ít nhất một cư dân.', 'info'); return; }
        
        setIsExportingPDF(true);
        showToast(`Đang chuẩn bị xuất ${selectedData.length} file PDF...`, 'info');

        try {
            await Promise.all([
                loadScript('jspdf'),
                loadScript('html2canvas'),
                loadScript('jszip')
            ]);
            
            const zip = new JSZip();
            for (const resident of selectedData) {
                const contentNode = document.createElement('div');
                contentNode.style.cssText = 'width: 794px; position: absolute; left: -9999px; background-color: white;';
                contentNode.innerHTML = renderResidentToHTML(resident);
                document.body.appendChild(contentNode);
                
                const canvas = await html2canvas(contentNode, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                document.body.removeChild(contentNode);

                // USE JPEG COMPRESSION (0.8 Quality)
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                
                const { jsPDF } = jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                zip.file(`HoSoCuDan_${resident.unit.UnitID}.pdf`, pdf.output('blob'));
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `HoSoCuDan_Export_${selectedData.length}_files.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Xuất file PDF thành công!', 'success');
        } catch (error) {
            console.error("PDF Export Error: ", error);
            showToast('Đã xảy ra lỗi khi xuất file PDF.', 'error');
        } finally {
            setIsExportingPDF(false);
        }
    };
    
    const handleDeleteSelected = () => {
        if (role !== 'Admin') {
            showToast('Chỉ Admin mới có quyền thực hiện hành động này.', 'error');
            return;
        }
        if (selectedUnitIDs.size === 0) {
            showToast('Vui lòng chọn ít nhất một hồ sơ để xoá.', 'info');
            return;
        }
        
        const performDeletion = () => {
            if (window.confirm(`Bạn có chắc chắn muốn RESET thông tin của ${selectedUnitIDs.size} hồ sơ cư dân đã chọn? Dữ liệu chủ hộ và phương tiện sẽ bị xóa trắng.`)) {
                onDeleteResidents(selectedUnitIDs);
                setSelectedUnitIDs(new Set());
            }
        };

        if (selectedUnitIDs.size > 10) {
            const pass = window.prompt(`Để xoá dữ liệu của ${selectedUnitIDs.size} căn hộ, vui lòng nhập mật khẩu của Admin:`);
            if (pass === currentUser.password) {
                performDeletion();
            } else if (pass !== null) {
                showToast('Mật khẩu không đúng. Thao tác đã bị huỷ.', 'error');
            }
        } else {
            performDeletion();
        }
    };

    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return { text: 'Chính chủ', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: <UserIcon className="w-3.5 h-3.5" /> };
            case 'Rent': return { text: 'Hộ thuê', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', icon: <KeyIcon className="w-3.5 h-3.5" /> };
            case 'Business': return { text: 'Kinh doanh', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', icon: <StoreIcon className="w-3.5 h-3.5" /> };
        }
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            {editingResident && <ResidentDetailModal resident={editingResident} onSave={onSaveResident} onClose={() => setEditingResident(null)} />}
            {viewingResident && <ResidentViewModal resident={viewingResident} onClose={() => setViewingResident(null)} />}
            {isImportModalOpen && <DataImportModal onClose={() => setIsImportModalOpen(false)} onImport={onImportData} />}

            {/* KPI Bar */}
            <div className="stats-row mt-6">
                {kpiConfig.map(kpi => (
                    <div key={kpi.id} className="stat-card" data-label={`Bấm để lọc theo ${kpi.label}`} onClick={() => handleKpiClick(kpi.filter)}>
                        <div className="stat-icon">{kpi.icon}</div>
                        <p className="stat-value">{kpi.value}</p>
                    </div>
                ))}
            </div>
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 p-2 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-xl border dark:border-dark-border shadow-sm">
                <input type="text" placeholder="Tìm căn hộ, tên, SĐT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow min-w-[200px] p-2 border rounded-lg bg-light-bg dark:bg-dark-bg" />
                <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg" title="Lọc theo tầng"><option value="all">All Floors</option>{floors.slice(1).map(f => <option key={f} value={f}>{f}</option>)}<option value="KIOS">KIOS</option></select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg" title="Lọc theo loại căn"><option value="all">All Types</option><option value="Owner">Chính chủ</option><option value="Rent">Hộ thuê</option><option value="Business">Kinh doanh</option></select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg" title="Trạng thái"><option value="all">All Status</option><option value="Normal">Normal</option><option value="Missing data">Missing</option><option value="Locked">Locked</option></select>
                <div className="ml-auto"><button onClick={() => setIsImportModalOpen(true)} disabled={!canEdit} className="px-4 py-2 bg-primary text-white font-semibold rounded-md flex items-center gap-2 disabled:bg-gray-400"><UploadIcon /> Import Excel/CSV</button></div>
            </div>
            
            {/* Action Bar */}
            {selectedUnitIDs.size > 0 && (
                <div className="bulk-action-bar">
                    <span className="font-semibold text-sm">{selectedUnitIDs.size} đã chọn</span>
                    <button onClick={() => setSelectedUnitIDs(new Set())} className="btn-clear ml-4">Bỏ chọn</button>
                    <div className="h-6 border-l dark:border-dark-border ml-2"></div>
                    <div className="ml-auto flex items-center gap-3">
                        <button onClick={handleExportPDFs} disabled={isExportingPDF} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary disabled:opacity-50">
                            <PrinterIcon /> {isExportingPDF ? 'Đang xuất...' : 'Xuất PDF'}
                        </button>
                        <button onClick={handleExportCSV} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary">
                           <DocumentArrowDownIcon /> Xuất Excel
                        </button>
                        {role === 'Admin' && (
                            <button 
                                onDoubleClick={handleDeleteSelected}
                                onClick={() => showToast(selectedUnitIDs.size > 0 ? 'Nhấn đúp để xác nhận xoá.' : 'Vui lòng chọn hồ sơ cần xoá.', 'info')}
                                title="Nhấn đúp để xoá dữ liệu"
                                className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-500 hover:text-red-800"
                            >
                               <TrashIcon /> Xoá dữ liệu
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto" style={{paddingBottom: '24px'}}>
                    <table className="min-w-full themed-table">
                        <thead className="sticky top-0 z-10 text-sm uppercase">
                            <tr>
                                <th className="py-3 px-2 w-12 text-center">
                                    <input type="checkbox" className="rounded" onChange={handleSelectAll} checked={isAllVisibleSelected} disabled={filteredResidents.length === 0} />
                                </th>
                                <th className="py-3 px-4 w-[90px] text-left">Căn hộ</th>
                                <th className="py-3 px-4 w-[90px] text-right">Diện tích</th>
                                <th className="py-3 px-4 flex-1 text-left">Chủ hộ</th>
                                <th className="py-3 px-4 w-[150px] text-left">Điện thoại</th>
                                <th className="py-3 px-4 w-[140px] text-left">Loại</th>
                                <th className="py-3 px-4 w-[80px] text-center whitespace-nowrap">Xe</th>
                                <th className="py-3 px-4 w-[120px] text-left">Trạng thái</th>
                                <th className="py-3 px-4 w-[96px] text-center">H.ĐỘNG</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm" style={{lineHeight: 1.4}}>
                            {filteredResidents.map(res => {
                                const typeDisplay = getTypeDisplay(res.unit.Status);
                                return (
                                    <tr key={res.unit.UnitID} className="hover:bg-[var(--color-row-hover)]">
                                        <td className="py-3 px-2 text-center">
                                            <input type="checkbox" className="rounded" checked={selectedUnitIDs.has(res.unit.UnitID)} onChange={(e) => handleSelectUnit(res.unit.UnitID, e.target.checked)} />
                                        </td>
                                        <td className="py-3 px-4 font-medium">{res.unit.UnitID}</td>
                                        <td className="py-3 px-4 text-right">{res.unit.Area_m2} m²</td>
                                        <td className="py-3 px-4">{res.owner.OwnerName}</td>
                                        <td className="py-3 px-4">{res.owner.Phone}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 inline-flex items-center gap-1.5 text-xs leading-5 font-semibold rounded-full ${typeDisplay.className}`}>
                                                {typeDisplay.icon} {typeDisplay.text}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">{res.vehicles.filter(v => v.isActive).length}</td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                {res.unit.displayStatus || 'Normal'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="action-icons">
                                                <button onClick={() => setViewingResident(res)} className="icon-btn" data-tooltip="Xem chi tiết"><ActionViewIcon className="text-blue-500" /></button>
                                                <button onClick={() => setEditingResident(res)} className="icon-btn" data-tooltip="Sửa thông tin" disabled={!canEdit}><PencilSquareIcon /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ResidentsPage;
