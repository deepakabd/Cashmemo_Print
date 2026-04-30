import { useEffect, useMemo, useState } from 'react';
import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';

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

  useEffect(() => {
    if (loggedInUser?.profileData) {
      setData(loggedInUser.profileData);
    } else {
      setData(null);
    }
  }, [loggedInUser]);

  const currentPackage = loggedInUser?.package || '-';
  const validity = loggedInUser?.validTill ? formatDisplayDate(loggedInUser.validTill) : '-';
  const profilePhotoDataUrl = data?.photoDataUrl || '';
  const summaryItems = [
    { label: 'Distributor Name', value: loggedInUser?.profileData?.distributorName || '-' },
    { label: 'Bank Details', value: loggedInUser?.bankDetailsData?.bankName ? 'Available' : 'Missing' },
    { label: 'Header', value: loggedInUser?.hindiHeaderData?.distributorName ? 'Available' : 'Missing' },
    { label: 'Rates', value: Array.isArray(loggedInUser?.ratesData) && loggedInUser.ratesData.length > 0 ? `${loggedInUser.ratesData.length} rows` : 'Missing' },
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
      };
    })
    .sort((a, b) => new Date(b.lastUpdatedAt || b.requestedAt || 0).getTime() - new Date(a.lastUpdatedAt || a.requestedAt || 0).getTime());

  useEffect(() => {
    if (initialSection !== 'history') return;
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
        <span>{validity}</span>
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
        <h3>Request History</h3>
        {requestHistoryRows.length === 0 ? (
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

export const ContactSupportPanel = ({
  loggedInUser,
  pushToast,
  readFeedbackDataFromStorage,
  readFeedbackRepliesFromStorage,
  updateUserInFirebase,
  updateUserInStore,
  formatDisplayDateTime,
  onClose,
}) => {
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    feedback: '',
  });
  const [showAdminChatPopup, setShowAdminChatPopup] = useState(false);
  const [activeReplyItem, setActiveReplyItem] = useState(null);
  const [adminReplyMessage, setAdminReplyMessage] = useState('');
  const [localFeedbackEntries, setLocalFeedbackEntries] = useState(() => readFeedbackDataFromStorage());
  const [feedbackErrors, setFeedbackErrors] = useState({});
  const [adminChatError, setAdminChatError] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: loggedInUser?.dealerName || '',
      mobile: loggedInUser?.mobile || '',
      email: loggedInUser?.email || '',
    }));
  }, [loggedInUser]);

  const storedFeedbackReplies = readFeedbackRepliesFromStorage();
  const feedbackMetaOverrides = useMemo(() => {
    try {
      const raw = localStorage.getItem('feedbackMetaOverrides');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, [localFeedbackEntries.length]);

  const supportRequests = useMemo(() => {
    if (!loggedInUser) return [];
    return localFeedbackEntries
      .filter((item) => item.userId === loggedInUser?.id || item.dealerCode === loggedInUser?.dealerCode)
      .map((item) => {
        const idKey = item.id || item.clientFeedbackId || '';
        const reply = storedFeedbackReplies[idKey] || '';
        const override = feedbackMetaOverrides[idKey] || feedbackMetaOverrides[item.id] || {};
        const resolved = Boolean(override?.resolved || item?.resolved);
        const status = resolved ? 'resolved' : reply ? 'reply' : 'submitted';
        return {
          ...item,
          reply,
          replyId: idKey,
          resolved,
          status,
          priority: String(override?.priority || item?.priority || 'medium').toLowerCase(),
          resolvedAt: override?.resolvedAt || item?.resolvedAt || '',
          updatedAt: override?.updatedAt || item?.updatedAt || item?.createdAt || '',
          rootTicketId: item.parentFeedbackId || idKey,
        };
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }, [feedbackMetaOverrides, localFeedbackEntries, loggedInUser, storedFeedbackReplies]);

  const userReplies = supportRequests.filter((item) => item.reply);
  const ticketThreads = useMemo(() => {
    const map = new Map();
    supportRequests.forEach((item) => {
      const rootId = item.rootTicketId || item.replyId || item.id || item.clientFeedbackId;
      const existing = map.get(rootId);
      const messageTimeline = [
        {
          id: `${item.replyId || item.id || item.clientFeedbackId}-user`,
          type: 'user',
          message: item.text || item.feedback || 'No message content.',
          createdAt: item.createdAt,
        },
        ...(item.reply ? [{
          id: `${item.replyId || item.id || item.clientFeedbackId}-admin`,
          type: 'admin',
          message: item.reply,
          createdAt: item.updatedAt || item.createdAt,
          highlight: true,
        }] : []),
      ];
      if (!existing) {
        map.set(rootId, {
          id: rootId,
          subject: item.text || item.feedback || 'Support request',
          status: item.status,
          priority: item.priority,
          resolvedAt: item.resolvedAt,
          latestAt: item.updatedAt || item.createdAt,
          latestPreview: item.reply || item.text || '',
          messages: messageTimeline,
        });
        return;
      }
      const mergedMessages = [...existing.messages, ...messageTimeline]
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      const latestAt = new Date(existing.latestAt || 0).getTime() >= new Date(item.updatedAt || item.createdAt || 0).getTime()
        ? existing.latestAt
        : item.updatedAt || item.createdAt;
      map.set(rootId, {
        ...existing,
        status: item.status === 'resolved' ? 'resolved' : existing.status === 'resolved' ? 'resolved' : item.status === 'reply' ? 'reply' : existing.status,
        priority: item.priority || existing.priority,
        resolvedAt: item.resolvedAt || existing.resolvedAt,
        latestAt,
        latestPreview: item.reply || item.text || existing.latestPreview,
        messages: mergedMessages,
      });
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime());
  }, [supportRequests]);
  const selectedTicket = useMemo(
    () => ticketThreads.find((item) => item.id === selectedTicketId) || ticketThreads[0] || null,
    [selectedTicketId, ticketThreads],
  );

  useEffect(() => {
    if (!showAdminChatPopup) return;
    if (userReplies.length > 0) {
      setActiveReplyItem((prev) => prev || userReplies[0]);
    }
  }, [showAdminChatPopup, userReplies]);

  useEffect(() => {
    if (ticketThreads.length === 0) {
      setSelectedTicketId('');
      return;
    }
    setSelectedTicketId((prev) => (prev && ticketThreads.some((item) => item.id === prev) ? prev : ticketThreads[0].id));
  }, [ticketThreads]);

  const handleOpenAdminChat = () => {
    setShowAdminChatPopup(true);
  };

  const handleCloseAdminChat = () => {
    setShowAdminChatPopup(false);
    setAdminReplyMessage('');
    setAdminChatError('');
  };

  const submitAdminChatReply = async () => {
    if (!adminReplyMessage.trim()) {
      setAdminChatError('Please type your message before sending.');
      pushToast('Please type your message before sending.', 'error');
      return;
    }
    if (!loggedInUser && (!form.name.trim() || !form.mobile.trim())) {
      setAdminChatError('Name and mobile number are required to send a chat message.');
      pushToast('Name and mobile number are required to send a chat message.', 'error');
      return;
    }
    setAdminChatError('');
    const key = 'feedbackData';
    const feedbackEntry = {
      clientFeedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: loggedInUser?.id || '',
      name: loggedInUser?.dealerName || form.name.trim() || '',
      mobile: loggedInUser?.mobile || form.mobile.trim() || '',
      dealerCode: loggedInUser?.dealerCode || '',
      dealerName: loggedInUser?.dealerName || form.name.trim() || '',
      email: loggedInUser?.email || form.email.trim() || '',
      text: adminReplyMessage.trim(),
      parentFeedbackId: activeReplyItem?.id || activeReplyItem?.clientFeedbackId || '',
      read: false,
      createdAt: new Date().toISOString(),
    };
    let anySaved = false;
    try {
      await addDoc(collection(db, 'feedback'), {
        ...feedbackEntry,
        createdAt: serverTimestamp(),
      });
      anySaved = true;
    } catch (e) { void e; }

    if (loggedInUser?.id) {
      try {
        const resolvedId = await updateUserInFirebase(loggedInUser.id, { feedbackEntries: arrayUnion(feedbackEntry) }, loggedInUser.dealerCode);
        updateUserInStore(
          resolvedId,
          (u) => ({ ...u, feedbackEntries: [...(Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : []), feedbackEntry] }),
          loggedInUser.dealerCode,
        );
        anySaved = true;
      } catch (e) { void e; }
    }

    try {
      const existing = localStorage.getItem(key);
      const arr = existing ? JSON.parse(existing) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.push({ ...feedbackEntry, source: 'local' });
      localStorage.setItem(key, JSON.stringify(next));
      setLocalFeedbackEntries(next);
      anySaved = true;
    } catch (e) { void e; }

    if (anySaved) {
      pushToast('Your chat message has been sent. Admin will reply shortly.', 'success');
      setAdminReplyMessage('');
    } else {
      setAdminChatError('Unable to send your chat message. Please try again.');
      pushToast('Unable to send your chat message. Please try again.', 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFeedbackErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const submitFeedback = async () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!form.mobile.trim()) nextErrors.mobile = 'Mobile number is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (!form.feedback.trim()) nextErrors.feedback = 'Feedback is required.';
    if (Object.keys(nextErrors).length > 0) {
      setFeedbackErrors(nextErrors);
      pushToast('Name, Mobile, Email and Feedback are required.', 'error');
      return;
    }
    setFeedbackErrors({});
    const key = 'feedbackData';
    const feedbackEntry = {
      clientFeedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: loggedInUser?.id || '',
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      dealerCode: loggedInUser?.dealerCode || '',
      dealerName: loggedInUser?.dealerName || form.name.trim(),
      email: form.email.trim(),
      text: form.feedback.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    let anySaved = false;
    try {
      await addDoc(collection(db, 'feedback'), {
        ...feedbackEntry,
        createdAt: serverTimestamp(),
      });
      anySaved = true;
    } catch (e) { void e; }

    if (loggedInUser?.id) {
      try {
        const resolvedId = await updateUserInFirebase(loggedInUser.id, { feedbackEntries: arrayUnion(feedbackEntry) }, loggedInUser.dealerCode);
        updateUserInStore(
          resolvedId,
          (u) => ({ ...u, feedbackEntries: [...(Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : []), feedbackEntry] }),
          loggedInUser.dealerCode,
        );
        anySaved = true;
      } catch (e) { void e; }
    }

    try {
      const existing = localStorage.getItem(key);
      const arr = existing ? JSON.parse(existing) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.push({ ...feedbackEntry, source: 'local' });
      localStorage.setItem(key, JSON.stringify(next));
      setLocalFeedbackEntries(next);
      anySaved = true;
    } catch (error) {
      void error;
    }

    if (anySaved) {
      pushToast('Feedback submitted. Thank you!', 'success');
      onClose();
    } else {
      pushToast('Unable to save feedback.', 'error');
    }
  };

  return (
    <div className="placeholder-container">
      <h2>Contact Us</h2>
      <div className="contact-us-links">
        <a className="contact-us-link" href="mailto:deepak.youvi@gmail.com" aria-label="Email Us">
          <span className="contact-us-icon">Mail</span> Email Us
        </a>
        <a className="contact-us-link" href="https://wa.me/918789358400" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Us">
          <span className="contact-us-icon">Chat</span> WhatsApp Us
        </a>
        {loggedInUser && (
          <button type="button" className="contact-us-link" onClick={handleOpenAdminChat}>
            <span className="contact-us-icon">Chat</span> Open Admin Replies Chat
          </button>
        )}
      </div>

      {loggedInUser && (
        <div className="support-status-panel">
          <div className="support-status-panel__header">
            <h3>Support Status</h3>
            <span>{supportRequests.length} requests tracked</span>
          </div>
          {supportRequests.length === 0 ? (
            <p className="support-status-panel__empty">Abhi koi support request submit nahi hui hai. Naya feedback bhejte hi yahan status dikhne lagega.</p>
          ) : (
            <div className="support-ticket-layout">
              <div className="support-status-panel__list">
                {ticketThreads.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`support-status-card support-status-card--${item.status} ${selectedTicket?.id === item.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedTicketId(item.id)}
                  >
                    <div className="support-status-card__top">
                      <strong>{item.status === 'resolved' ? 'Resolved' : item.status === 'reply' ? 'Reply Received' : 'Submitted'}</strong>
                      <span>{formatDisplayDateTime(item.latestAt)}</span>
                    </div>
                    <div className="support-status-card__meta">
                      <span className={`support-priority support-priority--${item.priority}`}>{item.priority} priority</span>
                      {item.resolvedAt && <span>Closed: {formatDisplayDateTime(item.resolvedAt)}</span>}
                    </div>
                    <p>{item.subject}</p>
                    <small>{item.latestPreview}</small>
                  </button>
                ))}
              </div>
              {selectedTicket && (
                <div className="support-ticket-thread">
                  <div className="support-ticket-thread__header">
                    <div>
                      <h4>Ticket Conversation</h4>
                      <p>{selectedTicket.subject}</p>
                    </div>
                    <div className="support-ticket-thread__badges">
                      <span className={`support-priority support-priority--${selectedTicket.priority}`}>{selectedTicket.priority}</span>
                      <span className={`support-ticket-status support-ticket-status--${selectedTicket.status}`}>{selectedTicket.status}</span>
                    </div>
                  </div>
                  <div className="support-ticket-thread__timeline">
                    {selectedTicket.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`support-ticket-message support-ticket-message--${message.type} ${message.highlight ? 'is-highlighted' : ''}`}
                      >
                        <div className="support-ticket-message__meta">
                          <strong>{message.type === 'admin' ? 'Admin Reply' : 'Your Message'}</strong>
                          <span>{formatDisplayDateTime(message.createdAt)}</span>
                        </div>
                        <p>{message.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdminChatPopup && (
        <div className="admin-chat-popup-overlay" role="dialog" aria-modal="true">
          <div className="admin-chat-popup">
            <div className="admin-chat-popup-header">
              <h3>Admin Chat</h3>
              <button type="button" className="admin-chat-popup-close" onClick={handleCloseAdminChat}>Close</button>
            </div>
            <div className="admin-chat-popup-body">
              <div className="admin-chat-sidebar">
                <h4>Conversations</h4>
                {userReplies.length === 0 ? (
                  <p>No admin replies yet. Send a message below to start chat with admin.</p>
                ) : (
                  <ul className="admin-chat-thread-list">
                    {userReplies.map((replyItem) => (
                      <li key={replyItem.id || replyItem.clientFeedbackId || `${replyItem.dealerCode}-${replyItem.createdAt}`}>
                        <button
                          type="button"
                          className={`admin-chat-thread-button ${activeReplyItem?.replyId === replyItem.replyId ? 'active' : ''}`}
                          onClick={() => setActiveReplyItem(replyItem)}
                        >
                          <strong>{replyItem.text?.slice(0, 40) || 'Your feedback'}</strong>
                          <small>{(replyItem.reply || '').slice(0, 40)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="admin-chat-content">
                {activeReplyItem ? (
                  <div className="admin-chat-conversation">
                    <div className="admin-chat-message user-message">
                      <strong>You:</strong>
                      <p>{activeReplyItem.text || activeReplyItem.feedback || 'No message content.'}</p>
                    </div>
                    <div className="admin-chat-message admin-message">
                      <strong>Admin:</strong>
                      <p>{activeReplyItem.reply}</p>
                    </div>
                  </div>
                ) : (
                  <div className="admin-chat-empty">
                    <p>Select a reply thread or type a new message below to chat with admin.</p>
                  </div>
                )}
                <textarea
                  className="form-input"
                  rows="4"
                  value={adminReplyMessage}
                  onChange={(e) => {
                    setAdminReplyMessage(e.target.value);
                    setAdminChatError('');
                  }}
                  placeholder="Type your message to admin here..."
                />
                {adminChatError && <div className="form-error">{adminChatError}</div>}
                <div className="admin-chat-actions">
                  <button type="button" className="form-button" onClick={submitAdminChatReply}>Send</button>
                  <button type="button" className="form-button secondary" onClick={handleCloseAdminChat}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="profile-form">
        <span className="profile-label">Name</span>
        <input className={`form-input${feedbackErrors.name ? ' form-input--error' : ''}`} name="name" type="text" value={form.name} onChange={handleChange} placeholder="Enter your name" />
        {feedbackErrors.name && <div className="form-error profile-form__error">{feedbackErrors.name}</div>}
        <span className="profile-label">Mobile</span>
        <input className={`form-input${feedbackErrors.mobile ? ' form-input--error' : ''}`} name="mobile" type="text" value={form.mobile} onChange={handleChange} placeholder="Enter mobile number" />
        {feedbackErrors.mobile && <div className="form-error profile-form__error">{feedbackErrors.mobile}</div>}
        <span className="profile-label">Email</span>
        <input className={`form-input${feedbackErrors.email ? ' form-input--error' : ''}`} name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter email" />
        {feedbackErrors.email && <div className="form-error profile-form__error">{feedbackErrors.email}</div>}
        <span className="profile-label">Feedback</span>
        <textarea className={`form-textarea${feedbackErrors.feedback ? ' form-input--error' : ''}`} name="feedback" rows="5" value={form.feedback} onChange={handleChange} placeholder="Kindly provide your feedback or Suggestion here" />
        {feedbackErrors.feedback && <div className="form-error profile-form__error">{feedbackErrors.feedback}</div>}
      </div>
      <div className="form-actions">
        <button onClick={submitFeedback}>Submit</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export const DictionaryRequestPanel = ({
  loggedInUser,
  pushToast,
  getPendingDictionaryRequestCount,
  deliveryAreaUpdates,
  deliveryStaffUpdates,
  submitUpdateApprovalRequest,
  updateUserInStore,
  mode = 'default',
  onClose,
}) => {
  const MAX_DICTIONARY_REQUEST_ROWS = 10;
  const createEmptyEntries = (count) => Array.from({ length: count }, () => ({ englishWord: '', hindiTranslation: '' }));
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

  const editApprovedItem = (item) => {
    setEntries([{ englishWord: item.englishWord || item.english || '', hindiTranslation: item.hindiTranslation || item.hindi || '' }]);
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
    setEntries((prev) => prev.map((entry, entryIndex) => (
      entryIndex === index
        ? { ...entry, [field]: value }
        : entry
    )));
  };

  const addEntry = () => {
    if (entries.length >= MAX_DICTIONARY_REQUEST_ROWS) {
      setDictionaryError(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests add kar sakte hain.`);
      pushToast(`Ek baar mein maximum ${MAX_DICTIONARY_REQUEST_ROWS} requests add kar sakte hain.`, 'info');
      return;
    }
    setDictionaryError('');
    setEntries((prev) => [...prev, { englishWord: '', hindiTranslation: '' }]);
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
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

    const nextPendingCount = pendingCount + normalizedEntries.length;
    const pendingRequests = normalizedEntries.map((entry, index) => {
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

    let approvalSavedCount = 0;
    try {
      try {
        const approvalRefs = await Promise.all(
          pendingRequests.map((request) => addDoc(collection(db, 'updateApprovals'), {
            userId: loggedInUser.id,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            type: 'dictionary',
            payload: request.payload,
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }))
        );
        approvalRefs.forEach((approvalRef, index) => {
          pendingRequests[index].approvalId = approvalRef.id;
        });
        approvalSavedCount = approvalRefs.length;
      } catch (e) { void e; }

      try {
        await updateDoc(doc(db, 'users', loggedInUser.id), {
          dictionaryPendingCount: nextPendingCount,
          pendingDictionaryRequests: arrayUnion(...pendingRequests),
          updatedAt: serverTimestamp(),
        });
      } catch {
        if (!approvalSavedCount) throw new Error('DICTIONARY_REQUEST_NOT_SAVED');
      }

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
      pushToast(`${normalizedEntries.length} dictionary request submitted. Your request is pending with admin for approval.`, 'success');
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
          <div className="dictionary-multi-header">
            <span>Sr.</span>
            <span>{isDeliveryAreaMode ? 'English Area' : isDeliveryStaffMode ? 'English Staff' : 'English Word'}</span>
            <span>Hindi Translation</span>
            <span>Action</span>
          </div>
          {entries.map((entry, index) => (
            <div key={index} className="dictionary-multi-entry">
              <span>{index + 1}</span>
              <input className="form-input" value={entry.englishWord} onChange={(e) => updateEntry(index, 'englishWord', e.target.value)} placeholder={englishPlaceholder} />
              <input className="form-input" value={entry.hindiTranslation} onChange={(e) => updateEntry(index, 'hindiTranslation', e.target.value)} placeholder={hindiPlaceholder} />
              <button type="button" className="dictionary-row-remove" onClick={() => removeEntry(index)} disabled={entries.length <= 1}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="dictionary-request-add-row" onClick={addEntry} disabled={entries.length >= MAX_DICTIONARY_REQUEST_ROWS}>
            {entries.length >= MAX_DICTIONARY_REQUEST_ROWS ? `Maximum ${MAX_DICTIONARY_REQUEST_ROWS} Rows Added` : 'Add Another Row'}
          </button>
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
