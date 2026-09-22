import React, { useState } from 'react';
import { MONTH_NAMES, FY_MONTHS } from '../../utils/salesDataNormalizer';

export default function SalesFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  availableOptions = {},
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    fys = [],
    orderStatuses = [],
    orderSources = [],
    orderTypes = [],
    consumerNatures = [],
    packageCodes = [],
    consumerTypes = [],
    deliveryModes = [],
    deliveryStaffList = [],
    deliveryAreas = [],
    dacTypes = [],
    ekycStatuses = [],
  } = availableOptions;

  // Count active filters
  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (!val) return false;
    if (key === 'startDate' || key === 'endDate') return Boolean(val);
    if (key === 'selectedProducts') return Array.isArray(val) && val.length > 0;
    return val !== 'ALL';
  }).length;

  const handleChange = (key, val) => {
    onFilterChange({ ...filters, [key]: val });
  };

  return (
    <div className="sales-filter-card">
      <div className="sales-filter-top">
        <div className="sales-filter-primary-group">
          {/* Financial Year */}
          <div className="sales-filter-item">
            <label>Financial Year</label>
            <select
              value={filters.fy || 'ALL'}
              onChange={(e) => handleChange('fy', e.target.value)}
            >
              <option value="ALL">All Financial Years</option>
              {fys.map((f) => (
                <option key={f} value={f}>FY {f}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="sales-filter-item">
            <label>Month</label>
            <select
              value={filters.monthNo || 'ALL'}
              onChange={(e) => handleChange('monthNo', e.target.value)}
            >
              <option value="ALL">All Months</option>
              {FY_MONTHS.map((m) => (
                <option key={m.monthCode} value={m.monthCode}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="sales-filter-item">
            <label>From Date</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleChange('startDate', e.target.value)}
            />
          </div>

          {/* Date Range: To */}
          <div className="sales-filter-item">
            <label>To Date</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleChange('endDate', e.target.value)}
            />
          </div>

          {/* Delivery Staff */}
          <div className="sales-filter-item">
            <label>Delivery Man</label>
            <select
              value={filters.deliveryStaff || 'ALL'}
              onChange={(e) => handleChange('deliveryStaff', e.target.value)}
            >
              <option value="ALL">All Delivery Men</option>
              {deliveryStaffList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Delivery Area */}
          <div className="sales-filter-item">
            <label>Delivery Area</label>
            <select
              value={filters.deliveryArea || 'ALL'}
              onChange={(e) => handleChange('deliveryArea', e.target.value)}
            >
              <option value="ALL">All Areas</option>
              {deliveryAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sales-filter-actions">
          <button
            type="button"
            className="filter-toggle-btn"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            <span>{showAdvanced ? '▲ Less Filters' : '▼ More Filters'}</span>
            {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
          </button>
          <button
            type="button"
            className="filter-reset-btn"
            onClick={onResetFilters}
            title="Reset all filters"
          >
            🔄 Reset Filters
          </button>
        </div>
      </div>

      {/* Advanced / Collapsible Filter Strip */}
      {showAdvanced && (
        <div className="sales-filter-advanced-grid">
          {/* Order Status */}
          <div className="sales-filter-item">
            <label>Order Status</label>
            <select
              value={filters.orderStatus || 'ALL'}
              onChange={(e) => handleChange('orderStatus', e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {orderStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Order Source */}
          <div className="sales-filter-item">
            <label>Order Source</label>
            <select
              value={filters.orderSource || 'ALL'}
              onChange={(e) => handleChange('orderSource', e.target.value)}
            >
              <option value="ALL">All Sources</option>
              {orderSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Order Type */}
          <div className="sales-filter-item">
            <label>Order Type</label>
            <select
              value={filters.orderType || 'ALL'}
              onChange={(e) => handleChange('orderType', e.target.value)}
            >
              <option value="ALL">All Types</option>
              {orderTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Nature of Consumer */}
          <div className="sales-filter-item">
            <label>Nature of Consumer</label>
            <select
              value={filters.natureOfConsumer || 'ALL'}
              onChange={(e) => handleChange('natureOfConsumer', e.target.value)}
            >
              <option value="ALL">All Natures</option>
              {consumerNatures.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Package Code */}
          <div className="sales-filter-item">
            <label>Package Code / Product</label>
            <select
              value={filters.packageCode || 'ALL'}
              onChange={(e) => handleChange('packageCode', e.target.value)}
            >
              <option value="ALL">All Packages</option>
              {packageCodes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Type of Consumer */}
          <div className="sales-filter-item">
            <label>Type of Consumer</label>
            <select
              value={filters.typeOfConsumer || 'ALL'}
              onChange={(e) => handleChange('typeOfConsumer', e.target.value)}
            >
              <option value="ALL">All (SBC / DBC)</option>
              {consumerTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Delivery Mode */}
          <div className="sales-filter-item">
            <label>Delivery Mode</label>
            <select
              value={filters.deliveryMode || 'ALL'}
              onChange={(e) => handleChange('deliveryMode', e.target.value)}
            >
              <option value="ALL">All Modes</option>
              {deliveryModes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* DAC Type */}
          <div className="sales-filter-item">
            <label>DAC TYPE</label>
            <select
              value={filters.dacType || 'ALL'}
              onChange={(e) => handleChange('dacType', e.target.value)}
            >
              <option value="ALL">All DAC Types</option>
              {dacTypes.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* eKYC Status */}
          <div className="sales-filter-item">
            <label>eKYC Status</label>
            <select
              value={filters.ekycStatus || 'ALL'}
              onChange={(e) => handleChange('ekycStatus', e.target.value)}
            >
              <option value="ALL">All eKYC Status</option>
              {ekycStatuses.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Is Reg Mobile */}
          <div className="sales-filter-item">
            <label>Registered Mobile</label>
            <select
              value={filters.isRegMobile || 'ALL'}
              onChange={(e) => handleChange('isRegMobile', e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="Y">Registered (Y)</option>
              <option value="N">Not Registered (N)</option>
            </select>
          </div>

          {/* Is Refill Port */}
          <div className="sales-filter-item">
            <label>Refill Portability</label>
            <select
              value={filters.isRefillPort || 'ALL'}
              onChange={(e) => handleChange('isRefillPort', e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="Y">Portability (Y)</option>
              <option value="N">Non-Port (N)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

