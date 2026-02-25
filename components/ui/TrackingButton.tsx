import React from 'react';

export interface TrackingButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const TrackingButton: React.FC<TrackingButtonProps> = ({ icon, label, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group flex flex-col items-center justify-center gap-2 rounded-xl border border-civic-border bg-civic-card p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-civic-sm"
    >
      <span className="rounded-lg bg-civic-primaryLight p-2.5 text-civic-primary transition-colors group-hover:bg-blue-100">
        {icon}
      </span>
      <span className="text-xs font-semibold text-civic-text">{label}</span>
    </button>
  );
};

export default TrackingButton;
