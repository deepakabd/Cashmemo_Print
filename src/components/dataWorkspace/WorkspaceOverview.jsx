const WorkspaceOverview = ({
  showBookingReport,
  filteredData,
  activeReportFilter,
  reportViewMode,
  setReportViewMode,
  hasActiveDataFilters,
  setActiveReportFilter,
  setShowBookingReport,
  reportSummaryCards,
  reportCards,
  exceptionQueueCards,
  reportRecordCount,
  uploadInProgress,
  selectedCustomerIds,
  parsedData,
  uploadMetadata,
  activeFilterChips,
  handleResetAllFilters,
  handleSaveCurrentPreset,
  showAdvancedFilters,
  setShowAdvancedFilters,
  savedFilterPresets,
  applyFilterPreset,
  handleDeletePreset,
  selectedFilteredRows,
  handlePrintCashmemo,
  exportSelectedBusinessRows,
  exportRowsToCsvFile,
  buildExportFilename,
  visibleHeaders,
  clearSelection,
  pushToast,
}) => (
  <>
    {showBookingReport && (
      <div className="booking-report-panel">
        <div className="booking-report-header">
          <div>
            <h3>Pending Booking Report</h3>
            <p>{reportViewMode === 'full' ? 'All uploaded pending bookings ka report' : 'Current filters ke hisaab se report'}</p>
          </div>
          <div className="booking-report-actions">
            <div className="booking-report-toggle-group">
              <button
                type="button"
                className={`booking-report-toggle ${reportViewMode === 'filtered' ? 'is-active' : ''}`}
                onClick={() => setReportViewMode('filtered')}
              >
                Filtered Report
              </button>
              <button
                type="button"
                className={`booking-report-toggle ${reportViewMode === 'full' ? 'is-active' : ''}`}
                onClick={() => setReportViewMode('full')}
              >
                Full Report
              </button>
            </div>
            <span className="booking-report-badge">Records: {reportRecordCount}</span>
            {!hasActiveDataFilters && (
              <span className="booking-report-badge">No filters active, both views will match</span>
            )}
            {activeReportFilter && (
              <button className="booking-report-clear" onClick={() => setActiveReportFilter('')}>
                Clear Report Filter
              </button>
            )}
            <button className="booking-report-clear" onClick={() => setShowBookingReport(false)}>
              Hide Report
            </button>
          </div>
        </div>

        <div className="booking-report-section">
          <div className="booking-report-section__head">
            <div className="booking-report-section__title">
              <span className="booking-report-section__icon" aria-hidden="true" />
              <h4>Fresh vs Old Pending</h4>
            </div>
          </div>
          <div className="booking-report-grid">
            {reportSummaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className={`booking-report-card booking-report-card--button ${activeReportFilter === card.key ? 'is-active' : ''} ${card.tone === 'success' ? 'booking-report-card--success' : ''} ${card.tone === 'warning' ? 'booking-report-card--warning' : ''} ${card.tone === 'danger' ? 'booking-report-card--danger' : ''} ${card.tone === 'info' ? 'booking-report-card--info' : ''}`}
                onClick={() => setActiveReportFilter((prev) => (prev === card.key ? '' : card.key))}
              >
                <span className="booking-report-card__emoji" aria-hidden="true">{card.icon}</span>
                <span className="booking-report-label">{card.label}</span>
                <strong>{card.displayValue || card.value}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="booking-report-section">
          <div className="booking-report-section__head">
            <h4>Detailed Metrics</h4>
          </div>
        <div className="booking-report-grid">
          {reportCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`booking-report-card booking-report-card--button ${activeReportFilter === card.key ? 'is-active' : ''} ${card.tone === 'success' ? 'booking-report-card--success' : ''} ${card.tone === 'warning' ? 'booking-report-card--warning' : ''} ${card.tone === 'danger' ? 'booking-report-card--danger' : ''} ${card.tone === 'info' ? 'booking-report-card--info' : ''}`}
              onClick={() => setActiveReportFilter((prev) => (prev === card.key || card.key === 'totalPendingBooking' ? '' : card.key))}
            >
              <span className="booking-report-label">{card.label}</span>
              {card.areaName ? <span className="booking-report-meta">{card.areaName}</span> : null}
              <strong>{card.displayValue || card.value}</strong>
            </button>
          ))}
        </div>
        </div>
      </div>
    )}

    <div className="filters-overview">
      {uploadInProgress && (
        <div className="inline-status-banner inline-status-banner--info">
          <span className="inline-status-banner__spinner" />
          <span>Uploading and preparing your file...</span>
        </div>
      )}
      <div className="upload-journey-card">
        <div className="upload-journey-card__header">
          <div>
            <p className="upload-journey-card__eyebrow">Next Steps</p>
            <h4>Upload se print tak ka fast flow</h4>
          </div>
          <span className="upload-journey-card__badge">
            {selectedCustomerIds.length > 0 ? 'Ready to print' : hasActiveDataFilters ? 'Selection next' : 'Filters next'}
          </span>
        </div>
        <div className="upload-journey-card__steps">
          <div className={`upload-journey-step ${parsedData.length > 0 ? 'is-complete' : ''}`}>
            <strong>1. Upload done</strong>
            <span>{uploadMetadata?.fileName ? `${uploadMetadata.fileName} loaded` : `${parsedData.length} rows ready`}</span>
          </div>
          <div className={`upload-journey-step ${hasActiveDataFilters ? 'is-complete' : ''}`}>
            <strong>2. Filter lagao</strong>
            <span>{hasActiveDataFilters ? `${filteredData.length} matching rows found` : 'Area, eKYC, payment ya date filters apply kijiye'}</span>
          </div>
          <div className={`upload-journey-step ${selectedCustomerIds.length > 0 ? 'is-complete' : ''}`}>
            <strong>3. Select & Print</strong>
            <span>{selectedCustomerIds.length > 0 ? `${selectedCustomerIds.length} row selected` : 'Rows select karke cashmemo ya export run kijiye'}</span>
          </div>
        </div>
      </div>
      {exceptionQueueCards?.length > 0 && (
        <div className="booking-report-panel">
          <div className="booking-report-header">
            <div>
              <h3>Action Required Queue</h3>
            </div>
            <div className="booking-report-actions">
              <span className="booking-report-badge">
                Open Items: {exceptionQueueCards.reduce((sum, item) => sum + Number(item.count || 0), 0)}
              </span>
            </div>
          </div>
          <div className="booking-report-grid">
            {exceptionQueueCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className={`booking-report-card booking-report-card--button ${card.isActive ? 'is-active' : ''} ${card.tone === 'success' ? 'booking-report-card--success' : ''} ${card.tone === 'warning' ? 'booking-report-card--warning' : ''} ${card.tone === 'danger' ? 'booking-report-card--danger' : ''} ${card.tone === 'info' ? 'booking-report-card--info' : ''}`}
                onClick={card.onClick}
              >
                <span className="booking-report-label">{card.label}</span>
                <span className="booking-report-meta">{card.description}</span>
                <strong>{card.count}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
      {activeFilterChips.length > 0 && (
        <div className="filter-chip-row">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} type="button" className="filter-chip" onClick={chip.clear}>
              <span>{chip.label}</span>
              <strong>Ã—</strong>
            </button>
          ))}
          <button type="button" className="filter-chip filter-chip--clear" onClick={handleResetAllFilters}>
            Clear All
          </button>
        </div>
      )}
      <div className="preset-toolbar">
        <div className="preset-toolbar__actions">
          <button type="button" className="filter-action filter-action--secondary" onClick={handleSaveCurrentPreset}>
            Save Current Preset
          </button>
          <button type="button" className="filter-action filter-action--secondary" onClick={() => setShowAdvancedFilters((prev) => !prev)}>
            {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
          </button>
        </div>
        {savedFilterPresets.length > 0 && (
          <div className="preset-chip-row">
            {savedFilterPresets.map((preset) => (
              <div key={preset.id} className="preset-chip">
                <button type="button" onClick={() => applyFilterPreset({ ...preset.filters, name: preset.name })}>
                  {preset.name}
                </button>
                <button type="button" className="preset-chip__delete" onClick={() => handleDeletePreset(preset.id)}>
                  Ã—
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedCustomerIds.length > 0 && (
        <div className="bulk-action-bar">
          <strong>{selectedCustomerIds.length} selected</strong>
          <span>{selectedFilteredRows.length} visible in current filters</span>
          <div className="bulk-action-bar__actions">
            <button type="button" className="table-action table-action--blue" onClick={handlePrintCashmemo}>
              Print Selected
            </button>
            <button type="button" className="table-action table-action--green" onClick={exportSelectedBusinessRows}>
              Export Selected Business
            </button>
            <button
              type="button"
              className="filter-action filter-action--secondary"
              onClick={() => exportRowsToCsvFile(buildExportFilename('selected-visible'), selectedFilteredRows, visibleHeaders)}
            >
              Export Selected Visible
            </button>
            <button
              type="button"
              className="filter-action filter-action--secondary"
              onClick={() => {
                clearSelection();
                pushToast('Selection cleared.', 'info');
              }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </div>
  </>
);

export default WorkspaceOverview;
