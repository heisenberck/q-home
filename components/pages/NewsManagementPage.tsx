
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { NewsItem, Role, UserPermission } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import { 
    PencilSquareIcon, TrashIcon, UploadIcon, MegaphoneIcon, 
    CheckCircleIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon,
    ClockIcon, PlusIcon, PaperAirplaneIcon, PinIcon, StarIcon,
} from '../ui/Icons';
import { timeAgo } from '../../utils/helpers';
import { isProduction } from '../../utils/env';
import { saveNewsItem, deleteNewsItem } from '../../services';
import { 
    collection, doc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Spinner from '../ui/Spinner';

type ExtendedNewsItem = NewsItem & { isPinned?: boolean };

interface NewsManagementPageProps {
  news: NewsItem[];
  setNews: (updater: React.SetStateAction<NewsItem[]>, logPayload?: any) => void;
  role: Role;
  users: UserPermission[];
}

const CompactStatCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    borderColorClass: string;
}> = ({ label, value, icon, colorClass, borderColorClass }) => (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${borderColorClass} flex items-center justify-between`}>
        <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-full ${colorClass}`}>
            {icon}
        </div>
    </div>
);

const NewsEditorModal: React.FC<{
  newsItem?: ExtendedNewsItem | null;
  onSave: (item: ExtendedNewsItem) => void;
  onClose: () => void;
  loading: boolean;
}> = ({ newsItem, onSave, onClose, loading }) => {
  const [item, setItem] = useState<Omit<ExtendedNewsItem, 'id' | 'date'>>(
    newsItem 
      ? { title: newsItem.title, content: newsItem.content || '', priority: newsItem.priority, category: newsItem.category, imageUrl: newsItem.imageUrl, sender: newsItem.sender || 'BQLVH', isPinned: newsItem.isPinned || false, isBroadcasted: newsItem.isBroadcasted, isArchived: newsItem.isArchived } 
      : { title: '', content: '', priority: 'normal', category: 'notification', imageUrl: '', sender: 'BQLVH', isPinned: false, isBroadcasted: false, isArchived: false }
  );
  const [imagePreview, setImagePreview] = useState(newsItem?.imageUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      if (editorRef.current) { editorRef.current.innerHTML = item.content || ''; }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setItem({ ...item, [e.target.name]: value });
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height = (height * MAX_WIDTH) / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setImagePreview(dataUrl); setItem(prev => ({ ...prev, imageUrl: dataUrl }));
            }
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...item,
      content: editorRef.current ? editorRef.current.innerHTML : item.content,
      imageUrl: imagePreview,
      id: newsItem?.id || '',
      date: newsItem?.date || new Date().toISOString(),
    });
  };

  const inputStyle = "w-full h-10 px-3 border rounded-md bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm";
  const labelStyle = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title={newsItem ? "Sửa Tin tức" : "Soạn Tin mới"} onClose={onClose} size="3xl">
      <form onSubmit={handleSubmit} className="space-y-6 text-gray-900">
        <div>
            <label className={labelStyle}>Tiêu đề tin <span className="text-red-500">*</span></label>
            <input name="title" value={item.title} onChange={handleChange} className={inputStyle} placeholder="Nhập tiêu đề..." required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className={labelStyle}>Phân loại</label><select name="category" value={item.category} onChange={handleChange} className={inputStyle}><option value="notification">Thông báo</option><option value="plan">Kế hoạch</option><option value="event">Sự kiện</option></select></div>
            <div><label className={labelStyle}>Độ ưu tiên</label><select name="priority" value={item.priority} onChange={handleChange} className={inputStyle}><option value="normal">Thông thường</option><option value="high">Quan trọng</option></select></div>
            <div><label className={labelStyle}>Người gửi</label><select name="sender" value={item.sender} onChange={handleChange} className={inputStyle}><option value="BQLVH">BQLVH</option><option value="BQT">BQT</option></select></div>
        </div>
        <div>
          <label className={labelStyle}>Nội dung</label>
          <div className="border border-gray-300 rounded-md mt-1 bg-white overflow-hidden shadow-sm">
            <div ref={editorRef} className="w-full p-4 min-h-[200px] max-h-[400px] overflow-y-auto outline-none text-sm" contentEditable={true} suppressContentEditableWarning={true} />
          </div>
        </div>
        <div>
          <label className={labelStyle}>Ảnh đính kèm</label>
          <div className="mt-1 border border-gray-300 rounded-lg p-4 bg-gray-50 flex flex-col md:flex-row gap-4 items-center">
            {imagePreview ? (
                <div className="relative w-48 h-32 rounded-lg overflow-hidden border">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => {setImagePreview(''); setItem(p=>({...p, imageUrl:''}))}} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><TrashIcon className="w-3 h-3"/></button>
                </div>
            ) : <div className="w-48 h-32 border-2 border-dashed flex items-center justify-center text-xs text-gray-400">Không ảnh</div>}
            <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-50">Chọn ảnh</button>
          </div>
        </div>
        <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex items-center gap-2">
               <input type="checkbox" id="isPinned" checked={item.isPinned} onChange={(e) => setItem({...item, isPinned: e.target.checked})} className="w-4 h-4 text-primary rounded"/>
                <label htmlFor="isPinned" className="text-sm text-gray-700">Ghim tin</label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg">Hủy</button>
              <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg flex items-center gap-2">
                  {loading && <Spinner />} {newsItem ? 'Cập nhật' : 'Đăng tin'}
              </button>
            </div>
        </div>
      </form>
    </Modal>
  );
};

const NewsManagementPage: React.FC<NewsManagementPageProps> = ({ news, setNews, role, users }) => {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtendedNewsItem | null | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const IS_PROD = isProduction();

  const filteredNews = useMemo(() => {
    return (news as ExtendedNewsItem[]).filter(item => {
        if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        return true;
    }).sort((a,b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [news, searchTerm, categoryFilter]);

  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNews.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNews, currentPage]);
  
  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);

  const handleSave = async (item: ExtendedNewsItem) => {
    setLoading(true);
    try {
        const savedId = await saveNewsItem(item);
        const savedItem = { ...item, id: savedId };
        
        // Cập nhật state App tức thì
        setNews(prev => {
            const exists = prev.some(n => n.id === item.id);
            return exists ? prev.map(n => n.id === item.id ? savedItem : n) : [savedItem, ...prev];
        });
        
        showToast('Đã lưu tin tức thành công.', 'success');
        setEditingItem(undefined);
    } catch (error: any) {
        showToast('Lỗi khi lưu: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa tin tức này?')) return;
    setLoading(true);
    try {
        await deleteNewsItem(id);
        setNews(prev => prev.filter(n => n.id !== id));
        showToast('Đã xóa tin tức.', 'success');
    } catch (error: any) {
        showToast('Lỗi khi xóa: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleBroadcast = async (item: NewsItem) => {
    if (!window.confirm('Gửi thông báo đẩy tới cư dân?')) return;
    setLoading(true);
    try {
        const batch = writeBatch(db);
        const residents = users.filter(u => u.Role === 'Resident');
        residents.forEach(res => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                userId: res.Username, title: item.title, body: item.title, isRead: false, createdAt: serverTimestamp(), type: 'news', linkId: item.id
            });
        });
        await batch.commit();
        const updatedItem = { ...item, isBroadcasted: true, broadcastTime: new Date().toISOString() };
        await saveNewsItem(updatedItem);
        setNews(prev => prev.map(n => n.id === item.id ? updatedItem : n));
        showToast(`Đã thông báo tới ${residents.length} cư dân.`, 'success');
    } catch (e: any) {
        showToast('Lỗi gửi: ' + e.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      {editingItem !== undefined && <NewsEditorModal newsItem={editingItem} onSave={handleSave} onClose={() => setEditingItem(undefined)} loading={loading} />}

      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-grow">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Tìm tiêu đề..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg outline-none focus:ring-1 focus:ring-primary"/>
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 px-3 border rounded-lg">
            <option value="all">Tất cả</option>
            <option value="notification">Thông báo</option>
            <option value="plan">Kế hoạch</option>
            <option value="event">Sự kiện</option>
        </select>
        <button onClick={() => setEditingItem(null)} className="h-10 px-5 bg-primary text-white font-bold rounded-lg flex items-center gap-2">
            <PlusIcon className="w-5 h-5" /> Tin mới
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {paginatedNews.map(item => (
            <div key={item.id} className="flex bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="w-48 h-32 bg-gray-100 shrink-0">
                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ClockIcon className="w-10 h-10"/></div>}
                </div>
                <div className="flex-grow p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {item.isPinned && <span className="p-1 bg-orange-100 text-orange-600 rounded-full"><PinIcon className="w-3 h-3" filled/></span>}
                        <span className="text-[10px] font-black uppercase text-gray-400">{item.category}</span>
                        {item.priority === 'high' && <span className="text-[10px] font-black uppercase text-red-600">Khẩn</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 truncate">{item.title}</h3>
                    <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <span>{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                        <span>{item.sender || 'BQLVH'}</span>
                    </div>
                </div>
                <div className="p-2 flex flex-col gap-2 border-l">
                    <button onClick={() => setEditingItem(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><PencilSquareIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleBroadcast(item)} disabled={item.isBroadcasted} className={`p-2 rounded ${item.isBroadcasted ? 'text-green-600' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}><PaperAirplaneIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><TrashIcon className="w-5 h-5"/></button>
                </div>
            </div>
        ))}
      </div>

      <div className="fixed bottom-0 right-0 z-50 h-7 flex items-center gap-4 px-6 bg-white border-t border-l border-gray-200">
          <span className="text-[10px] font-bold text-gray-400">Trang {currentPage} / {totalPages || 1}</span>
          <div className="flex gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 hover:bg-gray-100 disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 hover:bg-gray-100 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
          </div>
      </div>
    </div>
  );
};

export default NewsManagementPage;
