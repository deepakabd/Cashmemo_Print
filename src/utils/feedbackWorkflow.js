export const getFeedbackWorkflowState = (item, feedbackReplies = {}, feedbackMetaOverrides = {}) => {
  if (!item) return 'awaiting-admin';
  const override = feedbackMetaOverrides[item.id] || {};
  const replyKey = item.id || item.clientFeedbackId || '';
  const hasAdminReply = Boolean(feedbackReplies?.[replyKey] || item?.adminReply);

  return String(
    override.workflowState
    || item.workflowState
    || (item.resolved ? 'resolved' : (hasAdminReply ? 'awaiting-user' : 'awaiting-admin')),
  ).trim().toLowerCase();
};

export const buildFeedbackStatusHistory = (item, feedbackReplies = {}, feedbackMetaOverrides = {}) => {
  if (!item) return [];

  const override = feedbackMetaOverrides[item.id] || {};
  const baseHistory = Array.isArray(override.statusHistory)
    ? override.statusHistory
    : (Array.isArray(item.statusHistory) ? item.statusHistory : []);

  if (baseHistory.length > 0) {
    return baseHistory;
  }

  const history = [];
  const createdAt = item.createdAt || item.date || '';
  if (createdAt) {
    history.push({
      key: 'submitted',
      label: 'Submitted',
      at: createdAt,
    });
  }

  const replyKey = item.id || item.clientFeedbackId || '';
  if (feedbackReplies?.[replyKey]) {
    history.push({
      key: 'awaiting-user',
      label: 'Admin Replied',
      at: override.lastAdminReplyAt || item.updatedAt || createdAt,
    });
  }

  if (item.resolved || override.resolved) {
    history.push({
      key: 'resolved',
      label: 'Resolved',
      at: override.resolvedAt || item.resolvedAt || item.updatedAt || createdAt,
    });
  }

  return history;
};

export const getFeedbackSlaTone = (slaDays = 0, workflowState = '') => {
  if (workflowState === 'resolved') return 'active';
  if (slaDays >= 7) return 'expired';
  if (slaDays >= 3) return 'amber';
  return 'info';
};
