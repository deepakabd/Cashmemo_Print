import { useEffect, useRef, useState } from 'react';

import { getMultiFilterValues } from './getMultiFilterValues';

const MultiValueFilterSelect = ({
  placeholder,
  options,
  value,
  onChange,
  searchable = false,
  searchPlaceholder = 'Type to search',
  showSelectAll = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const selectedValues = getMultiFilterValues(value);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleOptions = searchable && normalizedSearch
    ? options.filter((option) => String(option || '').trim().toLowerCase().includes(normalizedSearch))
    : options;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const nextOpen = !prev;
      if (!nextOpen && searchTerm) {
        setSearchTerm('');
      }
      return nextOpen;
    });
  };

  const toggleValue = (option, checked) => {
    const normalizedOption = String(option || '').trim();
    if (!normalizedOption) return;
    const nextValues = checked
      ? [...new Set([...selectedValues, normalizedOption])]
      : selectedValues.filter((item) => item !== normalizedOption);
    onChange(nextValues.length > 0 ? nextValues : 'All');
  };

  const visibleOptionValues = visibleOptions
    .map((option) => String(option || '').trim())
    .filter(Boolean);
  const isAllVisibleSelected = visibleOptionValues.length > 0
    && visibleOptionValues.every((option) => selectedValues.includes(option));

  const toggleSelectAllVisible = (checked) => {
    const nextValues = checked
      ? [...new Set([...selectedValues, ...visibleOptionValues])]
      : selectedValues.filter((item) => !visibleOptionValues.includes(item));
    onChange(nextValues.length > 0 ? nextValues : 'All');
  };

  const sanitizeId = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

  const buttonLabel = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues[0]} +${selectedValues.length - 1}`;

  return (
    <div className={`multi-filter ${isOpen ? 'is-open' : ''}`} ref={containerRef}>
      <button type="button" className="multi-filter__trigger" onClick={toggleOpen}>
        <span>{buttonLabel}</span>
        <strong>{isOpen ? '^' : 'v'}</strong>
      </button>
      {isOpen && (
        <div className="multi-filter__menu">
          {searchable && (
            <input
              type="text"
              className="multi-filter__search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
            />
          )}
          {showSelectAll && (
            <label className={`multi-filter__option multi-filter__option--select-all ${isAllVisibleSelected ? 'is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={(event) => toggleSelectAllVisible(event.target.checked)}
              />
              <span>Select all</span>
            </label>
          )}
          <button
            type="button"
            className={`multi-filter__option multi-filter__option--clear ${selectedValues.length === 0 ? 'is-selected' : ''}`}
            onClick={() => {
              onChange('All');
              setSearchTerm('');
              setIsOpen(false);
            }}
          >
            Clear selection
          </button>
          {visibleOptions.map((option, index) => {
            const normalizedOption = String(option || '').trim();
            const optionId = `${sanitizeId(placeholder)}-${sanitizeId(normalizedOption)}-${index}`;
            const isSelected = selectedValues.includes(normalizedOption);
            return (
              <label key={optionId} className={`multi-filter__option ${isSelected ? 'is-selected' : ''}`}>
                <input
                  id={optionId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) => toggleValue(normalizedOption, event.target.checked)}
                />
                <span>{normalizedOption}</span>
              </label>
            );
          })}
          {visibleOptions.length === 0 && (
            <div className="multi-filter__empty">No matching options found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiValueFilterSelect;
