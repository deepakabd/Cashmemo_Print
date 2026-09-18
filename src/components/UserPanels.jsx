import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { db } from '../firebase';
import { getAccessState } from '../app/permissions';
import { getDictionaryTranslation, getExistingDictionaryEntry } from '../utils/dictionaryWorkflow';

export const ProfileUpdatePanel = ({
  loggedInUser,
  pushToast,
  readImageFileAsDataUrl,
  submitUpdateApprovalRequest,
  logRecentActivity,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    distributorCode: '',
    distributorName: '',
    contact: '',
    email: '',
    gst: '',
    address: '',
    photoDataUrl: '',
    paymentQrDataUrl: '',
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loggedInUser?.profileData) {
      setFormData((prev) => ({ ...prev, ...loggedInUser.profileData }));
    }
  }, [loggedInUser?.profileData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      pushToast('Profile photo must be under 1 MB.', 'error');
      return;
    }
    try {
      const photoDataUrl = await readImageFileAsDataUrl(file);
      setFormData((prev) => ({ ...prev, photoDataUrl }));
    } catch {
      pushToast('Photo upload failed. Please try another image.', 'error');
    }
  };

  const handlePhotoRemove = () => {
    setFormData((prev) => ({ ...prev, photoDataUrl: '' }));
  };

  const handlePaymentQrChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Please choose an image file for the payment QR.', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      pushToast('Payment QR image must be under 1 MB.', 'error');
      return;
    }
    try {
      const paymentQrDataUrl = await readImageFileAsDataUrl(file);
      setFormData((prev) => ({ ...prev, paymentQrDataUrl }));
    } catch {
      pushToast('Payment QR upload failed. Please try another image.', 'error');
    }
  };

  const validateProfileForm = () => {
    const nextErrors = {};
    if (!formData.distributorCode.trim()) nextErrors.distributorCode = 'Distributor code is required.';
    if (!formData.distributorName.trim()) nextErrors.distributorName = 'Distributor name is required.';
    if (!/^\d{10}$/.test(formData.contact.trim())) nextErrors.contact = 'Enter a valid 10-digit contact number.';
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!formData.gst.trim()) nextErrors.gst = 'GST is required.';
    if (!formData.address.trim()) nextErrors.address = 'Address is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateProfileForm()) return;
    setIsSaving(true);
    const ok = await submitUpdateApprovalRequest({
      type: 'profile',
      payload: formData,
      localKey: 'profileData',
      successMessage: 'Profile update request submitted. Your request is pending with admin for approval.',
    });
    setIsSaving(false);
    if (ok) {
      logRecentActivity('Submitted profile update request');
      onClose();
    }
  };

  return (
    <div className="placeholder-container">
      <h2>Profile Update</h2>
      <div className="profile-form">
        <span className="profile-label">Profile Photo</span>
        <div className="profile-photo-field">
          {formData.photoDataUrl ? (
            <img className="profile-photo-preview" src={formData.photoDataUrl} alt="Profile preview" />
          ) : (
            <div className="profile-photo-placeholder">No photo selected</div>
          )}
          <div className="profile-photo-actions">
            <input className="form-input" type="file" accept="image/*" onChange={handlePhotoChange} />
            {formData.photoDataUrl && (
              <button type="button" className="profile-photo-remove" onClick={handlePhotoRemove}>Remove Photo</button>
            )}
          </div>
        </div>
        <span className="profile-label">Payment QR</span>
        <div className="profile-photo-field">
          {formData.paymentQrDataUrl ? (
            <img className="profile-photo-preview" src={formData.paymentQrDataUrl} alt="Payment QR preview" />
          ) : (
            <div className="profile-photo-placeholder">No payment QR selected</div>
          )}
          <div className="profile-photo-actions">
            <input className="form-input" type="file" accept="image/*" onChange={handlePaymentQrChange} />
            {formData.paymentQrDataUrl && (
              <button type="button" className="profile-photo-remove" onClick={() => setFormData((prev) => ({ ...prev, paymentQrDataUrl: '' }))}>Remove QR</button>
            )}
          </div>
        </div>
        <span className="profile-label">Distributor Code</span>
        <div>
          <input className={`form-input${errors.distributorCode ? ' form-input--error' : ''}`} name="distributorCode" type="text" value={formData.distributorCode} onChange={handleChange} />
          {errors.distributorCode && <div className="form-error">{errors.distributorCode}</div>}
        </div>
        <span className="profile-label">Distributor Name</span>
        <div>
          <input className={`form-input${errors.distributorName ? ' form-input--error' : ''}`} name="distributorName" type="text" value={formData.distributorName} onChange={handleChange} />
          {errors.distributorName && <div className="form-error">{errors.distributorName}</div>}
        </div>
        <span className="profile-label">Contact</span>
        <div>
          <input className={`form-input${errors.contact ? ' form-input--error' : ''}`} name="contact" type="text" value={formData.contact} onChange={handleChange} />
          {errors.contact && <div className="form-error">{errors.contact}</div>}
        </div>
        <span className="profile-label">Email</span>
        <div>
          <input className={`form-input${errors.email ? ' form-input--error' : ''}`} name="email" type="email" value={formData.email} onChange={handleChange} />
          {errors.email && <div className="form-error">{errors.email}</div>}
        </div>
        <span className="profile-label">GST</span>
        <div>
          <input className={`form-input${errors.gst ? ' form-input--error' : ''}`} name="gst" type="text" value={formData.gst} onChange={handleChange} />
          {errors.gst && <div className="form-error">{errors.gst}</div>}
        </div>
        <span className="profile-label">Address</span>
        <div>
          <textarea className={`form-textarea${errors.address ? ' form-input--error' : ''}`} name="address" rows="3" value={formData.address} onChange={handleChange} />
          {errors.address && <div className="form-error">{errors.address}</div>}
        </div>
      </div>
      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
        <button onClick={onClose} disabled={isSaving}>Close</button>
      </div>
    </div>
  );
};

export const BankDetailsPanel = ({
  loggedInUser,
  submitUpdateApprovalRequest,
  logRecentActivity,
  onClose,
}) => {
  const defaultBankDetails = {
    bankName: '',
    branch: '',
    accountNo: '',
    ifsc: '',
  };
  const [formData, setFormData] = useState(defaultBankDetails);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loggedInUser?.bankDetailsData) {
      setFormData((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
    }
  }, [loggedInUser?.bankDetailsData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateBankForm = () => {
    const nextErrors = {};
    if (!formData.bankName.trim()) nextErrors.bankName = 'Bank name is required.';
    if (!formData.branch.trim()) nextErrors.branch = 'Branch is required.';
    if (!/^\d{8,20}$/.test(formData.accountNo.trim())) nextErrors.accountNo = 'Enter a valid account number.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifsc.trim())) nextErrors.ifsc = 'Enter a valid IFSC code.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateBankForm()) return;
    setIsSaving(true);
    const ok = await submitUpdateApprovalRequest({
      type: 'bank',
      payload: formData,
      localKey: 'bankDetailsData',
      successMessage: 'Bank details update request submitted. Your request is pending with admin for approval.',
    });
    setIsSaving(false);
    if (ok) {
      logRecentActivity('Submitted bank details update request');
      onClose();
    }
  };

  return (
    <div className="placeholder-container">
      <h2>Bank Details</h2>
      <div className="profile-form">
        <span className="profile-label">Bank Name</span>
        <div>
          <input className={`form-input${errors.bankName ? ' form-input--error' : ''}`} name="bankName" type="text" value={formData.bankName} onChange={handleChange} />
          {errors.bankName && <div className="form-error">{errors.bankName}</div>}
        </div>
        <span className="profile-label">Branch</span>
        <div>
          <input className={`form-input${errors.branch ? ' form-input--error' : ''}`} name="branch" type="text" value={formData.branch} onChange={handleChange} />
          {errors.branch && <div className="form-error">{errors.branch}</div>}
        </div>
        <span className="profile-label">Account No</span>
        <div>
          <input className={`form-input${errors.accountNo ? ' form-input--error' : ''}`} name="accountNo" type="text" value={formData.accountNo} onChange={handleChange} />
          {errors.accountNo && <div className="form-error">{errors.accountNo}</div>}
        </div>
        <span className="profile-label">IFSC Code</span>
        <div>
          <input className={`form-input${errors.ifsc ? ' form-input--error' : ''}`} name="ifsc" type="text" value={formData.ifsc} onChange={handleChange} />
          {errors.ifsc && <div className="form-error">{errors.ifsc}</div>}
        </div>
      </div>
      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
        <button onClick={onClose} disabled={isSaving}>Close</button>
      </div>
    </div>
  );
};

export const UserProfilePanel = ({
  loggedInUser,
  formatDisplayDate,
  initialSection = 'overview',
  onClose,
}) => {
  const [data, setData] = useState(null);
  const [areaSearch, setAreaSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [showRequestHistory, setShowRequestHistory] = useState(initialSection === 'history');

  useEffect(() => {
    if (loggedInUser?.profileData) {
      setData(loggedInUser.profileData);
    } else {
      setData(null);
    }
  }, [loggedInUser]);

  const currentPackage = loggedInUser?.package || '-';
  const validity = loggedInUser?.validTill ? formatDisplayDate(loggedInUser.validTill) : '-';
  const validityDate = loggedInUser?.validTill ? new Date(`${loggedInUser.validTill}T23:59:59`) : null;
  // Central permission engine — local expiry duplication hataya gaya.
  const isPlanExpired = !getAccessState(loggedInUser, { isLoggedIn: Boolean(loggedInUser?.id) }).planActive;
  const profilePhotoDataUrl = data?.photoDataUrl || '';
  const deliveryAreaUpdates = Array.isArray(loggedInUser?.deliveryAreaUpdates) ? loggedInUser.deliveryAreaUpdates : [];
  const deliveryStaffUpdates = Array.isArray(loggedInUser?.deliveryStaffUpdates) ? loggedInUser.deliveryStaffUpdates : [];
  const filteredDeliveryAreas = deliveryAreaUpdates.filter((item) => (
    String(item?.englishWord || item?.english || '').toLowerCase().includes(areaSearch.trim().toLowerCase())
    || String(item?.hindiTranslation || item?.hindi || '').toLowerCase().includes(areaSearch.trim().toLowerCase())
  ));
  const filteredDeliveryStaff = deliveryStaffUpdates.filter((item) => (
    String(item?.englishWord || item?.english || '').toLowerCase().includes(staffSearch.trim().toLowerCase())
    || String(item?.hindiTranslation || item?.hindi || '').toLowerCase().includes(staffSearch.trim().toLowerCase())
  ));
  const summaryItems = [
    { label: 'Distributor Name', value: loggedInUser?.profileData?.distributorName || '-' },
    { label: 'Bank Details', value: loggedInUser?.bankDetailsData?.bankName ? 'Available' : 'Missing' },
    { label: 'Header', value: loggedInUser?.hindiHeaderData?.distributorName ? 'Available' : 'Missing' },
    { label: 'Rates', value: Array.isArray(loggedInUser?.ratesData) && loggedInUser.ratesData.length > 0 ? `${loggedInUser.ratesData.length} rows` : 'Missing' },
    { label: 'Delivery Areas', value: `${deliveryAreaUpdates.length} approved` },
    { label: 'Delivery Staff', value: `${deliveryStaffUpdates.length} approved` },
  ];
  const requestHistoryRows = Object.entries(loggedInUser?.pendingUpdates || {})
    .map(([type, info]) => {
      const normalizedType = String(type || '').trim();
      const status = String(info?.status || loggedInUser?.approvalStatus?.[type] || '').toLowerCase() || 'draft';
      const mostRecentAt = info?.approvedAt || info?.rejectedAt || info?.adminReplyAt || info?.requestedAt || '';
      return {
        type: normalizedType,
        status,
        requestedAt: info?.requestedAt || '',
        lastUpdatedAt: mostRecentAt,
        adminReply: String(info?.adminReply || '').trim(),
        approvedAt: info?.approvedAt || '',
        rejectedAt: info?.rejectedAt || '',
        adminReplyAt: info?.adminReplyAt || '',
        timeline: [
          { key: 'submitted', label: 'Submitted', date: info?.requestedAt || '', complete: Boolean(info?.requestedAt) },
          { key: 'pending', label: 'Pending', date: info?.requestedAt || '', complete: ['pending', 'approved', 'rejected'].includes(status) },
          {
            key: status === 'rejected' ? 'rejected' : 'approved',
            label: status === 'rejected' ? 'Rejected' : 'Approved',
            date: status === 'rejected' ? info?.rejectedAt || '' : info?.approvedAt || '',
            complete: status === 'approved' || status === 'rejected',
            tone: status === 'rejected' ? 'danger' : 'success',
          },
          { key: 'reply', label: 'Admin Reply', date: info?.adminReplyAt || '', complete: Boolean(info?.adminReply), tone: 'info' },
        ],
      };
    })
    .sort((a, b) => new Date(b.lastUpdatedAt || b.requestedAt || 0).getTime() - new Date(a.lastUpdatedAt || a.requestedAt || 0).getTime());

  useEffect(() => {
    if (initialSection !== 'history') return;
    setShowRequestHistory(true);
    const historyBlock = document.getElementById('user-request-history');
    historyBlock?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialSection]);

  return (
    <div className="placeholder-container">
      <h2>User Profile</h2>
      {profilePhotoDataUrl && (
        <div className="user-profile-photo-wrap">
          <img className="user-profile-photo" src={profilePhotoDataUrl} alt="User profile" />
        </div>
      )}
      <div className="home-account-grid user-profile-summary-grid">
        {summaryItems.map((item) => (
          <div key={item.label} className="home-account-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="profile-form">
        <span className="profile-label">Current Package</span>
        <span>{currentPackage}</span>
        <span className="profile-label">Package Validity</span>
        <span className={isPlanExpired ? 'profile-validity--expired' : ''}>{validity}{isPlanExpired ? ' — Expired' : ''}</span>
        {data && (
          <>
            <span className="profile-label">Distributor Code</span>
            <span>{data.distributorCode || '-'}</span>
            <span className="profile-label">Distributor Name</span>
            <span>{data.distributorName || '-'}</span>
            <span className="profile-label">Contact</span>
            <span>{data.contact || '-'}</span>
            <span className="profile-label">Email</span>
            <span>{data.email || '-'}</span>
            <span className="profile-label">GST</span>
            <span>{data.gst || '-'}</span>
            <span className="profile-label">Address</span>
            <span>{data.address || '-'}</span>
          </>
        )}
      </div>
      {!data && (
        <div style={{ marginTop: '15px' }}>No additional profile details found. Please update your profile.</div>
      )}
      <div id="user-request-history" className="user-profile-history">
        <button
          type="button"
          className="user-profile-history-toggle"
          onClick={() => setShowRequestHistory((prev) => !prev)}
          aria-expanded={showRequestHistory}
        >
          <h3>Request History</h3>
          <span>{requestHistoryRows.length} requests</span>
        </button>
        {showRequestHistory && (
          requestHistoryRows.length === 0 ? (
            <div className="user-profile-history-empty">No update requests submitted yet.</div>
          ) : (
            <div className="user-profile-history-list">
              {requestHistoryRows.map((item) => (
                <div key={`${item.type}-${item.requestedAt}-${item.lastUpdatedAt}`} className="user-profile-history-item">
                  <strong>{item.type}</strong>
                  <span>Status: {item.status || '-'}</span>
                  <span>Requested: {formatDisplayDate(item.requestedAt) || '-'}</span>
                  <span>Last Update: {formatDisplayDate(item.lastUpdatedAt) || '-'}</span>
                  {item.adminReply && <span>Admin Reply: {item.adminReply}</span>}
                  <div className="user-profile-request-timeline">
                    {item.timeline.map((step) => (
                      <div
                        key={`${item.type}-${step.key}`}
                        className={`user-profile-request-step ${step.complete ? 'is-complete' : ''} ${step.tone ? `user-profile-request-step--${step.tone}` : ''}`}
                      >
                        <strong>{step.label}</strong>
                        <span>{formatDisplayDate(step.date) || (step.complete ? 'Done' : 'Waiting')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      <div className="user-profile-history">
        <h3>Delivery Area Management</h3>
        <input
          className="form-input"
          type="text"
          value={areaSearch}
          onChange={(e) => setAreaSearch(e.target.value)}
          placeholder="Search approved delivery area"
        />
        {filteredDeliveryAreas.length === 0 ? (
          <div className="user-profile-history-empty">No approved delivery areas found.</div>
        ) : (
          <div className="user-profile-history-list">
            {filteredDeliveryAreas.map((item, index) => (
              <div key={`area-${index}`} className="user-profile-history-item">
                <strong>{String(item?.englishWord || item?.english || '-')}</strong>
                <span>Hindi: {String(item?.hindiTranslation || item?.hindi || '-')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="user-profile-history">
        <h3>Delivery Staff Management</h3>
        <input
          className="form-input"
          type="text"
          value={staffSearch}
          onChange={(e) => setStaffSearch(e.target.value)}
          placeholder="Search approved delivery staff"
        />
        {filteredDeliveryStaff.length === 0 ? (
          <div className="user-profile-history-empty">No approved delivery staff found.</div>
        ) : (
          <div className="user-profile-history-list">
            {filteredDeliveryStaff.map((item, index) => (
              <div key={`staff-${index}`} className="user-profile-history-item">
                <strong>{String(item?.englishWord || item?.english || '-')}</strong>
                <span>Hindi: {String(item?.hindiTranslation || item?.hindi || '-')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="form-actions">
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export const ContactSupportPanel = ({ onClose }) => (
  <div className="placeholder-container">
    <h2>Contact Us</h2>
    <div className="contact-us-links">
      <a className="contact-us-link" href="mailto:deepak.youvi@gmail.com">Email Us</a>
      <a className="contact-us-link" href="https://wa.me/918789358400" target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
    </div>
    <div className="form-actions"><button onClick={onClose}>Close</button></div>
  </div>
);

export const DictionaryRequestPanel = ({
  loggedInUser,
  pushToast,
  getPendingDictionaryRequestCount,
  deliveryAreaUpdates,
  deliveryStaffUpdates,
  translationDictionary,
  submitUpdateApprovalRequest,
  updateUserInStore,
  mode = 'default',
  onClose,
}) => {
  const MAX_DICTIONARY_REQUEST_ROWS = 10;
  const createEntry = (overrides = {}) => ({
    englishWord: '',
    hindiTranslation: '',
    isHindiManual: false,
    ...overrides,
  });
  const createEmptyEntries = (count) => Array.from({ length: count }, () => createEntry());
  const [entries, setEntries] = useState(createEmptyEntries(MAX_DICTIONARY_REQUEST_ROWS));
  const [dictionaryError, setDictionaryError] = useState('');
  const pendingCount = getPendingDictionaryRequestCount(loggedInUser);
  const isDeliveryAreaMode = mode === 'deliveryArea';
  const isDeliveryStaffMode = mode === 'deliveryStaff';
  const title = isDeliveryAreaMode ? 'Delivery Area Update' : isDeliveryStaffMode ? 'Delivery Staff Update' : 'Dictionary';
  const englishPlaceholder = isDeliveryAreaMode ? 'e.g. Khera Bazar' : isDeliveryStaffMode ? 'e.g. Rajesh' : 'e.g. Mr.';
  const hindiPlaceholder = isDeliveryAreaMode ? 'Hindi translation' : isDeliveryStaffMode ? 'Hindi translation' : 'e.g. Shri';
  const [showApprovedList, setShowApprovedList] = useState(false);
  const approvedItems = isDeliveryAreaMode ? deliveryAreaUpdates : isDeliveryStaffMode ? deliveryStaffUpdates : [];
  const approvedListTitle = isDeliveryAreaMode ? 'Approved Delivery Areas' : 'Approved Delivery Staff';
  const normalizedDictionary = translationDictionary && typeof translationDictionary === 'object'
    ? translationDictionary
    : {};

  const entryInsights = useMemo(() => entries.map((entry) => {
    const englishWord = String(entry.englishWord || '').trim();
    const hindiTranslation = String(entry.hindiTranslation || '').trim();
    const existingEntry = englishWord ? getExistingDictionaryEntry(normalizedDictionary, englishWord) : null;
    const suggestedHindi = englishWord ? String(getDictionaryTranslation(normalizedDictionary, englishWord) || '').trim() : '';
    const hasSuggestion = Boolean(suggestedHindi);
    const isExactDuplicate = Boolean(existingEntry)
      && suggestedHindi !== ''
      && suggestedHindi.toLowerCase() === hindiTranslation.toLowerCase()
      && hindiTranslation !== '';
    const hasConflict = Boolean(existingEntry)
      && hindiTranslation !== ''
      && suggestedHindi !== ''
      && suggestedHindi.toLowerCase() !== hindiTranslation.toLowerCase();
    const isNewWord = Boolean(englishWord) && !existingEntry;
    return {
      englishWord,
      hindiTranslation,
      existingEntry,
      suggestedHindi,
      hasSuggestion,
      isExactDuplicate,
      hasConflict,
      isNewWord,
    };
  }), [entries, normalizedDictionary]);

  const validationPreview = useMemo(() => {
    const filledEntries = entryInsights.filter((item) => item.englishWord || item.hindiTranslation);
    return {
      total: filledEntries.length,
      exactDuplicates: filledEntries.filter((item) => item.isExactDuplicate).length,
      conflicts: filledEntries.filter((item) => item.hasConflict).length,
      newWords: filledEntries.filter((item) => item.isNewWord).length,
      suggested: filledEntries.filter((item) => item.hasSuggestion && !item.hindiTranslation).length,
      ready: filledEntries.filter((item) => item.englishWord && item.hindiTranslation && !item.isExactDuplicate).length,
    };
  }, [entryInsights]);

  const editApprovedItem = (item) => {
    setEntries([createEntry({
      englishWord: item.englishWord || item.english || '',
      hindiTranslation: item.hindiTranslation || item.hindi || '',
      isHindiManual: true,
    })]);
    setShowApprovedList(false);
  };

  useEffect(() => {
    if (isDeliveryAreaMode || isDeliveryStaffMode) {
      setEntries(createEmptyEntries(5));
    } else {
      setEntries(createEmptyEntries(MAX_DICTIONARY_REQUEST_ROWS));
    }
    setShowApprovedList(false);
  }, [mode, isDeliveryAreaMode, isDeliveryStaffMode]);

  const updateEntry = (index, field, value) => {
    setDictionaryError('');
    if (field === 'englishWord') {
      const nextEnglishWord = value;
      setEntries((prev) => prev.map((entry, entryIndex) => (
        entryIndex !== index
          ? entry
          : (() => {
              const trimmedEnglishWord = String(nextEnglishWord || '').trim();
              const suggestedHindi = trimmedEnglishWord ? getDictionaryTranslation(normalizedDictionary, trimmedEnglishWord) : '';
              const shouldAutofillSuggestion = suggestedHindi
                && (!String(entry.hindiTranslation || '').trim() || !entry.isHindiManual);
              return {
                ...entry,
                englishWord: nextEnglishWord,
                hindiTranslation: shouldAutofillSuggestion ? suggestedHindi : entry.hindiTranslation,
                isHindiManual: shouldAutofillSuggestion ? false : entry.isHindiManual,
              };
            })()
      )));
      return;
    }

    setEntries((prev) => prev.map((entry, entryIndex) => (
      entryIndex !== index
        ? entry
        : (() => {
            if (field === 'hindiTranslation') {
              const nextHindiTranslation = value;
              return {
                ...entry,
                hindiTranslation: nextHindiTranslation,
                isHindiManual: String(nextHindiTranslation || '').trim() !== '',
              };
            }

            return { ...entry, [field]: value };
          })()
    )));
  };

  const addEntry = () => {
    if (entries.length >= MAX_DICTIONARY_REQUEST_ROWS) {
      setDictionaryError(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests add kar sakte hain.`);
      pushToast(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests add kar sakte hain.`, 'info');
      return;
    }
    setDictionaryError('');
    setEntries((prev) => [...prev, createEntry()]);
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
  };

  const applySuggestedTranslation = (index) => {
    const insight = entryInsights[index];
    if (!insight?.suggestedHindi) return;
    setEntries((prev) => prev.map((entry, entryIndex) => (
      entryIndex === index
        ? {
            ...entry,
            hindiTranslation: insight.suggestedHindi,
            isHindiManual: false,
          }
        : entry
    )));
  };

  const submitDictionaryRequest = async () => {
    const type = isDeliveryAreaMode ? 'deliveryArea' : isDeliveryStaffMode ? 'deliveryStaff' : 'dictionary';
    const successMessage = isDeliveryAreaMode
      ? 'Delivery area update request submitted. Your request is pending with admin for approval.'
      : isDeliveryStaffMode
        ? 'Delivery staff update request submitted. Your request is pending with admin for approval.'
        : 'Dictionary request submitted. Your request is pending with admin for approval.';

    if (!loggedInUser?.id) {
      setDictionaryError('Please login first.');
      pushToast('Please login first.', 'error');
      return;
    }

    const normalizedEntries = entries.map((entry) => ({
      englishWord: String(entry.englishWord || '').trim(),
      hindiTranslation: String(entry.hindiTranslation || '').trim(),
    })).filter((entry) => entry.englishWord || entry.hindiTranslation);

    if (normalizedEntries.length === 0 || normalizedEntries.some((entry) => !entry.englishWord || !entry.hindiTranslation)) {
      setDictionaryError('Har row mein English aur Hindi dono values bharen.');
      pushToast('Har row mein English aur Hindi dono values bharen.', 'error');
      return;
    }

    if (normalizedEntries.length > MAX_DICTIONARY_REQUEST_ROWS) {
      setDictionaryError(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests bhej sakte hain.`);
      pushToast(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests bhej sakte hain.`, 'error');
      return;
    }

    if (isDeliveryAreaMode || isDeliveryStaffMode) {
      const ok = await submitUpdateApprovalRequest({
        type,
        payload: normalizedEntries,
        localKey: type === 'deliveryArea' ? 'deliveryAreaUpdates' : 'deliveryStaffUpdates',
        successMessage,
      });
      if (ok) {
        setEntries(isDeliveryAreaMode || isDeliveryStaffMode ? createEmptyEntries(5) : createEmptyEntries(MAX_DICTIONARY_REQUEST_ROWS));
        onClose();
      }
      return;
    }
    setDictionaryError('');

    const duplicateRows = normalizedEntries.filter((entry) => {
      const existingEntry = getExistingDictionaryEntry(normalizedDictionary, entry.englishWord);
      return Boolean(existingEntry)
        && String(existingEntry.hindiTranslation || '').trim().toLowerCase() === entry.hindiTranslation.toLowerCase();
    });
    const actionableEntries = normalizedEntries.filter((entry) => !duplicateRows.includes(entry));

    if (actionableEntries.length === 0) {
      setDictionaryError('Ye sabhi words dictionary mein same translation ke saath already available hain.');
      pushToast('Same translation wale duplicate rows skip ho gaye. Naya ya changed word add kijiye.', 'info');
      return;
    }

    if (duplicateRows.length > 0) {
      pushToast(`${duplicateRows.length} duplicate rows skip ki gayi kyunki same translation already saved hai.`, 'info');
    }

    const nextPendingCount = pendingCount + actionableEntries.length;
    const pendingRequests = actionableEntries.map((entry, index) => {
      const requestedAt = new Date(Date.now() + index).toISOString();
      const clientRequestId = `dict-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: clientRequestId,
        status: 'pending',
        payload: {
          clientRequestId,
          englishWord: entry.englishWord,
          hindiTranslation: entry.hindiTranslation,
          requestedBy: loggedInUser?.dealerCode || '',
          requestedAt,
        },
        dealerCode: loggedInUser.dealerCode || '',
        dealerName: loggedInUser.dealerName || '',
        requestedAt,
      };
    });

    try {
        const batch = writeBatch(db);
        pendingRequests.forEach((request) => {
          const approvalRef = doc(collection(db, 'updateApprovals'));
          request.approvalId = approvalRef.id;
          batch.set(approvalRef, {
            userId: loggedInUser.id,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            type: 'dictionary',
            payload: request.payload,
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        batch.update(doc(db, 'users', loggedInUser.id), {
          dictionaryPendingCount: nextPendingCount,
          pendingDictionaryRequests: arrayUnion(...pendingRequests),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

      updateUserInStore(
        loggedInUser.id,
        (user) => ({
          ...user,
          dictionaryPendingCount: nextPendingCount,
          pendingDictionaryRequests: [
            ...(Array.isArray(user.pendingDictionaryRequests) ? user.pendingDictionaryRequests : []),
            ...pendingRequests,
          ],
        }),
        loggedInUser.dealerCode,
      );
      setEntries(createEmptyEntries(MAX_DICTIONARY_REQUEST_ROWS));
      pushToast(`${actionableEntries.length} dictionary request submitted. Your request is pending with admin for approval.`, 'success');
    } catch {
      setDictionaryError('Dictionary request submit failed. Check Firebase permissions.');
      pushToast('Dictionary request submit failed. Check Firebase permissions.', 'error');
    }
  };

  return (
    <div className="placeholder-container dictionary-request-panel">
      <h2>{title}</h2>
      {mode === 'default' ? (
        <div className="dictionary-pending-count">{pendingCount} request pending</div>
      ) : null}
      {dictionaryError && <div className="form-error dictionary-request-panel__error">{dictionaryError}</div>}
      {(isDeliveryAreaMode || isDeliveryStaffMode) && (
        <div className="dictionary-approved-toggle">
          <button type="button" className="dictionary-approved-toggle-button" onClick={() => setShowApprovedList((prev) => !prev)}>
            {approvedListTitle}
          </button>
          {showApprovedList && (
            <div className="dictionary-approved-list">
              {approvedItems.length > 0 ? (
                <table className="dictionary-approved-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{isDeliveryAreaMode ? 'Approved Area' : 'Approved Staff'}</th>
                      <th>Hindi Translation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedItems.map((item, index) => (
                      <tr key={`${mode}-approved-${index}`}>
                        <td>{index + 1}</td>
                        <td>{String(item.englishWord || item.english || '').trim() || '-'}</td>
                        <td>{String(item.hindiTranslation || item.hindi || '').trim() || '-'}</td>
                        <td className="dictionary-approved-actions">
                          <button type="button" className="dictionary-approved-action" onClick={() => editApprovedItem(item)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="dictionary-approved-empty">No approved items found yet.</div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="profile-form">
        <>
          {!isDeliveryAreaMode && !isDeliveryStaffMode ? (
            <div className="dictionary-approved-list" style={{ marginBottom: '16px' }}>
              <div className="dictionary-pending-count"><strong>Validation Preview</strong></div>
              <div className="home-account-grid user-profile-summary-grid">
                <div className="home-account-item">
                  <span>Filled Rows</span>
                  <strong>{validationPreview.total}</strong>
                </div>
                <div className="home-account-item">
                  <span>Ready to Send</span>
                  <strong>{validationPreview.ready}</strong>
                </div>
                <div className="home-account-item">
                  <span>New Words</span>
                  <strong>{validationPreview.newWords}</strong>
                </div>
                <div className="home-account-item">
                  <span>Conflicts</span>
                  <strong>{validationPreview.conflicts}</strong>
                </div>
              </div>
              <div className="dictionary-pending-count">
                Exact duplicates: {validationPreview.exactDuplicates} | Suggestion available: {validationPreview.suggested}
              </div>
            </div>
          ) : null}
          <div className="dictionary-multi-header">
            <span>Sr.</span>
            <span>{isDeliveryAreaMode ? 'English Area' : isDeliveryStaffMode ? 'English Staff' : 'English Word'}</span>
            <span>Hindi Translation</span>
            <span>Action</span>
          </div>
          {entries.map((entry, index) => {
            const insight = entryInsights[index];
            return (
            <div key={index} className="dictionary-multi-entry">
              <span>{index + 1}</span>
              <div>
                <input className="form-input" value={entry.englishWord} onChange={(e) => updateEntry(index, 'englishWord', e.target.value)} placeholder={englishPlaceholder} />
                {!isDeliveryAreaMode && !isDeliveryStaffMode && insight?.hasSuggestion && (
                  <div className="dictionary-pending-count">
                    Suggested: {insight.suggestedHindi}
                    {String(entry.hindiTranslation || '').trim() !== insight.suggestedHindi && (
                      <button type="button" className="dictionary-approved-action" onClick={() => applySuggestedTranslation(index)} style={{ marginLeft: '8px' }}>
                        Use Suggestion
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <input className="form-input" value={entry.hindiTranslation} onChange={(e) => updateEntry(index, 'hindiTranslation', e.target.value)} placeholder={hindiPlaceholder} />
                {!isDeliveryAreaMode && !isDeliveryStaffMode && insight?.englishWord && (
                  <div className="dictionary-pending-count">
                    {insight.isExactDuplicate
                      ? 'Already exists with same translation.'
                      : insight.hasConflict
                        ? `Conflict: existing translation is "${insight.existingEntry?.hindiTranslation || '-'}".`
                        : insight.isNewWord
                          ? 'New word. This will create a fresh dictionary request.'
                          : insight.hasSuggestion
                            ? 'Suggestion matched from existing dictionary.'
                            : 'No suggestion found. Manual translation required.'}
                  </div>
                )}
              </div>
              <div>
                <button type="button" className="dictionary-row-remove" onClick={() => removeEntry(index)} disabled={entries.length <= 1}>
                  Remove
                </button>
              </div>
            </div>
          )})}
          <button type="button" className="dictionary-request-add-row" onClick={addEntry} disabled={entries.length >= MAX_DICTIONARY_REQUEST_ROWS}>
            {entries.length >= MAX_DICTIONARY_REQUEST_ROWS ? `Maximum ${MAX_DICTIONARY_REQUEST_ROWS} Rows Added` : 'Add Another Row'}
          </button>
          <div className="dictionary-pending-count">English word type karte hi existing dictionary se suggestion aur duplicate/conflict check dikhega.</div>
          {!isDeliveryAreaMode && !isDeliveryStaffMode ? (
            <div className="dictionary-pending-count">Ek baar mein 1 se {MAX_DICTIONARY_REQUEST_ROWS} dictionary requests bhej sakte hain.</div>
          ) : null}
        </>
      </div>
      <div className="form-actions">
        <button onClick={submitDictionaryRequest}>Send Request</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

