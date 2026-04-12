export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const getConsumerId = (customer) => String(customer?.['Consumer No.'] ?? '');

export const toggleCustomerSelection = (selectedIds, consumerNo) => {
  const nextId = String(consumerNo ?? '');
  if (!nextId) return [...selectedIds];
  return selectedIds.includes(nextId)
    ? selectedIds.filter((id) => id !== nextId)
    : [...selectedIds, nextId];
};

export const toggleSelectAllFiltered = (selectedIds, filteredData) => {
  const filteredConsumerNos = filteredData.map(getConsumerId).filter(Boolean);
  const isEveryFilteredRowSelected =
    filteredConsumerNos.length > 0 && filteredConsumerNos.every((id) => selectedIds.includes(id));

  if (isEveryFilteredRowSelected) {
    return selectedIds.filter((id) => !filteredConsumerNos.includes(id));
  }

  return [...new Set([...selectedIds, ...filteredConsumerNos])];
};

export const areAllFilteredRowsSelected = (filteredData, selectedIds) =>
  filteredData.length > 0 && filteredData.every((customer) => selectedIds.includes(getConsumerId(customer)));

export const getSelectedCustomersForPrint = (filteredData, selectedIds) =>
  filteredData.filter((customer) => selectedIds.includes(getConsumerId(customer)));

export const formatPrintTableValue = (
  row,
  header,
  formatDateToDDMMYYYY,
  excelSerialDateToJSDate,
  parseDateString,
) => {
  let displayValue = row?.[header];

  if (header === 'Order Date' || header === 'Cash Memo Date') {
    let date = null;
    if (typeof row?.[header] === 'number') {
      date = excelSerialDateToJSDate(row[header]);
    } else if (typeof row?.[header] === 'string') {
      date = parseDateString(row[header]);
    }
    displayValue = formatDateToDDMMYYYY(date);
  } else if (header === 'Online Refill Payment status') {
    displayValue = row?.[header] === 'PAID' ? 'PAID' : 'COD';
  }

  return displayValue;
};

export const buildPrintDataHtml = ({
  visibleHeaders,
  filteredData,
  formatDateToDDMMYYYY,
  excelSerialDateToJSDate,
  parseDateString,
}) => `
      <style>
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid black;
          padding: 8px;
          text-align: left;
        }
      </style>
      <h1>List of Cash Memo</h1>
      <table>
        <thead>
          <tr>
            ${visibleHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filteredData.map((row) => `
            <tr>
              ${visibleHeaders.map((header) => {
                const displayValue = formatPrintTableValue(
                  row,
                  header,
                  formatDateToDDMMYYYY,
                  excelSerialDateToJSDate,
                  parseDateString,
                );
                return `<td>${escapeHtml(displayValue)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p>Total Records: ${filteredData.length}</p>
    `;
