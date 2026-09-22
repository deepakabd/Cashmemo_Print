import React, { useState, useMemo } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { patchAdminUser } from '../services/adminUserRepository';

export const MENU_ACCESS_DEFINITIONS = [
  {
    key: 'hrWorkforce',
    label: '👥 HR & WORKFORCE',
    description: 'Attendance, Employee Profile, Salary Slips, ID Cards, and HR Reports',
    defaultEnabled: true,
  },
  {
    key: 'inventoryReports',
    label: '📦 Inventory Reports',
    description: 'Daily Cylinder Stock Register, Godown Movements, and Inventory Analytics',
    defaultEnabled: true,
  },
  {
    key: 'salesReport',
    label: '📊 Sales Report',
    description: 'Sales Analytics Dashboard, Detailed Sales Data, and Month-wise DAC Register',
    defaultEnabled: true,
  },
  {
    key: 'cashmemoLayout',
    label: '📋 Cashmemo Layout',
    description: 'Cashmemo Print Layout Customization (2, 3, 4 per page) and Label Settings',
    defaultEnabled: true,
  },
  {
    key: 'invoiceWorkspace',
    label: '🧾 INVOICE WORKSPACE',
    description: 'Customer Billing, Tax Invoicing, Payment Tracking, and Sales Statements',
    defaultEnabled: true,
  },
  {
    key: 'allowSalesReupload',
    label: '🔄 Sales Data Re-upload',
    description: 'Permission to re-upload or overwrite sales dumps for confirmed/locked months',
    defaultEnabled: false,
  },
];

export const normalizeUserAccess = (access = {}) => ({
  hrWorkforce: access.hrWorkforce !== false,
  inventoryReports: access.inventoryReports !== false,
  salesReport: access.salesReport !== false,
  cashmemoLayout: access.cashmemoLayout !== false,
  invoiceWorkspace: access.invoiceWorkspace !== false,
  allowSalesReupload: Boolean(access.allowSalesReupload),
});

export const AdminUserAccessPanel = ({
  users = [],
  updateUserInStore,
  pushToast = () => {},
  canMutateAdminData = true,
  setLoggedInUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingAccess, setEditingAccess] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const code = String(u.dealerCode || '').toLowerCase();
      const name = String(u.dealerName || u.name || '').toLowerCase();
      const mobile = String(u.mobile || '').toLowerCase();
      const pkg = String(u.package || '').toLowerCase();
      return code.includes(term) || name.includes(term) || mobile.includes(term) || pkg.includes(term);
    });
  }, [users, searchTerm]);

  const openAccessModal = (user) => {
    setSelectedUser(user);
    setEditingAccess(normalizeUserAccess(user.userAccess));
  };

  const closeAccessModal = () => {
    setSelectedUser(null);
    setEditingAccess(null);
  };

  const handleToggleOption = (key) => {
    if (!editingAccess) return;
    setEditingAccess((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEnableAll = () => {
    setEditingAccess({
      hrWorkforce: true,
      inventoryReports: true,
      salesReport: true,
      cashmemoLayout: true,
      invoiceWorkspace: true,
      allowSalesReupload: editingAccess?.allowSalesReupload || false,
    });
  };

  const handleDisableAll = () => {
    setEditingAccess({
      hrWorkforce: false,
      inventoryReports: false,
      salesReport: false,
      cashmemoLayout: false,
      invoiceWorkspace: false,
      allowSalesReupload: false,
    });
  };

  const saveUserAccess = async (user, accessPayload) => {
    setIsSaving(true);
    try {
      // 1. Try server endpoint
      try {
        await patchAdminUser(user.id, { userAccess: accessPayload });
      } catch (apiErr) {
        console.warn('patchAdminUser API call failed, falling back to direct Firestore update:', apiErr);
        // Fallback directly to Firestore users doc
        await setDoc(doc(db, 'users', user.id), {
          userAccess: accessPayload,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // 2. Update local Admin store
      if (typeof updateUserInStore === 'function') {
        updateUserInStore(user.id, (curr) => ({
          ...curr,
          userAccess: accessPayload,
        }), user.dealerCode);
      }

      // 3. Update loggedInUser if this user is currently active
      if (typeof setLoggedInUser === 'function') {
        setLoggedInUser((curr) => {
          if (!curr || (curr.id !== user.id && String(curr.dealerCode || '').trim() !== String(user.dealerCode || '').trim())) {
            return curr;
          }
          return { ...curr, userAccess: accessPayload };
        });
      }

      pushToast(`User access permissions saved for ${user.dealerCode || user.dealerName}!`, 'success');
      closeAccessModal();
    } catch (error) {
      console.error('Failed to save user access:', error);
      pushToast(`Failed to update user access: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggle = async (user, menuKey) => {
    if (!canMutateAdminData) {
      pushToast('Permission denied: You do not have access to edit user permissions.', 'error');
      return;
    }
    const current = normalizeUserAccess(user.userAccess);
    const updated = {
      ...current,
      [menuKey]: !current[menuKey],
    };
    await saveUserAccess(user, updated);
  };

  return (
    <div className="admin-user-access-panel" style={{ padding: '8px 0' }}>
      {/* Search and Overview Banner */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            User Access &amp; Menu Permissions
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Configure which menus active users can open. When disabled, users see an authorization contact page.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by Code, Name, Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '260px', padding: '8px 12px', fontSize: '13px' }}
          />
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
            {filteredUsers.length} Users
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div
        className="admin-table-wrap"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px #e2e8f0',
          overflowX: 'auto',
        }}
      >
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px' }}>Dealer</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Package &amp; Status</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>👥 HR &amp; Workforce</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>📦 Inventory</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>📊 Sales Report</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>📋 Layout</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>🧾 Invoice</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>🔄 Sales Re-upload</th>
              <th style={{ textAlign: 'center', padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const access = normalizeUserAccess(u.userAccess);
                return (
                  <tr key={u.id || u.dealerCode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '14px' }}>
                        {u.dealerCode || 'No Code'}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {u.dealerName || u.name || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                        {u.package || '-'}
                      </div>
                      <span
                        className={`admin-status-chip admin-status-chip--${u.status === 'active' ? 'active' : 'disabled'}`}
                        style={{ fontSize: '10px', textTransform: 'capitalize' }}
                      >
                        {u.status || 'Active'}
                      </span>
                    </td>

                    {/* Quick Toggle Pills */}
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'hrWorkforce')}
                        title="Click to toggle HR & Workforce access"
                        style={{
                          background: access.hrWorkforce ? '#dcfce7' : '#fee2e2',
                          color: access.hrWorkforce ? '#15803d' : '#b91c1c',
                          border: `1px solid ${access.hrWorkforce ? '#86efac' : '#fca5a5'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.hrWorkforce ? '✅ Enabled' : '❌ Disabled'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'inventoryReports')}
                        title="Click to toggle Inventory access"
                        style={{
                          background: access.inventoryReports ? '#dcfce7' : '#fee2e2',
                          color: access.inventoryReports ? '#15803d' : '#b91c1c',
                          border: `1px solid ${access.inventoryReports ? '#86efac' : '#fca5a5'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.inventoryReports ? '✅ Enabled' : '❌ Disabled'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'salesReport')}
                        title="Click to toggle Sales Report access"
                        style={{
                          background: access.salesReport ? '#dcfce7' : '#fee2e2',
                          color: access.salesReport ? '#15803d' : '#b91c1c',
                          border: `1px solid ${access.salesReport ? '#86efac' : '#fca5a5'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.salesReport ? '✅ Enabled' : '❌ Disabled'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'cashmemoLayout')}
                        title="Click to toggle Cashmemo Layout access"
                        style={{
                          background: access.cashmemoLayout ? '#dcfce7' : '#fee2e2',
                          color: access.cashmemoLayout ? '#15803d' : '#b91c1c',
                          border: `1px solid ${access.cashmemoLayout ? '#86efac' : '#fca5a5'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.cashmemoLayout ? '✅ Enabled' : '❌ Disabled'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'invoiceWorkspace')}
                        title="Click to toggle Invoice Workspace access"
                        style={{
                          background: access.invoiceWorkspace ? '#dcfce7' : '#fee2e2',
                          color: access.invoiceWorkspace ? '#15803d' : '#b91c1c',
                          border: `1px solid ${access.invoiceWorkspace ? '#86efac' : '#fca5a5'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.invoiceWorkspace ? '✅ Enabled' : '❌ Disabled'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(u, 'allowSalesReupload')}
                        title="Click to toggle Sales Data Re-upload permission"
                        style={{
                          background: access.allowSalesReupload ? '#e0f2fe' : '#f1f5f9',
                          color: access.allowSalesReupload ? '#0369a1' : '#64748b',
                          border: `1px solid ${access.allowSalesReupload ? '#7dd3fc' : '#cbd5e1'}`,
                          borderRadius: '20px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: canMutateAdminData ? 'pointer' : 'default',
                        }}
                      >
                        {access.allowSalesReupload ? '🔓 Allowed' : '🔒 Blocked'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button
                        type="button"
                        className="admin-ghost-btn"
                        onClick={() => openAccessModal(u)}
                        disabled={!canMutateAdminData}
                        style={{ fontSize: '12px', padding: '6px 14px' }}
                      >
                        ⚙️ Manage
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog for detailed User Access editing */}
      {selectedUser && editingAccess && (
        <div
          className="admin-modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="admin-modal-content"
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h4 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '800' }}>
                  Manage User Access: {selectedUser.dealerCode}
                </h4>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {selectedUser.dealerName || selectedUser.name || 'Distributor'} • {selectedUser.package || '-'}
                </span>
              </div>
              <button
                type="button"
                onClick={closeAccessModal}
                style={{ background: 'transparent', border: 0, color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Bulk Actions */}
            <div
              style={{
                background: '#f8fafc',
                padding: '12px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Quick Actions:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleEnableAll}
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Enable All Menus
                </button>
                <button
                  type="button"
                  onClick={handleDisableAll}
                  style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Disable All Menus
                </button>
              </div>
            </div>

            {/* Permission Toggle Rows */}
            <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {MENU_ACCESS_DEFINITIONS.map((def) => {
                  const isEnabled = Boolean(editingAccess[def.key]);
                  return (
                    <div
                      key={def.key}
                      onClick={() => handleToggleOption(def.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: isEnabled ? '#f0fdf4' : '#fafafa',
                        border: `1.5px solid ${isEnabled ? '#86efac' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: isEnabled ? '#15803d' : '#334155' }}>
                          {def.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {def.description}
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <div
                        style={{
                          width: '48px',
                          height: '26px',
                          borderRadius: '13px',
                          background: isEnabled ? '#10b981' : '#cbd5e1',
                          position: 'relative',
                          transition: 'background 0.2s ease',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: '3px',
                            left: isEnabled ? '25px' : '3px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                background: '#f8fafc',
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={closeAccessModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveUserAccess(selectedUser, editingAccess)}
                disabled={isSaving}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSaving ? 'wait' : 'pointer',
                }}
              >
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserAccessPanel;

