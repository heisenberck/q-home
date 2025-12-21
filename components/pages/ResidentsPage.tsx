import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Unit, Owner, Vehicle, Role, UserPermission, VehicleDocument, ActivityLog, ProfileRequest } from '../../types';
import { UnitType, VehicleTier } from '../../types';
import { useNotification, useDataRefresh } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    PencilSquareIcon, BuildingIcon, UploadIcon, 
    UserIcon, KeyIcon, StoreIcon, CarIcon, TrashIcon,
    DocumentTextIcon, SearchIcon, ChevronDownIcon,
    MotorbikeIcon, BikeIcon, PhoneArrowUpRightIcon, EnvelopeIcon, UserCircleIcon, ClipboardIcon,
    PrinterIcon, WarningIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, EBikeIcon, EyeIcon, DocumentPlusIcon,
    PaperclipIcon, XMarkIcon, ClockIcon,
    DocumentArrowDownIcon,
    CheckCircleIcon
} from '../ui/Icons';
import { normalizePhoneNumber, formatLicensePlate, vehicleTypeLabels, translateVehicleType, sortUnitsComparator, compressImageToWebP, parseUnitCode, getPastelColorForName, timeAgo } from '../../utils/helpers';
import { mapExcelHeaders } from '../../utils/importHelpers';
import { loadScript } from '../../utils/scriptLoader';
import { getAllPendingProfileRequests, resolveProfileRequest } from '../../services/index';
import { isProduction } from '../../utils/env';

declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any;

const ITEMS_PER_PAGE = 16;

type ResidentData = {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
    pendingRequest?: ProfileRequest;
};

// --- PDF Generation Helper ---
const renderResidentToHTML = (resident: ResidentData): string => {
    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return 'Chính chủ';
            case 'Rent': return 'Hộ thuê';
            case 'Business': return 'Kinh doanh';
        }
    };
    const activeVehicles = (resident.vehicles || []).filter(v => v.isActive);

    const vehicleRows = activeVehicles.length > 0
        ? activeVehicles.map(v => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #000 !important;">${translateVehicleType(v.Type)}</td>
                <td style="padding: 8px; color: #000 !important;">${v.VehicleName || ''}</td>
                <td style="padding: 8px; font-family: monospace; color: #000 !important;">${v.PlateNumber}</td>
                <td style="padding: 8px; color: #000 !important;">${v.parkingStatus || ''}</td>
                <td style="padding: 8px; color: #000 !important;">${new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding: 12px; font-style: italic; color: #777; text-align: center;">Chưa đăng ký phương tiện nào.</td></tr>';
    
    return `
    <div style="font-family: 'Inter', Arial, sans-serif; color: #1f2937; padding: 40px; background-color: white; max-width: 210mm; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px;">
            <h2 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 8px 0; text-transform: uppercase;">HỒ SƠ CƯ DÂN</h2>
            <p style="font-size: 16px; color: #6b7280; margin: 0;">Căn hộ: <span style="font-weight: 600; color: #374151;">${resident.unit.UnitID}</span></p>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Chủ hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Họ và tên:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.OwnerName}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Số điện thoại:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.Phone}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Email:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.Email}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Vợ/Chồng:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.secondOwnerName || 'Chưa có'}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">SĐT Vợ/Chồng:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.secondOwnerPhone || ''}</td></tr>
            </table>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Căn hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                 <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Diện tích:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.unit.Area_m2} m²</td>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500; padding-left: 24px;">Trạng thái:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${getTypeDisplay(resident.unit.Status)}</td>
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

const StatusBadge: React.FC<{ status: 'Owner' | 'Rent' | 'Business' | string }> = ({ status }) => {
    const styles: Record<string, { icon: React.ReactElement; text: string; classes: string }> = {
        Owner: { icon: <UserIcon />, text: 'Chính chủ', classes: 'bg-green-100 text-green-800' },
        Rent: { icon: <KeyIcon />, text: 'Hộ thuê', classes: 'bg-blue-100 text-blue-800' },
        Business: { icon: <StoreIcon />, text: 'Kinh doanh', classes: 'bg-amber-100 text-amber-800' }
    };
    const s = styles[status] || { icon: <UserIcon/>, text: 'Chưa rõ', classes: 'bg-gray-100 text-gray-800' };
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${s.classes}`}>
            {React.cloneElement(s.icon, {className: "w-3 h-3"})}
            {s.text}
        </span>
    );
};

const ProfileChangeReview: React.FC<{
    currentData: ResidentData;
    request: ProfileRequest;
    onApprove: (selectedChanges: Partial<ProfileRequest['changes']>) => void;
    onReject: () => void;
}> = ({ currentData, request, onApprove, onReject }) => {
    const displayMap: Record<keyof ProfileRequest['changes'], string> = {
        title: 'Danh xưng',
        OwnerName: 'Tên chủ hộ',
        Phone: 'Số điện thoại',
        Email: 'Email',
        secondOwnerName: 'Vợ/Chồng',
        secondOwnerPhone: 'SĐT Vợ/Chồng',
        UnitStatus: 'Trạng thái căn hộ',
        avatarUrl: 'Ảnh đại diện'
    };

    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(Object.keys(request.changes)));

    const handleToggle = (key: string) => {
        const next = new Set(selectedFields);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedFields(next);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedFields(new Set(Object.keys(request.changes)));
        else setSelectedFields(new Set());
    };

    const handleApprove = () => {
        if (selectedFields.size === 0) return;
        const changesToApprove: Partial<ProfileRequest['changes']> = {};
        Object.keys(request.changes).forEach(key => {
            if (selectedFields.has(key)) {
                // @ts-ignore
                changesToApprove[key] = request.changes[key];
            }
        });
        onApprove(changesToApprove);
    };

    const getCurrentValue = (key: string) => {
        if (key === 'UnitStatus') return currentData.unit.Status;
        if (key === 'avatarUrl') return currentData.owner.avatarUrl ? 'Có ảnh cũ' : 'Không có';
        // @ts-ignore
        return currentData.owner[key] || '(Trống)';
    };

    const getNewValueDisplay = (key: string, value: any) => {
        if (key === 'avatarUrl') {
            return value ? <img src={value as string} alt="New Avatar" className="w-8 h-8 rounded-full object-cover border"/> : <span className="text-red-500 italic">(Đã xóa ảnh)</span>;
        }
        if (value === '' || value === null || value === undefined) {
            return <span className="text-red-500 font-bold italic border border-red-200 bg-red-50 px-2 py-0.5 rounded text-xs">✖ (Đã xóa)</span>;
        }
        return String(value);
    };

    return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                    <WarningIcon className="w-5 h-5"/> Yêu cầu cập nhật từ Cư dân
                </h3>
                <span className="text-xs text-orange-600 italic">Gửi lúc: {new Date(request.createdAt).toLocaleString()}</span>
            </div>

            <table className="w-full text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                        <th className="p-2 w-10 text-center"><input type="checkbox" checked={selectedFields.size === Object.keys(request.changes).length} onChange={handleSelectAll} className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500" /></th>
                        <th className="p-2 text-left font-semibold text-gray-700">Trường thông tin</th>
                        <th className="p-2 text-left font-semibold text-gray-500">Giá trị hiện tại</th>
                        <th className="p-2 text-left font-semibold text-gray-700">Giá trị mới (Yêu cầu)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {Object.entries(request.changes).map(([key, newValue]) => {
                        const label = displayMap[key as keyof ProfileRequest['changes']] || key;
                        return (
                            <tr key={key} className={selectedFields.has(key) ? 'bg-orange-50/50' : ''}>
                                <td className="p-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedFields.has(key)} 
                                        onChange={() => handleToggle(key)} 
                                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                                    />
                                </td>
                                <td className="p-2 font-medium text-gray-700">{label}</td>
                                <td className="p-2 text-gray-500 line-through">{getCurrentValue(key)}</td>
                                <td className="p-2 text-green-700 font-bold break-all select-all selection:bg-orange-200">
                                    {getNewValueDisplay(key, newValue)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="flex justify-end gap-3 mt-4">
                <button onClick={onReject} className="px-4 py-2 bg-white border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 text-sm shadow-sm">Từ chối yêu cầu</button>
                <button onClick={handleApprove} disabled={selectedFields.size === 0} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm shadow-sm disabled:opacity-50 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Phê duyệt {selectedFields.size} mục đã chọn</button>
            </div>
        </div>
    );
};

const DocumentPreviewModal: React.FC<{ doc: VehicleDocument; onClose: () => void; }> = ({ doc, onClose }) => {
    const isImage = doc.type.startsWith('image/');
    const isPdf = doc.type === 'application/pdf' || doc.url.startsWith('data:application/pdf');

    return (
        <Modal title={`Xem tài liệu: ${doc.name}`} onClose={onClose} size="4xl">
            <div className="flex justify-center items-center p-4 bg-gray-100 min-h-[70vh]">
                {isImage ? (
                    <img src={doc.url} alt={doc.name} className="max-w-full max-h-[70vh] object-contain shadow-lg" />
                ) : isPdf ? (
                    <iframe src={doc.url} className="w-full h-[70vh] border-0" title={doc.name}></iframe>
                ) : (
                    <div className="text-center">
                        <p className="text-lg mb-4">Định dạng file này không hỗ trợ xem trước.</p>
                        <a href={doc.url} download={doc.name} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">
                            <DocumentArrowDownIcon /> Tải xuống
                        </a>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const ResidentDetailModal: React.FC<{
    resident: ResidentData;
    onClose: () => void;
    onSave: (updatedData: { unit: Unit, owner: Owner, vehicles: Vehicle[] }, reason: string) => Promise<void>;
    onResolveRequest: (req: ProfileRequest, action: 'approve' | 'reject', changes?: any) => void;
}> = ({ resident, onClose, onSave, onResolveRequest }) => {
    const { showToast } = useNotification();
    const [formData, setFormData] = useState<{unit: Unit, owner: Owner, vehicles: Vehicle[]}>({
        unit: { ...resident.unit },
        owner: { ...resident.owner, documents: resident.owner.documents || { others: [] } },
        vehicles: JSON.parse(JSON.stringify((resident.vehicles || []).filter(v => v.isActive)))
    });
    const [activeTab, setActiveTab] = useState<'info'|'vehicles'|'docs'>('info');
    const [errors, setErrors] = useState<Record<number, {plateNumber?: string}>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [otherReason, setOtherReason] = useState('');

    const REASON_OPTIONS = ["Thay đổi thông tin", "Thay đổi trạng thái căn hộ", "Thay đổi phương tiện (thêm bớt)", "Cập nhật hình ảnh"];
    const formElementStyle = `w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm`;
    const labelStyle = `block text-sm font-medium text-gray-700 mb-1`;

    const validateVehicle = useCallback((vehicle: Vehicle) => {
        const vErrors: {plateNumber?: string} = {};
        if (vehicle.Type !== VehicleTier.BICYCLE && !vehicle.PlateNumber?.trim()) vErrors.plateNumber = "Biển số là bắt buộc.";
        return vErrors;
    }, []);
    
    useEffect(() => {
        const allErrors: Record<number, any> = {};
        formData.vehicles.forEach((v, index) => {
            const vErrors = validateVehicle(v);
            if (Object.keys(vErrors).length > 0) allErrors[index] = vErrors;
        });
        setErrors(allErrors);
    }, [formData.vehicles, validateVehicle]);

    const handleOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, owner: { ...p.owner, [e.target.name]: e.target.value } }));
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? parseFloat(value) : value;
        setFormData(p => ({ ...p, unit: { ...p.unit, [name]: val }}));
    };
    const handleVehicleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [name]: value as any };
        if (name === 'Type' && value === VehicleTier.BICYCLE) updatedVehicles[index].PlateNumber = ''; 
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
        const newVehicle: Vehicle = { VehicleId: `VEH_NEW_${Date.now()}`, UnitID: formData.unit.UnitID, Type: VehicleTier.MOTORBIKE, VehicleName: '', PlateNumber: '', StartDate: new Date().toISOString().split('T')[0], isActive: true };
        setFormData(p => ({...p, vehicles: [...p.vehicles, newVehicle]}));
    };
    const handleRemoveVehicle = (index: number) => setFormData(p => ({ ...p, vehicles: p.vehicles.filter((_, i) => i !== index) }));
    const handleOwnerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'nationalId' | 'title') => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            showToast('Đang nén ảnh...', 'info');
            const compressedDataUrl = await compressImageToWebP(file);
            const newDoc: VehicleDocument = { fileId: `DOC_OWNER_${Date.now()}`, name: file.name.replace(/\.[^/.]+$/, ".webp"), url: compressedDataUrl, type: 'image/webp', uploadedAt: new Date().toISOString() };
            setFormData(prev => ({ ...prev, owner: { ...prev.owner, documents: { ...prev.owner.documents, [docType]: newDoc } } }));
            showToast(`Đã tải lên ${newDoc.name}`, 'success');
        } catch (error) { showToast('Lỗi khi nén và xử lý ảnh.', 'error'); }
        if(e.target) e.target.value = '';
    };
    const handleRemoveOwnerFile = (docType: 'nationalId' | 'title') => {
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
            setFormData(prev => { const newDocs = { ...prev.owner.documents }; delete newDocs[docType]; return { ...prev, owner: { ...prev.owner, documents: newDocs } }; });
        }
    };
    const handleConfirmUploadOtherFile = (fileName: string, file: File) => {
        try {
            showToast('Đang xử lý file...', 'info');
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const newDoc: VehicleDocument = { fileId: `DOC_OTHER_${Date.now()}`, name: fileName, url: reader.result as string, type: file.type, uploadedAt: new Date().toISOString() };
                setFormData(prev => ({ ...prev, owner: { ...prev.owner, documents: { ...prev.owner.documents, others: [...(prev.owner.documents?.others || []), newDoc] } } }));
                showToast(`Đã tải lên file: ${fileName}`, 'success');
            };
            reader.onerror = () => { throw new Error("File reading failed"); };
        } catch (error) { showToast('Lỗi khi xử lý file.', 'error'); } 
        finally { setIsUploadModalOpen(false); }
    };
    const handleRemoveOtherFile = (fileId: string) => {
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
            setFormData(prev => ({ ...prev, owner: { ...prev.owner, documents: { ...prev.owner.documents, others: prev.owner.documents?.others?.filter(doc => doc.fileId !== fileId) || [] } } }));
        }
    };
    const toggleReason = (r: string) => setSelectedReasons(prev => prev.includes(r) ? prev.filter(i => i !== r) : [...prev, r]);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (Object.keys(errors).length > 0) { showToast('Vui lòng sửa các lỗi trước khi lưu.', 'error'); return; }
        const finalReason = [selectedReasons.join(', '), otherReason.trim()].filter(Boolean).join('. ');
        if (!finalReason) { showToast('Vui lòng chọn hoặc nhập lý do điều chỉnh.', 'error'); return; }
        setIsSaving(true);
        try { await onSave(formData, finalReason); onClose(); } finally { setIsSaving(false); }
    };

    const TabButton: React.FC<{ tabId: 'info'|'vehicles'|'docs', label: string, icon: React.ReactNode }> = ({ tabId, label, icon }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{icon} {label}</button>
    );

    const FileUploadField: React.FC<{ docType: 'nationalId' | 'title'; label: string; }> = ({ docType, label }) => {
        const doc = formData.owner.documents?.[docType];
        return (
            <div className="border rounded-md p-3 bg-gray-50">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{label}</label>
                    {doc ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 truncate max-w-[150px]">{doc.name}</span>
                            <button type="button" onClick={() => handleRemoveOwnerFile(docType)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <label className="cursor-pointer text-xs bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-gray-50"><span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleOwnerFileUpload(e, docType)} /></label>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Modal title={`Cập nhật thông tin - Căn hộ ${resident.unit.UnitID}`} onClose={onClose} size="3xl">
            {isUploadModalOpen && (
                <Modal title="Upload File" onClose={() => setIsUploadModalOpen(false)} size="md">
                    <div className="space-y-4">
                        <div><label className={labelStyle}>Tên file</label><input type="text" className={formElementStyle} /></div>
                        <div><label className={labelStyle}>Chọn file</label><input type="file" className="w-full p-2 border rounded-md bg-white border-gray-300" /></div>
                        <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button><button type="button" className="px-4 py-2 bg-primary text-white rounded-md">Xác nhận</button></div>
                    </div>
                </Modal>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col h-[70vh]">
                {resident.pendingRequest && <ProfileChangeReview currentData={resident} request={resident.pendingRequest} onApprove={(changes) => onResolveRequest(resident.pendingRequest!, 'approve', changes)} onReject={() => onResolveRequest(resident.pendingRequest!, 'reject')} />}
                <div className="flex border-b mb-4 sticky top-0 bg-white z-10 pt-1">
                    <TabButton tabId="info" label="Thông tin chung" icon={<UserIcon className="w-4 h-4" />} />
                    <TabButton tabId="vehicles" label="Phương tiện" icon={<CarIcon className="w-4 h-4" />} />
                    <TabButton tabId="docs" label="Tài liệu" icon={<DocumentTextIcon className="w-4 h-4" />} />
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-6">
                    {activeTab === 'info' && (
                         <section className="animate-fade-in-down">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className={labelStyle}>Tên chủ hộ</label><input name="OwnerName" value={formData.owner.OwnerName} onChange={handleOwnerChange} className={formElementStyle} /></div>
                                <div><label className={labelStyle}>SĐT chủ hộ</label><input name="Phone" value={formData.owner.Phone} onChange={handleOwnerChange} className={formElementStyle} /></div>
                                <div><label className={labelStyle}>Email</label><input type="email" name="Email" value={formData.owner.Email} onChange={handleOwnerChange} className={formElementStyle} /></div>
                                <div><label className={labelStyle}>Trạng thái căn hộ</label><select name="Status" value={formData.unit.Status} onChange={handleUnitChange} className={formElementStyle}><option value="Owner">Chính chủ</option><option value="Rent">Hộ thuê</option><option value="Business">Kinh doanh</option></select></div>
                                <div><label className={labelStyle}>Tên Vợ/Chồng</label><input name="secondOwnerName" value={formData.owner.secondOwnerName || ''} onChange={handleOwnerChange} className={formElementStyle} /></div>
                                <div><label className={labelStyle}>SĐT Vợ/Chồng</label><input name="secondOwnerPhone" value={formData.owner.secondOwnerPhone || ''} onChange={handleOwnerChange} className={formElementStyle} /></div>
                            </div>
                        </section>
                    )}
                    {activeTab === 'vehicles' && (
                        <section className="animate-fade-in-down">
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {formData.vehicles.map((vehicle, index) => (
                                    <div key={vehicle.VehicleId || index} className="grid grid-cols-1 md:grid-cols-10 gap-2 items-start p-2 bg-gray-50 rounded-md border">
                                        <div className="md:col-span-2"><label className="text-xs font-semibold">Loại xe</label><select name="Type" value={vehicle.Type} onChange={e => handleVehicleChange(index, e)} className={formElementStyle}>{Object.entries(vehicleTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                        <div className="md:col-span-3"><label className="text-xs font-semibold">Tên xe</label><input type="text" name="VehicleName" value={vehicle.VehicleName || ''} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                        <div className="md:col-span-2"><label className="text-xs font-semibold">Biển số</label><input type="text" name="PlateNumber" value={vehicle.PlateNumber} onBlur={(e) => handleLicensePlateBlur(index, e)} onChange={e => handleVehicleChange(index, e)} disabled={vehicle.Type === VehicleTier.BICYCLE} className={`${formElementStyle} ${errors[index]?.plateNumber ? 'border-red-500' : ''}`} /><p className="text-red-500 text-xs mt-1 h-3">{errors[index]?.plateNumber}</p></div>
                                        <div className="md:col-span-2"><label className="text-xs font-semibold">Ngày ĐK</label><input type="date" name="StartDate" value={vehicle.StartDate} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                        <div className="md:col-span-1 text-center self-center pt-5"><button type="button" onClick={() => handleRemoveVehicle(index)} className="text-red-500 hover:text-red-700 font-semibold p-1">Xóa</button></div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={handleAddVehicle} className="mt-4 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-focus">+ Thêm xe</button>
                        </section>
                    )}
                    {activeTab === 'docs' && (
                        <section className="animate-fade-in-down">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FileUploadField docType="nationalId" label="Ảnh CCCD" /><FileUploadField docType="title" label="Ảnh Sổ đỏ/Hợp đồng" /></div>
                            <div className="mt-4 space-y-2">{(formData.owner.documents?.others || []).map(doc => (<div key={doc.fileId} className="flex justify-between items-center p-2 bg-gray-50 rounded-md text-sm"><span className="font-medium truncate">{doc.name}</span><button type="button" onClick={() => handleRemoveOtherFile(doc.fileId)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-4 h-4"/></button></div>))}</div>
                            <div className="mt-4"><button type="button" onClick={() => setIsUploadModalOpen(true)} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"><DocumentPlusIcon /> Upload file khác...</button></div>
                        </section>
                    )}
                </div>
                <div className="pt-4 border-t mt-auto sticky bottom-0 bg-white z-10 pb-1">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Lý do điều chỉnh <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-2 gap-3 mb-3">{REASON_OPTIONS.map(r => (<label key={r} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded border border-gray-100 select-none"><input type="checkbox" checked={selectedReasons.includes(r)} onChange={() => toggleReason(r)} className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary mt-0.5" /><span className="text-sm text-gray-700 leading-snug">{r}</span></label>))}</div>
                    <input type="text" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm" placeholder="Chi tiết khác..." />
                    <div className="flex justify-end gap-3 pt-4 mt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button><button type="submit" disabled={isSaving || Object.keys(errors).length > 0} className="px-6 py-2 bg-primary text-white font-semibold rounded-md disabled:bg-gray-400">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
                </div>
            </form>
        </Modal>
    );
};

const DataImportModal: React.FC<{ onClose: () => void; onImport: (updates: any[]) => void; }> = ({ onClose, onImport }) => {
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
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                if (json.length > 0) {
                    const headers = json[0].map((h: any) => String(h).trim());
                    setRawHeaders(headers);
                    setMappedHeaders(mapExcelHeaders(headers));
                    setPreview(json.slice(1).filter(row => row.some((cell: any) => cell !== "")));
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const processExcelData = () => {
        if (!preview.length) return;
        const updates = preview.map(rowArray => {
            const row: { [key: string]: any } = {};
            rawHeaders.forEach((header, index) => {
                const mappedKey = mappedHeaders[header];
                if (mappedKey) row[mappedKey] = rowArray[index];
            });
            const unitId = row.unitId ? String(row.unitId).trim() : null;
            if (!unitId) return null;
            const vehicles: any[] = [];
            if (row.vehicles_motorbike) String(row.vehicles_motorbike).split(/[,;]/).forEach(p => { if (p.trim()) vehicles.push({ PlateNumber: p.trim(), Type: VehicleTier.MOTORBIKE }); });
            if (row.vehicles_car) String(row.vehicles_car).split(/[,;]/).forEach(p => { if (p.trim()) vehicles.push({ PlateNumber: p.trim(), Type: VehicleTier.CAR }); });
            return { unitId, ownerName: String(row.ownerName || ''), status: row.status || 'Owner', area: parseFloat(String(row.area||'0'))||0, phone: normalizePhoneNumber(row.phone ? String(row.phone) : ''), email: String(row.email||''), vehicles, parkingStatus: row.parkingStatus||null, unitType: unitId.toLowerCase().startsWith('k') ? UnitType.KIOS : UnitType.APARTMENT };
        }).filter(Boolean);
        onImport(updates);
        onClose();
    };

    return (
        <Modal title="Nhập dữ liệu Cư dân" onClose={onClose} size="5xl">
            <div className="space-y-4"><div className="p-4 border-2 border-dashed rounded-lg text-center"><input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="mx-auto block text-sm" /></div>
                {preview.length > 0 && (<div><h4 className="font-semibold mb-2">Xem trước dữ liệu</h4><div className="overflow-auto border rounded-lg max-h-96"><table className="min-w-full"><thead className="sticky top-0 bg-gray-50"><tr>{rawHeaders.map((h, i) => (<th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}<div className="text-primary font-bold">{mappedHeaders[h] || <span className="text-red-500">?</span>}</div></th>))}</tr></thead><tbody className="divide-y divide-gray-200">{preview.slice(0, 10).map((r, i) => (<tr key={i} className="hover:bg-gray-50">{rawHeaders.map((_, j) => (<td key={j} className="px-4 py-3 text-sm text-gray-800">{r[j]||''}</td>))}</tr>))}</tbody></table></div></div>)}
                <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button><button onClick={processExcelData} disabled={!preview.length} className="px-4 py-2 bg-primary text-white rounded-md">Nhập dữ liệu</button></div>
            </div>
        </Modal>
    );
};

const FilterPill: React.FC<{ icon: React.ReactNode; options: { value: string; label: string }[]; currentValue: string; onValueChange: (value: string) => void; tooltip: string; }> = ({ icon, options, currentValue, onValueChange, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);
    useEffect(() => { const h = (e: MouseEvent) => { if (pillRef.current && !pillRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
    const currentLabel = options.find(o => o.value === currentValue)?.label || 'Select';
    return (<div className="relative" ref={pillRef} data-tooltip={tooltip}><button onClick={() => setIsOpen(!isOpen)} className="h-10 px-3 border border-gray-300 bg-white rounded-lg flex items-center gap-2 hover:border-primary w-full justify-between"><div className='flex items-center gap-2'>{icon}<span className="text-sm font-medium">{currentLabel}</span></div><ChevronDownIcon className="w-4 h-4"/></button>{isOpen && (<div className="absolute top-full mt-1.5 z-20 bg-white p-2 rounded-lg shadow-lg border w-48 max-h-60 overflow-y-auto">{options.map(o => (<button key={o.value} onClick={() => { onValueChange(o.value); setIsOpen(false); }} className={`w-full text-left p-2 rounded-md text-sm ${currentValue===o.value?'bg-primary text-white':'hover:bg-gray-100'}`}>{o.label}</button>))}</div>)}</div>);
};

const ResidentDetailPanel: React.FC<{ resident: ResidentData | null; activityLogs: ActivityLog[]; onExportPDF: (resident: ResidentData) => void; onCopyToClipboard: (text: string, label: string) => void; onOpenDoc: (doc: VehicleDocument) => void; onClose: () => void; onNavigate?: (page: string) => void; }> = ({ resident, activityLogs, onExportPDF, onCopyToClipboard, onOpenDoc, onClose, onNavigate }) => {
    if (!resident || !resident.unit || !resident.owner) return null;
    const { unit, owner, vehicles } = resident;
    const safeVehicles = vehicles || [];
    const allDocs = [...(owner.documents?.nationalId ? [{...owner.documents.nationalId, name: `CCCD - ${owner.OwnerName}`}] : []), ...(owner.documents?.title ? [{...owner.documents.title, name: 'Sổ đỏ/Hợp đồng'}] : []), ...(owner.documents?.others || [])];
    const relevantLogs = (activityLogs || []).filter(l => (l.ids && l.ids.includes(unit.UnitID)) || l.summary.includes(unit.UnitID)).slice(0, 10);
    const theme = getPastelColorForName(owner.OwnerName);
    const [isOwnerInfoOpen, setOwnerInfoOpen] = useState(true);
    const [isVehiclesOpen, setVehiclesOpen] = useState(true);

    const handleVehicleClick = (plate: string) => {
        localStorage.setItem('vehicle_search_term', plate);
        if (onNavigate) onNavigate('vehicles');
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-2xl overflow-y-auto animate-slide-up">
            <div className={`p-6 ${theme.bg} relative text-center border-b border-gray-100`}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/40 hover:bg-white/70 text-gray-700"><XMarkIcon className="w-5 h-5"/></button>
                <div className="w-24 h-24 mx-auto bg-white rounded-full p-1 shadow-md mb-3"><div className="w-full h-full rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">{owner.avatarUrl ? <img src={owner.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/> : <UserCircleIcon className="w-full h-full text-gray-300"/>}</div></div>
                <h1 className={`text-xl font-bold ${theme.text}`}>{owner.OwnerName}</h1>
                <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-600 bg-white/60 px-3 py-1 rounded-full backdrop-blur-sm border border-white/50 w-fit mx-auto"><span className="font-mono font-semibold">Unit {unit.UnitID}</span><span>•</span><span>{unit.Area_m2}m²</span><span>•</span><StatusBadge status={unit.Status} /></div>
            </div>
            <div className="border-b border-gray-100">
                <button onClick={() => setOwnerInfoOpen(!isOwnerInfoOpen)} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100 transition-colors"><span className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><UserIcon className="w-4 h-4"/> Thông tin chủ hộ</span>{isOwnerInfoOpen ? <ChevronUpIcon className="w-4 h-4 text-gray-500"/> : <ChevronDownIcon className="w-4 h-4 text-gray-500"/>}</button>
                {isOwnerInfoOpen && (
                    <div className="p-4 space-y-4 animate-fade-in-down"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">Chủ hộ</label><div className="text-sm font-semibold text-gray-800">{owner.OwnerName}</div></div><div><label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">SĐT</label><a href={`tel:${owner.Phone}`} className="text-sm font-semibold text-blue-600 hover:underline">{owner.Phone}</a></div></div><div><label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">Email</label><div className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100"><span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{owner.Email || '---'}</span>{owner.Email && <button onClick={() => onCopyToClipboard(owner.Email, "Email")}><ClipboardIcon className="w-4 h-4 text-gray-400 hover:text-blue-500"/></button>}</div></div></div>
                )}
            </div>
            <div className="border-b border-gray-100">
                <button onClick={() => setVehiclesOpen(!isVehiclesOpen)} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100 transition-colors"><span className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><CarIcon className="w-4 h-4"/> Phương tiện <span className="text-xs bg-gray-200 px-1.5 rounded-full text-gray-600">{safeVehicles.filter(v=>v?.isActive).length}</span></span>{isVehiclesOpen ? <ChevronUpIcon className="w-4 h-4 text-gray-500"/> : <ChevronDownIcon className="w-4 h-4 text-gray-500"/>}</button>
                {isVehiclesOpen && (
                    <div className="p-4 space-y-2 animate-fade-in-down">{safeVehicles.filter(v=>v?.isActive).length > 0 ? (safeVehicles.filter(v=>v?.isActive).map(v => (<div key={v.VehicleId} onClick={() => handleVehicleClick(v.PlateNumber)} className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"><div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors border border-gray-200">{v.Type.includes('car') ? <CarIcon className="w-5 h-5"/> : v.Type === 'motorbike' ? <MotorbikeIcon className="w-5 h-5"/> : v.Type === 'ebike' ? <EBikeIcon className="w-5 h-5"/> : <BikeIcon className="w-5 h-5"/>}</div><div className="flex-1 min-w-0"><div className="flex justify-between items-center"><p className="font-bold text-gray-900 font-mono truncate">{v.PlateNumber}</p><ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500"/></div><p className="text-xs text-gray-500 truncate mt-0.5">{v.VehicleName || translateVehicleType(v.Type)} • <span>{v.parkingStatus || 'Chưa có lốt'}</span></p></div></div>))) : (<div className="text-center py-4 text-gray-400 text-sm italic bg-gray-50 rounded-lg border border-dashed border-gray-200">Chưa đăng ký phương tiện.</div>)}</div>
                )}
            </div>
            <div className="p-6 space-y-8 flex-1">
                <section><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><DocumentTextIcon className="w-4 h-4"/> Hồ sơ & Tài liệu</h3>{allDocs.length > 0 ? (<div className="flex flex-wrap gap-2">{allDocs.map(d => (<button key={d.fileId} onClick={() => onOpenDoc(d)} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded border border-gray-200 flex items-center gap-1 hover:bg-gray-100 hover:border-gray-300"><PaperclipIcon className="w-3 h-3"/> {d.name}</button>))}</div>) : (<p className="text-sm text-gray-500 italic">Chưa có tài liệu.</p>)}</section>
                <section><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ClockIcon className="w-4 h-4"/> Lịch sử Thay đổi</h3><div className="border-l-2 border-gray-100 pl-4 space-y-4">{relevantLogs.length > 0 ? relevantLogs.map(log => (<div key={log.id} className="relative"><div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white"></div><p className="text-xs text-gray-400 mb-0.5">{timeAgo(log.ts)}</p><p className="text-sm text-gray-800">{log.summary}</p><p className="text-[10px] text-gray-500 italic mt-1">Bởi: {log.actor_email}</p></div>)) : <p className="text-sm text-gray-400 italic">Chưa có lịch sử ghi nhận.</p>}</div></section>
                <div className="mt-auto pt-4 border-t"><button onClick={() => onExportPDF(resident)} className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"><PrinterIcon className="w-5 h-5"/> Xuất PDF Hồ sơ</button></div>
            </div>
        </div>
    );
};

const ResidentsPage: React.FC<ResidentsPageProps> = ({ units = [], owners = [], vehicles = [], activityLogs = [], onSaveResident, onImportData, role, currentUser, onNavigate }) => {
    const { showToast } = useNotification();
    const { refreshData } = useDataRefresh(); 
    const canManage = ['Admin', 'Accountant', 'Operator'].includes(role);
    const IS_PROD = isProduction();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Owner' | 'Rent' | 'Business'>('all');
    const [floorFilter, setFloorFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [isStatsVisible, setIsStatsVisible] = useState(true);
    
    const [modalState, setModalState] = useState<{ type: 'edit' | 'import' | null; data: ResidentData | null }>({ type: null, data: null });
    const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);
    const [pendingRequests, setPendingRequests] = useState<ProfileRequest[]>([]);

    useEffect(() => { 
        setSelectedResident(null); 
        setCurrentPage(1);
    }, [searchTerm, statusFilter, floorFilter]);
    
    const fetchPendingRequests = useCallback(async () => {
        if (!IS_PROD) return;
        const reqs = await getAllPendingProfileRequests();
        setPendingRequests(reqs);
    }, [IS_PROD]);

    useEffect(() => { fetchPendingRequests(); }, [fetchPendingRequests]);

    const residentsData = useMemo(() => {
        const ownersMap = new Map(owners.map(o => [o.OwnerID, o]));
        const vehiclesMap = new Map<string, Vehicle[]>();
        vehicles.forEach(v => { if (!vehiclesMap.has(v.UnitID)) vehiclesMap.set(v.UnitID, []); vehiclesMap.get(v.UnitID)!.push(v); });
        const requestsMap = new Map<string, ProfileRequest>();
        pendingRequests.forEach(req => requestsMap.set(req.residentId, req));
        return units.map(unit => ({ unit, owner: ownersMap.get(unit.OwnerID)!, vehicles: vehiclesMap.get(unit.UnitID) || [], pendingRequest: requestsMap.get(unit.UnitID) })).sort((a,b) => { if (a.pendingRequest && !b.pendingRequest) return -1; if (!a.pendingRequest && b.pendingRequest) return 1; return sortUnitsComparator(a.unit, b.unit); });
    }, [units, owners, vehicles, pendingRequests]);

    useEffect(() => {
        if (selectedResident) {
            const updated = residentsData.find(r => r.unit.UnitID === selectedResident.unit.UnitID);
            if (updated && updated !== selectedResident) setSelectedResident(updated);
        }
    }, [residentsData, selectedResident]);

    const filteredResidents = useMemo(() => {
        return residentsData.filter(r => {
            if (!r.owner) return false;
            if (statusFilter !== 'all' && r.unit.Status !== statusFilter) return false;
            if (floorFilter !== 'all') { if (floorFilter === 'KIOS') { if (r.unit.UnitType !== UnitType.KIOS) return false; } else { const unitFloor = parseUnitCode(r.unit.UnitID)?.floor; if (String(unitFloor) !== floorFilter) return false; } }
            const s = searchTerm.toLowerCase();
            if (s && !(r.unit.UnitID.toLowerCase().includes(s) || (r.owner.OwnerName || '').toLowerCase().includes(s) || (r.owner.Phone || '').includes(s))) return false;
            return true;
        });
    }, [residentsData, searchTerm, statusFilter, floorFilter]);

    const paginatedResidents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredResidents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredResidents, currentPage]);

    const kpiStats = useMemo(() => ({ total: units.length, owner: units.filter(u => u.Status === 'Owner').length, rent: units.filter(u => u.Status === 'Rent').length, business: units.filter(u => u.Status === 'Business').length, }), [units]);
    const floors = useMemo(() => { const nums = Array.from(new Set(units.filter(u=>u.UnitType===UnitType.APARTMENT).map(u => u.UnitID.slice(0,-2)))).sort((a,b) => parseInt(String(a),10)-parseInt(String(b),10)); return [{value: 'all', label: 'Tất cả tầng'}, ...nums.map(f => ({value: f, label: `Tầng ${f}`})), {value: 'KIOS', label: 'Kios'}]; }, [units]);

    const handleSelectResident = useCallback((r: ResidentData) => setSelectedResident(prev => prev?.unit.UnitID === r.unit.UnitID ? null : r), []);
    const handleOpenEditModal = (e: React.MouseEvent, r: ResidentData) => { e.stopPropagation(); if (!canManage) { showToast('Bạn không có quyền.', 'error'); return; } setModalState({ type: 'edit', data: r }); };
    const handleCloseModal = () => setModalState({ type: null, data: null });
    const handleSaveResident = async (data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, reason: string) => { await onSaveResident(data, reason); handleCloseModal(); if (selectedResident?.unit.UnitID === data.unit.UnitID) setSelectedResident({...data, vehicles: data.vehicles.filter(v => v.isActive)}); };
    const handleExportExcel = useCallback(() => { if(filteredResidents.length===0){showToast('Không có dữ liệu.','info');return;} const data=filteredResidents.map(r=>{const vbt:{[k in VehicleTier]?:string[]}={};r.vehicles.forEach(v=>{if(v.isActive&&v.PlateNumber){if(!vbt[v.Type])vbt[v.Type]=[];vbt[v.Type]!.push(v.PlateNumber)}});return {'Mã căn hộ':r.unit.UnitID,'Chủ hộ':r.owner.OwnerName,'SĐT':r.owner.Phone,Email:r.owner.Email,'Diện tích (m2)':r.unit.Area_m2,'Trạng thái':r.unit.Status,'Biển số Ô tô':(vbt.car||[]).join(', '),'Biển số Xe máy':(vbt.motorbike||[]).join(', '),'Biển số Xe điện':(vbt.ebike||[]).join(', '),'Biển số Xe đạp':(vbt.bicycle||[]).join(', ')}});try{const ws=XLSX.utils.json_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cư dân');XLSX.writeFile(wb,`CuDan_${new Date().toISOString().slice(0,10)}.xlsx`);showToast('Xuất Excel thành công!','success')}catch(e: any){showToast('Lỗi xuất file.','error')}}, [filteredResidents, showToast]);
    const handleExportPDF = useCallback(async (r: ResidentData) => { try { await Promise.all([loadScript('jspdf'), loadScript('html2canvas')]); const html=renderResidentToHTML(r);const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:0;width:210mm;background:#fff;';document.body.appendChild(host);host.innerHTML=html;await new Promise(r=>setTimeout(r,100));const canvas=await html2canvas(host,{scale:2,useCORS:true,logging:false});const{jsPDF}=jspdf;const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4'});const w=pdf.internal.pageSize.getWidth();const h=(canvas.height*w)/canvas.width;pdf.addImage(canvas.toDataURL('image/jpeg',.95),'JPEG',0,0,w,h);host.remove();pdf.save(`HoSo_${r.unit.UnitID}.pdf`);showToast('Xuất PDF thành công!','success')}catch(e: any){showToast('Lỗi xuất PDF.','error')}}, [showToast]);
    const handleCopyToClipboard = (content: string, label: string) => { if(!content) return; navigator.clipboard.writeText(content).then(()=>showToast(`Đã sao chép ${label}`,'success')).catch((e: any)=>showToast(`Lỗi sao chép: ${e?.message || 'Lỗi'}`,'error')) };
    const handleResolveRequest = async (req: ProfileRequest, action: 'approve' | 'reject', changes?: any) => { try { await resolveProfileRequest(req, action, currentUser.Email, changes); showToast(action === 'approve' ? 'Đã phê duyệt.' : 'Đã từ chối.', 'success'); fetchPendingRequests(); refreshData(); handleCloseModal(); } catch (error) { showToast('Lỗi xử lý.', 'error'); } };

    const totalPages = Math.ceil(filteredResidents.length / ITEMS_PER_PAGE);

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {modalState.type === 'edit' && modalState.data && (<ResidentDetailModal resident={modalState.data} onClose={handleCloseModal} onSave={handleSaveResident} onResolveRequest={handleResolveRequest} />)}
            {modalState.type === 'import' && <DataImportModal onClose={handleCloseModal} onImport={onImportData} />}
            {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
            
            <div className={`flex flex-col gap-4 min-w-0 transition-all duration-300 ${selectedResident ? 'w-2/3' : 'w-full'}`}>
                {/* StatCards Container with Overlay Button */}
                <div className="relative group">
                    {/* The Content */}
                    <div className={`transition-all duration-300 ease-in-out ${isStatsVisible ? 'opacity-100 max-h-[500px] mb-4' : 'opacity-0 max-h-0 overflow-hidden mb-0'}`}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div onClick={() => setStatusFilter('all')} className="cursor-pointer"><StatCard label="Tổng số căn" value={kpiStats.total} icon={<BuildingIcon className="w-6 h-6 text-blue-600"/>} iconBgClass="bg-blue-100" className="border-l-4 border-blue-500" /></div>
                            <div onClick={() => setStatusFilter('Owner')} className="cursor-pointer"><StatCard label="Chính chủ" value={kpiStats.owner} icon={<UserIcon className="w-6 h-6 text-green-600"/>} iconBgClass="bg-green-100" className="border-l-4 border-green-500" /></div>
                            <div onClick={() => setStatusFilter('Rent')} className="cursor-pointer"><StatCard label="Hộ thuê" value={kpiStats.rent} icon={<KeyIcon className="w-6 h-6 text-orange-600"/>} iconBgClass="bg-orange-100" className="border-l-4 border-orange-500" /></div>
                            <div onClick={() => setStatusFilter('Business')} className="cursor-pointer"><StatCard label="Kinh doanh" value={kpiStats.business} icon={<StoreIcon className="w-6 h-6 text-purple-600"/>} iconBgClass="bg-purple-100" className="border-l-4 border-purple-500" /></div>
                        </div>
                    </div>

                    {/* The Toggle Button (Absolute Positioned) */}
                    <button
                        onClick={() => setIsStatsVisible(!isStatsVisible)}
                        className={`absolute ${isStatsVisible ? 'bottom-6 right-2' : 'top-1/2 -translate-y-1/2 right-2'} z-10 p-1.5 bg-white/80 hover:bg-white backdrop-blur-sm rounded-md shadow-sm border border-gray-200 text-gray-400 hover:text-primary transition-all`}
                        title={isStatsVisible ? "Thu gọn" : "Mở rộng"}
                    >
                        {isStatsVisible ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                    
                    {!isStatsVisible && (
                        <div className="absolute top-0 right-10 bottom-0 flex items-center pointer-events-none">
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Hiện thống kê</span>
                        </div>
                    )}
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-2 md:gap-4"><div className="relative flex-grow min-w-[150px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm căn hộ, tên, SĐT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-all"/></div><div className="hidden lg:block"><FilterPill icon={<BuildingIcon className="h-5 w-5 text-gray-400" />} currentValue={floorFilter} onValueChange={setFloorFilter} tooltip="Lọc theo tầng" options={floors} /></div><div className="ml-auto flex items-center gap-2"><button onClick={() => setModalState({ type: 'import', data: null })} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 bg-white"><UploadIcon /> Import</button><button onClick={handleExportExcel} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-green-600 text-green-700 hover:bg-green-600/10 bg-white"><DocumentArrowDownIcon /> Export</button></div></div>

                <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col min-h-0 border border-gray-100">
                    <div className="overflow-y-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Diện tích</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chủ hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">SĐT</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Xe cộ</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedResidents.map(r => {
                                    const activeVehicles=r.vehicles.filter(v=>v.isActive); const carCount=activeVehicles.filter(v=>v.Type==='car'||v.Type==='car_a').length; const motorbikeCount=activeVehicles.filter(v=>v.Type==='motorbike'||v.Type==='ebike').length; const bicycleCount=activeVehicles.filter(v=>v.Type==='bicycle').length;
                                    const hasPending = !!r.pendingRequest;
                                    return (
                                        <tr key={r.unit.UnitID} onClick={()=>handleSelectResident(r)} className={`cursor-pointer transition-colors ${selectedResident?.unit.UnitID===r.unit.UnitID?'bg-blue-50':'hover:bg-gray-50'}`}>
                                            <td className="font-bold px-4 py-3 text-sm text-gray-900">{r.unit.UnitID}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">{r.unit.Area_m2} m²</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-800 flex items-center gap-2">{hasPending && <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse"></span>}{r.owner.OwnerName}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">{r.owner.Phone}</td>
                                            <td className="text-center px-4 py-3"><StatusBadge status={r.unit.Status} /></td>
                                            <td className="px-4 py-3 text-sm text-center"><div className="flex justify-center items-center gap-3 text-gray-600">{carCount>0&&<div className="flex items-center gap-1"><CarIcon/><span className="text-xs font-bold">{carCount}</span></div>}{motorbikeCount>0&&<div className="flex items-center gap-1"><MotorbikeIcon/><span className="text-xs font-bold">{motorbikeCount}</span></div>}{bicycleCount>0&&<div className="flex items-center gap-1"><BikeIcon/><span className="text-xs font-bold">{bicycleCount}</span></div>}</div></td>
                                            <td className="px-4 py-3"><div className="flex justify-center items-center gap-2"><button onClick={(e)=>handleOpenEditModal(e,r)} className={`p-2 rounded-full hover:bg-blue-50 disabled:opacity-30 ${hasPending ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-blue-600'}`} disabled={!canManage}><PencilSquareIcon className="w-5 h-5"/></button></div></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {filteredResidents.length === 0 && <div className="p-8 text-center text-gray-500">Không tìm thấy cư dân nào.</div>}
                    </div>
                </div>
            </div>

            {selectedResident && (
                <div className="w-1/3 flex flex-col h-full animate-slide-up shadow-2xl rounded-l-xl overflow-hidden z-20">
                     <ResidentDetailPanel key={selectedResident.unit.UnitID} resident={selectedResident} activityLogs={activityLogs} onExportPDF={handleExportPDF} onCopyToClipboard={handleCopyToClipboard} onOpenDoc={setPreviewDoc} onClose={() => setSelectedResident(null)} onNavigate={onNavigate} />
                </div>
            )}

            {/* Floating Pagination Control - Pinned to Bottom Right System Footer Area */}
            <div className="fixed bottom-0 right-0 z-50 p-2 pr-6 bg-white/90 backdrop-blur-sm border-t border-l border-gray-200 rounded-tl-lg shadow-sm flex items-center gap-4">
                <span className="text-xs text-gray-500 font-medium">
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredResidents.length)} / {filteredResidents.length}
                </span>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-xs font-bold text-gray-700 min-w-[20px] text-center">
                        {currentPage}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ResidentsPageProps {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    activityLogs: ActivityLog[];
    onSaveResident: (data: { unit: Unit, owner: Owner, vehicles: Vehicle[] }, reason: string) => Promise<void>;
    onImportData: (updates: any[]) => void;
    onDeleteResidents: (unitIds: Set<string>) => void;
    role: Role;
    currentUser: UserPermission;
    onNavigate?: (page: string) => void;
}

export default ResidentsPage;