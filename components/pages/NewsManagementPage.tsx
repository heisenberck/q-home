import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { NewsItem, Role, UserPermission } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import { 
    PencilSquareIcon, TrashIcon, UploadIcon, MegaphoneIcon, ArchiveBoxIcon, 
    CheckCircleIcon, ListBulletIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon,
    ClockIcon, PlusIcon, PaperAirplaneIcon
} from '../ui/Icons';
import { timeAgo } from '../../utils/helpers';
import { isProduction } from '../../utils/env';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Spinner from '../ui/Spinner';

// --- Local Icons ---
const NewspaperIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
    </svg>
);

const PinIcon: React.FC<{ className?: string; filled?: boolean }> = ({ className = "h-6 w-6", filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
);

const StarIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
);

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
  const { showToast } = useNotification();
  
  const [item, setItem] = useState<Omit<ExtendedNewsItem, 'id' | 'date'>>(
    newsItem 
      ? { title: newsItem.title, content: newsItem.content || '', priority: newsItem.priority, category: newsItem.category, imageUrl: newsItem.imageUrl, sender: newsItem.sender || 'BQLVH', isPinned: newsItem.isPinned || false } 
      : { title: '', content: '', priority: 'normal', category: 'notification', imageUrl: '', sender: 'BQLVH', isPinned: false }
  );
  const [imagePreview, setImagePreview] = useState(newsItem?.imageUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      if (editorRef.current) {
          editorRef.current.innerHTML = item.content || '';
      }
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
            const MAX_WIDTH = 800;
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setImagePreview(dataUrl);
                setItem(prev => ({ ...prev, imageUrl: dataUrl }));
            }
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalItem: ExtendedNewsItem = {
      ...item,
      content: editorRef.current ? editorRef.current.innerHTML : item.content,
      imageUrl: imagePreview,
      id: newsItem?.id || '',
      date: newsItem?.date || new Date().toISOString(),
      isArchived: newsItem?.isArchived || false,
      isBroadcasted: newsItem?.isBroadcasted || false,
    };
    onSave(finalItem);
  };

  const inputStyle = "w-full h-10 px-3 border rounded-md bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-sm placeholder-gray-400";
  const labelStyle = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title={newsItem ? "Sửa Tin tức" : "Soạn Tin mới"} onClose={onClose} size="3xl">
      <form onSubmit={handleSubmit} className="space-y-6 text-gray-900">
        <div className="grid grid-cols-1 gap-6">
            <div>
                <label className={labelStyle}>Tiêu đề tin <span className="text-red-500">*</span></label>
                <input name="title" value={item.title} onChange={handleChange} className={inputStyle} placeholder="Nhập tiêu đề ngắn gọn..." required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className={labelStyle}>Phân loại</label>
                    <select name="category" value={item.category} onChange={handleChange} className={inputStyle}>
                        <option value="notification">Thông báo</option>
                        <option value="plan">Kế hoạch</option>
                        <option value="event">Sự kiện</option>
                    </select>
                </div>
                <div>
                    <label className={labelStyle}>Độ ưu tiên</label> 
                    <select name="priority" value={item.priority} onChange={handleChange} className={inputStyle}>
                        <option value="normal">Thông thường</option>
                        <option value="high">Quan trọng (High)</option>
                    </select>
                </div>
                <div>
                    <label className={labelStyle}>Người gửi</label>
                    <select name="sender" value={item.sender} onChange={handleChange} className={inputStyle}>
                        <option value="BQLVH">Ban Quản lý (BQLVH)</option>
                        <option value="BQT">Ban Quản trị (BQT)</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Editor */}
        <div className="flex flex-col h-full">
          <label className={labelStyle}>Nội dung chi tiết</label>
            <div className="border border-gray-300 rounded-md mt-1 bg-white overflow-hidden shadow-sm">
                <div 
                    ref={editorRef}
                    className="w-full p-4 min-h-[250px] max-h-[400px] overflow-y-auto bg-white text-gray-900 outline-none cursor-text text-sm leading-relaxed"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                />
            </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className={labelStyle}>Ảnh đính kèm</label>
          <div className="mt-1 border border-gray-300 rounded-lg p-4 bg-gray-50 flex flex-col md:flex-row gap-4 items-center">
            {imagePreview ? (
                <div className="relative group w-full md:w-48 h-32 rounded-lg overflow-hidden border border-gray-200">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => {setImagePreview(''); setItem(p=>({...p, imageUrl:''}))}} className="text-white text-xs font-bold bg-red-600 px-2 py-1 rounded">Xóa ảnh</button>
                    </div>
                </div>
            ) : (
                <div className="w-full md:w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white text-gray-400">
                    <span className="text-xs">Chưa có ảnh</span>
                </div>
            )}
            <div className="flex-1">
                 <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm text-sm hover:bg-gray-50 transition-colors">
                    <UploadIcon className="w-4 h-4" /> Chọn ảnh từ máy
                 </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
               <input type="checkbox" name="isPinned" id="isPinned" checked={item.isPinned} onChange={(e) => setItem({...item, isPinned: e.target.checked})} className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"/>
                <label htmlFor="isPinned" className="text-sm text-gray-700 select-none">Ghim tin này lên đầu</label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary-focus flex items-center gap-2 disabled:bg-gray-400">
                  {loading ? <Spinner /> : <CheckCircleIcon className="w-5 h-5"/>} {newsItem ? 'Cập nhật' : 'Đăng tin'}
              </button>
            </div>
        </div>
      </form>
    </Modal>
  );
};

const NewsManagementPage: React.FC<NewsManagementPageProps> = ({ news: initialNews, setNews, role, users }) => {
  const { showToast } = useNotification();
  const canManage = role === 'Admin';
  const IS_PROD = isProduction();

  const [localNews, setLocalNews] = useState<ExtendedNewsItem[]>(initialNews as ExtendedNewsItem[]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtendedNewsItem | null | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // --- 1. Data Fetching ---
  useEffect(() => {
    const fetchNews = async () => {
        if (!IS_PROD) {
            setLocalNews(initialNews as ExtendedNewsItem[]);
            return;
        }
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'news'));
            const fetchedNews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExtendedNewsItem[];
            fetchedNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLocalNews(fetchedNews);
        } catch (error) {
            showToast('Lỗi tải danh sách tin tức.', 'error');
        } finally {
            setLoading(false);
        }
    };
    fetchNews();
  }, [IS_PROD, initialNews, showToast]);

  // --- 2. Filter & Sort ---
  const filteredNews = useMemo(() => {
    return localNews.filter(item => {
        if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        return true;
    }).sort((a,b) => {
        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [localNews, searchTerm, categoryFilter]);

  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNews.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNews, currentPage]);
  
  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);

  // Stats
  const stats = useMemo(() => ({
      total: localNews.length,
      important: localNews.filter(n => n.priority === 'high').length,
      pinned: localNews.filter(n => n.isPinned).length,
      broadcasted: localNews.filter(n => n.isBroadcasted).length
  }), [localNews]);

  // --- 3. Handlers ---

  const handleSave = async (item: ExtendedNewsItem) => {
    setLoading(true);
    const isEdit = !!item.id;
    try {
        if (IS_PROD) {
            let newItemId = item.id;
            // Remove 'id' from the doc payload
            const { id, ...docData } = item; 

            if (isEdit && !item.id.startsWith('news_') && !item.id.startsWith('mock')) {
                await updateDoc(doc(db, 'news', item.id), docData);
            } else {
                const docRef = await addDoc(collection(db, 'news'), docData);
                newItemId = docRef.id;
            }
            const newItemWithId = { ...item, id: newItemId };
            setLocalNews(prev => isEdit ? prev.map(n => n.id === item.id ? newItemWithId : n) : [newItemWithId, ...prev]);
            showToast('Đã lưu tin tức thành công.', 'success');
        } else {
            // Dev Mode
            const mockId = isEdit ? item.id : `news_mock_${Date.now()}`;
            const newItem = { ...item, id: mockId };
            setLocalNews(prev => isEdit ? prev.map(n => n.id === item.id ? newItem : n) : [newItem, ...prev]);
            showToast('[DEV] Lưu tin tức thành công (Local).', 'success');
        }
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
        if (IS_PROD) {
            await deleteDoc(doc(db, 'news', id));
        }
        setLocalNews(prev => prev.filter(n => n.id !== id));
        showToast('Đã xóa tin tức.', 'success');
    } catch (error: any) {
        showToast('Lỗi khi xóa: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleBroadcast = async (item: NewsItem) => {
    if (!window.confirm('Gửi thông báo đẩy (Push Notification) tới toàn bộ cư dân?')) return;
    
    setLoading(true);
    const broadcastTime = new Date().toISOString();
    
    // Logic for sending
    if (IS_PROD) {
        try {
            const batch = writeBatch(db);
            
            // 1. Resolve Document ID
            // If the item has a mock ID (created locally but not yet sync to valid Firestore ID), create a new ID
            const isMockId = item.id.startsWith('news_') || item.id.startsWith('mock');
            const newsId = isMockId ? doc(collection(db, 'news')).id : item.id;
            const newsRef = doc(db, 'news', newsId);

            // 2. Upsert News Item (Ensures doc exists)
            const newsPayload = { ...item, id: newsId, isBroadcasted: true, broadcastTime };
            delete (newsPayload as any).id; // don't store id inside doc
            batch.set(newsRef, newsPayload, { merge: true });

            // 3. Create Notifications
            const residents = users.filter(u => u.Role === 'Resident');
            let count = 0;
            
            // Limit to ~400 for batch limit safety (max 500 ops)
            residents.slice(0, 400).forEach(res => {
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    userId: res.Username, // Targeting the user by Username (Unit ID)
                    title: item.title,
                    body: item.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
                    isRead: false,
                    createdAt: serverTimestamp(),
                    type: 'news',
                    linkId: newsId
                });
                count++;
            });

            await batch.commit();
            
            // Update local state with real ID if it changed
            setLocalNews(prev => prev.map(n => n.id === item.id ? { ...n, id: newsId, isBroadcasted: true, broadcastTime } : n));
            showToast(`Đã gửi thông báo tới ${count} cư dân.`, 'success');

        } catch (error: any) {
            console.error("Broadcast failed", error);
            showToast('Lỗi khi gửi thông báo: ' + error.message, 'error');
        }
    } else {
        // Dev Mode
        await new Promise(r => setTimeout(r, 1000));
        const residentCount = users.filter(u => u.Role === 'Resident').length;
        setLocalNews(prev => prev.map(n => n.id === item.id ? { ...n, isBroadcasted: true, broadcastTime } : n));
        showToast(`[DEV] Simulated sending to ${residentCount} residents.`, 'success');
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {editingItem !== undefined && <NewsEditorModal newsItem={editingItem} onSave={handleSave} onClose={() => setEditingItem(undefined)} loading={loading} />}

      {/* 1. Compact Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactStatCard label="Tổng số tin" value={stats.total} icon={<NewspaperIcon className="w-6 h-6 text-blue-600"/>} colorClass="bg-blue-100" borderColorClass="border-blue-500" />
          <CompactStatCard label="Tin quan trọng" value={stats.important} icon={<StarIcon className="w-6 h-6 text-red-600"/>} colorClass="bg-red-100" borderColorClass="border-red-500" />
          <CompactStatCard label="Tin đã ghim" value={stats.pinned} icon={<PinIcon className="w-6 h-6 text-orange-600" filled/>} colorClass="bg-orange-100" borderColorClass="border-orange-500" />
          <CompactStatCard label="Đã gửi TB" value={stats.broadcasted} icon={<MegaphoneIcon className="w-6 h-6 text-green-600"/>} colorClass="bg-green-100" borderColorClass="border-green-500" />
      </div>

      {/* 2. Toolbar */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-grow w-full md:w-auto">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm tiêu đề tin..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"/>
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary outline-none">
            <option value="all">Tất cả danh mục</option>
            <option value="notification">Thông báo</option>
            <option value="plan">Kế hoạch</option>
            <option value="event">Sự kiện</option>
        </select>
        <button onClick={() => setEditingItem(null)} disabled={!canManage} className="h-10 px-5 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus shadow-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50 transition-colors">
            <PlusIcon className="w-5 h-5" /> Tin mới
        </button>
      </div>

      {/* 3. News List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {paginatedNews.map(item => (
            <div key={item.id} className={`group flex flex-col md:flex-row bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${item.priority === 'high' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'} ${item.isPinned ? 'bg-amber-50 ring-1 ring-orange-200' : ''} ${item.isArchived ? 'opacity-60 grayscale' : ''}`}>
                <div className="w-full md:w-48 h-48 md:h-auto flex-shrink-0 bg-gray-200 relative">
                    {item.imageUrl ? (<img src={item.imageUrl} alt="" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-gray-400"><NewspaperIcon className="w-10 h-10" /></div>)}
                    {item.isPinned && (<div className="absolute top-2 left-2 bg-orange-500 text-white p-1 rounded-full shadow-md"><PinIcon className="w-4 h-4" filled /></div>)}
                </div>
                <div className="flex-grow p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {item.isBroadcasted && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Đã gửi TB</span>}
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 uppercase">{item.category}</span>
                            {item.priority === 'high' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><StarIcon className="w-3 h-3"/> Quan trọng</span>}
                            {item.isArchived && <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-600">Đã lưu trữ</span>}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">{item.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.content }} />
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                        <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3"/> {new Date(item.date).toLocaleDateString('vi-VN')}</span>
                        <span className="font-semibold px-2 py-0.5 bg-gray-50 rounded border border-gray-200">{item.sender || 'BQLVH'}</span>
                        {item.isBroadcasted && item.broadcastTime && <span>Gửi lúc: {timeAgo(item.broadcastTime)}</span>}
                    </div>
                </div>
                {canManage && (
                    <div className="flex md:flex-col justify-end md:justify-center gap-2 p-3 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-100">
                        <button onClick={() => setEditingItem(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors" title="Chỉnh sửa"><PencilSquareIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleBroadcast(item)} disabled={item.isBroadcasted || loading} className={`p-2 rounded-md transition-colors ${item.isBroadcasted ? 'text-green-600 bg-green-50 cursor-default' : 'text-gray-400 hover:text-green-600 hover:bg-white'}`} title={item.isBroadcasted ? `Đã gửi lúc ${timeAgo(item.broadcastTime)}` : "Gửi thông báo"}>{item.isBroadcasted ? <CheckCircleIcon className="w-5 h-5"/> : <PaperAirplaneIcon className="w-5 h-5"/>}</button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-colors" title="Xóa tin"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                )}
            </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-500">Trang {currentPage} / {totalPages}</span>
            <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 bg-white"><ChevronLeftIcon className="w-4 h-4"/></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 bg-white"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
        </div>
      )}
    </div>
  );
};

export default NewsManagementPage;