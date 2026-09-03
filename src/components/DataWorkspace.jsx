import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import WorkspaceFilters from './dataWorkspace/WorkspaceFilters';
import WorkspaceOverview from './dataWorkspace/WorkspaceOverview';
import WorkspaceTable from './dataWorkspace/WorkspaceTable';
import AppIcon from './AppIcon';

import { getMultiFilterValues } from './dataWorkspace/getMultiFilterValues';

const DataWorkspace = (props) => {
  const {
    showBookingReport,
    filteredData,
    activeReportFilter,
    reportViewMode,
    setReportViewMode,
    setActiveReportFilter,
    setShowBookingReport,
    reportSummaryCards,
    reportCards,
    exceptionQueueCards,
    reportRecordCount,
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
    setVisibleHeaders,
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
    shouldShowFilteredEmptyState,
    handleReUploadClick,
    canUpload = true,
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
    itemsPerPage,
    setItemsPerPage,
    availableIsRegMobileOptions,
    isRegMobileFilter,
    setIsRegMobileFilter,
  } = props;

  const [activeConsumerNo, setActiveConsumerNo] = useState('');
  const consumerDetailRef = useRef(null);
  const searchInputRef = useRef(null);

  const columnPresets = useMemo(() => {
    const onlyAvailable = (columns) => columns.filter((header) => headers.includes(header));
    return [
      {
        key: 'essential',
        label: 'Essential',
        columns: onlyAvailable(['Consumer No.', 'Consumer Name', 'Delivery Area', 'Mobile No.', 'Order Date', 'Cash Memo Date', 'Online Refill Payment status', 'EKYC Status']),
      },
      {
        key: 'delivery',
        label: 'Delivery',
        columns: onlyAvailable(['Consumer No.', 'Consumer Name', 'Delivery Area', 'Delivery Man', 'Mobile No.', 'Order Date', 'Order Status', 'Cash Memo Status']),
      },
      {
        key: 'payment',
        label: 'Payment',
        columns: onlyAvailable(['Consumer No.', 'Consumer Name', 'Mobile No.', 'Cash Memo No.', 'Cash Memo Date', 'Online Refill Payment status', 'Order Type']),
      },
      {
        key: 'all',
        label: 'All Columns',
        columns: headers,
      },
    ].filter((preset) => preset.columns.length > 0);
  }, [headers]);

  const essentialColumnPreset = useMemo(
    () => columnPresets.find((preset) => preset.key === 'essential') || columnPresets[0] || null,
    [columnPresets],
  );

  const applyColumnPreset = useCallback((preset) => {
    if (!preset?.columns?.length) return;
    setVisibleHeaders(preset.columns);
  }, [setVisibleHeaders]);

  useEffect(() => {
    if (!essentialColumnPreset?.columns?.length) return;
    setVisibleHeaders(essentialColumnPreset.columns);
  }, [essentialColumnPreset, setVisibleHeaders]);

  const selectedColumnPresetKey = useMemo(() => {
    const visibleKey = visibleHeaders.join('\u001f');
    const matchingPreset = columnPresets.find((preset) => preset.columns.join('\u001f') === visibleKey);
    return matchingPreset?.key || 'custom';
  }, [columnPresets, visibleHeaders]);

  const handleResetAllFiltersWithEssentialColumns = useCallback(() => {
    handleResetAllFilters();
    applyColumnPreset(essentialColumnPreset);
  }, [applyColumnPreset, essentialColumnPreset, handleResetAllFilters]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      const target = event.target;
      const isTypingTarget = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      );

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!isTypingTarget && event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

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

  const formatConsumerDetailValue = useCallback((customer, header) => {
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
  }, [excelSerialDateToJSDate, formatDateToDDMMYYYY, parseDateString]);

  const createConsumerDetailBlob = async () => {
    const node = consumerDetailRef.current;
    if (!node) {
      throw new Error('Consumer detail view is not available.');
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const clone = node.cloneNode(true);
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.opacity = '1';
    clone.style.animation = 'none';
    clone.style.transition = 'none';
    clone.style.filter = 'none';
    clone.querySelector('.consumer-detail-toolbar')?.remove();

    clone.querySelectorAll('*').forEach((element) => {
      element.style.animation = 'none';
      element.style.transition = 'none';
      element.style.opacity = '1';
      if (element.classList.contains('consumer-detail-overlay')) {
        element.style.background = 'transparent';
        element.style.backdropFilter = 'none';
      }
    });

    const captureRoot = document.createElement('div');
    captureRoot.style.position = 'fixed';
    captureRoot.style.left = '-100000px';
    captureRoot.style.top = '0';
    captureRoot.style.padding = '0';
    captureRoot.style.margin = '0';
    captureRoot.style.background = '#ffffff';
    captureRoot.style.zIndex = '-1';
    captureRoot.appendChild(clone);
    document.body.appendChild(captureRoot);

    const pixelRatio = Math.max(2, Math.min((window.devicePixelRatio || 1) * 2, 4));

    try {
      const canvas = await html2canvas(clone, {
        backgroundColor: '#ffffff',
        scale: pixelRatio,
        useCORS: true,
        logging: false,
        imageTimeout: 0,
      });

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
      captureRoot.remove();
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

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-100000px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  const handleCopyConsumerDetailText = async () => {
    if (!activeConsumer) {
      pushToast?.('Consumer detail available nahi hai.', 'error');
      return;
    }

    const detailText = [
      `Consumer No - ${formatConsumerDetailValue(activeConsumer, 'Consumer No.')}`,
      `Name - ${formatConsumerDetailValue(activeConsumer, 'Consumer Name')}`,
      `Contact No - ${formatConsumerDetailValue(activeConsumer, 'Mobile No.')}`,
      `Area - ${formatConsumerDetailValue(activeConsumer, 'Delivery Area')}`,
      `Address - ${formatConsumerDetailValue(activeConsumer, 'Address')}`,
      `Order Date - ${formatConsumerDetailValue(activeConsumer, 'Order Date')}`,
      `Consumer Type - ${formatConsumerDetailValue(activeConsumer, 'Consumer Type')}`,
      `EKYC Status - ${formatConsumerDetailValue(activeConsumer, 'EKYC Status')}`,
      `Online Refill Payment status - ${formatConsumerDetailValue(activeConsumer, 'Online Refill Payment status')}`,
      `Order No - ${formatConsumerDetailValue(activeConsumer, 'Order No.')}`,
      `Cashmemo No - ${formatConsumerDetailValue(activeConsumer, 'Cash Memo No.')}`,
      `Cashmemo Date - ${formatConsumerDetailValue(activeConsumer, 'Cash Memo Date')}`,
      `Cashmemo Status - ${formatConsumerDetailValue(activeConsumer, 'Cash Memo Status')}`,
    ].join('\n');

    try {
      await copyTextToClipboard(detailText);
    } catch {
      pushToast?.('Consumer details text copy nahi ho paya. Please try again.', 'error');
    }
  };

  const handleCopyConsumerDetailImage = async () => {
    try {
      const blob = await createConsumerDetailBlob();

      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob }),
          ]);
          return;
        } catch {
          downloadConsumerDetailBlob(blob);
          pushToast?.('Clipboard copy block ho gaya. Screenshot download kar diya gaya hai.', 'info');
          return;
        }
      }

      downloadConsumerDetailBlob(blob);
      pushToast?.('Clipboard support nahi mila. Screenshot download kar diya gaya hai.', 'info');
    } catch {
      pushToast?.('Screenshot copy nahi ho paya. Please try again.', 'error');
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
      .filter((key) => key !== 'IsRefillPort')
      .filter((key) => !basicFieldOrder.includes(key))
      .filter((key) => {
        if (key === 'Online Refill Payment status') {
          return true;
        }
        const value = activeConsumer[key];
        return !(value === undefined || value === null || String(value).trim() === '');
      })
      .map((key) => ({
        key,
        label: key,
        value: formatConsumerDetailValue(activeConsumer, key),
      }));
//check
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
  }, [activeConsumer, formatConsumerDetailValue, headers]);

  const areaSelections = getMultiFilterValues(areaFilter);
  const findOption = (options, matchers) => {
    const optionList = Array.isArray(options) ? options : [];
    const matcherList = Array.isArray(matchers) ? matchers : [matchers];
    return optionList.find((option) => {
      const normalizedOption = String(option || '').toLowerCase().trim();
      return matcherList.some((matcher) => normalizedOption.includes(String(matcher || '').toLowerCase()));
    });
  };

  const commonFilterPresets = [
    {
      key: 'pending-ekyc',
      label: 'Pending eKYC',
      description: 'Rows jahan eKYC follow-up chahiye',
      disabled: !findOption(availableEkycOptions, ['pending', 'not done']),
      onClick: () => {
        const match = findOption(availableEkycOptions, ['pending', 'not done']);
        if (match) setEKycFilter([match]);
      },
    },
    {
      key: 'online-paid',
      label: 'Online Paid',
      description: 'Paid refill bookings focus karo',
      disabled: !findOption(availableOnlinePaymentOptions, 'paid'),
      onClick: () => {
        const match = findOption(availableOnlinePaymentOptions, 'paid');
        if (match) setOnlineRefillPaymentStatusFilter(match);
      },
    },
    {
      key: 'cashmemo-pending',
      label: 'Cashmemo Pending',
      description: 'Print queue ke pending rows',
      disabled: !findOption(availableCashMemoStatusOptions, ['not generated', 'pending', 'not printed']),
      onClick: () => {
        const match = findOption(availableCashMemoStatusOptions, ['not generated', 'pending', 'not printed']);
        if (match) setCashMemoStatusFilter(match);
      },
    },
  ];

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
    handleResetAllFilters: handleResetAllFiltersWithEssentialColumns,
  };

  return (
    <div className={`filters-shell ${compactWorkspaceMode ? 'filters-shell--compact' : ''}`}>
      <WorkspaceOverview
        showBookingReport={showBookingReport}
        filteredData={filteredData}
        activeReportFilter={activeReportFilter}
        reportViewMode={reportViewMode}
        setReportViewMode={setReportViewMode}
        setActiveReportFilter={setActiveReportFilter}
        setShowBookingReport={setShowBookingReport}
        reportSummaryCards={reportSummaryCards}
        reportCards={reportCards}
        exceptionQueueCards={exceptionQueueCards}
        reportRecordCount={reportRecordCount}
        uploadInProgress={uploadInProgress}
        selectedCustomerIds={selectedCustomerIds}
        hasActiveDataFilters={hasActiveDataFilters}
        parsedData={parsedData}
        uploadMetadata={uploadMetadata}
        activeFilterChips={activeFilterChips}
        handleResetAllFilters={handleResetAllFiltersWithEssentialColumns}
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
        commonFilterPresets={commonFilterPresets}
      />

      <WorkspaceFilters
        basicFilters={basicFilters}
        advancedFilters={advancedFilters}
        controls={controls}
      />

      <div className="table-controls">
        <div className="table-control-group table-control-group--smart-search">
          <label className="table-control-label" htmlFor="searchDataInput">Search</label>
          <input
            ref={searchInputRef}
            id="searchDataInput"
            className="search-input"
            type="text"
            placeholder="Consumer, mobile, name, cash memo..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="columnPresetSelect">Column View</label>
          <select
            className="table-select"
            id="columnPresetSelect"
            onChange={(event) => {
              const preset = columnPresets.find((item) => item.key === event.target.value);
              if (preset) {
                applyColumnPreset(preset);
              }
            }}
            value={selectedColumnPresetKey}
          >
            <option value="custom" disabled>Custom</option>
            {columnPresets.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </div>

        <div className="table-control-group">
          <label className="table-control-label" htmlFor="pageSizeSelect">Rows</label>
          <select
            className="table-select"
            id="pageSizeSelect"
            onChange={(event) => {
              setItemsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
            value={itemsPerPage}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={0}>All</option>
          </select>
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
          <AppIcon name="compact" />
          {compactWorkspaceMode ? 'Normal View' : 'Compact Mode'}
        </button>

        <button className="table-action table-action--green action-button" onClick={handlePrintData}>
          <AppIcon name="print" />
          Print Data
        </button>
        <button className="table-action table-action--blue action-button" onClick={handlePrintCashmemo}>
          <AppIcon name="print" />
          Print Cashmemo
        </button>
        <button className="filter-action filter-action--secondary action-button" onClick={exportFilteredRows}>
          <AppIcon name="export" />
          Export Filtered
        </button>
      </div>

      <WorkspaceTable
        shouldShowFilteredEmptyState={shouldShowFilteredEmptyState}
        hasActiveDataFilters={hasActiveDataFilters}
        emptyStateActions={emptyStateActions}
        handleResetAllFilters={handleResetAllFiltersWithEssentialColumns}
        handleReUploadClick={handleReUploadClick}
        canUpload={canUpload}
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
        itemsPerPage={itemsPerPage}
        pushToast={pushToast}
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
                  <span aria-hidden="true">📷</span>
                </button>
                <button
                  type="button"
                  className="consumer-detail-card__icon-button consumer-detail-card__snapshot"
                  onClick={handleCopyConsumerDetailText}
                  title="Copy detail text"
                  aria-label="Copy detail text"
                >
                  <span aria-hidden="true">📋</span>
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
                    <div className={`consumer-book-section__grid ${
                      section.key === 'other' ? 'consumer-book-section__grid--other' : ''
                    }`}>
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
