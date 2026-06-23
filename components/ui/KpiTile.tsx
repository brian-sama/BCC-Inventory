import React from 'react';
import { Link } from 'react-router-dom';
import { KpiMetric } from '../../types';
import { civicTheme } from '../../theme';

export interface KpiTileProps {
  metric: KpiMetric;
  icon: React.ReactNode;
}

const KpiTile: React.FC<KpiTileProps> = ({ metric, icon }) => {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-90">{metric.label}</span>
        <span className="text-white/80">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none">{metric.value.toLocaleString()}</p>
      <p className="mt-1 text-xs opacity-85">{metric.description}</p>
    </>
  );

  const className = `rounded-xl p-5 text-white shadow-civic-sm transition-opacity ${civicTheme.kpiToneClasses[metric.tone]} ${metric.href ? 'hover:opacity-90 cursor-pointer' : ''}`;

  if (metric.href) {
    return (
      <Link to={metric.href} className={className} aria-label={`${metric.label}: ${metric.value}`}>
        <article>{inner}</article>
      </Link>
    );
  }

  return (
    <article className={className}>
      {inner}
    </article>
  );
};

export default KpiTile;
