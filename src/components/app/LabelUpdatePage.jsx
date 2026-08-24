import { CASHMEMO_LABEL_OPTIONS, CASHMEMO_PAGE_TYPES } from '../../utils/appConfig';
import { mergeCashMemoLabelSettings } from '../../utils/cashmemoHelpers';

const LabelUpdatePage = ({
  labelDraftSettings,
  labelUpdatePageType,
  setLabelUpdatePageType,
  setAllCashMemoLabelsForPage,
  resetCashMemoLabelsForPage,
  updateCashMemoLabelSetting,
  handleSaveCashMemoLabels,
  navigateToHome,
  cashMemoLabelSettings,
  setLabelDraftSettings,
}) => {
  const activeSettings = labelDraftSettings[labelUpdatePageType] || {};
  const groupedLabels = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="placeholder-container label-update-page">
      <div className="label-update-header">
        <div>
          <h2>Label Update</h2>
          <p>Cashmemo print labels, page type select.</p>
        </div>
        <div className="label-update-actions">
          <select className="form-input" value={labelUpdatePageType} onChange={(e) => setLabelUpdatePageType(e.target.value)}>
            {CASHMEMO_PAGE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, true)}>Select All</button>
          <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, false)}>Clear All</button>
          <button type="button" onClick={() => resetCashMemoLabelsForPage(labelUpdatePageType)}>Reset Default</button>
        </div>
      </div>

      <div className="label-update-grid">
        {Object.entries(groupedLabels).map(([group, items]) => (
          <section key={group} className="label-update-section">
            <h3>{group}</h3>
            <div className="label-checkbox-list">
              {items.map((item) => (
                <label key={item.key} className="label-checkbox-item">
                  <input
                    type="checkbox"
                    checked={activeSettings[item.key] !== false}
                    onChange={(e) => updateCashMemoLabelSetting(labelUpdatePageType, item.key, e.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="form-actions">
        <button onClick={handleSaveCashMemoLabels}>Save</button>
        <button onClick={() => {
          setLabelDraftSettings(mergeCashMemoLabelSettings(cashMemoLabelSettings));
          navigateToHome();
        }}>Close</button>
      </div>
    </div>
  );
};

export default LabelUpdatePage;
