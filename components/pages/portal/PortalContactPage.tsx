import React, { useState } from 'react';
import { useNotification, useAuth } from '../../../App';
import type { FeedbackItem, FeedbackReply } from '../../../types';
import { ChatBubbleLeftEllipsisIcon, PhoneArrowUpRightIcon } from '../../ui/Icons';


interface PortalContactPageProps {
    hotline: string;
    onSubmitFeedback: (item: FeedbackItem) => void;
}

const PortalContactPage: React.FC<PortalContactPageProps> = ({ hotline, onSubmitFeedback }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<'general' | 'maintenance' | 'billing' | 'other'>('general');
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !content.trim()) {
            showToast('Vui lòng nhập đầy đủ chủ đề và nội dung.', 'error');
            return;
        }

        const newFeedback: FeedbackItem = {
            id: `fb_${Date.now()}`,
            residentId: user.residentId!,
            subject,
            category,
            content,
            status: 'Pending',
            date: new Date().toISOString(),
            replies: [],
        };

        onSubmitFeedback(newFeedback);
        showToast('Gửi phản hồi thành công!', 'success');
        setSubject('');
        setContent('');
    };
    
    const inputStyle = "w-full p-3 border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-primary focus:border-primary";

  return (
    <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <h2 className="font-bold mb-3 text-lg">Liên hệ khẩn cấp</h2>
            <a href={`tel:${hotline}`} className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 text-white font-bold rounded-lg text-lg shadow-lg hover:bg-red-700">
                <PhoneArrowUpRightIcon className="w-6 h-6" />
                GỌI HOTLINE BQL
            </a>
            <p className="text-xs text-center text-gray-500 mt-2">({hotline})</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <h2 className="font-bold mb-3 text-lg">Gửi phản hồi / Báo sự cố</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="font-medium text-sm">Chủ đề</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} className={inputStyle} required />
                </div>
                <div>
                    <label className="font-medium text-sm">Phân loại</label>
                    <select value={category} onChange={e => setCategory(e.target.value as any)} className={inputStyle}>
                        <option value="general">Góp ý chung</option>
                        <option value="maintenance">Báo hỏng hóc, kỹ thuật</option>
                        <option value="billing">Thắc mắc về hóa đơn</option>
                        <option value="other">Vấn đề khác</option>
                    </select>
                </div>
                <div>
                    <label className="font-medium text-sm">Nội dung chi tiết</label>
                    <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} className={inputStyle} required />
                </div>
                <div>
                    <label className="font-medium text-sm">Đính kèm ảnh (nếu có)</label>
                    <input type="file" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                </div>
                <button type="submit" className="w-full p-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary-focus">Gửi đi</button>
            </form>
        </div>
    </div>
  );
};

export default PortalContactPage;