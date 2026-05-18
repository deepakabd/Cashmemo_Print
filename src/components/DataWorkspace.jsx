import WorkspaceFilters from './dataWorkspace/WorkspaceFilters';
import WorkspaceOverview from './dataWorkspace/WorkspaceOverview';
import WorkspaceTable from './dataWorkspace/WorkspaceTable';

import { getMultiFilterValues } from './dataWorkspace/getMultiFilterValues';

const DataWorkspace = (props) => {
  const {
    showBookingReport,
    filteredData,
    activeReportFilter,
    setActiveReportFilter,
    setShowBookingReport,
    reportCards,
    exceptionQueueCards,
    uploadInProgress,
    selectedCustomerIds,
    hasActiveDataFilters,
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
    reportFilterOptions,
    eKycFilter,
    setEKycFilter,
    availableEkycOptions,
    areaFilter,
    setAreaFilter,
    availableAreaOptions,
    onlineRefillPaymentStatusFilter,
    setOnlineRefillPaymentStatusFilter,
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
    availableOnlinePaymentOptions,
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
    printHeaderMode,
    setPrintHeaderMode,
    printLanguage,
    setPrintLanguage,
    handlePrintData,
    onPreviewCustomer,
    exportFilteredRows,
    exportReportSummary,
    shouldShowFilteredEmptyState,
    handleReUploadClick,
    openOnboardingTour,
    compactWorkspaceMode,
    onToggleCompactWorkspaceMode,
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
    availableIsRegMobileOptions,
    isRegMobileFilter,
    setIsRegMobileFilter,
  } = props;

  const areaSelections = getMultiFilterValues(areaFilter);
  const emptyStateActions = [
    searchTerm ? {
      key: 'search',
      label: `Remove search "${searchTerm}"`,
      onClick: () => setSearchTerm(''),
    } : null,
    getMultiFilterValues(eKycFilter).length > 0 ? {
      key: 'ekyc',
      label: 'Reset eKYC',
      onClick: () => setEKycFilter('All'),
    } : null,
    areaSelections.length > 0 ? {
      key: 'area',
      label: 'Show all areas',
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

  const basicFilters = {
    activeReportFilter,
    setActiveReportFilter,
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
    orderDateStart,
    setOrderDateStart,
    orderDateEnd,
    setOrderDateEnd,
  };

  const advancedFilters = {
    showAdvancedFilters,
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
    orderTypeFilter,
    setOrderTypeFilter,
    availableOrderTypeOptions,
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
    availableIsRegMobileOptions,
    isRegMobileFilter,
    setIsRegMobileFilter,
  };

  const controls = {
    sortBy,
    setSortBy,
    headers,
    sortOrder,
    setSortOrder,
    handleResetAllFilters,
  };

  return (
    <div className={`filters-shell ${compactWorkspaceMode ? 'filters-shell--compact' : ''}`}>
      <WorkspaceOverview
        showBookingReport={showBookingReport}
        filteredData={filteredData}
        activeReportFilter={activeReportFilter}
        setActiveReportFilter={setActiveReportFilter}
        setShowBookingReport={setShowBookingReport}
        reportCards={reportCards}
        exceptionQueueCards={exceptionQueueCards}
        uploadInProgress={uploadInProgress}
        selectedCustomerIds={selectedCustomerIds}
        hasActiveDataFilters={hasActiveDataFilters}
        parsedData={parsedData}
        uploadMetadata={uploadMetadata}
        activeFilterChips={activeFilterChips}
        handleResetAllFilters={handleResetAllFilters}
        handleSaveCurrentPreset={handleSaveCurrentPreset}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        savedFilterPresets={savedFilterPresets}
        applyFilterPreset={applyFilterPreset}
        handleDeletePreset={handleDeletePreset}
        selectedFilteredRows={selectedFilteredRows}
        handlePrintCashmemo={handlePrintCashmemo}
        exportSelectedBusinessRows={exportSelectedBusinessRows}
        exportRowsToCsvFile={exportRowsToCsvFile}
        buildExportFilename={buildExportFilename}
        visibleHeaders={visibleHeaders}
        clearSelection={clearSelection}
        pushToast={pushToast}
      />

      <WorkspaceFilters
        basicFilters={basicFilters}
        advancedFilters={advancedFilters}
        controls={controls}
      />

      <div className="table-controls">
        <div className="table-control-group">
          <label className="table-control-label" htmlFor="searchDataInput">Search</label>
          <input id="searchDataInput" className="search-input" type="text" placeholder="Search within data..." value={searchTerm} onChange={handleSearchChange} />
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="addColumnSelect">Add Column</label>
          <select className="table-select" id="addColumnSelect" onChange={(event) => addColumn(event.target.value)} value="">
            <option value="" disabled>Select a column</option>
            {headers.filter((header) => !visibleHeaders.includes(header)).map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="removeColumnSelect">Remove Column</label>
          <select className="table-select" id="removeColumnSelect" onChange={(event) => removeColumn(event.target.value)} value="">
            <option value="" disabled>Select a column</option>
            {visibleHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="pageTypeSelect">Page Type</label>
          <select className="table-select" id="pageTypeSelect" onChange={(event) => setPageType(event.target.value)} value={pageType}>
            <option value="2 Cashmemo/Page">2 Cashmemo/Page</option>
            <option value="3 Cashmemo/Page">3 Cashmemo/Page</option>
            <option value="4 Cashmemo/Page">4 Cashmemo/Page</option>
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="printHeaderModeSelect">Print Header</label>
          <select className="table-select" id="printHeaderModeSelect" onChange={(event) => setPrintHeaderMode(event.target.value)} value={printHeaderMode}>
            <option value="With Header">With Header</option>
            <option value="Without Header">Without Header</option>
          </select>
        </div>

        {isHindiEnterprisePackage(loggedInUser?.package) && (
          <div className="table-control-group">
            <label className="table-control-label" htmlFor="printLanguageSelect">Print Language</label>
            <select className="table-select" id="printLanguageSelect" onChange={(event) => setPrintLanguage(event.target.value)} value={printLanguage}>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
        )}

        <button type="button" className="filter-action filter-action--secondary action-button" onClick={onToggleCompactWorkspaceMode}>
          {compactWorkspaceMode ? 'Normal View' : 'Compact Mode'}
        </button>

        <button className="table-action table-action--green action-button" onClick={handlePrintData}>Print Data</button>
        <button className="table-action table-action--blue action-button" onClick={handlePrintCashmemo}>Print Cashmemo</button>
        <button className="filter-action filter-action--secondary action-button" onClick={exportFilteredRows}>Export Filtered</button>
        <button className="filter-action filter-action--secondary action-button" onClick={exportReportSummary}>Export Report Summary</button>
      </div>

      <WorkspaceTable
        shouldShowFilteredEmptyState={shouldShowFilteredEmptyState}
        hasActiveDataFilters={hasActiveDataFilters}
        emptyStateActions={emptyStateActions}
        handleResetAllFilters={handleResetAllFilters}
        handleReUploadClick={handleReUploadClick}
        openOnboardingTour={openOnboardingTour}
        visibleHeaders={visibleHeaders}
        currentTableData={currentTableData}
        selectedCustomerIds={selectedCustomerIds}
        handleCheckboxChange={handleCheckboxChange}
        handleSelectAllChange={handleSelectAllChange}
        isAllFilteredRowsSelected={isAllFilteredRowsSelected}
        onPreviewCustomer={onPreviewCustomer}
        filteredData={filteredData}
        formatDateToDDMMYYYY={formatDateToDDMMYYYY}
        excelSerialDateToJSDate={excelSerialDateToJSDate}
        parseDateString={parseDateString}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />
    </div>
  );
};

export default DataWorkspace;
