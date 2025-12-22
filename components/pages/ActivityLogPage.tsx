
import React, { useState, useEffect, useCallback } from 'react';
import type { Role, ActivityLog } from '../../types';
import { ActivityLogEntry, fetchLogs, LogAction } from '../../services/logService';
import { ClockIcon, ArrowPathIcon } from '../ui/Icons';

// Added ActivityLog and onUndo to props to match App.tsx requirements
interface ActivityLogPageProps {
    role: Role;
    logs: ActivityLog[];
    onUndo: () => void;
}

const getActionStyles = (action: LogAction) => {
    switch (action) {
        case 'CREATE': return 'bg-green-100 text-green-800 border-green-200';
        case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
        case 'LOGIN': return 'bg-amber-100 text-amber-800 border-amber-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

// Added unused _logs and _onUndo to props destructuring to satisfy TypeScript
const ActivityLogPage: React.FC<ActivityLogPageProps> = ({ role, logs: _logs, onUndo: _onUndo }) => {
    const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // 1. Tải dữ liệu ban đầu (Ưu tiên Local -> Server)
    const loadData = useCallback(async (isInitial = false) => {
        if (loading) return;
        setLoading(true);
        try {
            // Nếu là lần đầu load, lấy từ localStorage để hiển thị ngay
            if (isInitial) {
                const cached = localStorage.getItem('local_activity_logs');
                if (cached) {
                    setLogs(JSON.parse(cached));
                }
            }

            const result = await fetchLogs(isInitial ? null : lastDoc);
            
            setLogs(prev => {
                const serverLogs = result.logs;
                if (isInitial) return serverLogs;
                
                // Lọc bỏ trùng lặp (nếu server log đã chứa local log)
                const existingIds = new Set(serverLogs.map(l => l.id));
                return [...prev.filter(l => !existingIds.has(l.id)), ...serverLogs];
            });
            
            setLastDoc(result.lastDoc);
            setHasMore(result.logs.length === 20);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [lastDoc, loading]);

    // 2. Lắng nghe sự kiện "Ghi log mới" để cập nhật UI tức thì
    useEffect(() => {
        const handleNewLog = (event: any) => {
            const newLog = event.detail as ActivityLogEntry;
            setLogs(prev => [newLog, ...prev]);
        };

        window.addEventListener('NEW_LOG_ADDED', handleNewLog);
        
        if (role === 'Admin') {
            loadData(true);
        }

        return () => window.removeEventListener('NEW_LOG_ADDED', handleNewLog);
    }, [role, loadData]);

    if (role !== 'Admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p className="text-lg font-bold">Quyền truy cập hạn chế</p>
                <p className="text-sm">Chỉ Quản trị viên mới có thể xem nhật ký hoạt động.</p>
            </div>
        );
    }

    const formatDateTime = (ts: any) => {
        if (!ts) return '---';
        // Xử lý cả Date object (local) và Firestore Timestamp
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-black text-gray-800 uppercase tracking-tight">Nhật ký Hệ thống</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Thời gian thực (Optimistic UI)</p>
                    </div>
                </div>
                <button 
                    onClick={() => loadData(true)} 
                    className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-all"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto flex-1 p-2">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Thời gian</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Người thực hiện</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Module</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Hành động</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map((log) => (
                                <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${log.isOptimistic ? 'opacity-60 bg-blue-50/30' : ''}`}>
                                    <td className="px-4 py-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                        {formatDateTime(log.timestamp)}
                                        {log.isOptimistic && <span className="ml-2 text-[8px] text-blue-400 animate-pulse">● Đang gửi...</span>}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase">
                                                {log.performedBy.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 leading-none">{log.performedBy.name}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{log.performedBy.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                            {log.module}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border shadow-sm ${getActionStyles(log.actionType)}`}>
                                            {log.actionType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-gray-600 leading-snug">
                                        {log.description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-center">
                    {hasMore ? (
                        <button 
                            onClick={() => loadData(false)}
                            className="px-6 py-2 bg-white border border-gray-200 text-primary text-[11px] font-black uppercase rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                            Tải thêm lịch sử
                        </button>
                    ) : (
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã hiển thị hết nhật ký</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActivityLogPage;
