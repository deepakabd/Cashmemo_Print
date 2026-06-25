import { useEffect, useMemo, useRef, useState } from 'react';
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

  const [activeConsumerNo, setActiveConsumerNo] = useState('');
  const consumerDetailRef = useRef(null);

  useEffect(() => {
    if (!activeConsumerNo || filteredData.length === 0) {
      if (filteredData.length === 0 && activeConsumerNo) {
        setActiveConsumerNo('');
      }
      return;
    }

    const hasActiveConsumer = filteredData.some((row) => String(row['Consumer No.'] || '') === activeConsumerNo);
    if (!hasActiveConsumer) {
      setActiveConsumerNo('');
    }
  }, [filteredData, activeConsumerNo]);

  const activeConsumer = useMemo(
    () => filteredData.find((row) => String(row['Consumer No.'] || '') === activeConsumerNo) || null,
    [filteredData, activeConsumerNo],
  );

  useEffect(() => {
    if (!activeConsumer) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveConsumerNo('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeConsumer]);

  const formatConsumerDetailValue = (customer, header) => {
    if (!customer) return '-';

    if (header === 'Online Refill Payment status') {
      return customer[header] === 'PAID' ? 'PAID' : 'COD';
    }

    if (String(header).toLowerCase().includes('date')) {
      const rawValue = customer[header];
      const parsedDate = typeof rawValue === 'number'
        ? excelSerialDateToJSDate(rawValue)
        : parseDateString(rawValue);
      return formatDateToDDMMYYYY(parsedDate) || '---';
    }

    const value = customer[header];
    return value === undefined || value === null || String(value).trim() === '' ? '---' : String(value);
  };

  const copyInlineStyles = (source, target) => {
    const computedStyle = window.getComputedStyle(source);
    let cssText = '';
    for (let index = 0; index < computedStyle.length; index += 1) {
      const property = computedStyle[index];
      cssText += `${property}:${computedStyle.getPropertyValue(property)};`;
    }
    target.style.cssText = cssText;

    Array.from(source.children).forEach((child, index) => {
      if (target.children[index]) {
        copyInlineStyles(child, target.children[index]);
      }
    });
  };

  const createConsumerDetailBlob = async () => {
    const node = consumerDetailRef.current;
    if (!node) {
      throw new Error('Consumer detail view is not available.');
    }

    const width = Math.ceil(node.scrollWidth);
    const height = Math.ceil(node.scrollHeight);
    const clone = node.cloneNode(true);
    copyInlineStyles(node, clone);

    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    clone.style.width = `${width}px`;
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.transform = 'none';
    clone.querySelector('.consumer-detail-toolbar')?.remove();

    const serialized = new XMLSerializer().serializeToString(clone);
    const svgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">${serialized}</foreignObject>
      </svg>
    `;
    const image = new Image();
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * pixelRatio);
      canvas.height = Math.ceil(height * pixelRatio);
      const context = canvas.getContext('2d');
      context.scale(pixelRatio, pixelRatio);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Screenshot image could not be created.'));
          }
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const downloadConsumerDetailBlob = (blob) => {
    const consumerNo = formatConsumerDetailValue(activeConsumer, 'Consumer No.').replace(/[^a-z0-9-]+/gi, '-');
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `consumer-detail-${consumerNo || 'snapshot'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyConsumerDetailImage = async () => {
    try {
      const blob = await createConsumerDetailBlob();

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        pushToast?.('Consumer detail image copied. You can paste/share it anywhere.', 'success');
        return;
      }

      downloadConsumerDetailBlob(blob);
      pushToast?.('Clipboard image copy is not supported here. Screenshot downloaded.', 'info');
    } catch (error) {
      pushToast?.('Unable to copy consumer detail image. Please try again.', 'error');
    }
  };

  const consumerDetailSections = useMemo(() => {
    if (!activeConsumer) return [];

    const basicFieldOrder = [
      'Consumer No.',
      'Consumer Name',
      'Consumer Type',
      'Order Date',
      'Mobile No.',
      'Delivery Area',
      'Address',
      'Delivery Man',
      'EKYC Status',
    ];

    const basicFields = basicFieldOrder
      .filter((key) => {
        const value = activeConsumer[key];
        return !(value === undefined || value === null || String(value).trim() === '');
      })
      .map((key) => ({
        key,
        label: key,
        value: formatConsumerDetailValue(activeConsumer, key),
      }));

    const knownHeaders = Array.isArray(headers) ? headers : [];
    const rowKeys = Object.keys(activeConsumer);
    const orderedKeys = [...knownHeaders, ...rowKeys.filter((key) => !knownHeaders.includes(key))];
    const remainingFields = orderedKeys
      .filter((key) => key !== 'LPG ID')
      .filter((key) => !basicFieldOrder.includes(key))
      .filter((key) => {
        const value = activeConsumer[key];
        return !(value === undefined || value === null || String(value).trim() === '');
      })
      .map((key) => ({
        key,
        label: key,
        value: formatConsumerDetailValue(activeConsumer, key),
      }));

    const sections = [];
    if (basicFields.length > 0) {
      sections.push({
        key: 'basic',
        title: 'बुनियादी विवरण',
        icon: '👤',
        fields: basicFields,
      });
    }

    if (remainingFields.length > 0) {
      sections.push({
        key: 'other',
        title: 'अन्य विवरण',
        icon: '📌',
        fields: remainingFields,
      });
    }

    return sections;
  }, [activeConsumer, headers]);

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
        activeConsumerNo={activeConsumerNo}
        onSelectConsumer={setActiveConsumerNo}
        filteredData={filteredData}
        formatDateToDDMMYYYY={formatDateToDDMMYYYY}
        excelSerialDateToJSDate={excelSerialDateToJSDate}
        parseDateString={parseDateString}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />

      {activeConsumer && (
        <div className="consumer-detail-overlay" onClick={() => setActiveConsumerNo('')}>
          <div
            ref={consumerDetailRef}
            className="consumer-detail-modal consumer-detail-modal--book"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consumer-detail-title"
          >
            <div className="consumer-detail-card__header">
              <div className="consumer-detail-card__summary">
                <h2 id="consumer-detail-title">
                  <span className="consumer-detail-card__title-icon" aria-hidden="true">♟</span>
                  <span>
                    उपभोक्ता विवरण - {formatConsumerDetailValue(activeConsumer, 'Consumer No.')} - {formatConsumerDetailValue(activeConsumer, 'Consumer Name')}
                  </span>
                </h2>
              </div>
              <div className="consumer-detail-toolbar">
                <button
                  type="button"
                  className="consumer-detail-card__icon-button consumer-detail-card__snapshot"
                  onClick={handleCopyConsumerDetailImage}
                  title="Copy detail screenshot"
                  aria-label="Copy detail screenshot"
                >
                  Shot
                </button>
                <button
                  type="button"
                  className="consumer-detail-card__icon-button consumer-detail-card__close"
                  onClick={() => setActiveConsumerNo('')}
                  title="Close"
                  aria-label="Close"
                >
                  X
                </button>
              </div>
            </div>
            <div className="consumer-book-view">
              <div className="consumer-book-view__table consumer-book-view__table--sections">
                {consumerDetailSections.map((section) => (
                  <section key={section.key} className="consumer-book-section">
                    <div className="consumer-book-section__title">
                      <span>{section.icon}</span>
                      <h5>{section.title}</h5>
                    </div>
                    <div className="consumer-book-section__grid">
                      {section.fields.map((field) => (
                        <div key={`${section.key}-${field.label}`} className="consumer-book-field">
                          <span className="consumer-book-field__label">{field.label}</span>
                          <strong className={`consumer-book-field__value ${
                            field.label === 'EKYC Status'
                              ? ['pending', 'ekyc not done'].includes(String(field.value || '').toLowerCase())
                                ? 'consumer-book-field__value--status-pending'
                                : 'consumer-book-field__value--status'
                              : ''
                          }`}>
                            {field.value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataWorkspace;
