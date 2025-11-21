import React from 'react';

interface StatCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    tooltip?: string;
    onClick?: () => void;
    isActive?: boolean;
    className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, tooltip, onClick, isActive, className }) => (
    <div 
        className={`stat-card ${onClick ? 'cursor-pointer' : ''} ${isActive ? 'ring-2 ring-primary' : ''} ${className || ''}`}
        data-label={tooltip || label}
        title={tooltip || label}
        onClick={onClick}
    >
        <div className="stat-icon">{icon}</div>
        <div className="stat-value" title={typeof value === 'string' || typeof value === 'number' ? String(value) : label}>
            {value}
        </div>
        {/* The label is visually hidden via CSS but available for screen readers and the tooltip */}
        <span className="stat-label">{label}</span>
    </div>
);

export default StatCard;
