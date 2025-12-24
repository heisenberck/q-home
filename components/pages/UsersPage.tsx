
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role, Unit } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    KeyIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon, TrashIcon, ShieldCheckIcon, UserIcon, PlusIcon,
    UserGroupIcon, ArrowPathIcon, BuildingIcon, LockClosedIcon
} from '../ui/Icons';
import { isProduction } from '../../utils/env';
import { saveUsers } from '../../services';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    units: Unit[];
    role: Role;
}

// Extended type for permission handling
type ExtendedUser = UserPermission & {
    permissions?: string[];
};

const AVAILABLE_MODULES = [
    { id: 'residents', label: 'Quản lý Cư dân' },
    { id: 'vehicles', label: 'Quản lý Phương tiện' },
    { id: 'water', label: 'Quản lý Nước' },
    { id: 'billing', label: 'Tính phí & Gửi phiếu' },
    { id: 'newsManagement', label: 'Quản lý Tin tức' },
    { id: 'feedbackManagement', label: 'Quản lý Phản hồi' },
];

const IS_PROD = isProduction();

// --- Components ---

const PasswordModal: React.FC<{ user: UserPermission, onSave: (pw: string) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password.length < 6) { setError('Mật khẩu phải từ 6 ký tự trở lên.'); return; }
        if (password !== confirm) { setError('Mật khẩu không khớp!'); return; }
        onSave(password);
    };

    return (
        <Modal title={`Đặt mật khẩu mới: ${user.Username || 'User'}`} onClose={onClose} size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary outline-none" />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-focus">Lưu thay đổi</button>
                </div>
            </div>
        </Modal>
    );
};

const UserModal: React.FC<{ 
    user?: ExtendedUser | null; 
    onSave: (data: ExtendedUser) => void; 
    onClose: () => void;
    allUsers: UserPermission[];
}> = ({ user, onSave, onClose, allUsers }) => {
    const { showToast } = useNotification();
    const isEdit = !!user;

    const [formData, setFormData] = useState<ExtendedUser>({
        Email: user?.Email || '', 
        contact_email: user?.contact_email || '', 
        Username: user?.Username || '',
        DisplayName: user?.DisplayName || '',
        Role: user?.Role || 'Viewer',
        status: user?.status || 'Active',
        password: user?.password || '123456a@',
        mustChangePassword: user?.mustChangePassword ?? true,
        permissions: user?.permissions || []
    });

    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(user?.permissions || []));

    const handlePermissionToggle = (moduleId: string) => {
        const next = new Set(selectedPermissions);
        if (next.has(moduleId)) next.delete(moduleId);
        else next.add(moduleId);
        setSelectedPermissions(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.Username) { showToast('Vui lòng nhập Tên đăng nhập (ID).', 'error'); return; }
        
        if (!isEdit) {
            if (allUsers.some(u => (u.Username || '').toLowerCase() === (formData.Username || '').toLowerCase())) {
                showToast('Tên đăng nhập (Mã căn) đã tồn tại.', 'error'); return;
            }
            if (!formData.Email) {
                formData.Email = `${formData.Username}@resident.q-home.vn`.toLowerCase();
            }
        }

        if (formData.contact_email) {
            const emailExists = allUsers.some(u => 
                (u.contact_email || '').toLowerCase() === (formData.contact_email || '').toLowerCase() && 
                (u.Username || '').toLowerCase() !== (formData.Username || '').toLowerCase()
            );
            if (emailExists) { showToast('Email liên hệ này đã được sử dụng.', 'error'); return; }
        }

        onSave({ ...formData, permissions: Array.from(selectedPermissions) });
    };

    const isStaff = ['Accountant', 'Operator', 'Viewer'].includes(formData.Role);
    const inputStyle = "w-full p-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary outline-none";

    return (
        <Modal title={isEdit ? `Cập nhật: ${user?.Username || 'Người dùng'}` : "Thêm người dùng mới"} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập (ID)</label>
                        <input type="text" required value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={`${inputStyle} ${isEdit ? 'bg-gray-100' : ''}`} disabled={isEdit} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email liên hệ</label>
                        <input type="email" value={formData.contact_email || ''} onChange={e => setFormData({...formData, contact_email: e.target.value})} className={inputStyle} placeholder="Email cá nhân..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                        <input type="text" value={formData.DisplayName} onChange={e => setFormData({...formData, DisplayName: e.target.value})} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                        <select value={formData.Role} onChange={e => setFormData({...formData, Role: e.target.value as Role})} className={inputStyle} disabled={isEdit && user?.Role === 'Admin'}>
                            <option value="Admin">Admin</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Operator">Operator</option>
                            <option value="Viewer">Viewer</option>
                            <option value="Resident">Resident</option>
                        </select>
                    </div>
                </div>

                {isStaff && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><ShieldCheckIcon className="w-5 h-5 text-primary"/> Phân quyền Module</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {AVAILABLE_MODULES.map(mod => (
                                <label key={mod.id} className="flex items-center space-x-3 cursor-pointer">
                                    <input type="checkbox" checked={selectedPermissions.has(mod.id)} onChange={() => handlePermissionToggle(mod.id)} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
                                    <span className="text-sm text-gray-700">{mod.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy</button>
                    <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus">{isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Main Page ---

const UsersPage: React.FC<UsersPageProps> = ({ users = [], setUsers, units = [], role }) => {
    const { showToast } = useNotification();
    const { user: currentUser, handleDeleteUsers } = useAuth() as any; 
    const isAdmin = role === 'Admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [isSyncLocked, setIsSyncLocked] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    const stats = useMemo(() => {
        const safeUsers = (users || []).filter(Boolean);
        return {
            total: safeUsers.length,
            admin: safeUsers.filter(u => u.Role === 'Admin').length,
            staff: safeUsers.filter(u => ['Accountant', 'Operator', 'Viewer'].includes(u.Role)).length,
            residents: safeUsers.filter(u => u.Role === 'Resident').length
        };
    }, [users]);

    const filteredUsers = useMemo(() => {
        return (users || []).filter(user => {
            if (!user) return false;
            if (roleFilter !== 'all' && user.Role !== roleFilter) return false;
            if (statusFilter !== 'all' && user.status !== statusFilter) return false;

            const s = searchTerm.trim().toLowerCase();
            if (!s) return true;

            const safeContactEmail = (user.contact_email || '').toLowerCase();
            const safeUsername = (user.Username || '').toLowerCase();
            const safeDisplayName = (user.DisplayName || '').toLowerCase();

            return safeContactEmail.includes(s) || safeUsername.includes(s) || safeDisplayName.includes(s);
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

    const persistData = async (newUsers: UserPermission[], actionSummary: string) => {
        setUsers(newUsers, { module: 'System', action: 'UPDATE_USERS', summary: actionSummary, before_snapshot: users });
        if (IS_PROD) { try { await saveUsers(newUsers); } catch { showToast('Lỗi lưu dữ liệu.', 'error'); } }
    };

    const handleSaveUser = (userToSave: ExtendedUser) => {
        const exists = users.some(u => u.Username === userToSave.Username);
        const updatedList = exists ? users.map(u => u.Username === userToSave.Username ? userToSave : u) : [...users, userToSave];
        persistData(updatedList, exists ? `Cập nhật: ${userToSave.Username}` : `Thêm: ${userToSave.Username}`);
        showToast('Thành công.', 'success'); setIsUserModalOpen(false);
    };

    const handleBulkDelete = () => {
        const safeToDelete = Array.from(selectedUsers).filter(id => {
            const u = users.find(user => user.Username === id);
            return u && u.Role !== 'Admin' && u.Username !== currentUser?.Username;
        });
        if (safeToDelete.length === 0) return;
        if (confirm(`Xác nhận xóa ${safeToDelete.length} người dùng?`)) {
            handleDeleteUsers(safeToDelete);
            setSelectedUsers(new Set());
        }
    };

    const handleSyncUsers = () => {
        const existingUsernames = new Set(users.map(u => (u.Username || '').toLowerCase()));
        const missingUnits = units.filter(unit => !existingUsernames.has(unit.UnitID.toLowerCase()));
        if (missingUnits.length === 0) { showToast('Dữ liệu đã đồng bộ.', 'info'); setIsSyncLocked(true); return; }
        if (window.confirm(`Tạo tự động ${missingUnits.length} tài khoản?`)) {
            const newResidents: UserPermission[] = missingUnits.map(unit => ({
                Email: `${unit.UnitID.toLowerCase()}@resident.q-home.vn`, contact_email: '', Username: unit.UnitID, DisplayName: `Cư dân ${unit.UnitID}`, Role: 'Resident', status: 'Active', password: '123456', mustChangePassword: true, residentId: unit.UnitID,
            }));
            persistData([...users, ...newResidents], `Đồng bộ ${newResidents.length} tài khoản.`);
            setIsSyncLocked(true);
        }
    };

    const toggleSelectAll = () => { if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set()); else setSelectedUsers(new Set(filteredUsers.map(u => u.Username || ''))); };

    return (
        <div className="h-full flex flex-col space-y-6">
            {isUserModalOpen && <UserModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsUserModalOpen(false)} allUsers={users} />}
            {passwordModalState.isOpen && passwordModalState.user && <PasswordModal user={passwordModalState.user} onSave={(pw) => {
                persistData(users.map(u => u.Username === passwordModalState.user?.Username ? { ...u, password: pw, mustChangePassword: false } : u), `Đổi mật khẩu: ${passwordModalState.user?.Username}`);
                setPasswordModalState({ isOpen: false, user: null });
            }} onClose={() => setPasswordModalState({ isOpen: false, user: null })} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng User" value={stats.total} icon={<UserGroupIcon className="w-6 h-6 text-gray-600"/>} className="border-l-4 border-gray-500"/>
                <StatCard label="Quản trị viên" value={stats.admin} icon={<ShieldCheckIcon className="w-6 h-6 text-red-600"/>} iconBgClass="bg-red-100" className="border-l-4 border-red-500"/>
                <StatCard label="Nhân viên" value={stats.staff} icon={<UserIcon className="w-6 h-6 text-blue-600"/>} iconBgClass="bg-blue-100" className="border-l-4 border-blue-500"/>
                <StatCard label="Cư dân" value={stats.residents} icon={<BuildingIcon className="w-6 h-6 text-green-600"/>} iconBgClass="bg-green-100" className="border-l-4 border-green-500"/>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm tên, username, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-primary outline-none" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2.5 border border-gray-300 rounded-lg"><option value="all">Tất cả vai trò</option><option value="Admin">Admin</option><option value="Accountant">Accountant</option><option value="Operator">Operator</option><option value="Resident">Resident</option></select>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={handleSyncUsers} className={`px-4 py-2.5 font-bold rounded-lg border ${isSyncLocked ? 'bg-gray-100 text-gray-400' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}>{isSyncLocked ? "Đã đồng bộ" : "Đồng bộ Cư dân"}</button>
                        <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus">Thêm User</button>
                    </div>
                )}
            </div>

            {selectedUsers.size > 0 && isAdmin && (
                <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between border border-red-200 animate-fade-in-down">
                    <span className="text-red-700 font-medium ml-2">Đã chọn {selectedUsers.size} người dùng</span>
                    <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 flex items-center gap-2"><TrashIcon className="w-4 h-4"/> Xóa</button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-6 py-4 text-center"><input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-primary" /></th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Người dùng</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Vai trò</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Trạng thái</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Quyền</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(u => {
                                if (!u) return null;
                                const id = u.Username || '---';
                                const roleName = u.Role || 'Viewer';
                                return (
                                <tr key={id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedUsers.has(id)} onChange={() => { const n = new Set(selectedUsers); if(n.has(id)) n.delete(id); else n.add(id); setSelectedUsers(n); }} className="w-4 h-4 rounded text-primary" disabled={u.Role === 'Admin'} /></td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 uppercase">{(u.DisplayName || id).charAt(0)}</div>
                                            <div><div className="font-bold text-gray-900">{id}</div><div className="text-xs text-gray-500">{u.contact_email || u.Email}</div></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roleName === 'Admin' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{roleName}</span></td>
                                    <td className="px-6 py-4">{u.status === 'Active' ? <span className="text-xs font-bold text-green-700">Active</span> : <span className="text-xs font-bold text-gray-400">Disabled</span>}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(u as any).permissions?.map((p: string) => <span key={p} className="text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{p}</span>)}
                                            {roleName === 'Admin' && <span className="text-xs text-red-500 font-bold uppercase">Toàn quyền</span>}
                                            {roleName !== 'Admin' && !(u as any).permissions?.length && <span className="text-xs text-gray-400 italic">Mặc định</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isAdmin && (
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} disabled={u.Role === 'Admin' && u.Username !== currentUser?.Username} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-20"><PencilSquareIcon className="w-4 h-4" /></button>
                                                <button onClick={() => setPasswordModalState({ isOpen: true, user: u })} disabled={u.Role === 'Admin' && u.Username !== currentUser?.Username} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-20"><KeyIcon className="w-4 h-4" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersPage;
