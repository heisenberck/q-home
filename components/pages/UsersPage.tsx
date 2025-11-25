
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role } from '../../types';
import { useAuth, useNotification } from '../../App';
import Modal from '../ui/Modal';
import { 
    KeyIcon, EnvelopeIcon, ShieldCheckIcon, ArrowPathIcon, 
    TrashIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon 
} from '../ui/Icons';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    role: Role;
}

// Modal Placeholders - Implement full UI as needed
const PasswordModal: React.FC<{ user: UserPermission, onSave: (pw: string) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    return (
        <Modal title={`Đặt mật khẩu mới cho ${user.Email}`} onClose={onClose}>
            <div className="space-y-4">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu mới" className="w-full p-2 border rounded-md" />
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Xác nhận mật khẩu" className="w-full p-2 border rounded-md" />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button>
                    <button onClick={() => password === confirm ? onSave(password) : alert('Mật khẩu không khớp!')} className="px-4 py-2 bg-primary text-white rounded-md">Lưu</button>
                </div>
            </div>
        </Modal>
    );
};

const EditUserModal: React.FC<{ user: UserPermission, onSave: (data: any) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [data, setData] = useState({ Email: user.Email, Username: user.Username || '' });
    return (
        <Modal title={`Sửa thông tin ${user.Email}`} onClose={onClose}>
             <div className="space-y-4">
                <input value={data.Email} onChange={e => setData(d => ({...d, Email: e.target.value}))} placeholder="Email" className="w-full p-2 border rounded-md" />
                <input value={data.Username} onChange={e => setData(d => ({...d, Username: e.target.value}))} placeholder="Tên đăng nhập" className="w-full p-2 border rounded-md" />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button>
                    <button onClick={() => onSave(data)} className="px-4 py-2 bg-primary text-white rounded-md">Lưu</button>
                </div>
            </div>
        </Modal>
    );
};

const AddUserModal: React.FC<{ onSave: (data: any) => void, onClose: () => void }> = ({ onSave, onClose }) => {
    // A full implementation would be needed here
    return (
        <Modal title="Thêm người dùng mới" onClose={onClose}>
            <p>Giao diện thêm người dùng sẽ được triển khai ở đây.</p>
             <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button>
                <button className="px-4 py-2 bg-primary text-white rounded-md">Lưu</button>
            </div>
        </Modal>
    );
};


const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, role }) => {
    const { showToast } = useNotification();
    const { user: currentUser } = useAuth();
    const canManage = role === 'Admin';

    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const [addUserModalOpen, setAddUserModalOpen] = useState(false);
    const [passwordModalState, setPasswordModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });
    const [editUserModalState, setEditUserModalState] = useState<{ isOpen: boolean; user: UserPermission | null }>({ isOpen: false, user: null });

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (roleFilter !== 'all' && user.Role !== roleFilter) return false;
            if (statusFilter !== 'all' && user.status !== statusFilter) return false;
    
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch && !(
                user.Email.toLowerCase().includes(lowerSearch) ||
                (user.Username || '').toLowerCase().includes(lowerSearch)
            )) return false;
    
            return true;
        });
    }, [users, searchTerm, roleFilter, statusFilter]);

    const handleUserUpdate = (updatedUser: UserPermission, summary: string, oldEmail?: string) => {
        const targetEmail = oldEmail || updatedUser.Email;
        const updater = (prev: UserPermission[]) => prev.map(u => u.Email === targetEmail ? updatedUser : u);
        setUsers(updater, {
            module: 'System', action: 'UPDATE_USER', 
            summary: summary, ids: [updatedUser.Email]
        });
    };

    const handleStatusChange = (email: string, newStatus: UserPermission['status']) => {
        const user = users.find(u => u.Email === email);
        if (user) handleUserUpdate({ ...user, status: newStatus }, `Thay đổi trạng thái của ${email} thành ${newStatus}`);
    };

    const handleResetToDefault = (email: string) => {
        if (!confirm(`Bạn có chắc muốn reset mật khẩu của ${email} về mặc định (123456a@)?`)) return;
        
        const user = users.find(u => u.Email === email);
        if (user) {
            handleUserUpdate({ 
                ...user, 
                password: '123456a@', 
                mustChangePassword: true 
            }, `Reset mật khẩu mặc định cho ${email}`);
            showToast(`Đã reset mật khẩu cho ${email}.`, 'success');
        }
    };

    const handleToggleMustChangePassword = (email: string) => {
        const user = users.find(u => u.Email === email);
        if (user) {
            const newValue = !user.mustChangePassword;
            handleUserUpdate({ 
                ...user, 
                mustChangePassword: newValue 
            }, `Cập nhật yêu cầu đổi mật khẩu cho ${email}: ${newValue}`);
            showToast(newValue ? `Đã yêu cầu ${email} đổi mật khẩu lần tới.` : `Đã huỷ yêu cầu đổi mật khẩu cho ${email}.`, 'info');
        }
    };

    const handleOpenSetPassword = (user: UserPermission) => {
        setPasswordModalState({ isOpen: true, user });
    };

    const handleSaveNewPassword = (newPassword: string) => {
        if (passwordModalState.user) {
            handleUserUpdate({
                ...passwordModalState.user,
                password: newPassword,
                mustChangePassword: false
            }, `Admin đặt mật khẩu mới cho ${passwordModalState.user.Email}`);
            showToast(`Đã đặt mật khẩu mới cho ${passwordModalState.user.Email}.`, 'success');
            setPasswordModalState({ isOpen: false, user: null });
        }
    };

    const handleOpenEditUser = (user: UserPermission) => {
        setEditUserModalState({ isOpen: true, user });
    };

    const handleSaveEditUser = (updatedData: { Email: string, Username: string }) => {
        const originalUser = editUserModalState.user;
        if (!originalUser) return;

        const emailExists = users.some(u => u.Email === updatedData.Email && u.Email !== originalUser.Email);
        if (emailExists) {
            showToast('Email này đã được sử dụng bởi người dùng khác.', 'error');
            return;
        }
        const usernameExists = users.some(u => u.Username === updatedData.Username && u.Username !== originalUser.Username);
        if (usernameExists && updatedData.Username) {
            showToast('Tên đăng nhập này đã được sử dụng.', 'error');
            return;
        }

        const newUser = { ...originalUser, ...updatedData };
        handleUserUpdate(newUser, `Cập nhật thông tin (Email/Username) cho user ${originalUser.Email}`, originalUser.Email);
        showToast('Cập nhật thông tin người dùng thành công.', 'success');
        setEditUserModalState({ isOpen: false, user: null });
    };
    
    const handleBulkAction = (action: 'activate' | 'deactivate' | 'reset_password' | 'delete') => {
        if (!canManage || selectedUsers.size === 0) return;

        if (action === 'delete') {
            if (currentUser && selectedUsers.has(currentUser.Email)) {
                showToast('Không thể xoá tài khoản của chính mình đang đăng nhập.', 'error');
                return;
            }
            if (!confirm(`CẢNH BÁO QUAN TRỌNG:\n\nBạn có chắc chắn muốn XOÁ VĨNH VIỄN ${selectedUsers.size} người dùng đã chọn?\nHành động này không thể hoàn tác.`)) return;
            
            const summary = `Xoá ${selectedUsers.size} người dùng`;
            const updater = (prev: UserPermission[]) => prev.filter(u => !selectedUsers.has(u.Email));
            
            setUsers(updater, {
                module: 'System', action: 'DELETE_USERS', 
                summary, count: selectedUsers.size, ids: Array.from(selectedUsers)
            });
            showToast(`${summary} thành công.`, 'success');
            setSelectedUsers(new Set());
            return;
        }
        
        let summary = '';
        const updater = (prev: UserPermission[]) => prev.map(u => {
            if (selectedUsers.has(u.Email)) {
                if (action === 'activate') return { ...u, status: 'Active' as const };
                if (action === 'deactivate') return { ...u, status: 'Disabled' as const };
                if (action === 'reset_password') return { ...u, password: '123456a@', mustChangePassword: true };
            }
            return u;
        });

        if (action === 'activate') summary = `Kích hoạt ${selectedUsers.size} người dùng`;
        if (action === 'deactivate') summary = `Vô hiệu hoá ${selectedUsers.size} người dùng`;
        if (action === 'reset_password') summary = `Reset mật khẩu cho ${selectedUsers.size} người dùng`;
        
        setUsers(updater, {
            module: 'System', action: 'BULK_UPDATE_USERS', 
            summary, count: selectedUsers.size, ids: Array.from(selectedUsers)
        });
        showToast(`${summary} thành công.`, 'success');
        setSelectedUsers(new Set());
    };

    const handleSelectUser = (email: string, isSelected: boolean) => {
        const newSelection = new Set(selectedUsers);
        isSelected ? newSelection.add(email) : newSelection.delete(email);
        setSelectedUsers(newSelection);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedUsers(e.target.checked ? new Set(filteredUsers.map(u => u.Email)) : new Set());
    };

    const isAllSelected = filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;

    const statusDisplay = (status: UserPermission['status']) => {
        const styles = {
            'Active': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            'Disabled': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        };
        const icon = {
            'Active': <CheckCircleIcon className="w-4 h-4" />,
            'Disabled': <WarningIcon className="w-4 h-4" />,
            'Pending': <WarningIcon className="w-4 h-4" />,
        }[status];
        return (
            <span className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>
                {icon}
                {status}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {addUserModalOpen && <AddUserModal onClose={() => setAddUserModalOpen(false)} onSave={() => {}} />}
            {passwordModalState.isOpen && passwordModalState.user && <PasswordModal user={passwordModalState.user} onSave={handleSaveNewPassword} onClose={() => setPasswordModalState({ isOpen: false, user: null })} />}
            {editUserModalState.isOpen && editUserModalState.user && <EditUserModal user={editUserModalState.user} onSave={handleSaveEditUser} onClose={() => setEditUserModalState({ isOpen: false, user: null })} />}

            <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-grow min-w-[200px]">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input type="text" placeholder="Tìm email, tên..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
                    </div>
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white">
                        <option value="all">Tất cả vai trò</option>
                        <option value="Admin">Admin</option>
                        <option value="Accountant">Accountant</option>
                        <option value="Operator">Operator</option>
                        <option value="Viewer">Viewer</option>
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white">
                        <option value="all">Tất cả trạng thái</option>
                        <option value="Active">Active</option>
                        <option value="Disabled">Disabled</option>
                        <option value="Pending">Pending</option>
                    </select>
                    <button onClick={() => setAddUserModalOpen(true)} disabled={!canManage} className="ml-auto px-4 py-2 bg-primary text-white font-semibold rounded-md">Thêm người dùng</button>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {selectedUsers.size > 0 && (
                    <div className="p-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex items-center gap-4">
                        <span className="font-semibold text-sm">{selectedUsers.size} đã chọn</span>
                        <div className="ml-auto flex items-center gap-4">
                            <button onClick={() => handleBulkAction('activate')} className="text-sm font-semibold text-green-600">Activate</button>
                            <button onClick={() => handleBulkAction('deactivate')} className="text-sm font-semibold text-yellow-600">Deactivate</button>
                            <button onClick={() => handleBulkAction('reset_password')} className="text-sm font-semibold text-blue-600">Reset Password</button>
                            <button onClick={() => handleBulkAction('delete')} className="text-sm font-semibold text-red-600">Delete</button>
                        </div>
                    </div>
                )}
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 w-12 text-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} /></th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Người dùng</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Vai trò</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.Email}>
                                    <td className="w-12 text-center"><input type="checkbox" checked={selectedUsers.has(user.Email)} onChange={e => handleSelectUser(user.Email, e.target.checked)} /></td>
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-gray-900 dark:text-gray-200">{user.Username || user.Email.split('@')[0]}</div>
                                        <div className="text-sm text-gray-500">{user.Email}</div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{user.Role}</td>
                                    <td className="px-4 py-4">{statusDisplay(user.status)}</td>
                                    <td className="px-4 py-4 text-center">
                                      <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleOpenEditUser(user)} className="p-1 text-gray-500 hover:text-primary" data-tooltip="Sửa"><PencilSquareIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleOpenSetPassword(user)} className="p-1 text-gray-500 hover:text-primary" data-tooltip="Đặt mật khẩu"><KeyIcon className="w-5 h-5" /></button>
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

export default UsersPage;
