import React, { useState, useEffect } from 'react';

// --- CountUp Hook ---
const useCountUp = (end: number, duration = 1500) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const startTime = performance.now();
        let frameId: number;

        const animate = (currentTime: number) => {
            const elapsedTime = currentTime - startTime;
            if (elapsedTime < duration) {
                const progress = elapsedTime / duration;
                const currentVal = Math.round(start + progress * (end - start));
                setCount(currentVal);
                frameId = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [end, duration]);

    return count;
};


interface DashboardCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  suffix?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, suffix }) => {
  const isNumeric = typeof value === 'number';
  const displayValue = isNumeric ? useCountUp(value) : 0;

  return (
    <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md flex items-center gap-4">
      <div className="bg-primary/10 text-primary p-3 rounded-full">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{title}</h4>
        <p className="text-2xl font-bold">
          {isNumeric ? new Intl.NumberFormat('vi-VN').format(displayValue) : value}
          {suffix && <span className="text-lg font-medium">{suffix}</span>}
        </p>
      </div>
    </div>
  );
};

export default DashboardCard;
