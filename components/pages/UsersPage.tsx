
import React, { useState, useMemo } from 'react';
import type { UserPermission, Role } from '../../types';
import { useAuth, useNotification, useLogger } from '../../App';
import Modal from '../ui/Modal';
import { 
    KeyIcon, EyeIcon, EnvelopeIcon, ShieldCheckIcon, ArrowPathIcon, 
    EllipsisVerticalIcon, TrashIcon, CheckCircleIcon, WarningIcon, PencilSquareIcon,
    SearchIcon 
} from '../ui/Icons';

interface UsersPageProps {
    users: UserPermission[];
    setUsers: (updater: React.SetStateAction<UserPermission[]>, logPayload?: any) => void;
    role: Role;
}

const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, role }) => {
    const { showToast } = useNotification();
    const { user: currentUser } = useAuth();
    const canManage = role === 'Admin';

    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modal States
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

    // --- Password Management Functions ---

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
                mustChangePassword: false // Assume manual set means it's verified
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

        // Check uniqueness
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
    
    // --- Bulk Actions ---

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
        return <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${styles[status]}`}>{status}</span>;
    };

    // Common styles for inputs in modals
    const inputClasses = "w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm transition-colors";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
    const selectClasses = inputClasses; // Reuse input styles for selects
    
    const AddUserModal: React.FC<{
        onClose: () => void;
        onSave: (data: any) => void;
    }> = ({ onClose, onSave }) => {
        const [formData, setFormData] = useState({ Email: '', Username: '', Role: 'Viewer', status: 'Pending', password: '123456a@' });
        const [inviteOption, setInviteOption] = useState('invite');

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            // Basic check
            if(users.some(u => u.Email === formData.Email)) {
                showToast('Email đã tồn tại.', 'error');
                return;
            }
            if(formData.Username && users.some(u => u.Username === formData.Username)) {
                showToast('Tên đăng nhập đã tồn tại.', 'error');
                return;
            }
            onSave(formData);
        }

        return (
            <Modal title="Thêm người dùng mới" onClose={onClose}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Email</label>
                        <input type="email" value={formData.Email} onChange={e => setFormData({...formData, Email: e.target.value})} required className={inputClasses}/>
                    </div>
                    <div>
                        <label className={labelClasses}>Tên đăng nhập (Tùy chọn)</label>
                        <input type="text" value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={inputClasses}/>
                    </div>
                    <div>
                        <label className={labelClasses}>Vai trò</label>
                        <select value={formData.Role} onChange={e => setFormData({...formData, Role: e.target.value as Role})} className={selectClasses}>
                            <option value="Admin">Admin</option><option value="Accountant">Accountant</option><option value="Operator">Operator</option><option value="Viewer">Viewer</option>
                        </select>
                    </div>
                    <div className="border-t dark:border-gray-600 pt-4">
                        <div className="flex items-center mb-2"><input type="radio" id="invite" name="inviteOption" value="invite" checked={inviteOption === 'invite'} onChange={() => setInviteOption('invite')} className="mr-2"/><label htmlFor="invite" className="text-sm text-gray-900 dark:text-gray-200">Gửi email mời (Mật khẩu mặc định: 123456a@)</label></div>
                        <div className="flex items-center"><input type="radio" id="set_pw" name="inviteOption" value="set_pw" checked={inviteOption === 'set_pw'} onChange={() => setInviteOption('set_pw')} className="mr-2"/><label htmlFor="set_pw" className="text-sm text-gray-900 dark:text-gray-200">Admin tự đặt mật khẩu</label></div>
                    </div>
                    {inviteOption === 'set_pw' && (
                        <div>
                            <label className={labelClasses}>Mật khẩu</label>
                            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClasses}/>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white">Hủy</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus">Thêm</button></div>
                </form>
            </Modal>
        );
    };
    
    const EditUserModal: React.FC<{
        user: UserPermission;
        onClose: () => void;
        onSave: (data: { Email: string, Username: string }) => void;
    }> = ({ user, onClose, onSave }) => {
        const [formData, setFormData] = useState({ Email: user.Email, Username: user.Username || '' });

        return (
            <Modal title={`Sửa người dùng: ${user.Email}`} onClose={onClose}>
                <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Email</label>
                        <input type="email" value={formData.Email} onChange={e => setFormData({...formData, Email: e.target.value})} required className={inputClasses}/>
                    </div>
                    <div>
                        <label className={labelClasses}>Tên đăng nhập</label>
                        <input type="text" value={formData.Username} onChange={e => setFormData({...formData, Username: e.target.value})} className={inputClasses} placeholder="Chưa đặt"/>
                    </div>
                    <div>
                        <label className={labelClasses}>Vai trò</label>
                        <input 
                            type="text" 
                            value={user.Role} 
                            disabled 
                            className={`${inputClasses} bg-gray-100 dark:bg-gray-600 cursor-not-allowed`} 
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white">Hủy</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus">Lưu thay đổi</button>
                    </div>
                </form>
            </Modal>
        );
    };

    const SetPasswordModal: React.FC<{
        user: UserPermission;
        onClose: () => void;
        onSave: (pass: string) => void;
    }> = ({ user, onClose, onSave }) => {
        const [newPass, setNewPass] = useState('');
        return (
             <Modal title={`Đặt mật khẩu cho ${user.Email}`} onClose={onClose} size="sm">
                <form onSubmit={(e) => { e.preventDefault(); if(newPass) onSave(newPass); }} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Mật khẩu mới</label>
                        <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} className={inputClasses} autoFocus placeholder="Nhập mật khẩu mới..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white">Hủy</button>
                        <button type="submit" disabled={!newPass} className="px-4 py-2 bg-primary text-white rounded-md text-sm disabled:opacity-50 hover:bg-primary-focus">Lưu mật khẩu</button>
                    </div>
                </form>
             </Modal>
        );
    }

    const handleAddUser = (data: any) => {
        const newUser = { ...data, mustChangePassword: true };
        setUsers(prev => [...prev, newUser], {
             module: 'System', action: 'ADD_USER', 
             summary: `Thêm người dùng mới ${data.Email}`
        });
        setAddUserModalOpen(false);
        showToast(`Đã thêm người dùng ${data.Email}.`, 'success');
    }

    return (
        <div className="space-y-4">
            {addUserModalOpen && <AddUserModal onClose={() => setAddUserModalOpen(false)} onSave={handleAddUser} />}
            {passwordModalState.isOpen && passwordModalState.user && (
                <SetPasswordModal 
                    user={passwordModalState.user} 
                    onClose={() => setPasswordModalState({ isOpen: false, user: null })} 
                    onSave={handleSaveNewPassword} 
                />
            )}
            {editUserModalState.isOpen && editUserModalState.user && (
                <EditUserModal
                    user={editUserModalState.user}
                    onClose={() => setEditUserModalState({ isOpen: false, user: null })}
                    onSave={handleSaveEditUser}
                />
            )}
            
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Quản lý Người dùng ({users.length})</h2>
                <button onClick={() => setAddUserModalOpen(true)} disabled={!canManage} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400 flex items-center gap-2">
                    <span>+</span> Thêm người dùng
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-4 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border dark:border-dark-border shadow-sm">
                <div className="relative flex-grow min-w-[200px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Tìm theo Email hoặc Tên..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-10 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"
                    />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg">
                    <option value="all">Tất cả vai trò</option>
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Operator">Operator</option>
                    <option value="Viewer">Viewer</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                    <option value="Pending">Pending</option>
                </select>
            </div>

            {selectedUsers.size > 0 && (
                <div className="bulk-action-bar">
                    <span className="font-semibold text-sm">{selectedUsers.size} đã chọn</span>
                    <button onClick={() => setSelectedUsers(new Set())} className="btn-clear ml-4">Bỏ chọn</button>
                    <div className="h-6 border-l dark:border-dark-border ml-2"></div>
                    <div className="ml-auto flex items-center gap-4">
                         <button onClick={() => handleBulkAction('activate')} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><CheckCircleIcon /> Kích hoạt</button>
                         <button onClick={() => handleBulkAction('deactivate')} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><WarningIcon /> Vô hiệu hoá</button>
                         <button onClick={() => handleBulkAction('reset_password')} className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary"><ArrowPathIcon /> Reset Mật khẩu</button>
                         <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-2"></div>
                         <button onClick={() => handleBulkAction('delete')} className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-800"><TrashIcon /> Xoá</button>
                    </div>
                </div>
            )}

            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-1 rounded-lg shadow-md overflow-hidden border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full themed-table">
                        <thead>
                            <tr>
                                <th className="w-12 text-center"><input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} disabled={!canManage || filteredUsers.length === 0} /></th>
                                <th className="text-left">Email / Tên đăng nhập</th>
                                <th className="text-left w-40">Vai trò</th>
                                <th className="text-left w-32">Trạng thái</th>
                                <th className="text-center w-48">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.Email} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="text-center py-3">
                                        <input type="checkbox" checked={selectedUsers.has(user.Email)} onChange={e => handleSelectUser(user.Email, e.target.checked)} disabled={!canManage} />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        <div>{user.Email}</div>
                                        {user.Username && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">@{user.Username}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 font-medium">
                                        {user.Role}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{statusDisplay(user.status)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="action-icons flex justify-center gap-3">
                                            <button
                                                disabled={!canManage}
                                                onClick={() => handleOpenEditUser(user)}
                                                className="icon-btn text-gray-500 hover:text-primary"
                                                title="Sửa thông tin người dùng"
                                            >
                                                <PencilSquareIcon />
                                            </button>
                                            <button 
                                                disabled={!canManage} 
                                                onClick={() => handleOpenSetPassword(user)}
                                                className="icon-btn text-gray-500 hover:text-blue-500" 
                                                title="Đặt mật khẩu thủ công"
                                            >
                                                <KeyIcon />
                                            </button>
                                            <button 
                                                disabled={!canManage} 
                                                onClick={() => handleResetToDefault(user.Email)}
                                                className="icon-btn text-gray-500 hover:text-orange-500" 
                                                title="Reset mật khẩu về mặc định"
                                            >
                                                <EnvelopeIcon />
                                            </button>
                                            <button 
                                                disabled={!canManage} 
                                                onClick={() => handleToggleMustChangePassword(user.Email)}
                                                className={`icon-btn ${user.mustChangePassword ? 'text-red-500' : 'text-green-500 hover:text-red-500'}`} 
                                                title={user.mustChangePassword ? "Đang yêu cầu đổi mật khẩu (Bấm để huỷ)" : "Bắt buộc đổi mật khẩu khi đăng nhập"}
                                            >
                                                <ShieldCheckIcon />
                                            </button>
                                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                            <button 
                                                disabled={!canManage} 
                                                onClick={() => handleStatusChange(user.Email, user.status === 'Active' ? 'Disabled' : 'Active')} 
                                                className="icon-btn" 
                                                title={user.status === 'Active' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}
                                            >
                                                {user.status === 'Active' ? <CheckCircleIcon className="text-green-600" /> : <WarningIcon className="text-red-500" />}
                                            </button>
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
