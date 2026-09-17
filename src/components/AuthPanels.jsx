import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase';
import { buildPinWritePatch } from '../auth/userAuth';
import BrandMark from './BrandMark';
import { clearLegacyRegistrationStorage, writeRegistrationRequestsCache } from '../utils/registrationStorage';

export const RegisterPanel = ({
  packageOptions,
  packagePricing,
  paymentUpiId,
  pushToast,
  logRecentActivity,
  onClose,
  onLogin,
}) => {
  useEffect(() => { clearLegacyRegistrationStorage(); }, []);
  const [form, setForm] = useState({
    package: '',
    dealerCode: '',
    dealerName: '',
    mobile: '',
    email: '',
    pin: '',
    confirmPin: '',
    utr: '',
    date: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentUpi, setShowPaymentUpi] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateRegisterForm = () => {
    const nextErrors = {};
    if (!form.package) nextErrors.package = 'Please select a package.';
    if (!form.dealerCode.trim()) nextErrors.dealerCode = 'Dealer code is required.';
    if (!form.dealerName.trim()) nextErrors.dealerName = 'Dealer name is required.';
    if (!/^\d{10}$/.test(form.mobile.trim())) nextErrors.mobile = 'Enter a valid 10-digit mobile number.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!/^\d{4}$/.test(form.pin.trim())) nextErrors.pin = 'PIN must be exactly 4 digits.';
    if (form.pin !== form.confirmPin) nextErrors.confirmPin = 'PIN and Confirm PIN do not match.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validateRegisterForm()) return;
    setIsSubmitting(true);
    const request = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      package: form.package,
      dealerCode: form.dealerCode,
      dealerName: form.dealerName,
      mobile: form.mobile,
      email: form.email,
      utr: form.utr,
      date: form.date,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    let requestRef = null;
    try {
      // NOTE: intentionally does NOT query the `users` collection.
      //
      // That read used to run unauthenticated to detect duplicate dealer codes,
      // which meant any anonymous visitor could enumerate `users` (and read the
      // plaintext PIN field it used to contain). Duplicate detection is now the
      // admin's job at approval time, where the request is already reviewed.
      //
      // Build the credential separately; it must never enter the browser cache.
      const pinPatch = await buildPinWritePatch(form.pin);

      requestRef = await addDoc(collection(db, 'registrationRequests'), {
        ...request,
        pin: null,
        ...pinPatch,
        createdAt: serverTimestamp(),
      });
    } catch {
      pushToast('Registration save to Firebase failed. Check Firebase config.', 'error');
      setIsSubmitting(false);
      return;
    }

    const requestToStore = { ...request, id: requestRef.id };
    try {
      const existing = localStorage.getItem('registrationRequests');
      const arr = existing ? JSON.parse(existing) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.push(requestToStore);
      writeRegistrationRequestsCache(next);
    } catch {
      writeRegistrationRequestsCache([requestToStore]);
    }

    clearLegacyRegistrationStorage();
    setForm((prev) => ({ ...prev, pin: '', confirmPin: '' }));
    pushToast('Registration request submitted!', 'success');
    logRecentActivity('Submitted registration request', form.dealerCode);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="placeholder-container auth-panel auth-panel--register">
      <div className="auth-panel__hero">
        <div>
          <BrandMark size="small" />
          <h2 className="register-title">Register</h2>
          <div className="auth-switch-action auth-switch-action--under-title">
            <span className="auth-switch-prompt">Already have an account?</span>
            <button className="auth-secondary-button" onClick={onLogin} type="button" disabled={isSubmitting}>Login</button>
          </div>
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
              <strong>{paymentUpiId}</strong>
              <button type="button" className="auth-panel__upi-hide" onClick={() => setShowPaymentUpi(false)}>Hide</button>
            </div>
          </div>
        )}
        <div className="auth-section-card">
          <div className="auth-section-card__header">
            <h3>Account Details</h3>
          </div>
          <div className="register-form register-form--enhanced">
            <div>
              <label className="auth-field-label">Package</label>
              <select name="package" value={form.package} onChange={onChange} className={`form-input${errors.package ? ' form-input--error' : ''}`}>
                <option value="">Select package</option>
                {packageOptions.map((opt) => (
                  <option key={opt} value={opt}>{`${opt} - ${packagePricing[opt] || '-'}`}</option>
                ))}
              </select>
              {errors.package && <div className="form-error">{errors.package}</div>}
            </div>
            <div>
              <label className="auth-field-label">Dealer Code</label>
              <input name="dealerCode" autoComplete="off" className={`form-input${errors.dealerCode ? ' form-input--error' : ''}`} placeholder="Dealer code (8 digits)" value={form.dealerCode} onChange={onChange} maxLength={8} />
              {errors.dealerCode && <div className="form-error">{errors.dealerCode}</div>}
            </div>
            <div>
              <label className="auth-field-label">Dealer Name</label>
              <input name="dealerName" autoComplete="off" className={`form-input${errors.dealerName ? ' form-input--error' : ''}`} placeholder="Dealer name" value={form.dealerName} onChange={onChange} />
              {errors.dealerName && <div className="form-error">{errors.dealerName}</div>}
            </div>
            <div>
              <label className="auth-field-label">Mobile Number</label>
              <input name="mobile" autoComplete="off" className={`form-input${errors.mobile ? ' form-input--error' : ''}`} placeholder="Mobile number (10 digits)" value={form.mobile} onChange={onChange} maxLength={10} />
              {errors.mobile && <div className="form-error">{errors.mobile}</div>}
            </div>
            <div>
              <label className="auth-field-label">Email ID</label>
              <input name="email" autoComplete="off" className={`form-input${errors.email ? ' form-input--error' : ''}`} placeholder="Email ID" type="email" value={form.email} onChange={onChange} />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div>
              <label className="auth-field-label">PIN</label>
              <input name="pin" autoComplete="new-password" className={`form-input${errors.pin ? ' form-input--error' : ''}`} placeholder="PIN (4 digits)" type="password" value={form.pin} onChange={onChange} maxLength={4} />
              {errors.pin && <div className="form-error">{errors.pin}</div>}
            </div>
            <div>
              <label className="auth-field-label">Confirm PIN</label>
              <input name="confirmPin" autoComplete="new-password" className={`form-input${errors.confirmPin ? ' form-input--error' : ''}`} placeholder="Confirm PIN" type="password" value={form.confirmPin} onChange={onChange} maxLength={4} />
              {errors.confirmPin && <div className="form-error">{errors.confirmPin}</div>}
            </div>
            <div>
              <label className="auth-field-label">UTR Number</label>
              <input name="utr" className="form-input" placeholder="UTR number" value={form.utr} onChange={onChange} />
            </div>
            <div>
              <label className="auth-field-label">Payment Date</label>
              <input name="date" className="form-input" placeholder="Select date" type="date" value={form.date} onChange={onChange} />
            </div>
          </div>
          <div className="form-actions auth-panel__actions">
            <button className="auth-primary-button" onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Register'}</button>
            <button className="auth-secondary-button" onClick={onClose} disabled={isSubmitting}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminLoginPanel = ({
  adminLoginId,
  setAdminLoginId,
  adminPassword,
  setAdminPassword,
  isAdminLoginSubmitting,
  handleAdminLoginSubmit,
  navigateToHome,
}) => (
  <div className="placeholder-container auth-panel auth-panel--login">
    <div className="auth-panel__hero">
      <div>
        <BrandMark size="small" />
        <h2>Admin Login</h2>
      </div>
    </div>
    <div className="auth-panel__content">
      <div className="auth-section-card">
        <div className="auth-section-card__header">
          <h3>Welcome Back</h3>
        </div>
        <form
          className="register-form register-form--enhanced"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdminLoginSubmit();
          }}
        >
          <div>
            <label className="auth-field-label">Admin Email</label>
            <input
              className="form-input"
              placeholder="Admin Email"
              autoComplete="username"
              value={adminLoginId}
              onChange={(e) => setAdminLoginId(e.target.value)}
            />
          </div>
          <div>
            <label className="auth-field-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>
        </form>
        <div className="form-actions auth-panel__actions">
          <button className="auth-primary-button" onClick={handleAdminLoginSubmit} type="button" disabled={isAdminLoginSubmitting}>{isAdminLoginSubmitting ? 'Logging in...' : 'Login'}</button>
          <button className="auth-secondary-button" onClick={navigateToHome} disabled={isAdminLoginSubmitting}>Close</button>
        </div>
      </div>
    </div>
  </div>
);

export const UserLoginPanel = ({
  userDealerCode,
  setUserDealerCode,
  userPinVisible,
  setUserPinVisible,
  userPin,
  setUserPin,
  isUserLoginSubmitting,
  handleUserLoginSubmit,
  navigateToHome,
  onRegister,
}) => (
  <div className="placeholder-container auth-panel auth-panel--login">
    <div className="auth-panel__hero">
      <div>
        <BrandMark size="small" />
        <h2>User Login</h2>
        <div className="auth-switch-action auth-switch-action--under-title">
          <span className="auth-switch-prompt">Don&apos;t have an account?</span>
          <button className="auth-secondary-button" onClick={onRegister} type="button" disabled={isUserLoginSubmitting}>Register</button>
        </div>
      </div>
    </div>
    <div className="auth-panel__content">
      <div className="auth-section-card">
        <div className="auth-section-card__header">
          <h3>Welcome Back</h3>
        </div>
        <form
          className="register-form register-form--enhanced"
          onSubmit={(e) => {
            e.preventDefault();
            handleUserLoginSubmit();
          }}
        >
          <div>
            <label className="auth-field-label">Dealer Code</label>
            <input
              className="form-input"
              placeholder="Dealer Code"
              autoComplete="username"
              value={userDealerCode}
              onChange={(e) => setUserDealerCode(e.target.value)}
            />
          </div>
          <div>
            <label className="auth-field-label">PIN</label>
            <input
              className="form-input"
              type={userPinVisible ? 'text' : 'password'}
              placeholder="PIN"
              autoComplete="current-password"
              value={userPin}
              onChange={(e) => setUserPin(e.target.value)}
            />
          </div>
          <div className="login-help-row">
            <label className="login-help-checkbox">
              <input
                type="checkbox"
                checked={userPinVisible}
                onChange={(e) => setUserPinVisible(e.target.checked)}
              />
              <span>Show PIN</span>
            </label>
          </div>
        </form>
        <div className="form-actions auth-panel__actions">
          <button className="auth-primary-button" onClick={handleUserLoginSubmit} type="button" disabled={isUserLoginSubmitting}>{isUserLoginSubmitting ? 'Logging in...' : 'Login'}</button>
          <button className="auth-secondary-button" onClick={navigateToHome} disabled={isUserLoginSubmitting}>Close</button>
        </div>
      </div>
    </div>
  </div>
);
