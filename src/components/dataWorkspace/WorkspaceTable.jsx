import { useMemo, useState } from 'react';
import AppIcon from '../AppIcon';

const getCellDisplayValue = ({
  customer,
  header,
  formatDateToDDMMYYYY,
  excelSerialDateToJSDate,
  parseDateString,
}) => String(
  header === 'Online Refill Payment status'
    ? (customer[header] === 'PAID' ? 'PAID' : 'COD')
    : (header === 'Order Date' || header === 'Cash Memo Date'
      ? formatDateToDDMMYYYY(
        typeof customer[header] === 'number'
          ? excelSerialDateToJSDate(customer[header])
          : parseDateString(customer[header]),
      )
      : (customer[header] === undefined || customer[header] === null ? '' : customer[header])),
);

const copyTextToClipboard = async (value) => {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error('Nothing to copy.');
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const WorkspaceTable = ({
  shouldShowFilteredEmptyState,
  hasActiveDataFilters,
  emptyStateActions,
  handleResetAllFilters,
  handleReUploadClick,
  canUpload = true,
  openOnboardingTour,
  visibleHeaders,
  currentTableData,
  selectedCustomerIds,
  handleCheckboxChange,
  handleSelectAllChange,
  isAllFilteredRowsSelected,
  onPreviewCustomer,
  activeConsumerNo,
  onSelectConsumer,
  filteredData,
  formatDateToDDMMYYYY,
  excelSerialDateToJSDate,
  parseDateString,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage,
  pushToast,
}) => {
  const [columnWidths, setColumnWidths] = useState({});

  const tableColumns = useMemo(() => (
    [
      { key: '__select__', width: 48 },
      ...visibleHeaders.map((header) => ({
        key: header,
        width: columnWidths[header] || (header === 'Consumer No.' ? 190 : 160),
      })),
    ]
  ), [columnWidths, visibleHeaders]);

  const startColumnResize = (event, header) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[header] || event.currentTarget.parentElement?.offsetWidth || 160;

    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.max(96, Math.min(420, startWidth + moveEvent.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [header]: nextWidth }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const paginationText = itemsPerPage === 0
    ? `Showing all ${filteredData.length} records`
    : `Page ${currentPage} of ${totalPages}`;

  return (
    <div className="table-container">
      {shouldShowFilteredEmptyState ? (
        <div className="data-empty-state">
          <p className="data-empty-state__eyebrow">Nothing To Show</p>
          <h3>Abhi koi booking current view me visible nahi hai.</h3>
          <p>
            {hasActiveDataFilters
              ? 'Kuch filters bahut strict ho gaye hain. Neeche diye gaye quick fixes try kijiye aur rows wapas laaiye.'
              : 'Latest Pending Booking file ko re-upload karke ya quick tour dekh kar next step samajh sakte ho.'}
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
                <AppIcon name="reset" />
                Reset Filters
              </button>
            )}
            {canUpload && (
              <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
                <AppIcon name="upload" />
                Re-Upload Data
              </button>
            )}
            <button type="button" className="filter-action filter-action--secondary" onClick={() => openOnboardingTour?.(0)}>
              Open Quick Tour
            </button>
          </div>
        </div>
      ) : (
        <>
          <table className="data-table">
            <colgroup>
              {tableColumns.map((column) => (
                <col key={column.key} style={{ width: `${column.width}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="data-table__sticky-select data-table__select-cell">
                  <input type="checkbox" onChange={handleSelectAllChange} checked={isAllFilteredRowsSelected} />
                </th>
                {visibleHeaders.map((header, index) => (
                  <th
                    key={header}
                    className={index === 0 ? 'data-table__sticky-first' : ''}
                  >
                    <span className="data-table__header-label">{header}</span>
                    <button
                      type="button"
                      className="data-table__resize-handle"
                      onPointerDown={(event) => startColumnResize(event, header)}
                      aria-label={`Resize ${header} column`}
                      title="Resize column"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTableData.map((customer, index) => {
                const isEkycStatusPending = customer['EKYC Status'] === 'Pending' || customer['EKYC Status'] === 'EKYC NOT DONE';
                const consumerNo = String(customer['Consumer No.'] || '');
                const isActiveConsumer = activeConsumerNo === consumerNo;
                return (
                  <tr
                    key={`${consumerNo || 'row'}-${index}`}
                    onDoubleClick={() => onPreviewCustomer?.(customer)}
                    style={{
                      backgroundColor: isActiveConsumer ? '#eef6ff' : '#fff',
                      color: isEkycStatusPending ? '#ff5252' : 'inherit',
                      fontWeight: isEkycStatusPending ? 'bold' : 'normal',
                      cursor: onPreviewCustomer ? 'pointer' : 'default',
                    }}
                  >
                    <td className="data-table__sticky-select data-table__select-cell">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(consumerNo)}
                        onChange={() => handleCheckboxChange(customer['Consumer No.'])}
                      />
                    </td>
                    {visibleHeaders.map((header, colIndex) => {
                      const displayValue = getCellDisplayValue({
                        customer,
                        header,
                        formatDateToDDMMYYYY,
                        excelSerialDateToJSDate,
                        parseDateString,
                      });

                      return (
                        <td key={header} className={colIndex === 0 ? 'data-table__sticky-first' : ''}>
                          {header === 'Consumer No.' ? (
                            <>
                              <button
                                type="button"
                                className={`consumer-link-button ${isActiveConsumer ? 'is-active' : ''}`}
                                onClick={() => onSelectConsumer?.(consumerNo)}
                              >
                                {displayValue}
                              </button>
                              <button
                                type="button"
                                className="consumer-copy-button"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  try {
                                    await copyTextToClipboard(consumerNo);
                                    pushToast?.(`Consumer No. ${consumerNo} copied`, 'success');
                                  } catch {
                                    pushToast?.('Consumer number copy nahi ho saka.', 'error');
                                  }
                                }}
                                aria-label={`Copy consumer number ${consumerNo}`}
                                title={`Copy ${consumerNo}`}
                              >
                                <AppIcon name="copy" />
                                Copy
                              </button>
                            </>
                          ) : (
                            displayValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>Total Records: {filteredData.length}</p>

          <div className="pagination">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || itemsPerPage === 0}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span>{paginationText}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || itemsPerPage === 0}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkspaceTable;
