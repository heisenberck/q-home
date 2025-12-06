import React, { useState, useMemo } from 'react';
import type { ActivityLog, Role } from '../../types';
import { ArrowUturnLeftIcon, SearchIcon } from '../ui/Icons';

interface ActivityLogPageProps {
    logs: ActivityLog[];
    onUndo: (logId: string) => void;
    role: Role;
}

const ITEMS_PER_PAGE = 25;

const ActivityLogPage: React.FC<ActivityLogPageProps> = ({ logs, onUndo, role }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    
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
    
    const uniqueUsers = useMemo(() => ['all', ...Array.from(new Set(logs.map(l => l.actor_email)))], [logs]);
    const uniqueModules = useMemo(() => ['all', ...Array.from(new Set(logs.map(l => l.module)))], [logs]);

    const filteredLogs = useMemo(() => {
        const now = new Date();
        const lowerSearchTerm = searchTerm.toLowerCase();

        return logs.filter(log => {
            if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
            if (userFilter !== 'all' && log.actor_email !== userFilter) return false;

            if (dateFilter !== 'all') {
                const logDate = new Date(log.ts);
                const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
                if (diffDays > parseInt(dateFilter, 10)) return false;
            }

            if (searchTerm && !(
                log.summary.toLowerCase().includes(lowerSearchTerm) ||
                log.action.toLowerCase().includes(lowerSearchTerm) ||
                log.actor_email.toLowerCase().includes(lowerSearchTerm) ||
                (log.ids && log.ids.join(',').toLowerCase().includes(lowerSearchTerm))
            )) return false;

            return true;
        });
    }, [logs, searchTerm, moduleFilter, userFilter, dateFilter]);

    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredLogs, currentPage]);

    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

    const inputStyle = "p-2 border rounded-lg bg-white border-gray-300 text-gray-900 dark:bg-dark-bg-secondary dark:border-gray-600 dark:text-white";

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full pl-10 ${inputStyle}`}/>
                    </div>
                    <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className={inputStyle}><option value="all">Tất cả Module</option>{uniqueModules.slice(1).map(m => <option key={m} value={m}>{m}</option>)}</select>
                    <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={inputStyle}><option value="all">Tất cả người dùng</option>{uniqueUsers.slice(1).map(u => <option key={u} value={u}>{u}</option>)}</select>
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={inputStyle}><option value="all">Toàn bộ thời gian</option><option value="1">24 giờ qua</option><option value="7">7 ngày qua</option><option value="30">30 ngày qua</option></select>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[15%]">Thời gian</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[15%]">Người dùng</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[10%]">Module</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[15%]">Hành động</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chi tiết</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[5%]">Undo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            {paginatedLogs.length === 0 ? (
                                <tr><td colSpan={6} className="text-center p-8 text-gray-500">Không có hoạt động nào phù hợp.</td></tr>
                            ) : (
                                paginatedLogs.map(log => {
                                    const canUndo = !log.undone && log.undo_token && new Date() < new Date(log.undo_until!);
                                    return (
                                        <tr key={log.id} className={`${log.undone ? 'opacity-40' : ''} hover:bg-gray-50 dark:hover:bg-slate-800/50`}>
                                            <td className="px-4 py-4 font-mono text-xs text-gray-900 dark:text-gray-200">{new Date(log.ts).toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-4 text-gray-900 dark:text-gray-200">{log.actor_email}<br/><span className="text-xs text-gray-500">{log.actor_role}</span></td>
                                            <td className="px-4 py-4"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200">{log.module}</span></td>
                                            <td className="px-4 py-4 font-semibold font-mono text-xs text-gray-900 dark:text-gray-200">{log.action}</td>
                                            <td className="px-4 py-4 text-gray-900 dark:text-gray-200">{log.summary}</td>
                                            <td className="px-4 py-4 text-center">
                                                <button 
                                                    onClick={() => handleUndoClick(log)}
                                                    disabled={!canUndo}
                                                    className="p-1.5 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed"
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
                </div>

                {totalPages > 1 && (
                    <div className="p-3 border-t dark:border-dark-border flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{`Trang ${currentPage} / ${totalPages}`}</span>
                        <div className="flex gap-2">
                             <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm bg-white dark:bg-dark-bg-secondary border dark:border-dark-border rounded-md disabled:opacity-50">Trước</button>
                             <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm bg-white dark:bg-dark-bg-secondary border dark:border-dark-border rounded-md disabled:opacity-50">Sau</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogPage;