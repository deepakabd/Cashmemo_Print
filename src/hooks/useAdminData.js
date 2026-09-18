import { useRef, useState } from 'react';

const readStorageValue = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const useAdminData = ({ confirmAdminAction: externalConfirmAdminAction } = {}) => {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const confirmedRegistrationStatuses = useRef(new Map());
  const reconcileRegistrationRequests = (nextRequests, live = false) => nextRequests.map((request) => {
    const confirmed = confirmedRegistrationStatuses.current.get(request.id);
    if (!confirmed) return request;
    const status = String(request.status || 'pending').trim().toLowerCase();
    if (status !== 'pending') {
      if (live) confirmedRegistrationStatuses.current.delete(request.id);
      return request;
    }
    return { ...request, status: confirmed };
  });
  const completeRegistrationRequest = (id, status) => {
    // Call only after the server confirms the mutation, never on a failed write.
    confirmedRegistrationStatuses.current.set(id, status);
    setRequests((previous) => reconcileRegistrationRequests(previous));
  };
  const [updateApprovals, setUpdateApprovals] = useState([]);
  const [activeAdminTabState, setActiveAdminTabState] = useState(() => {
    const savedTab = readStorageValue('activeAdminTab', 'dashboard');
    return typeof savedTab === 'string' && savedTab ? savedTab : 'dashboard';
  });
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
  const [adminDataHealth, setAdminDataHealth] = useState({ source: 'unknown', lastSyncAt: '', firebaseReachable: false, error: '' });
  const [hiddenApprovalIds, setHiddenApprovalIds] = useState([]);

  const confirmAdminAction = externalConfirmAdminAction || ((message) => window.confirm(message));

  const setActiveAdminTab = (nextTab) => {
    setActiveAdminTabState((prevTab) => {
      const resolvedTab = typeof nextTab === 'function' ? nextTab(prevTab) : nextTab;
      const safeTab = typeof resolvedTab === 'string' && resolvedTab ? resolvedTab : 'dashboard';
      localStorage.setItem('activeAdminTab', JSON.stringify(safeTab));
      return safeTab;
    });
  };

  const paginateAdminRows = (rows, adminItemsPerPage, adminCurrentPageValue) => {
    const startIndex = (adminCurrentPageValue - 1) * adminItemsPerPage;
    return rows.slice(startIndex, startIndex + adminItemsPerPage);
  };

  return {
    requests,
    setRequests,
    users,
    setUsers,
    updateApprovals,
    setUpdateApprovals,
    activeAdminTab: activeAdminTabState,
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
    completeRegistrationRequest,
    reconcileRegistrationRequests,
    confirmAdminAction,
    paginateAdminRows,
  };
};
