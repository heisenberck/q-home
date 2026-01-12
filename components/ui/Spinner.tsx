
import React from 'react';

interface SpinnerProps {
    className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className }) => {
    if (className) {
        return <div className={`animate-spin rounded-full border-t-2 border-b-2 border-primary ${className}`}></div>;
    }

    return (
        <div className="flex justify-center items-center h-full w-full">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
};

export default Spinner;
