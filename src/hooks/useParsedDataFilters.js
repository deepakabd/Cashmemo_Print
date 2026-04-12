import { useState } from 'react';

export const useParsedDataFilters = ({
  normalizeData,
  sortedUniqueValues,
  defaultVisibleHeaders,
  hideAllViews,
}) => {
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [visibleHeaders, setVisibleHeaders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [pageType, setPageType] = useState('3 Cashmemo/Page');
  const [printLanguage, setPrintLanguage] = useState('English');
  const [showDataButton, setShowDataButton] = useState(false);
  const [showParsedData, setShowParsedData] = useState(false);
  const [fileUploadMessage, setFileUploadMessage] = useState('');
  const [showBookingReport, setShowBookingReport] = useState(true);

  const [eKycFilter, setEKycFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [natureFilter, setNatureFilter] = useState('All');
  const [mobileStatusFilter, setMobileStatusFilter] = useState('All');
  const [consumerStatusFilter, setConsumerStatusFilter] = useState('All');
  const [connectionTypeFilter, setConnectionTypeFilter] = useState('All');
  const [onlineRefillPaymentStatusFilter, setOnlineRefillPaymentStatusFilter] = useState('All');
  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');
  const [cashMemoDateStart, setCashMemoDateStart] = useState('');
  const [cashMemoDateEnd, setCashMemoDateEnd] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeReportFilter, setActiveReportFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSourceFilter, setOrderSourceFilter] = useState('All');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [cashMemoStatusFilter, setCashMemoStatusFilter] = useState('All');
  const [deliveryManFilter, setDeliveryManFilter] = useState('All');
  const [isRegMobileFilter, setIsRegMobileFilter] = useState('All');

  const [uniqueEkycStatuses, setUniqueEkycStatuses] = useState([]);
  const [uniqueAreas, setUniqueAreas] = useState([]);
  const [uniqueNatures, setUniqueNatures] = useState([]);
  const [uniqueMobileStatuses, setUniqueMobileStatuses] = useState([]);
  const [uniqueConsumerStatuses, setUniqueConsumerStatuses] = useState([]);
  const [uniqueConnectionTypes, setUniqueConnectionTypes] = useState([]);
  const [uniqueOnlineRefillPaymentStatuses, setUniqueOnlineRefillPaymentStatuses] = useState([]);
  const [uniqueOrderStatuses, setUniqueOrderStatuses] = useState([]);
  const [uniqueOrderSources, setUniqueOrderSources] = useState([]);
  const [uniqueOrderTypes, setUniqueOrderTypes] = useState([]);
  const [uniqueCashMemoStatuses, setUniqueCashMemoStatuses] = useState([]);
  const [uniqueDeliveryMen, setUniqueDeliveryMen] = useState([]);
  const [uniqueIsRegMobileStatuses, setUniqueIsRegMobileStatuses] = useState([]);

  const handleFileUpload = async (file) => {
    if (!file) return;

    const processAndSetData = (data) => {
      const normalizedData = normalizeData(data);
      setParsedData(normalizedData);

      if (normalizedData.length > 0) {
        const firstRow = normalizedData[0];
        const nextHeaders = Object.keys(firstRow);
        setHeaders(nextHeaders);
        setVisibleHeaders(defaultVisibleHeaders);
        setUniqueEkycStatuses(sortedUniqueValues(normalizedData.map((row) => row['EKYC Status'])));
        setUniqueAreas(sortedUniqueValues(normalizedData.map((row) => row['Delivery Area'])));
        setUniqueNatures(sortedUniqueValues(normalizedData.map((row) => row['Consumer Nature'])));
        setUniqueMobileStatuses(sortedUniqueValues(['Available', 'Not Available']));
        setUniqueConsumerStatuses(sortedUniqueValues(normalizedData.map((row) => row['Consumer Type'])));
        setUniqueConnectionTypes(sortedUniqueValues(normalizedData.map((row) => row['Consumer Package'])));
        setUniqueOnlineRefillPaymentStatuses(sortedUniqueValues(normalizedData.map((row) => row['Online Refill Payment status'])));
        setUniqueOrderStatuses(sortedUniqueValues(normalizedData.map((row) => row['Order Status'])));
        setUniqueOrderSources(sortedUniqueValues(normalizedData.map((row) => row['Order Source'])));
        setUniqueOrderTypes(sortedUniqueValues(normalizedData.map((row) => row['Order Type'])));
        setUniqueCashMemoStatuses(sortedUniqueValues(normalizedData.map((row) => row['Cash Memo Status'])));
        setUniqueDeliveryMen(sortedUniqueValues(normalizedData.map((row) => row['Delivery Man'])));
        setUniqueIsRegMobileStatuses(sortedUniqueValues(['Yes', 'No']));
      }

      setShowDataButton(true);
      hideAllViews();
      setShowParsedData(true);
      setFileUploadMessage('File uploaded successfully!');
      setTimeout(() => setFileUploadMessage(''), 5000);
    };

    if (file.name.endsWith('.csv')) {
      const { default: Papa } = await import('papaparse');
      Papa.parse(file, {
        header: true,
        complete: (result) => processAndSetData(result.data),
        error: (error) => {
          console.error('Error parsing CSV file:', error);
          alert('Error parsing CSV file. Please try again.');
        },
      });
    } else if (file.name.endsWith('.xlsx')) {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        processAndSetData(json);
      };
      reader.readAsArrayBuffer(file);
    }
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
    setActiveReportFilter('');
    setCurrentPage(1);
  };

  return {
    parsedData,
    setParsedData,
    headers,
    setHeaders,
    visibleHeaders,
    setVisibleHeaders,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    pageType,
    setPageType,
    printLanguage,
    setPrintLanguage,
    showDataButton,
    setShowDataButton,
    showParsedData,
    setShowParsedData,
    fileUploadMessage,
    setFileUploadMessage,
    showBookingReport,
    setShowBookingReport,
    eKycFilter,
    setEKycFilter,
    areaFilter,
    setAreaFilter,
    natureFilter,
    setNatureFilter,
    mobileStatusFilter,
    setMobileStatusFilter,
    consumerStatusFilter,
    setConsumerStatusFilter,
    connectionTypeFilter,
    setConnectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    setOnlineRefillPaymentStatusFilter,
    orderDateStart,
    setOrderDateStart,
    orderDateEnd,
    setOrderDateEnd,
    cashMemoDateStart,
    setCashMemoDateStart,
    cashMemoDateEnd,
    setCashMemoDateEnd,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeReportFilter,
    setActiveReportFilter,
    orderStatusFilter,
    setOrderStatusFilter,
    orderSourceFilter,
    setOrderSourceFilter,
    orderTypeFilter,
    setOrderTypeFilter,
    cashMemoStatusFilter,
    setCashMemoStatusFilter,
    deliveryManFilter,
    setDeliveryManFilter,
    isRegMobileFilter,
    setIsRegMobileFilter,
    uniqueEkycStatuses,
    uniqueAreas,
    uniqueNatures,
    uniqueMobileStatuses,
    uniqueConsumerStatuses,
    uniqueConnectionTypes,
    uniqueOnlineRefillPaymentStatuses,
    uniqueOrderStatuses,
    uniqueOrderSources,
    uniqueOrderTypes,
    uniqueCashMemoStatuses,
    uniqueDeliveryMen,
    uniqueIsRegMobileStatuses,
    handleFileUpload,
    handleResetFilters,
  };
};
