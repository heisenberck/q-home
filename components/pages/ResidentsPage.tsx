import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Unit, Owner, Vehicle, Role, UserPermission, VehicleDocument } from '../../types';
import { UnitType, VehicleTier } from '../../types';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { useNotification } from '../../App';
import { 
    EyeIcon, PencilSquareIcon, BuildingIcon, TagIcon, UploadIcon, UserGroupIcon, 
    UserIcon, KeyIcon, StoreIcon, CarIcon, TrashIcon,
    DocumentArrowDownIcon, ActionViewIcon, TableCellsIcon, DocumentTextIcon
} from '../ui/Icons';
import { loadScript } from '../../utils/scriptLoader';
import { normalizePhoneNumber, formatLicensePlate, vehicleTypeLabels, translateVehicleType, sortUnitsComparator, compressImageToWebP } from '../../utils/helpers';


// Declare external libraries
declare const jspdf: any;
declare const html2canvas: any;
declare const JSZip: any;
declare const XLSX: any; // SheetJS

const renderStatusBadge = (status: 'Owner' | 'Rent' | 'Business' | string) => {
    const baseClasses = "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full";

    switch (status) {
        case 'Owner':
            return (
                <span className={`${baseClasses} bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700/50`}>
                    <UserIcon className="w-3.5 h-3.5" />
                    Chính chủ
                </span>
            );
        case 'Rent':
            return (
                <span className={`${baseClasses} bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700/50`}>
                    <KeyIcon className="w-3.5 h-3.5" />
                    Hộ thuê
                </span>
            );
        case 'Business':
            return (
                <span className={`${baseClasses} bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700/50`}>
                    <StoreIcon className="w-3.5 h-3.5" />
                    Kinh doanh
                </span>
            );
        default:
            return (
                <span className={`${baseClasses} bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600`}>
                    Chưa rõ
                </span>
            );
    }
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
    onSaveResident: (data: { unit: Unit, owner: Owner, vehicles: Vehicle[] }) => Promise<void>;
    onImportData: (updates: any[]) => void;
    onDeleteResidents: (unitIds: Set<string>) => void;
    role: Role;
    currentUser: UserPermission;
}

type VehicleErrors = {
    plateNumber?: string;
};

// --- START: PDF Generation Helper ---
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
    onSave: (updatedData: { unit: Unit, owner: Owner, vehicles: Vehicle[] }) => Promise<void>;
}> = ({ resident, onClose, onSave }) => {
    const { showToast } = useNotification();
    
    const [formData, setFormData] = useState<{unit: Unit, owner: Owner, vehicles: Vehicle[]}>({
        unit: resident.unit,
        owner: {
            ...resident.owner,
            documents: resident.owner.documents || {}
        },
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


    const formElementStyle = `w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed`;

    const validateVehicle = useCallback((vehicle: Vehicle): VehicleErrors => {
        const vErrors: VehicleErrors = {};
        const isBicycle = vehicle.Type === VehicleTier.BICYCLE;
        const plate = vehicle.PlateNumber?.trim() || '';
        
        if (!isBicycle && !plate) {
            vErrors.plateNumber = "Biển số là bắt buộc.";
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
        const formattedPlate = formatLicensePlate(value);
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
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (Object.keys(errors).length > 0) {
            showToast('Vui lòng sửa các lỗi trong biểu mẫu trước khi lưu.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose(); // Only close on successful save
        } catch (error) {
            // Error toast is shown in the parent `handleSaveResident` function.
            // The modal remains open for the user to retry or cancel.
        } finally {
            setIsSaving(false);
        }
    };

    const handleOwnerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'nationalId' | 'title') => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        if (file.size > 10 * 1024 * 1024) { // 10MB limit before compression
            showToast('Kích thước ảnh gốc phải nhỏ hơn 10MB.', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('Chỉ chấp nhận file ảnh.', 'error');
            return;
        }
    
        try {
            showToast('Đang nén ảnh...', 'info');
            const compressedDataUrl = await compressImageToWebP(file);
            const newDoc: VehicleDocument = { // Reusing VehicleDocument type
                fileId: `DOC_OWNER_${Date.now()}`,
                name: file.name.replace(/\.[^/.]+$/, ".webp"),
                url: compressedDataUrl,
                type: 'image/webp',
                uploadedAt: new Date().toISOString()
            };
            
            setFormData(prev => ({
                ...prev,
                owner: {
                    ...prev.owner,
                    documents: {
                        ...prev.owner.documents,
                        [docType]: newDoc
                    }
                }
            }));
            showToast(`Đã tải lên ${newDoc.name}`, 'success');
        } catch (error) {
            showToast('Lỗi khi nén và xử lý ảnh.', 'error');
            console.error(error);
        }
        if(e.target) e.target.value = '';
    };

    const handleRemoveOwnerFile = (docType: 'nationalId' | 'title') => {
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
            setFormData(prev => {
                const newDocs = { ...prev.owner.documents };
                delete newDocs[docType];
                return {
                    ...prev,
                    owner: {
                        ...prev.owner,
                        documents: newDocs
                    }
                };
            });
        }
    };
    
    const FileUploadField: React.FC<{
        docType: 'nationalId' | 'title';
        label: string;
    }> = ({ docType, label }) => {
        const doc = formData.owner.documents?.[docType];
        return (
            <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{label}</label>
                    {doc ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 truncate max-w-[150px]">{doc.name}</span>
                            <button type="button" onClick={() => handleRemoveOwnerFile(docType)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                            <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleOwnerFileUpload(e, docType)} />
                        </label>
                    )}
                </div>
            </div>
        );
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
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5"/> Hồ sơ Chủ hộ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FileUploadField docType="nationalId" label="Ảnh CCCD" />
                        <FileUploadField docType="title" label="Ảnh Sổ đỏ/Hợp đồng" />
                    </div>
                     <p className="text-xs text-gray-500 mt-2">Hỗ trợ ảnh. File sẽ được nén dưới 200KB.</p>
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
                                    <select name="Type" value={vehicle.Type === VehicleTier.EBIKE ? VehicleTier.MOTORBIKE : vehicle.Type} onChange={e => handleVehicleChange(index, e)} className={formElementStyle}>
                                        <option value={VehicleTier.CAR} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR}>{vehicleTypeLabels.car}</option>
                                        <option value={VehicleTier.CAR_A} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR_A}>{vehicleTypeLabels.car_a}</option>
                                        <option value={VehicleTier.MOTORBIKE}>{vehicleTypeLabels.motorbike}</option>
                                        <option value={VehicleTier.BICYCLE}>{vehicleTypeLabels.bicycle}</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3"><label className="text-xs font-semibold">Tên xe</label><input type="text" name="VehicleName" placeholder={vehicle.Type.includes('car') ? 'Toyota Vios...' : 'Honda SH...'} value={vehicle.VehicleName || ''} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                <div className="md:col-span-2"><label className="text-xs font-semibold">Biển số</label><input type="text" name="PlateNumber" placeholder={vehicle.Type.includes('car') ? 'VD: 30E-12345' : 'VD: 29H1-12345'} value={vehicle.PlateNumber} onBlur={(e) => handleLicensePlateBlur(index, e)} onChange={e => handleVehicleChange(index, e)} className={`${formElementStyle} ${errors[index]?.plateNumber ? 'border-red-500' : ''}`} /><p className="text-red-500 text-xs mt-1 h-3">{errors[index]?.plateNumber}</p></div>
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

// --- REWRITTEN: Smart Data Import Modal ---
const DataImportModal: React.FC<{
    onClose: () => void;
    onImport: (updates: any[]) => void;
}> = ({ onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [mappedHeaders, setMappedHeaders] = useState<Record<string, string>>({});
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const { showToast } = useNotification();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (json.length > 0) {
                    const headers = json[0].map((h: any) => String(h).trim());
                    setRawHeaders(headers);
                    setMappedHeaders(detectColumns(headers));
                    setPreview(json.slice(1).filter(row => row.some((cell: any) => cell !== ""))); // Keep rows with at least one non-empty cell
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const detectColumns = (headers: string[]) => {
        const headerMap: { [key: string]: string } = {};
        const usedHeaders = new Set<string>();

        const ownerKeywords = ['họ tên', 'chủ hộ', 'tên chủ', 'name'];
        const unitKeywords = ['số căn hộ', 'mã căn', 'căn hộ', 'unit', 'room'];
        const unitExclusionKeywords = ['họ tên', 'chủ', 'name'];

        // Priority 1: ownerName
        headers.forEach(header => {
            const normalizedHeader = header.toLowerCase();
            if (usedHeaders.has(header)) return;

            if (ownerKeywords.some(kw => normalizedHeader.includes(kw))) {
                headerMap[header] = 'ownerName';
                usedHeaders.add(header);
            }
        });

        // Priority 2: unitId with exclusion
        headers.forEach(header => {
            const normalizedHeader = header.toLowerCase();
            if (usedHeaders.has(header)) return;

            const isUnitCandidate = unitKeywords.some(kw => normalizedHeader.includes(kw));
            const isExcluded = unitExclusionKeywords.some(kw => normalizedHeader.includes(kw));

            if (isUnitCandidate && !isExcluded) {
                headerMap[header] = 'unitId';
                usedHeaders.add(header);
            }
        });
        
        // Other mappings (can be lower priority)
        const otherMappings: { [key: string]: string[] } = {
            'status': ['status', 'trạng thái'],
            'vehicles_motorbike': ['xe may', 'xe máy'],
            'vehicles_ebike': ['xe điện', 'xe dien'],
            'vehicles_bicycle': ['xe dap', 'xe đạp'],
            'vehicles_car': ['o to', 'ô tô'],
            'parkingStatus': ['parking', 'lốt đỗ'],
            'area': ['diện tích', 'dien tich', 'dt', 'area'],
            'phone': ['sđt', 'sdt', 'tel', 'mobile', 'điện thoại', 'dien thoai'],
            'email': ['email'],
        };

        headers.forEach(header => {
            const normalizedHeader = header.toLowerCase();
            if (usedHeaders.has(header)) return;

            for (const targetKey in otherMappings) {
                if (otherMappings[targetKey].some(kw => normalizedHeader.includes(kw))) {
                    headerMap[header] = targetKey;
                    usedHeaders.add(header);
                    break;
                }
            }
        });

        return headerMap;
    };
    
    const processExcelData = () => {
        if (!preview.length || !Object.keys(mappedHeaders).length) {
            showToast("Không có dữ liệu hợp lệ để xử lý.", "warn");
            return;
        }

        const updates = preview.map(rowArray => {
            const row: { [key: string]: any } = {};
            rawHeaders.forEach((header, index) => {
                const mappedKey = mappedHeaders[header];
                if (mappedKey) {
                    row[mappedKey] = rowArray[index];
                }
            });

            const unitId = row.unitId;
            if (!unitId) return null;

            const unitIdStr = String(unitId).trim();
            const unitType = unitIdStr.toLowerCase().startsWith('kios') ? UnitType.KIOS : UnitType.APARTMENT;

            const vehicles: any[] = [];
            
            // Motorbike
            if (row.vehicles_motorbike) {
                String(row.vehicles_motorbike).split(';').forEach(plate => {
                    if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.MOTORBIKE, VehicleName: '' });
                });
            }
            
            // E-Bike (Hybrid Logic)
            if (row.vehicles_ebike) {
                const value = String(row.vehicles_ebike).trim();
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && String(numValue) === value) { // It's a number count
                    for (let i = 1; i <= numValue; i++) {
                        vehicles.push({ PlateNumber: `EB-${unitIdStr}-${i}`, Type: VehicleTier.EBIKE, VehicleName: `Xe điện ${i}` });
                    }
                } else { // It's a plate string
                    value.split(';').forEach(plate => {
                        if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.EBIKE, VehicleName: '' });
                    });
                }
            }

            // Bicycle (Hybrid Logic)
            if (row.vehicles_bicycle) {
                const value = String(row.vehicles_bicycle).trim();
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && String(numValue) === value) { // It's a number count
                    for (let i = 1; i <= numValue; i++) {
                        vehicles.push({ PlateNumber: `XB-${unitIdStr}-${i}`, Type: VehicleTier.BICYCLE, VehicleName: `Xe đạp ${i}` });
                    }
                } else { // It's a plate string
                    value.split(';').forEach(plate => {
                        if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.BICYCLE, VehicleName: '' });
                    });
                }
            }

            // Car
            if (row.vehicles_car) {
                 String(row.vehicles_car).split(';').forEach(plate => {
                    if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.CAR, VehicleName: '' });
                });
            }

            return {
                unitId: unitIdStr,
                unitType: unitType,
                ownerName: String(row.ownerName || ''),
                status: row.status || 'Owner',
                area: parseFloat(String(row.area || '0').replace(/m2/i, '').trim()) || 0,
                phone: normalizePhoneNumber(row.phone || ''),
                email: String(row.email || ''),
                vehicles: vehicles,
                parkingStatus: row.parkingStatus || null,
            };

        }).filter(Boolean);

        onImport(updates);
        onClose();
    };

    return (
        <Modal title="Nhập dữ liệu Cư dân từ Excel" onClose={onClose} size="5xl">
            <div className="space-y-4">
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="mx-auto block text-sm" />
                </div>

                {preview.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2">Xem trước dữ liệu (10 dòng đầu)</h4>
                        <div className="overflow-auto border rounded-lg max-h-96">
                            <table className="min-w-full">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        {rawHeaders.map((header, index) => (
                                            <th key={index} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {header}
                                                <div className="text-primary font-bold">{mappedHeaders[header] || <span className="text-red-500">Not Found</span>}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {preview.slice(0, 10).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            {rawHeaders.map((_header, colIndex) => (
                                                <td key={colIndex} className="px-4 py-3 text-sm whitespace-nowrap text-gray-800 dark:text-gray-200">
                                                    {row[colIndex] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-dark-border">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button>
                    <button onClick={processExcelData} disabled={!preview.length} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400">
                        Bắt đầu nhập
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- Main Page Component ---
const ResidentsPage: React.FC<ResidentsPageProps> = ({ units, owners, vehicles, onSaveResident, onImportData, onDeleteResidents, role }) => {
    const { showToast } = useNotification();
    const canManage = ['Admin', 'Accountant', 'Operator'].includes(role);
    const canDelete = role === 'Admin';
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const [modalState, setModalState] = useState<{ type: 'view' | 'edit' | 'import' | null; data: ResidentData | null }>({ type: null, data: null });
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    
    const residentsData = useMemo(() => {
        const ownersMap = new Map(owners.map(o => [o.OwnerID, o]));
        const vehiclesMap = new Map<string, Vehicle[]>();
        vehicles.forEach(v => {
            if (!vehiclesMap.has(v.UnitID)) vehiclesMap.set(v.UnitID, []);
            vehiclesMap.get(v.UnitID)!.push(v);
        });

        return units.map(unit => ({
            unit,
            owner: ownersMap.get(unit.OwnerID)!,
            vehicles: vehiclesMap.get(unit.UnitID) || [],
        })).sort((a,b) => sortUnitsComparator(a.unit, b.unit));
    }, [units, owners, vehicles]);

    const filteredResidents = useMemo(() => {
        return residentsData.filter(r => {
            if (typeFilter !== 'all' && r.unit.UnitType !== typeFilter) return false;
            if (statusFilter !== 'all' && r.unit.Status !== statusFilter) return false;
            if (searchTerm && !(
                r.unit.UnitID.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.owner.OwnerName.toLowerCase().includes(searchTerm.toLowerCase())
            )) return false;
            return true;
        });
    }, [residentsData, searchTerm, typeFilter, statusFilter]);
    
    const kpiStats = useMemo(() => ({
        totalUnits: units.length,
        apartments: units.filter(u => u.UnitType === UnitType.APARTMENT).length,
        kiosks: units.filter(u => u.UnitType === UnitType.KIOS).length,
        totalVehicles: vehicles.filter(v => v.isActive).length,
    }), [units, vehicles]);

    const handleSelectUnit = (unitId: string, isSelected: boolean) => {
        const newSelection = new Set(selectedUnits);
        isSelected ? newSelection.add(unitId) : newSelection.delete(unitId);
        setSelectedUnits(newSelection);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedUnits(e.target.checked ? new Set(filteredResidents.map(r => r.unit.UnitID)) : new Set());
    };
    
    const isAllVisibleSelected = filteredResidents.length > 0 && selectedUnits.size === filteredResidents.length;

    const handleDeleteSelected = () => {
        if (!canDelete || selectedUnits.size === 0) return;
        if (window.confirm(`Bạn có chắc chắn muốn XÓA DỮ LIỆU của ${selectedUnits.size} hồ sơ đã chọn? Thao tác này sẽ reset thông tin chủ hộ và phương tiện.`)) {
            onDeleteResidents(selectedUnits);
            setSelectedUnits(new Set());
        }
    };
    
    const handleExportSelected = () => {
        const dataToExport = filteredResidents.filter(r => selectedUnits.has(r.unit.UnitID));
        if(dataToExport.length === 0) { showToast('Vui lòng chọn ít nhất một hồ sơ để xuất.', 'info'); return; }
        
        const headers = ['Mã căn hộ', 'Chủ hộ', 'SĐT', 'Email', 'Trạng thái', 'Loại hình', 'Diện tích', 'Xe máy', 'Ô tô', 'Xe đạp'];
        const csvRows = [headers.join(',')];
        
        dataToExport.forEach(r => {
            const row = [
                r.unit.UnitID,
                `"${r.owner.OwnerName}"`,
                `'${r.owner.Phone}`,
                r.owner.Email,
                r.unit.Status,
                r.unit.UnitType,
                r.unit.Area_m2,
                r.vehicles.filter(v => v.isActive && (v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE)).map(v=>v.PlateNumber).join(';'),
                r.vehicles.filter(v => v.isActive && (v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A)).map(v=>v.PlateNumber).join(';'),
                r.vehicles.filter(v => v.isActive && v.Type === VehicleTier.BICYCLE).map(v=>v.PlateNumber).join(';')
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `HoSoCuDan_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    
    return (
        <div className="h-full flex flex-col space-y-6">
            {modalState.type === 'view' && modalState.data && <ResidentViewModal resident={modalState.data} onClose={() => setModalState({ type: null, data: null })} />}
            {modalState.type === 'edit' && modalState.data && <ResidentDetailModal resident={modalState.data} onClose={() => setModalState({ type: null, data: null })} onSave={onSaveResident} />}
            {modalState.type === 'import' && <DataImportModal onClose={() => setModalState({ type: null, data: null })} onImport={onImportData} />}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Tổng Căn hộ & Kios" value={kpiStats.totalUnits} icon={<UserGroupIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />} iconBgClass="bg-indigo-100 dark:bg-indigo-900/50" />
                <StatCard label="Số căn hộ" value={kpiStats.apartments} icon={<BuildingIcon className="w-7 h-7 text-sky-600 dark:text-sky-400" />} iconBgClass="bg-sky-100 dark:bg-sky-900/50" />
                <StatCard label="Số kios kinh doanh" value={kpiStats.kiosks} icon={<StoreIcon className="w-7 h-7 text-amber-600 dark:text-amber-400" />} iconBgClass="bg-amber-100 dark:bg-amber-900/50" />
                <StatCard label="Tổng số phương tiện" value={kpiStats.totalVehicles} icon={<CarIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />} iconBgClass="bg-emerald-100 dark:bg-emerald-900/50" />
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <input type="text" placeholder="Tìm căn hộ, chủ hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white"><option value="all">Tất cả loại hình</option><option value={UnitType.APARTMENT}>Căn hộ</option><option value={UnitType.KIOS}>KIOS</option></select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white"><option value="all">Tất cả trạng thái</option><option value="Owner">Chủ sở hữu</option><option value="Rent">Cho thuê</option><option value="Business">Kinh doanh</option></select>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setModalState({ type: 'import', data: null })} disabled={!canManage} className="px-4 py-2 bg-primary text-white font-semibold rounded-md flex items-center gap-2"><UploadIcon /> Import Excel</button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {selectedUnits.size > 0 && (
                    <div className="p-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex items-center gap-4">
                        <span className="font-semibold text-sm">{selectedUnits.size} đã chọn</span>
                        <button onClick={() => setSelectedUnits(new Set())} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Bỏ chọn</button>
                        <div className="h-5 border-l dark:border-dark-border ml-2"></div>
                        <div className="ml-auto flex items-center gap-4">
                            <button onClick={handleExportSelected} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><TableCellsIcon /> Export CSV</button>
                            {canDelete && <button onClick={handleDeleteSelected} className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-800"><TrashIcon /> Xóa thông tin</button>}
                        </div>
                    </div>
                )}
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 w-12 text-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllVisibleSelected} disabled={!canManage} /></th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Diện tích</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chủ hộ</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Liên hệ</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Loại hình</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredResidents.map(resident => (
                                <tr key={resident.unit.UnitID} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                    <td className="w-12 text-center text-sm"><input type="checkbox" checked={selectedUnits.has(resident.unit.UnitID)} onChange={(e) => handleSelectUnit(resident.unit.UnitID, e.target.checked)} disabled={!canManage} /></td>
                                    <td className="px-4 py-4 font-medium text-sm text-gray-900 dark:text-gray-200">{resident.unit.UnitID}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{resident.unit.Area_m2} m²</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{resident.owner.OwnerName}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{resident.owner.Phone}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{resident.unit.UnitType === UnitType.APARTMENT ? 'Căn hộ' : 'Kios'}</td>
                                    <td className="px-4 py-4">{renderStatusBadge(resident.unit.Status)}</td>
                                    <td className="text-center px-4 py-4">
                                        <div className="flex justify-center items-center gap-2">
                                            <button onClick={() => setModalState({ type: 'view', data: resident })} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700" data-tooltip="Xem"><ActionViewIcon className="w-5 h-5"/></button>
                                            <button onClick={() => setModalState({ type: 'edit', data: resident })} disabled={!canManage} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 text-blue-600 hover:text-blue-800" data-tooltip="Sửa"><PencilSquareIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ResidentsPage;