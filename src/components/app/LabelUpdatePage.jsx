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
  const visibleLabelCount = CASHMEMO_LABEL_OPTIONS.filter((item) => activeSettings[item.key] !== false).length;

  return (
    <div className="placeholder-container label-update-page">
      <div className="label-update-header">
        <div className="label-update-title">
          <div className="label-update-title__icon" aria-hidden="true">Aa</div>
          <div>
            <h2>Label Update</h2>
            <p>Cashmemo print mein दिखाई देने वाले labels ko page type ke हिसाब se manage karein.</p>
          </div>
        </div>
        <div className="label-update-actions">
          <label className="label-update-page-type">Page layout<select className="form-input" value={labelUpdatePageType} onChange={(e) => setLabelUpdatePageType(e.target.value)}>
            {CASHMEMO_PAGE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select></label>
          <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, true)}>Select All</button>
          <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, false)}>Clear All</button>
          <button type="button" onClick={() => resetCashMemoLabelsForPage(labelUpdatePageType)}>Reset Default</button>
        </div>
      </div>

      <div className="label-update-summary">
        <strong>{labelUpdatePageType}</strong>
        <span>{visibleLabelCount} of {CASHMEMO_LABEL_OPTIONS.length} labels visible</span>
        <small>Unchecked labels sirf print se hide honge; original data सुरक्षित रहेगा।</small>
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

      <div className="form-actions label-update-footer">
        <button onClick={handleSaveCashMemoLabels}>Save Label Settings</button>
        <button onClick={() => {
          setLabelDraftSettings(mergeCashMemoLabelSettings(cashMemoLabelSettings));
          navigateToHome();
        }}>Close</button>
      </div>
    </div>
  );
};

export default LabelUpdatePage;
