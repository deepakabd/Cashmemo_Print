import { useEffect, useRef, useState } from 'react';

import { getMultiFilterValues } from './getMultiFilterValues';

const MultiValueFilterSelect = ({
  placeholder,
  options,
  value,
  onChange,
  searchable = false,
  searchPlaceholder = 'Type to search',
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

  const toggleValue = (option) => {
    const normalizedOption = String(option || '').trim();
    if (!normalizedOption) return;
    const nextValues = selectedValues.includes(normalizedOption)
      ? selectedValues.filter((item) => item !== normalizedOption)
      : [...selectedValues, normalizedOption];
    onChange(nextValues.length > 0 ? nextValues : 'All');
  };

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
          {visibleOptions.map((option) => {
            const normalizedOption = String(option || '').trim();
            const isSelected = selectedValues.includes(normalizedOption);
            return (
              <label key={normalizedOption} className={`multi-filter__option ${isSelected ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleValue(normalizedOption)}
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
