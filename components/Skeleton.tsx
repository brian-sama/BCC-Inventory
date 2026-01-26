import React from 'react';

interface SkeletonProps {
    className?: string;
    count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
    const items = Array.from({ length: count });

    return (
        <>
            {items.map((_, i) => (
                <div
                    key={i}
                    className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded ${className}`}
                    style={{ minHeight: '1em' }}
                />
            ))}
        </>
    );
};

export const TableSkeleton: React.FC<{ rows?: number, cols?: number }> = ({ rows = 5, cols = 5 }) => {
    return (
        <div className="w-full space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-1/4' : 'flex-1'}`} />
                    ))}
                </div>
            ))}
        </div>
    );
};

export const CardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-start">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-12 h-4" />
        </div>
        <Skeleton className="w-2/3 h-4" />
        <Skeleton className="w-1/3 h-8" />
        <Skeleton className="w-1/2 h-3" />
    </div>
);
