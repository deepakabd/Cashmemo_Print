import { useState } from 'react';
import { PACKAGE_PRICING, PAYMENT_UPI_ID } from '../../utils/appConfig';
import { formatDisplayDate } from '../../utils/dateHelpers';
import { formatPackageNameForNavbar, formatPackageOptionLabel } from '../../utils/packageHelpers';

const UpgradePlanForm = ({ onClose, loggedInUser, submitUpdateApprovalRequest, logRecentActivity, planUpgradeOptions = [] }) => {
  const hasPendingUpgrade = String(loggedInUser?.pendingUpdates?.planUpgrade?.status || '').toLowerCase() === 'pending'
    || String(loggedInUser?.approvalStatus?.planUpgrade || '').toLowerCase() === 'pending';
  const [selectedPackage, setSelectedPackage] = useState(planUpgradeOptions[0] || '');
  const [paymentDetails, setPaymentDetails] = useState({
    utr: '',
    paymentDate: '',
    paymentNote: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentUpi, setShowPaymentUpi] = useState(false);

  const handlePaymentDetailsChange = (e) => {
    const { name, value } = e.target;
    setPaymentDetails((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '', selectedPackage: '' }));
  };

  const submitUpgradeRequest = async () => {
    const nextErrors = {};
    if (!selectedPackage) nextErrors.selectedPackage = 'Please select a plan.';
    if (!paymentDetails.utr.trim()) nextErrors.utr = 'UTR number is required.';
    if (!paymentDetails.paymentDate) nextErrors.paymentDate = 'Payment date is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSubmitting(true);
    const payload = {
      package: selectedPackage,
      packagePrice: PACKAGE_PRICING[selectedPackage] || '',
      currentPackage: loggedInUser?.package || '',
      currentValidTill: loggedInUser?.validTill || '',
      paymentUpiId: PAYMENT_UPI_ID,
      paymentUtr: paymentDetails.utr.trim(),
      paymentDate: paymentDetails.paymentDate,
      paymentNote: paymentDetails.paymentNote.trim(),
      requestedAt: new Date().toISOString(),
    };
    const ok = await submitUpdateApprovalRequest({
      type: 'planUpgrade',
      payload,
      successMessage: 'Plan upgrade request submitted. Your request is pending with admin for approval.',
    });
    setIsSubmitting(false);
    if (ok) {
      logRecentActivity('Submitted plan upgrade request');
      onClose();
    }
  };

  return (
    <div className="placeholder-container auth-panel auth-panel--register upgrade-plan-panel">
      <div className="auth-panel__hero">
        <div>
          <h2>Upgrade Plan</h2>
        </div>
      </div>
      <div className="auth-panel__content auth-panel__content--wide">
        <div className="auth-panel__upi-area">
          <span
            className="auth-panel__upi-text"
            role="button"
            tabIndex={0}
            onClick={() => setShowPaymentUpi(true)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setShowPaymentUpi(true); }}
          >
            UPI ID for Payment ▾
          </span>
        </div>
        {showPaymentUpi && (
          <div className="auth-panel__upi-flash" role="dialog" aria-modal="true" aria-label="UPI ID for payment" onClick={() => setShowPaymentUpi(false)}>
            <div className="auth-panel__upi-flash-card" onClick={(event) => event.stopPropagation()}>
              <span>UPI ID for Payment</span>
              <strong>{PAYMENT_UPI_ID}</strong>
              <button type="button" className="auth-panel__upi-hide" onClick={() => setShowPaymentUpi(false)}>Hide</button>
            </div>
          </div>
        )}
        <div className="auth-section-card">
          <div className="auth-section-card__header">
            <h3>Renewal Details</h3>
          </div>
          <div className="upgrade-plan-summary">
            <div className="upgrade-plan-summary__item">
              <span className="upgrade-plan-summary__label">Current Package</span>
              <strong>{formatPackageNameForNavbar(loggedInUser?.package)}</strong>
            </div>
            <div className="upgrade-plan-summary__item">
              <span className="upgrade-plan-summary__label">Expired On</span>
              <strong>{formatDisplayDate(loggedInUser?.validTill)}</strong>
            </div>
          </div>
          <form
            className="register-form register-form--enhanced"
            onSubmit={(e) => {
              e.preventDefault();
              submitUpgradeRequest();
            }}
          >
            <div>
              <label className="auth-field-label">Choose New Plan</label>
              <select
                className={`form-input${errors.selectedPackage ? ' form-input--error' : ''}`}
                value={selectedPackage}
                onChange={(e) => {
                  setSelectedPackage(e.target.value);
                  setErrors((prev) => ({ ...prev, selectedPackage: '' }));
                }}
                disabled={hasPendingUpgrade || isSubmitting}
              >
                {planUpgradeOptions.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {formatPackageOptionLabel(pkg)}
                  </option>
                ))}
              </select>
              {errors.selectedPackage && <div className="form-error">{errors.selectedPackage}</div>}
            </div>
            <div>
              <label className="auth-field-label">UTR Number</label>
              <input
                className={`form-input${errors.utr ? ' form-input--error' : ''}`}
                name="utr"
                value={paymentDetails.utr}
                onChange={handlePaymentDetailsChange}
                placeholder="Enter UTR / Transaction ID"
                disabled={hasPendingUpgrade || isSubmitting}
              />
              {errors.utr && <div className="form-error">{errors.utr}</div>}
            </div>
            <div>
              <label className="auth-field-label">Payment Date</label>
              <input
                className={`form-input${errors.paymentDate ? ' form-input--error' : ''}`}
                name="paymentDate"
                type="date"
                value={paymentDetails.paymentDate}
                onChange={handlePaymentDetailsChange}
                disabled={hasPendingUpgrade || isSubmitting}
              />
              {errors.paymentDate && <div className="form-error">{errors.paymentDate}</div>}
            </div>
            <div className="upgrade-plan-field upgrade-plan-field--full">
              <label className="auth-field-label">Payment Remark</label>
              <textarea
                className="form-textarea"
                name="paymentNote"
                value={paymentDetails.paymentNote}
                onChange={handlePaymentDetailsChange}
                placeholder="Optional payment note"
                disabled={hasPendingUpgrade || isSubmitting}
              />
            </div>
          </form>
          {hasPendingUpgrade && (
            <p className="upgrade-plan-pending">Your plan upgrade request is already pending with admin.</p>
          )}
          <div className="form-actions auth-panel__actions">
            <button className="auth-primary-button" onClick={submitUpgradeRequest} type="button" disabled={hasPendingUpgrade || isSubmitting}>{isSubmitting ? 'Submitting...' : 'Send Request'}</button>
            <button className="auth-secondary-button" onClick={onClose} disabled={isSubmitting}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanForm;
