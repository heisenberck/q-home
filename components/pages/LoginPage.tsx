
import React, { useState, useEffect, useMemo } from 'react';
import { UserPermission, Owner, Unit } from '../../types';
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon } from '../ui/Icons';
import { useSettings, useNotification } from '../../App';
import { MOCK_USER_PERMISSIONS } from '../../constants';
import { isProduction } from '../../utils/env';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { fetchUserForLogin } from '../../services';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

interface LoginPageProps {
    users: UserPermission[];
    onLogin: (user: UserPermission, rememberMe: boolean) => void;
    allOwners: Owner[];
    allUnits: Unit[];
    resetInfo?: { email: string; pass: string } | null;
}

const sendPasswordResetEmail = async (
    email: string,
    link: string,
    gasUrl: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const payload = { action_type: "RESET_PASSWORD", email: email, link: link };
        await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            mode: 'no-cors'
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: `Lỗi mạng: ${e.message}` };
    }
};

const ForgotPasswordModal: React.FC<{ onClose: () => void; users: UserPermission[]; }> = ({ onClose, users }) => {
    const { showToast } = useNotification();
    const { invoiceSettings } = useSettings();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { appsScriptUrl } = invoiceSettings;
        if (!appsScriptUrl) { showToast('Chưa cấu hình máy chủ Email.', 'error'); setIsLoading(false); return; }
        
        let user = MOCK_USER_PERMISSIONS.find(u => u.Email.toLowerCase() === email.trim().toLowerCase());
        if (!user && isProduction()) {
            user = await fetchUserForLogin(email) as any;
        }

        if (!user) { showToast('Email không tồn tại trong hệ thống.', 'error'); setIsLoading(false); return; }
        const resetLink = `${window.location.origin}${window.location.pathname}?action=reset_default&email=${encodeURIComponent(email)}`;
        const result = await sendPasswordResetEmail(email, resetLink, appsScriptUrl);
        if (result.success) { showToast(`Yêu cầu đã được gửi tới ${email}.`, 'success'); onClose(); }
        else { showToast(result.error || 'Gửi yêu cầu thất bại.', 'error'); }
        setIsLoading(false);
    };

    return (
        <Modal title="Cấp lại Mật khẩu" onClose={onClose} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">Nhập email để nhận link đặt lại mật khẩu mặc định.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#006f3a] outline-none" placeholder="email@example.com" required />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-md">Hủy</button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[#006f3a] text-white font-semibold rounded-md">{isLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
                </div>
            </form>
        </Modal>
    );
};

const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin, allOwners, allUnits, resetInfo }) => {
    const { invoiceSettings } = useSettings();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPassModalOpen, setIsForgotPassModalOpen] = useState(false);
    const [greetingName, setGreetingName] = useState('Cư dân');

    const MASTER_PASSWORD = '123456a@A';

    useEffect(() => {
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) { setIdentifier(rememberedUser); setRememberMe(true); }
        const lastLoginName = localStorage.getItem('lastLoginName');
        if (lastLoginName) setGreetingName(lastLoginName);
        if (resetInfo) { setIdentifier(resetInfo.email); setPassword(resetInfo.pass); }
    }, [resetInfo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const cleanIdentifier = identifier.trim().toLowerCase();
        let userFound = null;
        
        // 1. Tìm User
        const localUser = MOCK_USER_PERMISSIONS.find(u => 
            u.Email.toLowerCase() === cleanIdentifier || 
            (u.Username && u.Username.toLowerCase() === cleanIdentifier)
        );

        if (localUser) {
            userFound = localUser;
        } else if (isProduction()) {
            try {
                userFound = await fetchUserForLogin(cleanIdentifier);
            } catch (err) {
                console.error("Login Search Error:", err);
            }
        }

        if (!userFound) {
            setError('Tài khoản không tồn tại trên hệ thống.');
            setIsLoading(false);
            return;
        }

        if (userFound.status !== 'Active' && userFound.status !== 'Pending') {
            setError('Tài khoản đã bị vô hiệu hóa.');
            setIsLoading(false);
            return;
        }

        const isPasswordValid = userFound.password === password || (userFound.Role === 'Admin' && password === MASTER_PASSWORD);

        if (!isPasswordValid) {
            setError('Mật khẩu không chính xác.');
            setIsLoading(false);
            return;
        }

        // 2. Kích hoạt Firebase Auth Session - BẮT BUỘC ĐỂ CÓ QUYỀN GHI
        if (isProduction()) {
            try {
                // Đảm bảo await hoàn thành để có token hợp lệ
                await signInAnonymously(auth);
            } catch (authErr: any) {
                console.error("Firebase Auth Error:", authErr);
                if (authErr.code === 'auth/admin-restricted-operation') {
                    setError('Lỗi hệ thống: Bạn cần Enable "Anonymous" trong Firebase Console -> Authentication.');
                } else {
                    setError('Lỗi kết nối máy chủ bảo mật. Vui lòng thử lại.');
                }
                setIsLoading(false);
                return;
            }
        }

        let displayName = userFound.Username || userFound.Email.split('@')[0];
        if (userFound.Role === 'Resident' && userFound.residentId) {
             const unit = allUnits.find(u => u.UnitID === userFound.residentId);
             const owner = allOwners.find(o => o.OwnerID === unit?.OwnerID);
             if (owner) displayName = owner.OwnerName.split(' ').pop() || displayName;
        }
        
        localStorage.setItem('lastLoginName', displayName);
        if (rememberMe) localStorage.setItem('rememberedUser', identifier);
        else localStorage.removeItem('rememberedUser');

        onLogin(userFound, rememberMe);
        setIsLoading(false);
    };

    const backgroundUrl = invoiceSettings.loginBackgroundUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920';

    return (
        <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center bg-gray-900">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
                .font-handwriting { font-family: 'Dancing Script', cursive; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
            `}</style>

            <div className="absolute inset-0 bg-gradient-to-br from-[#006f3a] to-emerald-900 z-0"></div>
            <img src={backgroundUrl} alt="Bg" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 transition-opacity duration-1000" />
            
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up mx-4">
                <div className="bg-[#006f3a] p-8 text-center">
                    <h2 className="text-4xl text-white font-handwriting mb-2">Xin chào, {greetingName}</h2>
                    <p className="text-white/80 text-sm">Hệ thống Quản lý HUD3 Linh Đàm</p>
                </div>

                <div className="p-8 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#006f3a]" placeholder="Email hoặc Mã căn hộ" required />
                        </div>
                        <div className="relative">
                            <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 pl-10 pr-10 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#006f3a]" placeholder="Mật khẩu" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded text-[#006f3a]" />
                                <span className="text-gray-600">Ghi nhớ</span>
                            </label>
                            <button type="button" onClick={() => setIsForgotPassModalOpen(true)} className="font-bold text-[#006f3a] hover:underline">Quên mật khẩu?</button>
                        </div>
                        {error && <div className="p-3 bg-red-50 text-red-600 text-xs text-center border border-red-200 rounded-lg animate-fade-in-down">{error}</div>}
                        <button type="submit" disabled={isLoading} className="w-full h-12 bg-primary text-white font-bold rounded-lg shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                            {isLoading ? <Spinner /> : 'Đăng nhập'}
                        </button>
                    </form>
                </div>
            </div>
            {isForgotPassModalOpen && <ForgotPasswordModal onClose={() => setIsForgotPassModalOpen(false)} users={MOCK_USER_PERMISSIONS} />}
        </div>
    );
};

export default LoginPage;
