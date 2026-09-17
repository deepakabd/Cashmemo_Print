import React, { useEffect, useState } from 'react';
import { fetchAllAdminUsers, getAdminUserStatistics, patchAdminUser } from './services/adminUserRepository';
import { getUserAccountStatus } from './utils/userAccountStatus';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      setLoading(true);
      setError('');

      try {
        const usersList = await fetchAllAdminUsers();

        if (!cancelled) {
          setUsers(usersList);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to fetch users.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleApprove = async (userId) => {
    setError('');

    try {
      await patchAdminUser(userId, {
        status: 'active',
      });
      setUsers((prev) => prev.map((user) => (
        user.id === userId ? { ...user, status: 'active' } : user
      )));
    } catch {
      setError('Failed to approve user.');
    }
  };
//test
  const statistics = getAdminUserStatistics(users);
  const totalUsers = statistics.total;
  const activeUsers = statistics.byStatus.active || 0;
  const blockedUsers = statistics.byStatus.disabled || 0;
  const expiredUsers = statistics.byStatus.expired || 0;
  const pendingAccounts = statistics.byStatus.pending || 0;

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="admin-container">
      <h2>Admin - User Approval</h2>
      <div className="admin-summary-grid">
        <div>Total Users: {totalUsers}</div>
        <div>Active Users: {activeUsers}</div>
        <div>Blocked Users: {blockedUsers}</div>
        <div>Expired Users: {expiredUsers}</div>
        <div>Pending Accounts: {pendingAccounts}</div>
      </div>

      <table className="user-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Dealer Code</th>
            <th>PIN</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name || user.dealerName || '-'}</td>
              <td>{user.email || '-'}</td>
              <td>{user.dealerCode || '-'}</td>
              <td>{user.pin || '-'}</td>
              <td>{getUserAccountStatus(user)}</td>
              <td>
                {getUserAccountStatus(user) === 'pending' && (
                  <button type="button" onClick={() => handleApprove(user.id)}>
                    Approve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
//check
export default AdminPage;
