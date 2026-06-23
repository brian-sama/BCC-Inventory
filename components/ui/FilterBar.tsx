import React from 'react';
import { DashboardFilterState } from '../../types';

export interface FilterBarProps {
  filters: DashboardFilterState;
  departments: string[];
  onChange: (nextFilters: DashboardFilterState) => void;
  onExport: () => void;
}

const EMPTY: DashboardFilterState = { startDate: '', endDate: '', department: '' };

const FilterBar: React.FC<FilterBarProps> = ({ filters, departments, onChange, onExport }) => {
  const hasFilters = filters.startDate || filters.endDate || filters.department;

  return (
    <div className="surface-card">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-civic-muted">
          Start Date
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            className="focus-ring rounded-xl border border-civic-border bg-civic-card px-3 py-2 text-sm font-medium text-civic-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-civic-muted">
          End Date
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
            className="focus-ring rounded-xl border border-civic-border bg-civic-card px-3 py-2 text-sm font-medium text-civic-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-civic-muted">
          Department
          <select
            value={filters.department}
            onChange={(e) => onChange({ ...filters, department: e.target.value })}
            className="focus-ring rounded-xl border border-civic-border bg-civic-card px-3 py-2 text-sm font-medium text-civic-text"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={() => onChange(EMPTY)}
              className="flex-shrink-0 rounded-xl border border-civic-border bg-white px-3 py-2 text-xs font-semibold text-civic-muted transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
              aria-label="Clear all filters"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="civic-button-primary flex-1"
            onClick={onExport}
            aria-label="Export filtered data as CSV"
          >
            Export Filtered
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
