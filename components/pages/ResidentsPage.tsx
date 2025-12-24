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
    PrinterIcon, HomeIcon, WarningIcon, ClipboardDocumentListIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, EBikeIcon, EyeIcon, DocumentPlusIcon,
    PaperclipIcon, XMarkIcon, ClockIcon,
    DocumentArrowDownIcon,
    CheckCircleIcon,
    ArrowPathIcon
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

const renderResidentToHTML = (resident: ResidentData): string => {
    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return 'Chính chủ';
            case 'Rent': return 'Hộ thuê';
            case 'Business': return 'Kinh doanh';
        }
    };
    const activeVehicles = (resident.vehicles || []).filter(v => v?.isActive);

    const vehicleRows = activeVehicles.length > 0
        ? activeVehicles.map(v => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #000 !important;">${translateVehicleType(v?.Type)}</td>
                <td style="padding: 8px; color: #000 !important;">${v?.VehicleName || ''}</td>
                <td style="padding: 8px; font-family: monospace; color: #000 !important;">${v?.PlateNumber}</td>
                <td style="padding: 8px; color: #000 !important;">${v?.parkingStatus || ''}</td>
                <td style="padding: 8px; color: #000 !important;">${new Date(v?.StartDate).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding: 12px; font-style: italic; color: #777; text-align: center;">Chưa đăng ký phương tiện nào.</td></tr>';
    
    return `
    <div style="font-family: 'Inter', Arial, sans-serif; color: #1f2937; padding: 40px; background-color: white; max-width: 210mm; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px;">
            <h2 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 8px 0; text-transform: uppercase;">HỒ SƠ CƯ DÂN</h2>
            <p style="font-size: 16px; color: #6b7280; margin: 0;">Căn hộ: <span style="font-weight: 600; color: #374151;">${resident.unit?.UnitID}</span></p>
        </div>
        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Chủ hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Họ và tên:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner?.OwnerName}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Số điện thoại:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner?.Phone}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Email:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner?.Email}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Vợ/Chồng:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner?.secondOwnerName || 'Chưa có'}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 500;">SĐT Vợ/Chồng:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner?.secondOwnerPhone || ''}</td></tr>
            </table>
        </div>
        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Căn hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                 <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Diện tích:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.unit?.Area_m2} m²</td>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500; padding-left: 24px;">Trạng thái:</td><td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${getTypeDisplay(resident.unit?.Status)}</td>
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

type ResidentData = {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
    pendingRequest?: ProfileRequest;
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

const ResidentsPage: React.FC<ResidentsPageProps> = ({ units = [], owners = [], vehicles = [], activityLogs = [], onSaveResident, onImportData, onDeleteResidents, role, currentUser, onNavigate }) => {
    const { showToast } = useNotification();
    const { refreshData } = useDataRefresh(); 
    const canManage = ['Admin', 'Accountant', 'Operator'].includes(role || '');
    const IS_PROD = isProduction();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Owner' | 'Rent' | 'Business'>('all');
    const [floorFilter, setFloorFilter] = useState('all');
    
    const [modalState, setModalState] = useState<{ type: 'edit' | 'import' | null; data: ResidentData | null }>({ type: null, data: null });
    const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);
    const [pendingRequests, setPendingRequests] = useState<ProfileRequest[]>([]);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const residentsData = useMemo(() => {
        const ownersMap = new Map((owners || []).map(o => [o.OwnerID, o]));
        const vehiclesMap = new Map<string, Vehicle[]>();
        (vehicles || []).forEach(v => { if (v?.UnitID) { if (!vehiclesMap.has(v.UnitID)) vehiclesMap.set(v.UnitID, []); vehiclesMap.get(v.UnitID)!.push(v); } });
        
        const requestsMap = new Map<string, ProfileRequest>();
        (pendingRequests || []).forEach(req => { if (req?.residentId) requestsMap.set(req.residentId, req); });

        return (units || []).map(unit => ({ 
            unit, 
            owner: ownersMap.get(unit.OwnerID)!, 
            vehicles: vehiclesMap.get(unit.UnitID) || [], 
            pendingRequest: requestsMap.get(unit.UnitID)
        })).sort((a,b) => {
            if (a.pendingRequest && !b.pendingRequest) return -1;
            if (!a.pendingRequest && b.pendingRequest) return 1;
            return sortUnitsComparator(a.unit, b.unit);
        });
    }, [units, owners, vehicles, pendingRequests]);

    // FIX: Hardened search filtering
    const filteredResidents = useMemo(() => {
        return residentsData.filter(r => {
            if (!r.owner || !r.unit) return false;
            if (statusFilter !== 'all' && r.unit.Status !== statusFilter) return false;
            
            if (floorFilter !== 'all') {
                if (floorFilter === 'KIOS') {
                    if (r.unit.UnitType !== UnitType.KIOS) return false;
                } else {
                    const unitFloor = parseUnitCode(r.unit.UnitID)?.floor;
                    if (String(unitFloor) !== floorFilter) return false;
                }
            }
            
            const s = (searchTerm || '').trim().toLowerCase();
            if (!s) return true;

            const unitId = String(r.unit.UnitID || '').toLowerCase();
            const ownerName = String(r.owner.OwnerName || '').toLowerCase();
            const ownerPhone = String(r.owner.Phone || '').toLowerCase();

            return unitId.includes(s) || ownerName.includes(s) || ownerPhone.includes(s);
        });
    }, [residentsData, searchTerm, statusFilter, floorFilter]);

    const totalPages = Math.ceil(filteredResidents.length / ITEMS_PER_PAGE);
    const paginatedResidents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredResidents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredResidents, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, floorFilter]);

    return (
        <div className="flex gap-6 h-full overflow-hidden relative">
            <div className={`flex flex-col gap-4 min-w-0 transition-all duration-300 ${selectedResident ? 'w-2/3' : 'w-full'}`}>
                {/* Simplified view for clarity, assuming headers and pagination remain the same */}
                <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col min-h-0 border border-gray-100">
                    <div className="overflow-y-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chủ hộ</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedResidents.map(r => (
                                    <tr key={r.unit.UnitID} onClick={() => setSelectedResident(r)} className="cursor-pointer hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-bold">{r.unit.UnitID}</td>
                                        <td className="px-4 py-3 text-sm">{r.owner?.OwnerName || 'N/A'}</td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={r.unit.Status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* ... rest of UI ... */}
        </div>
    );
};

export default ResidentsPage;