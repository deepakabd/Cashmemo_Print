import MultiValueFilterSelect from './MultiValueFilterSelect';

const WorkspaceFilters = ({
  basicFilters,
  advancedFilters,
  controls,
}) => (
  <>
    <div className="filters-container filters-container--basic">
      <select className="filter-select" value={basicFilters.activeReportFilter || 'All'} onChange={(event) => basicFilters.setActiveReportFilter(event.target.value === 'All' ? '' : event.target.value)}>
        <option value="All">All Report Filters</option>
        {basicFilters.reportFilterOptions.map((item) => (
          <option key={item.key} value={item.key}>{item.label}</option>
        ))}
      </select>
      <MultiValueFilterSelect
        placeholder="All eKYC"
        options={basicFilters.availableEkycOptions}
        value={basicFilters.eKycFilter}
        onChange={basicFilters.setEKycFilter}
      />
      <MultiValueFilterSelect
        placeholder="All Areas"
        options={basicFilters.availableAreaOptions}
        value={basicFilters.areaFilter}
        onChange={basicFilters.setAreaFilter}
        searchable
        searchPlaceholder="Search area"
      />
      <select className="filter-select" value={basicFilters.onlineRefillPaymentStatusFilter} onChange={(event) => basicFilters.setOnlineRefillPaymentStatusFilter(event.target.value)}>
        <option value="All">All Online Refill Payment Status</option>
        {basicFilters.availableOnlinePaymentOptions.map((status, index) => (
          <option key={index} value={status}>{status}</option>
        ))}
      </select>
      <select className="filter-select" value={controls.sortBy} onChange={(event) => controls.setSortBy(event.target.value)}>
        <option value="">Sort By</option>
        {controls.headers.map((header, index) => (
          <option key={index} value={header}>{header}</option>
        ))}
      </select>
      <select className="filter-select" value={controls.sortOrder} onChange={(event) => controls.setSortOrder(event.target.value)}>
        <option value="asc">asc</option>
        <option value="desc">desc</option>
      </select>
      <div className="filters-reset-wrap">
        <button className="filter-action filter-action--secondary" onClick={controls.handleResetAllFilters}>Reset Filters</button>
      </div>
      <div className="filter-date-group filter-date-group--wide">
        <span className="filter-date-label">Order Date</span>
        <input className="filter-date-input filter-date-input--wide" type="date" value={basicFilters.orderDateStart} onChange={(event) => basicFilters.setOrderDateStart(event.target.value)} />
        <span className="filter-date-divider">to</span>
        <input className="filter-date-input filter-date-input--wide" type="date" value={basicFilters.orderDateEnd} onChange={(event) => basicFilters.setOrderDateEnd(event.target.value)} />
      </div>
    </div>

    {advancedFilters.showAdvancedFilters && (
      <div className="filters-container">
        <MultiValueFilterSelect
          placeholder="All Nature"
          options={advancedFilters.availableNatureOptions}
          value={advancedFilters.natureFilter}
          onChange={advancedFilters.setNatureFilter}
        />
        <select className="filter-select" value={advancedFilters.mobileStatusFilter} onChange={(event) => advancedFilters.setMobileStatusFilter(event.target.value)}>
          <option value="All">All Mobile Status</option>
          {advancedFilters.availableMobileStatusOptions.map((status, index) => (
            <option key={index} value={status}>{status}</option>
          ))}
        </select>
        <MultiValueFilterSelect
          placeholder="All Consumer Status"
          options={advancedFilters.availableConsumerStatusOptions}
          value={advancedFilters.consumerStatusFilter}
          onChange={advancedFilters.setConsumerStatusFilter}
        />
        <MultiValueFilterSelect
          placeholder="All Connection Types"
          options={advancedFilters.availableConnectionTypeOptions}
          value={advancedFilters.connectionTypeFilter}
          onChange={advancedFilters.setConnectionTypeFilter}
        />
        <select className="filter-select" value={advancedFilters.orderStatusFilter} onChange={(event) => advancedFilters.setOrderStatusFilter(event.target.value)}>
          <option value="All">All Order Status</option>
          {advancedFilters.availableOrderStatusOptions.map((status, index) => (
            <option key={index} value={status}>{status}</option>
          ))}
        </select>
        <MultiValueFilterSelect
          placeholder="All Order Source"
          options={advancedFilters.availableOrderSourceOptions}
          value={advancedFilters.orderSourceFilter}
          onChange={advancedFilters.setOrderSourceFilter}
        />
        <select className="filter-select" value={advancedFilters.orderTypeFilter} onChange={(event) => advancedFilters.setOrderTypeFilter(event.target.value)}>
          <option value="All">All Order Type</option>
          {advancedFilters.availableOrderTypeOptions.map((type, index) => (
            <option key={index} value={type}>{type}</option>
          ))}
        </select>
        <select className="filter-select" value={advancedFilters.cashMemoStatusFilter} onChange={(event) => advancedFilters.setCashMemoStatusFilter(event.target.value)}>
          <option value="All">All Cash Memo Status</option>
          {advancedFilters.availableCashMemoStatusOptions.map((status, index) => (
            <option key={index} value={status}>{status}</option>
          ))}
        </select>
        <MultiValueFilterSelect
          placeholder="All Delivery Man"
          options={advancedFilters.availableDeliveryManOptions}
          value={advancedFilters.deliveryManFilter}
          onChange={advancedFilters.setDeliveryManFilter}
        />
        <div className="filter-date-group filter-date-group--wide">
          <span className="filter-date-label">Cash Memo Date</span>
          <input className="filter-date-input filter-date-input--wide" type="date" value={advancedFilters.cashMemoDateStart} onChange={(event) => advancedFilters.setCashMemoDateStart(event.target.value)} />
          <span className="filter-date-divider">to</span>
          <input className="filter-date-input filter-date-input--wide" type="date" value={advancedFilters.cashMemoDateEnd} onChange={(event) => advancedFilters.setCashMemoDateEnd(event.target.value)} />
        </div>
      </div>
    )}
  </>
);

export default WorkspaceFilters;
