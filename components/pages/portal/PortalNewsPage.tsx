
import React, { useState, useMemo, useEffect } from 'react';
import type { NewsItem } from '../../../types';
import Modal from '../../ui/Modal';
import { timeAgo } from '../../../utils/helpers';
import { ClipboardDocumentListIcon, BellIcon, CalendarDaysIcon, SparklesIcon, MegaphoneIcon } from '../../ui/Icons';


interface PortalNewsPageProps {
  news: NewsItem[];
  onAllRead?: () => void;
}

const NewsDetailPage: React.FC<{ item: NewsItem, onClose: () => void }> = ({ item, onClose }) => {
    return (
        <Modal title={item.title} onClose={onClose} size="lg">
            <div className="space-y-4">
                {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover rounded-lg" />}
                <p className="text-sm text-gray-500">{new Date(item.date).toLocaleString('vi-VN')}</p>
                <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{item.content}</div>
            </div>
        </Modal>
    )
}

const NewsCategoryIcon: React.FC<{ category: NewsItem['category'] }> = ({ category }) => {
    switch (category) {
        case 'notification': return <MegaphoneIcon className="w-5 h-5 text-blue-500" />;
        case 'plan': return <CalendarDaysIcon className="w-5 h-5 text-orange-500" />;
        case 'event': return <SparklesIcon className="w-5 h-5 text-purple-500" />;
        default: return <ClipboardDocumentListIcon className="w-5 h-5 text-gray-500" />;
    }
};


const PortalNewsPage: React.FC<PortalNewsPageProps> = ({ news, onAllRead }) => {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
      if (onAllRead) onAllRead();
  }, [onAllRead]);

  const activeNews = useMemo(() => {
      return [...news]
        .filter(item => !item.isArchived)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [news]);

  return (
    <div className="p-4 space-y-4 min-h-[300px]">
        {selectedNews && <NewsDetailPage item={selectedNews} onClose={() => setSelectedNews(null)} />}
        
        {activeNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <BellIcon className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-bold text-gray-500">Không có thông báo nào</p>
                <p className="text-sm">Vui lòng quay lại sau.</p>
            </div>
        ) : (
            activeNews.map(item => (
                <div key={item.id} onClick={() => setSelectedNews(item)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-primary transition-colors flex gap-4 items-start active:bg-gray-50">
                    <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <NewsCategoryIcon category={item.category} />
                        {item.sender && <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{item.sender}</span>}
                        {item.priority === 'high' && (
                            <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">KHẨN</span>
                        )}
                    </div>
                    <h2 className="font-bold text-base text-gray-900 leading-snug line-clamp-2">{item.title}</h2>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                    <div className="flex items-center gap-4 mt-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{timeAgo(item.date)}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                    </div>
                    </div>
                    {item.imageUrl && (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            ))
        )}
    </div>
  );
};

export default PortalNewsPage;
