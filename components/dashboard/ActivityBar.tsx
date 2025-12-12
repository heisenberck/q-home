
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    BellIcon, ArrowPathIcon, ChevronUpIcon, UserCircleIcon, 
    CheckCircleIcon, ClockIcon, ArrowRightOnRectangleIcon 
} from '../ui/Icons';
import { useSmartSystemData } from '../../hooks/useSmartData';
import { timeAgo } from '../../utils/helpers';
import type { AdminPage, FeedbackItem, ActivityLog } from '../../types';

// Local Icon Definitions
const ChatBubbleLeftRightIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 12c0-2.515-2.035-4.545-4.545-4.545H5.25a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25H9m11.25-8.25a2.25 2.25 0 0 0-2.25-2.25H13.5a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25H18a2.25 2.25 0 0 0 2.25-2.25V12.75Z" />
    </svg>
);

const BoltIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
);

interface ActivityBarProps {
    onNavigate: (page: AdminPage) => void;
    feedback: FeedbackItem[];
}

const ActivityBar: React.FC<ActivityBarProps> = ({ onNavigate, feedback }) => {
    const { activityLogs, refreshSystemData, isRefreshing } = useSmartSystemData();
    const [activePopup, setActivePopup] = useState<'activity' | 'messages' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isShaking, setIsShaking] = useState(false);

    // Latest Data
    const latestLog = useMemo(() => activityLogs[0], [activityLogs]);
    const pendingFeedback = useMemo(() => feedback.filter(f => f.status === 'Pending'), [feedback]);
    const recentFeedback = useMemo(() => feedback.slice(0, 5), [feedback]);

    // Check for new activity to animate bell
    useEffect(() => {
        if (latestLog) {
            const now = new Date();
            const logTime = new Date(latestLog.ts);
            // If log is less than 30 seconds old, shake
            if ((now.getTime() - logTime.getTime()) < 30000) {
                setIsShaking(true);
                const timer = setTimeout(() => setIsShaking(false), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [latestLog?.id]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setActivePopup(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const togglePopup = (popup: 'activity' | 'messages') => {
        setActivePopup(prev => prev === popup ? null : popup);
    };

    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        refreshSystemData(true);
        setActivePopup(null);
    };

    const handleNavigateFeedback = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigate('feedbackManagement');
        setActivePopup(null);
    };

    return (
        <div ref={containerRef} className="fixed bottom-0 right-0 left-0 md:left-72 h-12 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex z-40 transition-all duration-300">
            
            {/* --- POPUP: ACTIVITY LOG --- */}
            {activePopup === 'activity' && (
                <div className="absolute bottom-14 left-2 w-96 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in-up origin-bottom-left">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                            <BoltIcon className="w-4 h-4 text-orange-500"/> Hoạt động hệ thống
                        </span>
                        <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{activityLogs.length}</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-0 bg-white">
                        {activityLogs.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {activityLogs.map(log => (
                                    <li key={log.id} className="p-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-gray-800">{log.module}</span>
                                            <span className="text-[10px] text-gray-400">{timeAgo(log.ts)}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-snug">{log.summary}</p>
                                        <p className="text-[10px] text-gray-400 mt-1 italic">User: {log.actor_email}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">Chưa có hoạt động nào.</div>
                        )}
                    </div>
                    <div className="p-3 border-t bg-gray-50">
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}/>
                            {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- POPUP: MESSAGES --- */}
            {activePopup === 'messages' && (
                <div className="absolute bottom-14 right-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in-up origin-bottom-right">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="w-4 h-4 text-primary"/> Tin nhắn mới nhất
                        </span>
                        {pendingFeedback.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{pendingFeedback.length} mới</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                        {recentFeedback.length > 0 ? (
                            <ul className="divide-y divide-gray-100">
                                {recentFeedback.map(item => (
                                    <li key={item.id} className="p-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onNavigate('feedbackManagement')}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                <UserCircleIcon className="w-5 h-5"/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="text-xs font-bold text-gray-900 truncate">Căn {item.residentId}</span>
                                                    <span className="text-[10px] text-gray-400">{timeAgo(item.date)}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 truncate">{item.subject}</p>
                                                <p className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.status === 'Pending' ? 'Chờ xử lý' : item.status}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">Không có tin nhắn nào.</div>
                        )}
                    </div>
                    <div className="p-3 border-t bg-gray-50">
                        <button 
                            onClick={handleNavigateFeedback}
                            className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            Xem tất cả & Phản hồi
                        </button>
                    </div>
                </div>
            )}

            {/* --- ZONE A: SYSTEM ACTIVITY (70%) --- */}
            <div 
                className="flex-[2] flex items-center px-4 border-r border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors group relative"
                onClick={() => togglePopup('activity')}
            >
                <div className={`relative mr-3 ${isShaking ? 'animate-bounce' : ''}`}>
                    <BellIcon className={`w-5 h-5 ${latestLog ? 'text-gray-600 group-hover:text-blue-600' : 'text-gray-400'}`} />
                    {isRefreshing && (
                        <span className="absolute -top-1 -right-1 block h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white animate-pulse"></span>
                    )}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hệ thống</span>
                        {isRefreshing && <span className="text-[10px] text-blue-500 font-medium animate-pulse">Đang cập nhật...</span>}
                    </div>
                    <span className="text-sm font-medium text-gray-800 truncate pr-2">
                        {latestLog ? latestLog.summary : "Hệ thống sẵn sàng."}
                    </span>
                </div>

                <ChevronUpIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activePopup === 'activity' ? 'rotate-180' : ''}`} />
            </div>

            {/* --- ZONE B: MESSAGES (30%) --- */}
            <div 
                className="flex-1 flex items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors group relative min-w-[140px]"
                onClick={() => togglePopup('messages')}
            >
                <div className="relative">
                    <ChatBubbleLeftRightIcon className={`w-6 h-6 ${pendingFeedback.length > 0 ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {pendingFeedback.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white shadow-sm">
                            {pendingFeedback.length}
                        </span>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className={`text-sm font-bold ${pendingFeedback.length > 0 ? 'text-indigo-700' : 'text-gray-600'}`}>Tin nhắn</span>
                    {pendingFeedback.length > 0 && <span className="text-[10px] text-red-500 font-medium">{pendingFeedback.length} chưa đọc</span>}
                </div>
                
                <ChevronUpIcon className={`w-3 h-3 text-gray-300 ml-1 transition-transform duration-200 ${activePopup === 'messages' ? 'rotate-180' : ''}`} />
            </div>
        </div>
    );
};

export default ActivityBar;
