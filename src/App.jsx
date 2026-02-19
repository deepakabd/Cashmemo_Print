
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import FileUpload from './FileUpload';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import CashMemoEnglish from './CashMemoEnglish';

import './App.css';

// Helper function to convert Excel serial date to JavaScript Date object
const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== 'number' || isNaN(serial)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
  const ms = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return date;
};

// Helper function to format a Date object to DD-MM-YYYY


const formatDateToDDMMYYYY = (date) => {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};









function App() {
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [visibleHeaders, setVisibleHeaders] = useState([]); // New state for visible headers
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1); // New state for current page
  const [itemsPerPage] = useState(25); // Number of items per page
  const [pageType, setPageType] = useState('A4 3 Cashmemo/Page'); // New state for page type
  const [customersToPrint, setCustomersToPrint] = useState([]); // New state to hold multiple customers for printing
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]); // New state to track selected customer IDs
  const cashMemoRef = useRef(); // Ref for the cash memo component

  // Sample Dealer Details (to be updated by user registration later)
  const sampleDealerDetails = {
    name: 'RAJE BHAWANISHANKAR ENTERPRISES (41012240)',
    gstn: '27AEXPB6427K1ZZ',
    address: {
      plotNo: 'PLOT NO-3, SECTOR-6, CBD BELAPUR, MAHARASHTRA-400614',
    },
    contact: {
      email: 'raje.thane@hpgas.hpcl.co.in',
      telephone: '022-27571972, 27573871',
    },
  };

  // Filter states
  const [eKycFilter, setEKycFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [natureFilter, setNatureFilter] = useState('All');
  const [mobileStatusFilter, setMobileStatusFilter] = useState('All'); // Assuming this is derived from Mobile No.
  const [consumerStatusFilter, setConsumerStatusFilter] = useState('All');
  const [connectionTypeFilter, setConnectionTypeFilter] = useState('All');
  const [onlineRefillPaymentStatusFilter, setOnlineRefillPaymentStatusFilter] = useState('All');


  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');
  const [cashMemoDateStart, setCashMemoDateStart] = useState('');
  const [cashMemoDateEnd, setCashMemoDateEnd] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // New Filter states
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSourceFilter, setOrderSourceFilter] = useState('All');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [cashMemoStatusFilter, setCashMemoStatusFilter] = useState('All');
  const [deliveryManFilter, setDeliveryManFilter] = useState('All');
  const [isRegMobileFilter, setIsRegMobileFilter] = useState('All');

  // Unique options for filters
  const [uniqueEkycStatuses, setUniqueEkycStatuses] = useState([]);
  const [uniqueAreas, setUniqueAreas] = useState([]);
  const [uniqueNatures, setUniqueNatures] = useState([]);
  const [uniqueMobileStatuses, setUniqueMobileStatuses] = useState([]);
  const [uniqueConsumerStatuses, setUniqueConsumerStatuses] = useState([]);
  const [uniqueConnectionTypes, setUniqueConnectionTypes] = useState([]);
  const [uniqueOnlineRefillPaymentStatuses, setUniqueOnlineRefillPaymentStatuses] = useState([]);



  // New Unique options for filters
  const [uniqueOrderStatuses, setUniqueOrderStatuses] = useState([]);
  const [uniqueOrderSources, setUniqueOrderSources] = useState([]);
  const [uniqueOrderTypes, setUniqueOrderTypes] = useState([]);
  const [uniqueCashMemoStatuses, setUniqueCashMemoStatuses] = useState([]);
  const [uniqueDeliveryMen, setUniqueDeliveryMen] = useState([]);
  const [uniqueIsRegMobileStatuses, setUniqueIsRegMobileStatuses] = useState([]);

  const defaultVisibleHeaders = [
    'Consumer No.',
    'Consumer Name',
    'Delivery Area',
    'Mobile No.',
    'Order Date',
    'Cash Memo Date',
    'Online Refill Payment status',
    'EKYC Status'
  ];

  const handleFileUpload = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target.result;
      if (file.name.endsWith('.csv')) {
        Papa.parse(data, {
          header: true,
          complete: (results) => {
            if (results.data.length > 0) {
              const allHeaders = Object.keys(results.data[0]);
              setHeaders(allHeaders);
              setParsedData(results.data);
              setVisibleHeaders(defaultVisibleHeaders.filter(header => allHeaders.includes(header))); // Set default visible headers

              // Extract unique values for filters
              setUniqueEkycStatuses([...new Set(results.data.map(row => row['EKYC Status']).filter(Boolean))]);
              setUniqueAreas([...new Set(results.data.map(row => row['Delivery Area']).filter(Boolean))]);
              setUniqueNatures([...new Set(results.data.map(row => row['Consumer Nature']).filter(Boolean))]);
              setUniqueMobileStatuses([...new Set(results.data.map(row => row['Mobile No.'] ? 'Available' : 'Not Available').filter(Boolean))]); // Example for Mobile Status
              setUniqueConsumerStatuses([...new Set(results.data.map(row => row['Consumer Type']).filter(Boolean))]);
              setUniqueConnectionTypes([...new Set(results.data.map(row => row['Consumer Package']).filter(Boolean))]);
              setUniqueOnlineRefillPaymentStatuses([...new Set(results.data.map(row => row['Online Refill Payment status']).filter(Boolean))]);


              // New unique options for filters
              setUniqueOrderStatuses([...new Set(results.data.map(row => row['Order Status']).filter(Boolean))]);
              setUniqueOrderSources([...new Set(results.data.map(row => row['Order Source']).filter(Boolean))]);
              setUniqueOrderTypes([...new Set(results.data.map(row => row['Order Type']).filter(Boolean))]);
              setUniqueCashMemoStatuses([...new Set(results.data.map(row => row['Cash Memo Status']).filter(Boolean))]);
              setUniqueDeliveryMen([...new Set(results.data.map(row => row['Delivery Man']).filter(Boolean))]);
              setUniqueIsRegMobileStatuses([...new Set(results.data.map(row => row['Is Reg Mobile'] ? 'Yes' : 'No').filter(Boolean))]);
            } else {
              setHeaders([]);
              setParsedData([]);
              setVisibleHeaders([]);
              // Clear unique options as well
              setUniqueEkycStatuses([]);
              setUniqueAreas([]);
              setUniqueNatures([]);
              setUniqueMobileStatuses([]);
              setUniqueConsumerStatuses([]);
              setUniqueConnectionTypes([]);
            }
            setSelectedCustomerIds([]);
            setCustomersToPrint([]); // Clear customers to print on new file upload
            setSelectedCustomerIds([]); // Clear selected customer IDs on new file upload
          },
          error: (error) => {
            console.error('CSV पार्स करने में त्रुटि:', error);
            alert('CSV फ़ाइल को पार्स करने में त्रुटि हुई।');
          }
        });
      } else if (file.name.endsWith('.xlsx')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length > 0) {
          const allHeaders = json[0];
          setHeaders(allHeaders);
          setParsedData(json.slice(1).map(row => {
            const rowObject = {};
            json[0].forEach((header, index) => {
              rowObject[header] = row[index];
            });
            return rowObject;
          }));
          setVisibleHeaders(defaultVisibleHeaders.filter(header => allHeaders.includes(header))); // Set default visible headers

          // Extract unique values for filters
          setUniqueEkycStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('EKYC Status')]).filter(Boolean))]);
          setUniqueAreas([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Delivery Area')]).filter(Boolean))]);
          setUniqueNatures([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Nature')]).filter(Boolean))]);
          setUniqueMobileStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Mobile No.')] ? 'Available' : 'Not Available').filter(Boolean))]);
          setUniqueConsumerStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Type')]).filter(Boolean))]);
          setUniqueConnectionTypes([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Package')]).filter(Boolean))]);
          setUniqueOnlineRefillPaymentStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Online Refill Payment status')]).filter(Boolean))]);


          // New unique options for filters
          setUniqueOrderStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Status')]).filter(Boolean))]);
          setUniqueOrderSources([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Source')]).filter(Boolean))]);
          setUniqueOrderTypes([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Type')]).filter(Boolean))]);
          setUniqueCashMemoStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Cash Memo Status')]).filter(Boolean))]);
          setUniqueDeliveryMen([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Delivery Man')]).filter(Boolean))]);
          setUniqueIsRegMobileStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Is Reg Mobile')] ? 'Yes' : 'No').filter(Boolean))]);
        } else {
          setHeaders([]);
          setParsedData([]);
          setVisibleHeaders([]);
          // Clear unique options as well
          setUniqueEkycStatuses([]);
          setUniqueAreas([]);
          setUniqueNatures([]);
          setUniqueMobileStatuses([]);
          setUniqueConsumerStatuses([]);
          setUniqueConnectionTypes([]);
        }
        setSelectedCustomerIds([]);
        setCustomersToPrint([]); // Clear customers to print on new file upload
      }
    };

    reader.onerror = (error) => {
      console.error('फ़ाइल पढ़ने में त्रुटि:', error);
      alert('फ़ाइल पढ़ने में त्रुटि हुई।');
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };




  const handleResetFilters = () => {
    setSearchTerm('');
    setEKycFilter('All');
    setAreaFilter('All');
    setNatureFilter('All');
    setMobileStatusFilter('All');
    setConsumerStatusFilter('All');
    setConnectionTypeFilter('All');
    setOnlineRefillPaymentStatusFilter('All');


    setOrderDateStart('');
    setOrderDateEnd('');
    setCashMemoDateStart('');
    setCashMemoDateEnd('');
    setSortBy('');
    setSortOrder('asc');
    setOrderStatusFilter('All');
    setOrderSourceFilter('All');
    setOrderTypeFilter('All');
    setCashMemoStatusFilter('All');
    setDeliveryManFilter('All');
    setIsRegMobileFilter('All');
    setCurrentPage(1);
    setSelectedCustomerIds([]); // Clear selected customer IDs on reset
  };

  const handlePrintData = () => {
    const printContent = `
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
      <h1>Available Data</h1>
      <table>
        <thead>
          <tr>
            ${visibleHeaders.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${currentTableData.map(row => `
            <tr>
              ${visibleHeaders.map(header => `<td>${row[header]}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintCashmemo = () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select at least one cashmemo to print.');
      return;
    }

    const customersToPrint = parsedData.filter(customer =>
      selectedCustomerIds.includes(String(customer['Consumer No.']))
    );

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cash Memos</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; }
          </style>
        </head>
        <body>
          <div id="print-root" style="display: flex; flex-wrap: wrap; align-content: flex-start;"></div>
        </body>
      </html>
    `);
    printWindow.document.close();

    const printRoot = printWindow.document.getElementById('print-root');
    customersToPrint.forEach((customer, index) => {
      const wrapperDiv = printWindow.document.createElement('div');
      let wrapperStyles = {
        width: '100%',
        boxSizing: 'border-box',
        padding: '5mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      };

      if (pageType === 'A4 3 Cashmemo/Page') {
        wrapperStyles.height = '97.66mm'; // A4 height (297mm) / 3 - 2mm margin
        if ((index + 1) % 3 !== 0) { // Add margin-bottom for all but the last cashmemo on the page
          wrapperStyles.marginBottom = '2mm';
        }
        if ((index + 1) % 3 === 0) {
          wrapperStyles.pageBreakAfter = 'always';
        }
      } else if (pageType === 'Lager 4 Cashmemo/Page') {
        wrapperStyles.height = '72.75mm'; // A4 height (297mm) / 4 - 2mm margin
        if ((index + 1) % 4 !== 0) { // Add margin-bottom for all but the last cashmemo on the page
          wrapperStyles.marginBottom = '2mm';
        }
        if ((index + 1) % 4 === 0) {
          wrapperStyles.pageBreakAfter = 'always';
        }
      }

      Object.assign(wrapperDiv.style, wrapperStyles);
      printRoot.appendChild(wrapperDiv);
      const root = createRoot(wrapperDiv);
      root.render(<CashMemoEnglish customer={customer} pageType={pageType} dealerDetails={sampleDealerDetails} />);
    });

    // Wait for images and other resources to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleCheckboxChange = (consumerNo) => {
    setSelectedCustomerIds(prev => {
      const stringConsumerNo = String(consumerNo);
      if (prev.includes(stringConsumerNo)) {
        return prev.filter(id => id !== stringConsumerNo);
      } else {
        return [...prev, stringConsumerNo];
      }
    });
  };

  const handleSelectAllChange = (event) => {
    if (event.target.checked) {
      const allConsumerNos = filteredData.map(customer => String(customer['Consumer No.']));
      setSelectedCustomerIds(allConsumerNos);
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const filteredData = useMemo(() => {

    let tempFilteredData = parsedData.filter(row => {
      const consumerNo = String(row['Consumer No.']);
      return /^\d{6}$/.test(consumerNo);
    });

    // Search Term Filter
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      tempFilteredData = tempFilteredData.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(lowercasedSearchTerm)
        )
      );
    }

    // Dropdown Filters
    if (eKycFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['EKYC Status'] === eKycFilter);
    }
    if (areaFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Area'] === areaFilter);
    }
    if (natureFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Nature'] === natureFilter);
    }
    if (mobileStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        mobileStatusFilter === 'Available' ? (row['Mobile No.'] && row['Mobile No.'] !== '') : (!row['Mobile No.'] || row['Mobile No.'] === '')
      );
    }
    if (consumerStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Type'] === consumerStatusFilter);
    }
    if (connectionTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Package'] === connectionTypeFilter);
    }
    if (onlineRefillPaymentStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Online Refill Payment status'] === onlineRefillPaymentStatusFilter);
    }



    // New Dropdown Filters
    if (orderStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Status'] === orderStatusFilter);
    }
    if (orderSourceFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Source'] === orderSourceFilter);
    }
    if (orderTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Type'] === orderTypeFilter);
    }
    if (cashMemoStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Cash Memo Status'] === cashMemoStatusFilter);
    }
    if (deliveryManFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Man'] === deliveryManFilter);
    }
    if (isRegMobileFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        isRegMobileFilter === 'Yes' ? (row['Is Reg Mobile'] && row['Is Reg Mobile'] !== '') : (!row['Is Reg Mobile'] || row['Is Reg Mobile'] === '')
      );
    }

    // Date Range Filters
    // Order Date (assuming 'Order Date' is the order date)
    if (orderDateStart && orderDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const rowDate = row['Order Date'];
        if (!rowDate) return false; // Skip if date is not available

        // Convert Excel serial date to JS Date object if it's a number, otherwise try to parse directly
        const convertedRowDate = typeof rowDate === 'number' ? excelSerialDateToJSDate(rowDate) : new Date(rowDate);

        if (!convertedRowDate || isNaN(convertedRowDate.getTime())) return false; // Skip if conversion failed

        const orderDate = convertedRowDate;
        const start = new Date(orderDateStart);
        const end = new Date(orderDateEnd);
        end.setHours(23, 59, 59, 999);
        // Set time to 00:00:00 for accurate date comparison
        orderDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return orderDate >= start && orderDate <= end;
      });
    }

    // Cash Memo Date
    if (cashMemoDateStart && cashMemoDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const rowDate = row['Cash Memo Date'];
        if (!rowDate) return false; // Skip if date is not available

        // Convert Excel serial date to JS Date object if it's a number, otherwise try to parse directly
        const convertedRowDate = typeof rowDate === 'number' ? excelSerialDateToJSDate(rowDate) : new Date(rowDate);

        if (!convertedRowDate || isNaN(convertedRowDate.getTime())) return false; // Skip if conversion failed

        const cashMemoDate = convertedRowDate;
        const start = new Date(cashMemoDateStart);
        const end = new Date(cashMemoDateEnd);
        end.setHours(23, 59, 59, 999);
        // Set time to 00:00:00 for accurate date comparison
        cashMemoDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return cashMemoDate >= start && cashMemoDate <= end;
      });
    }

    // Sorting
    if (sortBy) {
      tempFilteredData = [...tempFilteredData].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (aValue === undefined || aValue === null) return sortOrder === 'asc' ? 1 : -1;
        if (bValue === undefined || bValue === null) return sortOrder === 'asc' ? -1 : 1;

        // Handle date sorting
        if (sortBy === 'Order Date' || sortBy === 'Cash Memo Date') {
          const dateA = new Date(aValue);
          const dateB = new Date(bValue);
          return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
        // Fallback for other types or mixed types
        return 0;
      });
    }

    return tempFilteredData;
  }, [
    parsedData,
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,


    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
  ]);

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
  ]);



  // Calculate total pages
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Get current page data
  const currentTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const addColumn = (header) => {
    if (!visibleHeaders.includes(header)) {
      setVisibleHeaders(prev => [...prev, header]);
    }
  };

  const removeColumn = (header) => {
    setVisibleHeaders(prev => prev.filter(h => h !== header));
  };

  const availableHeadersToAdd = headers.filter(header => !visibleHeaders.includes(header));

  return (
    <>
      <h1>Cash Memo Printer</h1>
      <style>{`
        input[type="checkbox"] {
          -webkit-appearance: checkbox;
          -moz-appearance: checkbox;
          appearance: checkbox;
          width: 16px;
          height: 16px;
          border: 1px solid #ccc;
          background-color: #fff;
          vertical-align: middle;
          position: relative;
        }

        input[type="checkbox"]:checked::before {
          content: '✔';
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          color: #000; /* Or any color that makes it visible */
        }
      `}</style>
      <FileUpload onFileUpload={handleFileUpload} />

      {parsedData.length > 0 && (
        <div style={{ marginTop: '20px' }}>





          {/* New Filter UI */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            {/* eKYC Filter */}
            <select value={eKycFilter} onChange={(e) => setEKycFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All eKYC</option>
              {uniqueEkycStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Area Filter */}
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Areas</option>
              {uniqueAreas.map((area, index) => (
                <option key={index} value={area}>{area}</option>
              ))}
            </select>

            {/* Nature Filter */}
            <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Nature</option>
              {uniqueNatures.map((nature, index) => (
                <option key={index} value={nature}>{nature}</option>
              ))}
            </select>

            {/* Mobile Status Filter */}
            <select value={mobileStatusFilter} onChange={(e) => setMobileStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Mobile Status</option>
              {uniqueMobileStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Consumer Status Filter */}
            <select value={consumerStatusFilter} onChange={(e) => setConsumerStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Consumer Status</option>
              {uniqueConsumerStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Connection Type Filter */}
            <select value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Connection Types</option>
              {uniqueConnectionTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>

            {/* Online Refill Payment Status Filter */}
            <select value={onlineRefillPaymentStatusFilter} onChange={(e) => setOnlineRefillPaymentStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Online Refill Payment Status</option>
              {uniqueOnlineRefillPaymentStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>





            {/* Order Status Filter */}
            <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Status</option>
              {uniqueOrderStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Order Source Filter */}
            <select value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Source</option>
              {uniqueOrderSources.map((source, index) => (
                <option key={index} value={source}>{source}</option>
              ))}
            </select>

            {/* Order Type Filter */}
            <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Type</option>
              {uniqueOrderTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>

            {/* Cash Memo Status Filter */}
            <select value={cashMemoStatusFilter} onChange={(e) => setCashMemoStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Cash Memo Status</option>
              {uniqueCashMemoStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Delivery Man Filter */}
            <select value={deliveryManFilter} onChange={(e) => setDeliveryManFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Delivery Man</option>
              {uniqueDeliveryMen.map((man, index) => (
                <option key={index} value={man}>{man}</option>
              ))}
            </select>

            {/* Is Reg Mobile Filter */}
            <select value={isRegMobileFilter} onChange={(e) => setIsRegMobileFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Is Reg Mobile</option>
              {uniqueIsRegMobileStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Refill Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <span>Order date</span>
              <input type="date" value={orderDateStart} onChange={(e) => setOrderDateStart(e.target.value)} style={{ border: 'none', outline: 'none' }} />
              <span>to</span>
              <input type="date" value={orderDateEnd} onChange={(e) => setOrderDateEnd(e.target.value)} style={{ border: 'none', outline: 'none' }} />
            </div>

            {/* Cash Memo Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <span>Cash Memo Date</span>
              <input type="date" value={cashMemoDateStart} onChange={(e) => setCashMemoDateStart(e.target.value)} style={{ border: 'none', outline: 'none' }} />
              <span>to</span>
              <input type="date" value={cashMemoDateEnd} onChange={(e) => setCashMemoDateEnd(e.target.value)} style={{ border: 'none', outline: 'none' }} />
            </div>

            {/* Sort By */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="">Sort By</option>
              {headers.map((header, index) => (
                <option key={index} value={header}>{header}</option>
              ))}
            </select>

            {/* Sort Order */}
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>

            <button onClick={() => { /* filteredData useMemo will react to state changes */ }} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>Filter</button>
            <button onClick={handleResetFilters} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#6c757d', color: 'white', cursor: 'pointer' }}>Reset Filters</button>
          </div>

          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <input type="text" placeholder="Search within data..." value={searchTerm} onChange={handleSearchChange} style={{ padding: '8px', width: '300px' }} />

            <label htmlFor="addColumnSelect">Add Column:</label>
            <select id="addColumnSelect" onChange={(e) => addColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {availableHeadersToAdd.map(header => <option key={header} value={header}>{header}</option>)}
            </select>
            <label htmlFor="removeColumnSelect">Remove Column:</label>
            <select id="removeColumnSelect" onChange={(e) => removeColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {visibleHeaders.map(header => <option key={header} value={header}>{header}</option>)}
            </select>

            {/* Page Type Dropdown */}
            <label htmlFor="pageTypeSelect">Page Type:</label>
            <select id="pageTypeSelect" onChange={(e) => setPageType(e.target.value)} value={pageType}>
              <option value="A4 3 Cashmemo/Page">A4 3 Cashmemo/Page</option>
              <option value="Lager 4 Cashmemo/Page">Lager 4 Cashmemo/Page</option>
            </select>
            <button onClick={handlePrintData} style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Print Data</button>
            <button onClick={handlePrintCashmemo} style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Print Cashmemo</button>
            </div>

          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table>
            <thead>
              <tr>
                    <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        onChange={handleSelectAllChange}
                        checked={selectedCustomerIds.length === currentTableData.length && currentTableData.length > 0}
                      />
                    </th>
                    {visibleHeaders.map((header, index) => (
                  <th key={index} style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                    {header}
                  </th>
                ))}
  
              </tr>
            </thead>
            <tbody>
                  {currentTableData.map((customer, index) => (
                    <tr key={index} style={{ border: '1px solid black' }}>
                      <td style={{ border: '1px solid black', padding: '8px' }}>
                        <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(String(customer['Consumer No.']))}
                            onChange={() => handleCheckboxChange(customer['Consumer No.'])}
                          />
                      </td>
                  {visibleHeaders.map((header, colIndex) => {
                        return (
                          <td key={colIndex} style={{ border: '1px solid black', padding: '8px' }}>
                            {String(
                                header === 'Online Refill Payment status'
                                   ? (customer[header] === 'PAID' ? 'PAID' : 'COD')
                                   : (header === 'IVR Booking No.' && customer[header] === undefined
                                     ? ''
                                     : (header === 'Order Date' || header === 'Cash Memo Date'
                                       ? formatDateToDDMMYYYY(excelSerialDateToJSDate(customer[header]))
                                       : customer[header]))
                               )}
                          </td>
                        );
                      })}
                </tr>
              ))}
            </tbody>
          </table>

        <div className="pagination">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
        </div>
      </div>
        </div>
      )}

      {customersToPrint.length > 0 && (
        <div style={{ marginTop: '40px' }}>

          <div ref={cashMemoRef}>
            {customersToPrint.map((item, index) => (
              <div
                key={index}
                style={{
                  pageBreakAfter:
                    pageType === 'A4 3 Cashmemo/Page'
                      ? (index + 1) % 3 === 0 ? 'always' : 'auto'
                      : (index + 1) % 4 === 0 ? 'always' : 'auto',
                }}
              >
                  <CashMemoEnglish customerData={item.customer} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default App;

