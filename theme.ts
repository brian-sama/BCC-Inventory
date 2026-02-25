export type KpiTone = 'blue' | 'amber' | 'red' | 'indigo' | 'green';

export const civicTheme = {
  kpiToneClasses: {
    blue: 'bg-blue-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
    indigo: 'bg-indigo-600',
    green: 'bg-green-600',
  } as Record<KpiTone, string>,
  panelClass: 'surface-card',
  primaryButtonClass: 'civic-button-primary',
  secondaryButtonClass: 'civic-button-secondary',
  statusBadgeClasses: {
    critical: 'bg-red-100 text-red-700 border border-red-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    info: 'bg-sky-100 text-sky-700 border border-sky-200',
  } as Record<'critical' | 'warning' | 'info', string>,
};

export const TABLE_CLASSES = {
  wrapper: 'overflow-x-auto rounded-xl border border-slate-200 bg-white',
  table: 'table-shell',
  head: 'table-head',
  body: 'divide-y divide-slate-200',
  row: 'table-row',
};
