import React from 'react';
import { KpiMetric } from '../../types';
import { civicTheme } from '../../theme';

export interface KpiTileProps {
  metric: KpiMetric;
  icon: React.ReactNode;
}

const KpiTile: React.FC<KpiTileProps> = ({ metric, icon }) => {
  return (
    <article className={`rounded-xl p-5 text-white shadow-civic-sm ${civicTheme.kpiToneClasses[metric.tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium opacity-90">{metric.label}</span>
        <span className="text-white/80">{icon}</span>
      </div>
      <p className="mt-2 text-[2rem] font-semibold leading-none">{metric.value.toLocaleString()}</p>
      <p className="mt-1 text-xs opacity-85">{metric.description}</p>
    </article>
  );
};

export default KpiTile;
