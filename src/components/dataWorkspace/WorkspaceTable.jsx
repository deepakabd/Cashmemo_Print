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

const WorkspaceTable = ({
  shouldShowFilteredEmptyState,
  hasActiveDataFilters,
  emptyStateActions,
  handleResetAllFilters,
  handleReUploadClick,
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
}) => (
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
              Reset Filters
            </button>
          )}
          <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
            Re-Upload Data
          </button>
          <button type="button" className="filter-action filter-action--secondary" onClick={() => openOnboardingTour?.(0)}>
            Open Quick Tour
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
              const consumerNo = String(customer['Consumer No.'] || '');
              const isActiveConsumer = activeConsumerNo === consumerNo;
              return (
                <tr
                  key={index}
                  onDoubleClick={() => onPreviewCustomer?.(customer)}
                  style={{
                    border: '1px solid black',
                    backgroundColor: isActiveConsumer ? '#eef6ff' : '#fff',
                    color: isEkycStatusPending ? '#ff5252' : 'inherit',
                    fontWeight: isEkycStatusPending ? 'bold' : 'normal',
                    cursor: onPreviewCustomer ? 'pointer' : 'default',
                  }}
                >
                  <td className="data-table__sticky-col" style={{ border: '1px solid black', padding: '8px' }}>
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
                      <td key={colIndex} style={{ border: '1px solid black', padding: '8px' }}>
                        {header === 'Consumer No.' ? (
                          <button
                            type="button"
                            className={`consumer-link-button ${isActiveConsumer ? 'is-active' : ''}`}
                            onClick={() => onSelectConsumer?.(consumerNo)}
                          >
                            {displayValue}
                          </button>
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
          <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
        </div>
      </>
    )}
  </div>
);

export default WorkspaceTable;
