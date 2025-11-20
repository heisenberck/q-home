
import React, { useState, useMemo } from 'react';
import type { ActivityLog, Role } from '../../types';
import { ArrowUturnLeftIcon, ClipboardDocumentListIcon, SearchIcon } from '../ui/Icons';

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

    return (
        <div className="h-full flex flex-col space-y-4">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <ClipboardDocumentListIcon className="w-7 h-7" />
                Nhật ký Hoạt động Hệ thống
            </h2>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border dark:border-dark-border shadow-sm">
                <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"/>
                </div>
                <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"><option value="all">All Modules</option>{uniqueModules.slice(1).map(m => <option key={m} value={m}>{m}</option>)}</select>
                <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"><option value="all">All Users</option>{uniqueUsers.slice(1).map(u => <option key={u} value={u}>{u}</option>)}</select>
                <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"><option value="all">All Time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
            </div>

            {/* Table */}
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto">
                    <table className="min-w-full themed-table">
                        <thead className="sticky top-0 z-10 text-xs uppercase">
                            <tr>
                                <th className="w-[15%]">Thời gian</th>
                                <th className="w-[15%]">Người dùng</th>
                                <th className="w-[10%]">Module</th>
                                <th className="w-[15%]">Hành động</th>
                                <th className="flex-1">Chi tiết</th>
                                <th className="w-[5%] text-center">Undo</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {paginatedLogs.length === 0 ? (
                                <tr><td colSpan={6} className="text-center p-8">Không có hoạt động nào phù hợp.</td></tr>
                            ) : (
                                paginatedLogs.map(log => {
                                    const canUndo = !log.undone && log.undo_token && new Date() < new Date(log.undo_until!);
                                    return (
                                        <tr key={log.id} className={log.undone ? 'opacity-40' : ''}>
                                            <td className="font-mono text-xs">{new Date(log.ts).toLocaleString('vi-VN')}</td>
                                            <td>{log.actor_email}<br/><span className="text-xs text-gray-500">{log.actor_role}</span></td>
                                            <td><span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-700">{log.module}</span></td>
                                            <td className="font-semibold font-mono text-xs">{log.action}</td>
                                            <td>{log.summary}</td>
                                            <td className="text-center">
                                                <button 
                                                    onClick={() => handleUndoClick(log)}
                                                    disabled={!canUndo}
                                                    className="p-1.5 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed"
                                                    title={log.undone ? 'Đã hoàn tác' : (!log.undo_token ? 'Không thể hoàn tác' : (canUndo ? 'Hoàn tác' : 'Hết hạn hoàn tác'))}
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

                 {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <span className="text-sm">{`Page ${currentPage} of ${totalPages}`}</span>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogPage;
