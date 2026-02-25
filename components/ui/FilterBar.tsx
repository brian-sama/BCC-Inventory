import React from 'react';
import { DashboardFilterState } from '../../types';

export interface FilterBarProps {
  filters: DashboardFilterState;
  departments: string[];
  onChange: (nextFilters: DashboardFilterState) => void;
  onExport: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, departments, onChange, onExport }) => {
  return (
    <div className="surface-card">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-civic-muted">
          Start Date
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            className="focus-ring rounded-xl border border-civic-border bg-civic-card px-3 py-2 text-sm font-medium text-civic-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-civic-muted">
          End Date
          <input
            type="date"
            value={filters.endDate}
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

        <div className="flex items-end">
          <button type="button" className="civic-button-primary w-full" onClick={onExport}>
            Export Filtered Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
