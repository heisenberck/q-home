
import React from 'react';

interface StatCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    iconBgClass?: string;
    className?: string;
    trend?: number;
}

const TrendBadge: React.FC<{ trend: number }> = ({ trend }) => {
    if (isNaN(trend) || !isFinite(trend)) {
        return null;
    }
    
    const isUp = trend > 0;
    const isDown = trend < 0;
    
    const badgeClass = isUp
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
        : isDown
        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        
    const arrow = isUp ? '↑' : isDown ? '↓' : '-';

    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${badgeClass}`}>
            <span>{arrow}</span>
            <span>{Math.abs(trend).toFixed(1)}%</span>
        </span>
    );
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, iconBgClass = 'bg-gray-100 dark:bg-gray-800', className, trend }) => {
    return (
        <div className={`bg-white dark:bg-dark-bg-secondary p-5 rounded-xl shadow-sm flex items-center gap-5 h-full ${className}`}>
            <div className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-full ${iconBgClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">{value}</p>
                    {typeof trend === 'number' && <TrendBadge trend={trend} />}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
