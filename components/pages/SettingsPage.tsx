

import React, { useState, useEffect } from 'react';
import type { InvoiceSettings, Role } from '../../types';
import { useLogger, useNotification } from '../../App';
import { processFooterHtml } from '../../utils/helpers';

const sendEmailAPI = async (
    recipient: string,
    subject: string,
    body: string,
    settings: InvoiceSettings
): Promise<{ success: boolean; error?: string }> => {
    if (!settings.appsScriptUrl) {
        return { success: false, error: 'Chưa cấu hình URL Google Apps Script trong Cài đặt.' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('email', recipient);
        formData.append('subject', subject);
        formData.append('htmlBody', body.replace(/\n/g, '<br>'));
        if (settings.senderName) {
            formData.append('senderName', settings.senderName);
        }

        const response = await fetch(settings.appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (!response.ok) {
            let errorMsg = `Server returned an error: ${response.status} ${response.statusText}`;
             try {
                const errorResult = await response.json();
                if (errorResult.error) errorMsg = `Server error: ${errorResult.error}`;
            } catch (e) { /* ignore */ }
            return { success: false, error: errorMsg };
        }
        
        return { success: true };

    } catch (e: any) {
        console.error("Apps Script fetch error:", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            return { success: false, error: `Lỗi mạng hoặc CORS. Vui lòng kiểm tra lại URL Google Apps Script và đảm bảo đã public đúng cách.`};
        }
        return { success: false, error: `Lỗi mạng khi gửi yêu cầu: ${e.message}` };
    }
};

interface SettingsPageProps {
    invoiceSettings: InvoiceSettings;
    setInvoiceSettings: (settings: InvoiceSettings) => Promise<void>;
    role: Role;
}

const DEFAULT_CONTENT_SETTINGS = {
    senderName: 'BQT HUD3 LINH DAM',
    emailSubject: '[BQL HUD3] THONG BAO PHI DICH VU KY {{period}} CHO CAN HO {{unit_id}}',
    emailBody: `Kinh gui Quy chu ho {{owner_name}},\n\nBan Quan ly (BQL) toa nha HUD3 Linh Dam tran trong thong bao phi dich vu ky {{period}} cua can ho {{unit_id}}.\n\nTong so tien can thanh toan la: {{total_due}}.\n\nVui long xem chi tiet phi dich vu ngay duoi day.\n\nTran trong,\nBQL Chung cu HUD3 Linh Dam.`,
    footerHtml: `© {{YEAR}} BQL Chung cu HUD3 Linh Dam. Hotline: 0834.88.66.86`,
    footerShowInPdf: true,
    footerShowInEmail: true,
    footerShowInViewer: true,
    footerAlign: 'center' as 'left' | 'center' | 'right',
    footerFontSize: 'sm' as 'sm' | 'md' | 'lg',
};

const SettingsPage: React.FC<SettingsPageProps> = ({ invoiceSettings, setInvoiceSettings, role }) => {
    const canEdit = ['Admin', 'Accountant'].includes(role);
    const { showToast } = useNotification();
    const { logAction } = useLogger();

    const [localSettings, setLocalSettings] = useState<InvoiceSettings>(invoiceSettings);

    useEffect(() => {
        setLocalSettings(invoiceSettings);
    }, [invoiceSettings]);

    const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setLocalSettings(prev => ({ ...prev, [id]: checked }));
        } else {
            setLocalSettings(prev => ({ ...prev, [id]: value }));
        }
    };
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (result) {
                    setLocalSettings(prev => ({ ...prev, logoUrl: result }));
                    showToast('Logo đã được tải lên. Bấm "Lưu" để xác nhận.', 'info');
                } else {
                    showToast('Không thể đọc file logo.', 'error');
                }
            };
            reader.onerror = () => {
                showToast('Lỗi khi đọc file logo.', 'error');
            }
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = async () => {
        try {
            await setInvoiceSettings(localSettings);
    
            if (localSettings.appsScriptUrl) {
                showToast('Đang gửi email kiểm tra để xác thực cài đặt...', 'info', 5000);
                const testRecipient = localSettings.senderEmail || 'hquynhmvt@gmail.com';
                const testSubject = '[Test] - Xac thuc Cai dat Email He thong HUD3';
                const testBody = `Xin chao,\n\nDay la email duoc gui tu dong de kiem tra cau hinh Google Apps Script cua ban.\n\nNeu ban nhan duoc email nay, cau hinh da thanh cong.\n\n- Ten nguoi gui: ${localSettings.senderName || 'Chua dat'}\n- Apps Script URL: ${localSettings.appsScriptUrl}\n- Thoi gian gui: ${new Date().toLocaleString('vi-VN')}\n\nTran trong,\nHe thong Quan ly.`;
                const result = await sendEmailAPI(testRecipient, testSubject, testBody, localSettings);
                if (result.success) {
                    showToast(`Yeu cau gui mail kiem tra da duoc gui toi ${testRecipient}. Vui long kiem tra hop thu cua ban.`, 'success', 8000);
                } else {
                    showToast(`Loi gui mail kiem tra: ${result.error}`, 'error', 10000);
                }
            } else {
                showToast('Chưa cau hinh Apps Script URL. Email kiem tra se khong duoc gui.', 'warn');
            }
        } catch (error) {
            // Error is handled by the parent, no need to show another toast
        }
    };

    const handleResetContentDefaults = () => {
        setLocalSettings(prev => ({
            ...prev,
            ...DEFAULT_CONTENT_SETTINGS
        }));
        showToast('Đã khôi phục cài đặt nội dung về mặc định.', 'info');
    };
    
    const insertVariable = (variable: string) => {
        setLocalSettings(prev => ({
            ...prev,
            footerHtml: (prev.footerHtml || '') + ` ${variable} `
        }));
    };

    const variables = ['{{YEAR}}', '{{BUILDING_NAME}}', '{{HOTLINE}}', '{{ADDRESS}}', '{{EMAIL_SUPPORT}}', '{{WEBSITE}}'];
    
    const inputStyle = "p-2 border rounded-md w-full mt-1 bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary focus:ring-primary focus:border-primary disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed";
    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary";

    return (
        <div className="space-y-6">
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 dark:border-dark-border">Thông tin Phiếu báo & Chuyển khoản</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={`${labelStyle} mb-1`}>Logo Phiếu báo</label>
                        <div className="flex items-center gap-4 mt-2">
                            <img src={localSettings.logoUrl} alt="Logo Preview" className="h-16 w-auto border p-1 rounded-md bg-white object-contain"/>
                            <input type="file" accept="image/*" onChange={handleLogoChange} disabled={!canEdit} className="hidden" id="logo-upload"/>
                            <label htmlFor="logo-upload" className={`cursor-pointer px-4 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-sm text-sm ${canEdit ? 'hover:bg-gray-700' : 'bg-gray-400 cursor-not-allowed'}`}>Thay đổi...</label>
                        </div>
                    </div>
                    <div></div> {/* Spacer */}
                    <div>
                        <label htmlFor="accountName" className={labelStyle}>Tên chủ tài khoản</label>
                        <input id="accountName" type="text" value={localSettings.accountName} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}/>
                    </div>
                    <div>
                        <label htmlFor="accountNumber" className={labelStyle}>Số tài khoản</label>
                        <input id="accountNumber" type="text" value={localSettings.accountNumber} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}/>
                    </div>
                    <div>
                        <label htmlFor="bankName" className={labelStyle}>Ngân hàng & Chi nhánh</label>
                        <input id="bankName" type="text" value={localSettings.bankName} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}/>
                    </div>
                </div>
            </div>

            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 dark:border-dark-border">Footer Phiếu báo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="footerHtml" className={labelStyle}>Nội dung Footer</label>
                            <textarea id="footerHtml" rows={5} value={localSettings.footerHtml || ''} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle} placeholder="© {{YEAR}} {{BUILDING_NAME}}. Hotline: {{HOTLINE}}" />
                        </div>
                        <div>
                            <label className={labelStyle}>Chèn biến</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {variables.map(v => <button key={v} type="button" onClick={() => insertVariable(v)} disabled={!canEdit} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-xs font-mono rounded hover:bg-gray-300 disabled:cursor-not-allowed">{v}</button>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4 dark:border-dark-border">
                            <div>
                                <label className={labelStyle}>Hiển thị</label>
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center"><input type="checkbox" id="footerShowInPdf" checked={localSettings.footerShowInPdf} onChange={handleSettingChange} disabled={!canEdit} className="mr-2" /><label htmlFor="footerShowInPdf" className="text-sm">Trên PDF</label></div>
                                    <div className="flex items-center"><input type="checkbox" id="footerShowInEmail" checked={localSettings.footerShowInEmail} onChange={handleSettingChange} disabled={!canEdit} className="mr-2" /><label htmlFor="footerShowInEmail" className="text-sm">Trong Email</label></div>
                                    <div className="flex items-center"><input type="checkbox" id="footerShowInViewer" checked={localSettings.footerShowInViewer} onChange={handleSettingChange} disabled={!canEdit} className="mr-2" /><label htmlFor="footerShowInViewer" className="text-sm">Khi xem phiếu</label></div>
                                </div>
                            </div>
                            <div>
                                <label className={labelStyle}>Căn lề</label>
                                <div className="mt-2 space-y-1">
                                    {(['left', 'center', 'right'] as const).map(align => <div key={align} className="flex items-center"><input type="radio" id={`footerAlign-${align}`} name="footerAlign" value={align} checked={localSettings.footerAlign === align} onChange={handleSettingChange} disabled={!canEdit} className="mr-2" /><label htmlFor={`footerAlign-${align}`} className="text-sm capitalize">{align}</label></div>)}
                                </div>
                            </div>
                            <div>
                                <label className={labelStyle}>Cỡ chữ</label>
                                <div className="mt-2 space-y-1">
                                    {(['sm', 'md', 'lg'] as const).map(size => <div key={size} className="flex items-center"><input type="radio" id={`footerFontSize-${size}`} name="footerFontSize" value={size} checked={localSettings.footerFontSize === size} onChange={handleSettingChange} disabled={!canEdit} className="mr-2" /><label htmlFor={`footerFontSize-${size}`} className="text-sm capitalize">{size === 'sm' ? 'Nhỏ' : size === 'md' ? 'Vừa' : 'Lớn'}</label></div>)}
                                </div>
                            </div>
                        </div>
                        <div>
                            <button type="button" onClick={handleResetContentDefaults} disabled={!canEdit} className="px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400">Khôi phục Mặc định</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">Xem trước</h4>
                        <div className="p-4 border rounded-md min-h-[150px] bg-white dark:bg-gray-800 flex items-center justify-center">
                            <div className={`
                                w-full
                                ${localSettings.footerAlign === 'left' ? 'text-left' : localSettings.footerAlign === 'right' ? 'text-right' : 'text-center'}
                                ${localSettings.footerFontSize === 'sm' ? 'text-xs' : localSettings.footerFontSize === 'lg' ? 'text-base' : 'text-sm'}
                            `} dangerouslySetInnerHTML={{ __html: processFooterHtml(localSettings.footerHtml) }} />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold border-b pb-3 mb-6 dark:border-dark-border">Cấu hình Gửi Mail</h3>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 mb-6">
                    <p className="text-sm mt-1">Sử dụng Google Apps Script để gửi mail. Dán "Deployment URL" của Web App vào ô "Google Apps Script URL" bên dưới.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label htmlFor="senderEmail" className={labelStyle}>Địa chỉ Email người gửi</label>
                        <input id="senderEmail" type="email" placeholder="example@gmail.com" value={localSettings.senderEmail} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}/>
                    </div>
                    <div>
                        <label htmlFor="senderName" className={labelStyle}>Tên người gửi (Sender Name)</label>
                        <input id="senderName" type="text" placeholder="BQT HUD3 LINH DAM" value={localSettings.senderName || ''} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle} />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="appsScriptUrl" className={labelStyle}>Google Apps Script URL</label>
                        <input id="appsScriptUrl" type="url" placeholder="https://script.google.com/macros/s/..." value={localSettings.appsScriptUrl || ''} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}/>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-6">
                    <div>
                        <label htmlFor="emailSubject" className={labelStyle}>Tiêu đề Mail</label>
                        <input id="emailSubject" type="text" value={localSettings.emailSubject || ''} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle} />
                    </div>
                    <div>
                        <label htmlFor="emailBody" className={labelStyle}>Nội dung Mail</label>
                        <textarea id="emailBody" rows={8} value={localSettings.emailBody || ''} onChange={handleSettingChange} disabled={!canEdit} className={inputStyle}></textarea>
                        <p className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            Sử dụng các biến: <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded-sm">{'{{unit_id}}'}</code>, <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded-sm">{'{{owner_name}}'}</code>, <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded-sm">{'{{period}}'}</code>, <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded-sm">{'{{total_due}}'}</code>.
                        </p>
                    </div>
                </div>
            </div>

             <div className="flex justify-end mt-6">
                <button onClick={handleSave} disabled={!canEdit} className="px-6 py-2 bg-primary text-white font-bold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400">
                    Lưu Cài đặt
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;
