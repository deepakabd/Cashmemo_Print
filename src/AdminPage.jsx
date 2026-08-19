import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      const db = getFirestore();
      setLoading(true);
      setError('');

      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map((userDoc) => ({
          id: userDoc.id,
          ...userDoc.data(),
        }));

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
    const db = getFirestore();
    setError('');

    try {
      await updateDoc(doc(db, 'users', userId), {
        approved: true,
      });
      setUsers((prev) => prev.map((user) => (
        user.id === userId ? { ...user, approved: true } : user
      )));
    } catch {
      setError('Failed to approve user.');
    }
  };
//test
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === 'active' || user.active).length;
  const blockedUsers = users.filter((user) => user.status === 'disabled' || user.blocked).length;
  const expiredUsers = users.filter((user) => user.status === 'expired' || user.expired).length;
  const pendingRegistrations = users.filter((user) => user.status === 'pending' || !user.approved).length;

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
        <div>Pending Registrations: {pendingRegistrations}</div>
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
              <td>{user.approved ? 'Approved' : 'Pending'}</td>
              <td>
                {!user.approved && (
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
