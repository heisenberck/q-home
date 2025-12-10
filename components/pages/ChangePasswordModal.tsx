import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useNotification } from '../../App';

interface ChangePasswordModalProps {
    onClose: () => void;
    onSave: (password: string) => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSave }) => {
    const { showToast } = useNotification();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }
        if (password === '123456') {
            setError('Vui lòng không sử dụng mật khẩu mặc định.');
            return;
        }
        onSave(password);
    };

    const inputStyle = "w-full p-3 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-primary focus:border-primary";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100] p-4">
             <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-5 border-b">
                    <h3 className="text-xl font-bold">Thay đổi Mật khẩu</h3>
                    <p className="text-sm text-gray-600 mt-1">Vì lý do bảo mật, vui lòng tạo mật khẩu mới cho lần đăng nhập đầu tiên.</p>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputStyle}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={inputStyle}
                            required
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Để sau</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">Lưu Mật khẩu</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
