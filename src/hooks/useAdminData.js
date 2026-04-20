import { useState } from 'react';

const readStorageValue = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const useAdminData = () => {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [updateApprovals, setUpdateApprovals] = useState([]);
  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminDateRange, setAdminDateRange] = useState('all');
  const [adminSubFilter, setAdminSubFilter] = useState('all');
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const [viewRequest, setViewRequest] = useState(null);
  const [viewApproval, setViewApproval] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [auditTrail, setAuditTrail] = useState(() => {
    const parsed = readStorageValue('adminAuditTrail', []);
    return Array.isArray(parsed) ? parsed : [];
  });
  const [adminNotes, setAdminNotes] = useState(() => {
    const parsed = readStorageValue('adminNotes', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  });
  const [feedbackMetaOverrides, setFeedbackMetaOverrides] = useState(() => {
    const parsed = readStorageValue('feedbackMetaOverrides', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  });
  const [feedbackReplies, setFeedbackReplies] = useState(() => {
    const parsed = readStorageValue('feedbackReplies', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  });
  const [approvalReplies, setApprovalReplies] = useState(() => {
    const parsed = readStorageValue('approvalReplies', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  });
  const [savedAdminViews, setSavedAdminViews] = useState(() => {
    const parsed = readStorageValue('savedAdminViews', []);
    return Array.isArray(parsed) ? parsed : [];
  });
  const [deletedUsersBin, setDeletedUsersBin] = useState(() => {
    const parsed = readStorageValue('deletedUsersBin', []);
    return Array.isArray(parsed) ? parsed : [];
  });
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminDataHealth, setAdminDataHealth] = useState({ source: 'unknown', lastSyncAt: '', firebaseReachable: false });
  const [hiddenApprovalIds, setHiddenApprovalIds] = useState([]);
  const [registrationStatusOverrides, setRegistrationStatusOverrides] = useState(() => {
    const parsed = readStorageValue('registrationStatusOverrides', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  });

  const confirmAdminAction = (message) => window.confirm(message);

  const paginateAdminRows = (rows, adminItemsPerPage, adminCurrentPageValue) => {
    const startIndex = (adminCurrentPageValue - 1) * adminItemsPerPage;
    return rows.slice(startIndex, startIndex + adminItemsPerPage);
  };

  return {
    requests,
    setRequests,
    users,
    setUsers,
    feedback,
    setFeedback,
    updateApprovals,
    setUpdateApprovals,
    activeAdminTab,
    setActiveAdminTab,
    adminSearchTerm,
    setAdminSearchTerm,
    adminDateRange,
    setAdminDateRange,
    adminSubFilter,
    setAdminSubFilter,
    adminCurrentPage,
    setAdminCurrentPage,
    viewRequest,
    setViewRequest,
    viewApproval,
    setViewApproval,
    detailView,
    setDetailView,
    auditTrail,
    setAuditTrail,
    adminNotes,
    setAdminNotes,
    feedbackMetaOverrides,
    setFeedbackMetaOverrides,
    feedbackReplies,
    setFeedbackReplies,
    approvalReplies,
    setApprovalReplies,
    savedAdminViews,
    setSavedAdminViews,
    deletedUsersBin,
    setDeletedUsersBin,
    adminNotifications,
    setAdminNotifications,
    adminDataHealth,
    setAdminDataHealth,
    hiddenApprovalIds,
    setHiddenApprovalIds,
    registrationStatusOverrides,
    setRegistrationStatusOverrides,
    confirmAdminAction,
    paginateAdminRows,
  };
};
