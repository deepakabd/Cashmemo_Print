const DataWorkspace = ({
  showBookingReport,
  filteredData,
  activeReportFilter,
  setActiveReportFilter,
  setShowBookingReport,
  reportCards,
  uploadInProgress,
  selectedCustomerIds,
  hasActiveDataFilters,
  parsedData,
  uploadMetadata,
  formatDisplayDateTime,
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
  recentActivities,
  reportFilterOptions,
  eKycFilter,
  setEKycFilter,
  availableEkycOptions,
  areaFilter,
  setAreaFilter,
  availableAreaOptions,
  onlineRefillPaymentStatusFilter,
  setOnlineRefillPaymentStatusFilter,
  availableOnlinePaymentOptions,
  orderTypeFilter,
  setOrderTypeFilter,
  availableOrderTypeOptions,
  orderDateStart,
  setOrderDateStart,
  orderDateEnd,
  setOrderDateEnd,
  natureFilter,
  setNatureFilter,
  availableNatureOptions,
  mobileStatusFilter,
  setMobileStatusFilter,
  availableMobileStatusOptions,
  consumerStatusFilter,
  setConsumerStatusFilter,
  availableConsumerStatusOptions,
  connectionTypeFilter,
  setConnectionTypeFilter,
  availableConnectionTypeOptions,
  orderStatusFilter,
  setOrderStatusFilter,
  availableOrderStatusOptions,
  orderSourceFilter,
  setOrderSourceFilter,
  availableOrderSourceOptions,
  cashMemoStatusFilter,
  setCashMemoStatusFilter,
  availableCashMemoStatusOptions,
  deliveryManFilter,
  setDeliveryManFilter,
  availableDeliveryManOptions,
  cashMemoDateStart,
  setCashMemoDateStart,
  cashMemoDateEnd,
  setCashMemoDateEnd,
  sortBy,
  setSortBy,
  headers,
  sortOrder,
  setSortOrder,
  searchTerm,
  setSearchTerm,
  handleSearchChange,
  addColumn,
  removeColumn,
  pageType,
  setPageType,
  isHindiEnterprisePackage,
  loggedInUser,
  printLanguage,
  setPrintLanguage,
  handlePrintData,
  exportFilteredRows,
  exportReportSummary,
  shouldShowFilteredEmptyState,
  handleReUploadClick,
  currentTableData,
  handleSelectAllChange,
  isAllFilteredRowsSelected,
  handleCheckboxChange,
  formatDateToDDMMYYYY,
  excelSerialDateToJSDate,
  parseDateString,
  currentPage,
  setCurrentPage,
  totalPages,
}) => {
  const emptyStateActions = [
    searchTerm ? {
      key: 'search',
      label: `Remove search "${searchTerm}"`,
      onClick: () => setSearchTerm(''),
    } : null,
    eKycFilter !== 'All' ? {
      key: 'ekyc',
      label: `Reset eKYC (${eKycFilter})`,
      onClick: () => setEKycFilter('All'),
    } : null,
    areaFilter !== 'All' ? {
      key: 'area',
      label: `Show all areas`,
      onClick: () => setAreaFilter('All'),
    } : null,
    (orderDateStart || orderDateEnd || cashMemoDateStart || cashMemoDateEnd) ? {
      key: 'dates',
      label: 'Clear date filters',
      onClick: () => {
        setOrderDateStart('');
        setOrderDateEnd('');
        setCashMemoDateStart('');
        setCashMemoDateEnd('');
      },
    } : null,
  ].filter(Boolean).slice(0, 4);

  return (
    <div className="filters-shell">
      {showBookingReport && (
        <div className="booking-report-panel">
          <div className="booking-report-header">
            <div>
              <h3>Pending Booking Report</h3>
            </div>
            <div className="booking-report-actions">
              <span className="booking-report-badge">Records: {filteredData.length}</span>
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

          <div className="booking-report-grid">
            {reportCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className={`booking-report-card booking-report-card--button ${activeReportFilter === card.key ? 'is-active' : ''}`}
                onClick={() => setActiveReportFilter((prev) => (prev === card.key || card.key === 'totalPendingBooking' ? '' : card.key))}
              >
                <span className="booking-report-label">{card.label}</span>
                {card.areaName ? <span className="booking-report-meta">{card.areaName}</span> : null}
                <strong>{card.value}</strong>
              </button>
            ))}
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
        {activeFilterChips.length > 0 && (
          <div className="filter-chip-row">
            {activeFilterChips.map((chip) => (
              <button key={chip.key} type="button" className="filter-chip" onClick={chip.clear}>
                <span>{chip.label}</span>
                <strong>×</strong>
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
                    ×
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

      <div className="filters-container filters-container--basic">
        <select className="filter-select" value={activeReportFilter || 'All'} onChange={(e) => setActiveReportFilter(e.target.value === 'All' ? '' : e.target.value)}>
          <option value="All">All Report Filters</option>
          {reportFilterOptions.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
        <select className="filter-select" value={eKycFilter} onChange={(e) => setEKycFilter(e.target.value)}>
          <option value="All">All eKYC</option>
          {availableEkycOptions.map((status, index) => (
            <option key={index} value={status}>{status}</option>
          ))}
        </select>
        <select className="filter-select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="All">All Areas</option>
          {availableAreaOptions.map((area, index) => (
            <option key={index} value={area}>{area}</option>
          ))}
        </select>
        <select className="filter-select" value={onlineRefillPaymentStatusFilter} onChange={(e) => setOnlineRefillPaymentStatusFilter(e.target.value)}>
          <option value="All">All Online Refill Payment Status</option>
          {availableOnlinePaymentOptions.map((status, index) => (
            <option key={index} value={status}>{status}</option>
          ))}
        </select>
        <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="">Sort By</option>
          {headers.map((header, index) => (
            <option key={index} value={header}>{header}</option>
          ))}
        </select>
        <select className="filter-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <div className="filters-reset-wrap">
          <button className="filter-action filter-action--secondary" onClick={handleResetAllFilters}>Reset Filters</button>
        </div>
        <div className="filter-date-group filter-date-group--wide">
          <span className="filter-date-label">Order Date</span>
          <input className="filter-date-input filter-date-input--wide" type="date" value={orderDateStart} onChange={(e) => setOrderDateStart(e.target.value)} />
          <span className="filter-date-divider">to</span>
          <input className="filter-date-input filter-date-input--wide" type="date" value={orderDateEnd} onChange={(e) => setOrderDateEnd(e.target.value)} />
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="filters-container">
          <select className="filter-select" value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)}>
            <option value="All">All Nature</option>
            {availableNatureOptions.map((nature, index) => (
              <option key={index} value={nature}>{nature}</option>
            ))}
          </select>
          <select className="filter-select" value={mobileStatusFilter} onChange={(e) => setMobileStatusFilter(e.target.value)}>
            <option value="All">All Mobile Status</option>
            {availableMobileStatusOptions.map((status, index) => (
              <option key={index} value={status}>{status}</option>
            ))}
          </select>
          <select className="filter-select" value={consumerStatusFilter} onChange={(e) => setConsumerStatusFilter(e.target.value)}>
            <option value="All">All Consumer Status</option>
            {availableConsumerStatusOptions.map((status, index) => (
              <option key={index} value={status}>{status}</option>
            ))}
          </select>
          <select className="filter-select" value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)}>
            <option value="All">All Connection Types</option>
            {availableConnectionTypeOptions.map((type, index) => (
              <option key={index} value={type}>{type}</option>
            ))}
          </select>
          <select className="filter-select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
            <option value="All">All Order Status</option>
            {availableOrderStatusOptions.map((status, index) => (
              <option key={index} value={status}>{status}</option>
            ))}
          </select>
          <select className="filter-select" value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)}>
            <option value="All">All Order Source</option>
            {availableOrderSourceOptions.map((source, index) => (
              <option key={index} value={source}>{source}</option>
            ))}
          </select>
          <select className="filter-select" value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}>
            <option value="All">All Order Type</option>
            {availableOrderTypeOptions.map((type, index) => (
              <option key={index} value={type}>{type}</option>
            ))}
          </select>
          <select className="filter-select" value={cashMemoStatusFilter} onChange={(e) => setCashMemoStatusFilter(e.target.value)}>
            <option value="All">All Cash Memo Status</option>
            {availableCashMemoStatusOptions.map((status, index) => (
              <option key={index} value={status}>{status}</option>
            ))}
          </select>
          <select className="filter-select" value={deliveryManFilter} onChange={(e) => setDeliveryManFilter(e.target.value)}>
            <option value="All">All Delivery Man</option>
            {availableDeliveryManOptions.map((man, index) => (
              <option key={index} value={man}>{man}</option>
            ))}
          </select>
          <div className="filter-date-group filter-date-group--wide">
            <span className="filter-date-label">Cash Memo Date</span>
            <input className="filter-date-input filter-date-input--wide" type="date" value={cashMemoDateStart} onChange={(e) => setCashMemoDateStart(e.target.value)} />
            <span className="filter-date-divider">to</span>
            <input className="filter-date-input filter-date-input--wide" type="date" value={cashMemoDateEnd} onChange={(e) => setCashMemoDateEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="table-controls">
        <div className="table-control-group">
          <label className="table-control-label" htmlFor="searchDataInput">Search</label>
          <input id="searchDataInput" className="search-input" type="text" placeholder="Search within data..." value={searchTerm} onChange={handleSearchChange} />
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="addColumnSelect">Add Column</label>
          <select className="table-select" id="addColumnSelect" onChange={(e) => addColumn(e.target.value)} value="">
            <option value="" disabled>Select a column</option>
            {headers.filter((header) => !visibleHeaders.includes(header)).map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="removeColumnSelect">Remove Column</label>
          <select className="table-select" id="removeColumnSelect" onChange={(e) => removeColumn(e.target.value)} value="">
            <option value="" disabled>Select a column</option>
            {visibleHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="pageTypeSelect">Page Type</label>
          <select className="table-select" id="pageTypeSelect" onChange={(e) => setPageType(e.target.value)} value={pageType}>
            <option value="2 Cashmemo/Page">2 Cashmemo/Page</option>
            <option value="3 Cashmemo/Page">3 Cashmemo/Page</option>
            <option value="4 Cashmemo/Page">4 Cashmemo/Page</option>
          </select>
        </div>

        {isHindiEnterprisePackage(loggedInUser?.package) && (
          <div className="table-control-group">
            <label className="table-control-label" htmlFor="printLanguageSelect">Print Language</label>
            <select className="table-select" id="printLanguageSelect" onChange={(e) => setPrintLanguage(e.target.value)} value={printLanguage}>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
        )}

        <button className="table-action table-action--green action-button" onClick={handlePrintData}>Print Data</button>
        <button className="table-action table-action--blue action-button" onClick={handlePrintCashmemo}>Print Cashmemo</button>
        <button className="filter-action filter-action--secondary action-button" onClick={exportFilteredRows}>Export Filtered</button>
        <button className="filter-action filter-action--secondary action-button" onClick={exportReportSummary}>Export Report Summary</button>
      </div>

      <div className="table-container">
        {shouldShowFilteredEmptyState ? (
          <div className="data-empty-state">
            <p className="data-empty-state__eyebrow">No Records Found</p>
            <h3>No bookings match the current filters.</h3>
            <p>
              {hasActiveDataFilters
                ? 'Kuch filters bahut strict ho gaye hain. Neeche diye gaye quick fixes try kijiye aur rows wapas laaiye.'
                : 'No visible rows are available right now. Try re-uploading the latest Pending Booking file.'}
            </p>
            {emptyStateActions.length > 0 && (
              <div className="data-empty-state__suggestions">
                {emptyStateActions.map((action) => (
                  <button key={action.key} type="button" className="data-empty-state__shortcut" onClick={action.onClick}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            <div className="data-empty-state__actions">
              {hasActiveDataFilters && (
                <button type="button" className="filter-action filter-action--secondary" onClick={handleResetAllFilters}>
                  Reset Filters
                </button>
              )}
              <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
                Re-Upload Data
              </button>
            </div>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table__sticky-col" style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                    <input type="checkbox" onChange={handleSelectAllChange} checked={isAllFilteredRowsSelected} />
                  </th>
                  {visibleHeaders.map((header, index) => (
                    <th key={index} style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentTableData.map((customer, index) => {
                  const isEkycStatusPending = customer['EKYC Status'] === 'Pending' || customer['EKYC Status'] === 'EKYC NOT DONE';
                  return (
                    <tr
                      key={index}
                      style={{
                        border: '1px solid black',
                        color: isEkycStatusPending ? '#ff5252' : 'inherit',
                        fontWeight: isEkycStatusPending ? 'bold' : 'normal',
                      }}
                    >
                      <td className="data-table__sticky-col" style={{ border: '1px solid black', padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(String(customer['Consumer No.']))}
                          onChange={() => handleCheckboxChange(customer['Consumer No.'])}
                        />
                      </td>
                      {visibleHeaders.map((header, colIndex) => (
                        <td key={colIndex} style={{ border: '1px solid black', padding: '8px' }}>
                          {String(
                            header === 'Online Refill Payment status'
                              ? (customer[header] === 'PAID' ? 'PAID' : 'COD')
                              : (header === 'Order Date' || header === 'Cash Memo Date'
                                ? formatDateToDDMMYYYY(
                                  typeof customer[header] === 'number'
                                    ? excelSerialDateToJSDate(customer[header])
                                    : parseDateString(customer[header]),
                                )
                                : (customer[header] === undefined || customer[header] === null ? '' : customer[header])),
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>Total Records: {filteredData.length}</p>

            <div className="pagination">
              <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataWorkspace;
