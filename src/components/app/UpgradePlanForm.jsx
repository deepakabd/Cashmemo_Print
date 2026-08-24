import { useState } from 'react';
import { PACKAGE_PRICING, PAYMENT_UPI_ID } from '../../utils/appConfig';
import { formatDisplayDate } from '../../utils/dateHelpers';
import { formatPackageNameForNavbar, formatPackageOptionLabel } from '../../utils/packageHelpers';

const UpgradePlanForm = ({ onClose, loggedInUser, submitUpdateApprovalRequest, logRecentActivity, planUpgradeOptions }) => {
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
    <div className="placeholder-container auth-panel upgrade-plan-panel">
      <div className="auth-panel__hero">
        <div>
          <span className="auth-panel__eyebrow">Plan Renewal</span>
          <h2>Upgrade Plan</h2>
          <p className="auth-panel__subtitle">
            Naya package select kijiye, payment details bhariye, aur request admin approval ke liye bhejiye.
          </p>
        </div>
        <div className="auth-panel__hero-badges">
          <span className="auth-panel__badge">Approval based</span>
          <span className="auth-panel__badge">Secure payment proof</span>
        </div>
      </div>
      <div className="auth-panel__content auth-panel__content--wide">
        <div className="auth-section-card">
          <div className="auth-section-card__header">
            <h3>Renewal Details</h3>
            <p>Current plan review karke next package aur payment reference submit kijiye.</p>
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
              <label className="auth-field-label">Payment UPI ID</label>
              <div className="upgrade-plan-upi">{PAYMENT_UPI_ID}</div>
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
          <div className="upi-note upi-note--card">UPI ID for Payment: {PAYMENT_UPI_ID}</div>
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