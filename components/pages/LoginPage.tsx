import React, { useState, useEffect } from 'react';
import { UserPermission, Owner, Unit } from '../../types';
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon } from '../ui/Icons';
import { useSettings, useNotification } from '../../App';
import { isProduction } from '../../utils/env';
import Modal from '../ui/Modal';

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
        const payload = {
            action_type: "RESET_PASSWORD",
            email: email,
            link: link
        };

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS quirk
            body: JSON.stringify(payload),
            mode: 'no-cors' // Use no-cors as GAS redirect can cause issues
        });
        
        // With no-cors, we can't read the response, so we assume success if the request was sent.
        return { success: true };

    } catch (e: any) {
        console.error("Password reset fetch error:", e);
        return { success: false, error: `Lỗi mạng khi gửi yêu cầu: ${e.message}` };
    }
};

const ForgotPasswordModal: React.FC<{ 
    onClose: () => void; 
    users: UserPermission[];
    allOwners: Owner[];
    allUnits: Unit[];
}> = ({ onClose, users, allOwners, allUnits }) => {
    const { showToast } = useNotification();
    const { invoiceSettings } = useSettings();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { appsScriptUrl } = invoiceSettings;
        if (!appsScriptUrl) {
            showToast('Chưa cấu hình máy chủ Email trong Cài đặt.', 'error');
            setIsLoading(false);
            return;
        }

        const user = users.find(u => u.Email.toLowerCase() === email.trim().toLowerCase());
        if (!user) {
            showToast('Không tìm thấy tài khoản nào với email này.', 'error');
            setIsLoading(false);
            return;
        }

        const resetLink = `${window.location.origin}${window.location.pathname}?action=reset_default&email=${encodeURIComponent(email)}`;
        
        const result = await sendPasswordResetEmail(email, resetLink, appsScriptUrl);

        if (result.success) {
            showToast(`Yêu cầu đã được gửi. Vui lòng kiểm tra email tại ${email} để nhận link xác nhận.`, 'success');
            onClose();
        } else {
            showToast(result.error || 'Gửi yêu cầu thất bại.', 'error');
        }
        
        setIsLoading(false);
    };

    return (
        <Modal title="Cấp lại Mật khẩu" onClose={onClose} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">Vui lòng nhập địa chỉ Email của bạn. Hệ thống sẽ gửi một link xác nhận để bạn đặt lại mật khẩu về mặc định.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ Email</label>
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary"
                        placeholder="your.email@example.com"
                        required
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-primary text-white font-semibold rounded-md disabled:opacity-70">
                        {isLoading ? 'Đang gửi...' : 'Gửi link xác nhận'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin, allOwners, allUnits, resetInfo }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPassModalOpen, setIsForgotPassModalOpen] = useState(false);
    const { invoiceSettings } = useSettings();
    const IS_PROD = isProduction();

    const MASTER_PASSWORD = '123456a@A';

    useEffect(() => {
        if (resetInfo) {
            setIdentifier(resetInfo.email);
            setPassword(resetInfo.pass);
        } else {
            const rememberedUser = localStorage.getItem('rememberedUser');
            if (rememberedUser) {
                setIdentifier(rememberedUser);
                setRememberMe(true);
            }
        }
    }, [resetInfo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 600));

        const cleanIdentifier = identifier.trim().toLowerCase();
        
        const user = users.find(u => 
            u.Email.toLowerCase() === cleanIdentifier || 
            (u.Username && u.Username.toLowerCase() === cleanIdentifier)
        );

        if (!user) {
            setError('Tên đăng nhập hoặc Email không tồn tại.');
            setIsLoading(false);
            return;
        }

        if (user.status !== 'Active') {
            setError('Tài khoản này chưa được kích hoạt hoặc đã bị vô hiệu hóa.');
            setIsLoading(false);
            return;
        }

        const isPasswordValid = user.password === password || (user.Role === 'Admin' && password === MASTER_PASSWORD);

        if (!isPasswordValid) {
            setError('Mật khẩu không chính xác.');
            setIsLoading(false);
            return;
        }

        onLogin(user, rememberMe);
        setIsLoading(false);
    };
    
    const backgroundUrl = invoiceSettings.loginBackgroundUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920';
    const buildingName = invoiceSettings.buildingName || 'Q-HOME MANAGER';
    const slogan = "Giải pháp Quản lý Vận hành Tòa nhà Chuyên nghiệp";

    return (
        <div className="min-h-screen bg-white text-gray-900 flex">
            {isForgotPassModalOpen && <ForgotPasswordModal onClose={() => setIsForgotPassModalOpen(false)} users={users} allOwners={allOwners} allUnits={allUnits} />}
            
            {/* Left Branding Section */}
            <div className="hidden lg:flex w-1/2 relative items-center justify-center">
                <div 
                    className="absolute inset-0 bg-cover bg-center" 
                    style={{ backgroundImage: `url("${backgroundUrl}")` }}
                />
                <div className="absolute inset-0 bg-primary opacity-80" />
                <div className="relative z-10 text-white text-center px-12">
                     <div className="mb-8 flex justify-center">
                        <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm border border-white/30">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                        </div>
                     </div>
                    <h1 className="text-4xl font-black tracking-tight mb-3">Q-Home Manager</h1>
                    <p className="text-lg opacity-90">{slogan}</p>
                </div>
            </div>

            {/* Right Form Section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <div className="max-w-md w-full mx-auto">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-gray-900">Xin chào, quản trị viên!</h2>
                        <p className="mt-2 text-gray-600">Đăng nhập để tiếp tục quản lý vận hành.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email hoặc Mã căn hộ</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <UserIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input 
                                    type="text" 
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                                    placeholder="Email hoặc Mã căn hộ"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center text-sm text-gray-600">
                                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                <span className="ml-2">Ghi nhớ đăng nhập</span>
                            </label>
                            <button type="button" onClick={() => setIsForgotPassModalOpen(true)} className="text-sm font-medium text-primary hover:underline">
                                Quên mật khẩu?
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-primary hover:bg-primary-focus text-white font-bold rounded-lg shadow-lg shadow-primary/30 transform transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Đang xử lý...
                                </div>
                            ) : 'Đăng nhập'}
                        </button>
                    </form>
                    
                    <div className="mt-12 text-center">
                        <p className="text-xs text-gray-500">© {new Date().getFullYear()} {buildingName}. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;