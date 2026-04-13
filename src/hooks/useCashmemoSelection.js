import { useMemo, useState } from 'react';

import {
  areAllFilteredRowsSelected,
  getSelectedCustomersForPrint,
  toggleCustomerSelection,
  toggleSelectAllFiltered,
} from '../utils/printSelection';

export const useCashmemoSelection = (filteredData) => {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);

  const isAllFilteredRowsSelected = useMemo(
    () => areAllFilteredRowsSelected(filteredData, selectedCustomerIds),
    [filteredData, selectedCustomerIds]
  );

  const selectedCustomersForPrint = useMemo(
    () => getSelectedCustomersForPrint(filteredData, selectedCustomerIds),
    [filteredData, selectedCustomerIds]
  );

  const handleCheckboxChange = (consumerNo) => {
    setSelectedCustomerIds((prev) => toggleCustomerSelection(prev, consumerNo));
  };

  const handleSelectAllChange = () => {
    setSelectedCustomerIds((prev) => toggleSelectAllFiltered(prev, filteredData));
  };

  const clearSelection = () => {
    setSelectedCustomerIds([]);
  };

  return {
    selectedCustomerIds,
    setSelectedCustomerIds,
    isAllFilteredRowsSelected,
    selectedCustomersForPrint,
    handleCheckboxChange,
    handleSelectAllChange,
    clearSelection,
  };
};
