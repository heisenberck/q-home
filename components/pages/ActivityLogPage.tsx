
import React, { useState, useEffect } from 'react';
import type { ActivityLog, Role } from '../../types';
import { ArrowUturnLeftIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon } from '../ui/Icons';
import { fetchLogsPaginated } from '../../services/firebaseAPI';
import { isProduction } from '../../utils/env';
import Spinner from '../ui/Spinner';

interface ActivityLogPageProps {
    logs: ActivityLog[]; // Deprecated prop, kept for compatibility interface
    onUndo: (logId: string) => void;
    role: Role;
}

const ActivityLogPage: React.FC<ActivityLogPageProps> = ({ logs: initialLogs, onUndo, role }) => {
    // Internal state for pagination
    const [logs, setLogs] = useState<ActivityLog[]>(initialLogs.length > 0 ? initialLogs : []);
    const [loading, setLoading] = useState(false);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    
    // Fallback to initial props for Mock Mode
    const IS_PROD = isProduction();

    const loadData = async (reset = false) => {
        if (!IS_PROD) return; // Use props in dev/mock
        
        setLoading(true);
        try {
            const result = await fetchLogsPaginated(reset ? null : lastDoc, 25);
            if (reset) {
                setLogs(result.data);
                setPage(1);
            } else {
                setLogs(prev => [...prev, ...result.data]);
                setPage(p => p + 1);
            }
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        if (IS_PROD && logs.length === 0) {
            loadData(true);
        }
    }, [IS_PROD]);

    if (role !== 'Admin') {
        return (
            <div className="text-center p-8 text-red-500 font-semibold">
                Bạn không có quyền truy cập chức năng này.
            </div>
        );
    }
    
    const handleUndoClick = (log: ActivityLog) => {
        if (window.confirm(`Bạn có chắc chắn muốn hoàn tác hành động này không?\n\n"${log.summary}"`)) {
            onUndo(log.id);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
                <h2 className="font-bold text-lg text-gray-800">Nhật ký Hoạt động</h2>
                <button onClick={() => loadData(true)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200" title="Làm mới"><SearchIcon className="w-5 h-5"/></button>
            </div>

            <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto flex-1">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[15%]">Thời gian</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[15%]">Người dùng</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">Module</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[15%]">Hành động</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Chi tiết</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-[5%]">Undo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                            {logs.length === 0 && !loading ? (
                                <tr><td colSpan={6} className="text-center p-8 text-gray-500">Không có hoạt động nào.</td></tr>
                            ) : (
                                logs.map(log => {
                                    const canUndo = !log.undone && log.undo_token && new Date() < new Date(log.undo_until!);
                                    return (
                                        <tr key={log.id} className={`${log.undone ? 'opacity-40' : ''} hover:bg-gray-50`}>
                                            <td className="px-4 py-4 font-mono text-xs text-gray-900">{new Date(log.ts).toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-4 text-gray-900">{log.actor_email}<br/><span className="text-xs text-gray-500">{log.actor_role}</span></td>
                                            <td className="px-4 py-4"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-900">{log.module}</span></td>
                                            <td className="px-4 py-4 font-semibold font-mono text-xs text-gray-900">{log.action}</td>
                                            <td className="px-4 py-4 text-gray-900">{log.summary}</td>
                                            <td className="px-4 py-4 text-center">
                                                <button 
                                                    onClick={() => handleUndoClick(log)}
                                                    disabled={!canUndo}
                                                    className="p-1.5 rounded-full text-blue-600 hover:bg-blue-100 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed"
                                                    data-tooltip={log.undone ? 'Đã hoàn tác' : (!log.undo_token ? 'Không thể hoàn tác' : (canUndo ? 'Hoàn tác' : 'Hết hạn hoàn tác'))}
                                                >
                                                    <ArrowUturnLeftIcon className="w-5 h-5"/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    {loading && <div className="p-4"><Spinner /></div>}
                </div>

                {hasMore && IS_PROD && (
                    <div className="p-3 border-t flex justify-center">
                        <button 
                            onClick={() => loadData(false)} 
                            disabled={loading}
                            className="px-4 py-2 text-sm bg-primary text-white rounded-md shadow hover:bg-primary-focus disabled:opacity-50"
                        >
                            {loading ? 'Đang tải...' : 'Xem thêm'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogPage;
