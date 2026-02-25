import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState(0);
  const [expiredUsers, setExpiredUsers] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [unreadFeedback, setUnreadFeedback] = useState(0);

  const fetchUsers = async () => {
    const db = getFirestore();
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      setTotalUsers(usersList.length);
      setActiveUsers(usersList.filter((user) => user.active).length);
      setBlockedUsers(usersList.filter((user) => user.blocked).length);
      setExpiredUsers(usersList.filter((user) => user.expired).length);
      setPendingRegistrations(usersList.filter((user) => !user.approved).length);
      setUnreadFeedback(1); // Placeholder for unread feedback count
    } catch (err) {
      setError('Failed to fetch users.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId) => {
    const db = getFirestore();
    const userDoc = doc(db, 'users', userId);
    try {
      await updateDoc(userDoc, {
        approved: true
      });
      // Refresh the user list
      fetchUsers();
    } catch (err) {
      setError('Failed to approve user.');
    }
  };

  const generateDealerCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="admin-container">
      <h2>Admin - User Approval</h2>
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
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.dealerCode}</td>
              <td>{user.pin}</td>
              <td>{user.approved ? 'Approved' : 'Pending'}</td>
              <td>
                {!user.approved && (
                  <button onClick={() => handleApprove(user.id)}>Approve</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Generate Credentials (Book View)</h2>
      <form>
        <label>
          Dealer Name:
          <input type="text" placeholder="Enter Dealer Name" />
        </label>
        <label>
          Email:
          <input type="email" placeholder="Enter Email" />
        </label>
        <label>
          Package:
          <input type="text" placeholder="पैकेज चुनें" />
        </label>
        <label>
          Dealer Code:
          <input type="text" placeholder="Dealer Code" />
        </label>
        <label>
          Pin:
          <input type="text" placeholder="Pin" />
        </label>
        <label>
          Activation Date:
          <input type="date" />
        </label>
        <label>
          Valid Till:
          <input type="date" />
        </label>
        <button type="submit">Generate Credentials</button>
      </form>

      <h2>Generated Credentials List:</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email}) - Dealer Code: {user.dealerCode}, Pin: {user.pin}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminPage;
