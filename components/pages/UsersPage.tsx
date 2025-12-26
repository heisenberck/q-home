
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification, useDataRefresh } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon
} from '../ui/Icons';
import { isProduction } from '../../utils/env';
import { saveUsers, deleteUsers } from '../../services';
import Spinner from '../ui/Spinner';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>) => void;
    units: Unit[];
    role: Role;
}

const AVAILABLE_MODULES = [
    { id: 'residents', label: 'Quản lý Cư dân' },
    { id: 'vehicles', label: 'Quản lý Phương tiện' },
    { id: 'water', label: 'Quản lý Nước' },
    { id: 'billing', label: 'Tính phí & Gửi phiếu' },
    { id: 'newsManagement', label: 'Quản lý Tin tức' },
    { id: 'feedbackManagement', label: 'Quản lý Phản hồi' },
];

const IS_PROD = isProduction();

const UsersPage: React.FC<UsersPageProps> = ({ users = [], setUsers, units = [], role }) => {
    const { showToast } = useNotification();
    const { refreshData } = useDataRefresh();
    const isAdmin = role === 'Admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    const stats = useMemo(() => ({
        total: users.length,
        admin: users.filter(u => u.Role === 'Admin').length,
        staff: users.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u.Role)).length,
        residents: users.filter(u => u.Role === 'Resident').length
    }), [users]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            (u.Username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.Email || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleSyncUsers = async () => {
        if (isProcessing) return;
        
        const existingUsernames = new Set(users.map(u => (u.Username || '').toLowerCase()));
        const missingUnits = units.filter(unit => !existingUsernames.has(unit.UnitID.toLowerCase()));
        
        if (missingUnits.length === 0) {
            showToast('Tất cả căn hộ đã có tài khoản.', 'info');
            return;
        }

        if (window.confirm(`Hệ thống sẽ tạo tự động ${missingUnits.length} tài khoản cho các căn hộ chưa có User. Mật khẩu mặc định: 123456. Tiếp tục?`)) {
            setIsProcessing(true);
            try {
                const newResidents: UserPermission[] = missingUnits.map(unit => ({
                    Email: `${unit.UnitID.toLowerCase()}@resident.q-home.vn`,
                    Username: unit.UnitID,
                    DisplayName: `Cư dân ${unit.UnitID}`,
                    Role: 'Resident',
                    status: 'Active',
                    password: '123456',
                    mustChangePassword: true,
                    residentId: unit.UnitID,
                }));

                const fullList = [...users, ...newResidents];
                if (IS_PROD) {
                    await saveUsers(newResidents); // Chỉ gửi bản ghi mới để tối ưu
                }
                setUsers(fullList);
                showToast(`Đã tạo thành công ${newResidents.length} tài khoản cư dân.`, 'success');
                refreshData(true);
            } catch (err) {
                showToast('Lỗi khi đồng bộ hàng loạt.', 'error');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedUsers.size === 0) return;
        if (!window.confirm(`Xóa vĩnh viễn ${selectedUsers.size} tài khoản đã chọn?`)) return;

        setIsProcessing(true);
        try {
            const emails = users.filter(u => selectedUsers.has(u.Email)).map(u => u.Email);
            await deleteUsers(emails);
            setUsers(prev => prev.filter(u => !selectedUsers.has(u.Email)));
            setSelectedUsers(new Set());
            showToast('Đã xóa người dùng.', 'success');
            refreshData(true);
        } catch {
            showToast('Lỗi khi xóa.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng User" value={stats.total} icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} className="border-l-4 border-gray-500"/>
                <StatCard label="Quản trị" value={stats.admin} icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} className="border-l-4 border-red-500"/>
                <StatCard label="Cư dân" value={stats.residents} icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} className="border-l-4 border-green-500"/>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Tìm ID hoặc Email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 border rounded-lg focus:ring-primary outline-none" />
                </div>
                
                {isAdmin && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={handleSyncUsers} 
                            disabled={isProcessing}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isProcessing ? <Spinner /> : <ArrowPathIcon className="w-4 h-4" />}
                            Đồng bộ Cư dân
                        </button>
                        {selectedUsers.size > 0 && (
                            <button onClick={handleBulkDelete} className="px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 flex items-center gap-2">
                                <TrashIcon className="w-4 h-4" /> Xóa ({selectedUsers.size})
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border flex-1 overflow-hidden">
                <div className="overflow-y-auto h-full">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b">
                            <tr>
                                <th className="w-10 px-4 py-3"><input type="checkbox" onChange={(e) => setSelectedUsers(e.target.checked ? new Set(filteredUsers.map(u => u.Email)) : new Set())} /></th>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">ID / Email</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Vai trò</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(u => (
                                <tr key={u.Email} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedUsers.has(u.Email)} 
                                            onChange={() => {
                                                const next = new Set(selectedUsers);
                                                if (next.has(u.Email)) next.delete(u.Email);
                                                else next.add(u.Email);
                                                setSelectedUsers(next);
                                            }}
                                            disabled={u.Role === 'Admin'}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-gray-900">{u.Username}</div>
                                        <div className="text-xs text-gray-400">{u.Email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.Role === 'Admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {u.Role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button className="p-2 text-gray-400 hover:text-primary"><PencilSquareIcon className="w-4 h-4"/></button>
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

export default UsersPage;
