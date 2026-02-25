
import { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import FileUpload from './FileUpload';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import CashMemoEnglish from './CashMemoEnglish';
import RateUpdatePage from './RateUpdatePage';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

import './App.css';

// Helper function to convert Excel serial date to JavaScript Date object
const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== 'number' || isNaN(serial)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
  const ms = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date; // Return null if date is invalid
};

// Helper function to format a Date object to DD-MM-YYYY


const formatDateToDDMMYYYY = (date) => {
  if (!(date instanceof Date)) {
    return '';
  }
  if (isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to parse various date string formats
const parseDateString = (dateString) => {
  if (!dateString) return null;

  // Try parsing as YYYY-MM-DD (standard for new Date())
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) return date;

  // Try parsing as DD-MM-YYYY
  let parts = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (parts) {
    date = new Date(parts[3], parts[2] - 1, parts[1]);
    if (!isNaN(date.getTime())) return date;
  }

  // Try parsing as MM/DD/YYYY
  parts = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts) {
    date = new Date(parts[3], parts[1] - 1, parts[2]);
    if (!isNaN(date.getTime())) return date;
  }

  // Try parsing as DD/MM/YYYY
  parts = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts) {
    date = new Date(parts[3], parts[2] - 1, parts[1]);
    if (!isNaN(date.getTime())) return date;
  }

  // If all attempts fail, return null
  return null;
};

const PACKAGE_OPTIONS = [
  'Demo Package - 1 Day',
  'Basic Package - 7 Days',
  'Premium Package - 30 Days',
  'Enterprise Package - 365 Days',
];

const getPackageValidityDays = (packageName = '') => {
  const normalized = String(packageName || '').toLowerCase();
  if (normalized.includes('demo')) return 1;
  if (normalized.includes('basic')) return 7;
  if (normalized.includes('premium')) return 30;
  if (normalized.includes('enterprise')) return 365;
  return 0;
};

const computeValidityDates = (packageName = '', baseDate = new Date()) => {
  const days = getPackageValidityDays(packageName);
  const validFrom = new Date(baseDate);
  const validTill = new Date(baseDate);
  if (days > 0) {
    validTill.setDate(validTill.getDate() + days);
  }
  return {
    packageDays: days,
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
  };
};

const isUserExpired = (user) => {
  const validTillRaw = user?.validTill;
  if (!validTillRaw) return false;
  const validTillDate = new Date(validTillRaw);
  if (Number.isNaN(validTillDate.getTime())) return false;
  return new Date().getTime() > validTillDate.getTime();
};

const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getRemainingDays = (validTill) => {
  if (!validTill) return null;
  const end = new Date(validTill);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const normalizePendingTypeLabel = (type) => {
  const raw = String(type || '').toLowerCase().trim();
  if (raw === 'profile' || raw === 'profiledata') return 'profile';
  if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
  if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
  return raw;
};









function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileUpdate, setShowProfileUpdate] = useState(false);
  const [showRateUpdate, setShowRateUpdate] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [showAboutInfo, setShowAboutInfo] = useState(false);
  const [showInvoicePage, setShowInvoicePage] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [userDealerCode, setUserDealerCode] = useState('');
  const [userPin, setUserPin] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [dealerWelcome, setDealerWelcome] = useState('');
  const [showDataButton, setShowDataButton] = useState(false); // New state for "Show Data" button
  const [fileUploadMessage, setFileUploadMessage] = useState(''); // New state for upload message
  const [showParsedData, setShowParsedData] = useState(false); // New state to control visibility of parsed data

  const readUsersData = () => {
    try {
      const raw = localStorage.getItem('usersData');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeUsersData = (users) => {
    localStorage.setItem('usersData', JSON.stringify(users));
  };

  const updateUserInStore = (userId, updater, dealerCode = '') => {
    if (!userId && !dealerCode) return null;
    const users = readUsersData();
    let idx = users.findIndex((u) => u.id === userId);
    if (idx < 0 && dealerCode) {
      idx = users.findIndex((u) => String(u?.dealerCode || '').trim() === String(dealerCode).trim());
    }
    if (idx < 0) return null;
    const nextUser = updater(users[idx]);
    const nextUsers = [...users];
    nextUsers[idx] = nextUser;
    writeUsersData(nextUsers);
    setLoggedInUser((prev) => {
      if (!prev) return prev;
      if (prev?.id === userId) return nextUser;
      if (dealerCode && String(prev?.dealerCode || '').trim() === String(dealerCode).trim()) return nextUser;
      return prev;
    });
    return nextUser;
  };

  const updateUserInFirebase = async (userId, patch, dealerCode = '') => {
    const payload = { ...patch, updatedAt: serverTimestamp() };

    if (userId) {
      try {
        await updateDoc(doc(db, 'users', userId), payload);
        return userId;
      } catch {}
    }

    if (dealerCode) {
      const snap = await getDocs(query(collection(db, 'users'), where('dealerCode', '==', String(dealerCode).trim())));
      if (!snap.empty) {
        const resolvedId = snap.docs[0].id;
        await updateDoc(doc(db, 'users', resolvedId), payload);
        return resolvedId;
      }
    }

    throw new Error('USER_DOC_NOT_FOUND');
  };

  const submitUpdateApprovalRequest = async ({ type, payload, localKey, successMessage }) => {
    if (!loggedInUser?.id) {
      alert('Please login first.');
      return false;
    }
    if (localKey) {
      localStorage.setItem(localKey, JSON.stringify(payload));
    }
    try {
      const nextApprovalStatus = { ...(loggedInUser.approvalStatus || {}), [type]: 'pending' };
      let approvalSaved = false;

      try {
        const approvalsSnap = await getDocs(query(collection(db, 'updateApprovals'), where('userId', '==', loggedInUser.id)));
        const existingPending = approvalsSnap.docs.find((d) => d.data()?.type === type && d.data()?.status === 'pending');
        if (existingPending) {
          await updateDoc(doc(db, 'updateApprovals', existingPending.id), {
            payload,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            status: 'pending',
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'updateApprovals'), {
            userId: loggedInUser.id,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            type,
            payload,
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        approvalSaved = true;
      } catch {}

      const pendingUpdatePatch = {
        approvalStatus: nextApprovalStatus,
        [`pendingUpdates.${type}`]: {
          status: 'pending',
          payload,
          requestedAt: new Date().toISOString(),
        },
        lastApprovalStorage: approvalSaved ? 'collection' : 'userDoc',
      };
      const resolvedId = await updateUserInFirebase(loggedInUser.id, pendingUpdatePatch, loggedInUser.dealerCode);
      updateUserInStore(
        resolvedId,
        (u) => ({
          ...u,
          approvalStatus: nextApprovalStatus,
          pendingUpdates: {
            ...(u.pendingUpdates || {}),
            [type]: {
              status: 'pending',
              payload,
              requestedAt: new Date().toISOString(),
            },
          },
          id: resolvedId,
        }),
        loggedInUser.dealerCode
      );
      alert(successMessage || 'Your request is pending with admin for approval.');
      return true;
    } catch {
      alert('Request submit failed. Check Firebase permissions.');
      return false;
    }
  };

  const ProfileUpdateForm = ({ onClose }) => {
    const [formData, setFormData] = useState({
      distributorCode: '',
      distributorName: '',
      contact: '',
      email: '',
      gst: '',
      address: '',
    });
    useEffect(() => {
      if (loggedInUser?.profileData) {
        setFormData((prev) => ({ ...prev, ...loggedInUser.profileData }));
      }
    }, [loggedInUser?.profileData]);
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };
    const handleSave = async () => {
      const ok = await submitUpdateApprovalRequest({
        type: 'profile',
        payload: formData,
        localKey: 'profileData',
        successMessage: 'Profile update request submitted. Your request is pending with admin for approval.',
      });
      if (ok) {
        onClose();
      }
    };
    return (
      <div className="placeholder-container">
        <h2>Profile Update</h2>
        <div className="profile-form">
          <span className="profile-label">Distributor Code</span>
          <input className="form-input" name="distributorCode" type="text" value={formData.distributorCode} onChange={handleChange} />
          <span className="profile-label">Distributor Name</span>
          <input className="form-input" name="distributorName" type="text" value={formData.distributorName} onChange={handleChange} />
          <span className="profile-label">Contact</span>
          <input className="form-input" name="contact" type="text" value={formData.contact} onChange={handleChange} />
          <span className="profile-label">Email</span>
          <input className="form-input" name="email" type="email" value={formData.email} onChange={handleChange} />
          <span className="profile-label">GST</span>
          <input className="form-input" name="gst" type="text" value={formData.gst} onChange={handleChange} />
          <span className="profile-label">Address</span>
          <textarea className="form-textarea" name="address" rows="3" value={formData.address} onChange={handleChange} />
        </div>
        <div className="form-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const BankDetailsForm = ({ onClose }) => {
    const defaultBankDetails = {
      bankName: '',
      branch: '',
      accountNo: '',
      ifsc: '',
    };
    const [formData, setFormData] = useState(defaultBankDetails);

    useEffect(() => {
      if (loggedInUser?.bankDetailsData) {
        setFormData((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
      }
    }, [loggedInUser?.bankDetailsData]);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
      const ok = await submitUpdateApprovalRequest({
        type: 'bank',
        payload: formData,
        localKey: 'bankDetailsData',
        successMessage: 'Bank details update request submitted. Your request is pending with admin for approval.',
      });
      if (ok) {
        onClose();
      }
    };

    return (
      <div className="placeholder-container">
        <h2>Bank Details</h2>
        <div className="profile-form">
          <span className="profile-label">Bank Name</span>
          <input className="form-input" name="bankName" type="text" value={formData.bankName} onChange={handleChange} />
          <span className="profile-label">Branch</span>
          <input className="form-input" name="branch" type="text" value={formData.branch} onChange={handleChange} />
          <span className="profile-label">Account No</span>
          <input className="form-input" name="accountNo" type="text" value={formData.accountNo} onChange={handleChange} />
          <span className="profile-label">IFSC Code</span>
          <input className="form-input" name="ifsc" type="text" value={formData.ifsc} onChange={handleChange} />
        </div>
        <div className="form-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  // Placeholder Component for Rate Update
  // const RateUpdatePlaceholder = () => (
  //   <div className="placeholder-container">
  //     <h2>Rate Update Section</h2>
  //     <p>This is where the rate update functionality will be implemented.</p>
  //     <button onClick={() => setShowRateUpdate(false)}>Close</button>
  //   </div>
  // );

  const handleLogin = () => {
    hideAllViews();
    setShowUserLogin(true);
    setShowUserMenu(false);
  };

  const handleUserLoginSubmit = async () => {
    const dealerCode = userDealerCode.trim();
    const pin = userPin.trim();
    if (!dealerCode || !pin) {
      alert('Dealer Code aur PIN required hai.');
      return;
    }

    let firestoreUser = null;
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('dealerCode', '==', dealerCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        const status = String(docData?.status || 'active').toLowerCase();
        if (String(docData?.pin || '') === pin) {
          firestoreUser = {
            id: snap.docs[0].id,
            dealerCode: docData.dealerCode || dealerCode,
            dealerName: docData.dealerName || '',
            mobile: docData.mobile || '',
            email: docData.email || '',
            package: docData.package || '',
            packageDays: docData.packageDays || 0,
            validFrom: docData.validFrom || '',
            validTill: docData.validTill || '',
            pin: docData.pin || '',
            role: docData.role || 'operator',
            status: docData.status || 'active',
            approvalStatus: docData.approvalStatus || {},
            pendingUpdates: docData.pendingUpdates || {},
            profileData: docData.profileData || null,
            bankDetailsData: docData.bankDetailsData || null,
            ratesData: Array.isArray(docData.ratesData) ? docData.ratesData : [],
          };
          if (status !== 'active') {
            firestoreUser.status = status;
          }
        }
      }
    } catch {
      alert('Firebase login check failed. Please try again.');
      return;
    }

    if (!firestoreUser) {
      alert('Invalid Dealer Code / PIN ya account disabled hai.');
      return;
    }

    if (firestoreUser.status === 'pending') {
      alert('Your registration is pending with admin approval.');
      return;
    }

    if (firestoreUser.status === 'disabled') {
      alert('Your account is disabled. Please contact admin.');
      return;
    }

    if (firestoreUser.status === 'expired') {
      alert(`Your package expired on ${formatDisplayDate(firestoreUser.validTill)}. Kindly renew or contact admin.`);
      return;
    }

    if (isUserExpired(firestoreUser)) {
      try {
        await updateDoc(doc(db, 'users', firestoreUser.id), {
          status: 'expired',
          updatedAt: serverTimestamp(),
        });
      } catch {}
      alert(`Your demo/account package expired on ${formatDisplayDate(firestoreUser.validTill)}. Kindly renew or contact admin.`);
      return;
    }

    let users = readUsersData();
    const existingIdx = users.findIndex((u) => String(u?.dealerCode || '').trim() === dealerCode);
    const localUser = existingIdx >= 0
      ? { ...users[existingIdx], ...firestoreUser, id: firestoreUser.id }
      : {
        ...firestoreUser,
        id: firestoreUser.id,
        createdAt: new Date().toISOString(),
      };
    if (existingIdx >= 0) {
      users[existingIdx] = localUser;
    } else {
      users = [...users, localUser];
    }
    writeUsersData(users);

    setLoggedInUser(localUser);
    setIsLoggedIn(true);
    setShowUserLogin(false);
    setUserDealerCode('');
    setUserPin('');
    alert('Logged in successfully!');
  };

  const handleLogout = () => {
    hideAllViews();
    setIsLoggedIn(false);
    setShowUserMenu(false);
    setLoggedInUser(null);
    setShowAboutInfo(true);
    alert('Logged out successfully!');
  };

  const hideAllViews = () => {
    setShowHomeInfo(false);
    setShowAboutInfo(false);
    setShowInvoicePage(false);
    setShowContactForm(false);
    setShowUserProfile(false);
    setShowRegisterForm(false);
    setShowProfileUpdate(false);
    setShowRateUpdate(false);
    setShowBankDetails(false);
    setShowParsedData(false);
    setShowAdminPanel(false);
    setShowAdminLogin(false);
    setShowUserLogin(false);
  };

  const handleProfileUpdate = () => {
    hideAllViews();
    setShowProfileUpdate(true);
    setShowUserMenu(false);
  };

  const handleRateUpdate = () => {
    hideAllViews();
    setShowRateUpdate(true);
    setShowUserMenu(false);
  };
  const handleBankDetails = () => {
    hideAllViews();
    setShowBankDetails(true);
    setShowUserMenu(false);
  };
  const handleRegister = () => {
    hideAllViews();
    setShowRegisterForm(true);
    setShowUserMenu(false);
  };
  const handleUserProfile = () => {
    hideAllViews();
    setShowUserProfile(true);
    setShowUserMenu(false);
  };

  const handleShowData = () => {
    if (!showParsedData) {
      hideAllViews();
      setShowParsedData(true);
    } else {
      setShowParsedData(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      let text = '';
      const userName = loggedInUser?.dealerName || '';
      const userCode = loggedInUser?.dealerCode || '';
      if (userName || userCode) {
        text = userName && userCode ? `${userName} (${userCode})` : (userName || userCode);
      }
      setDealerWelcome(text || '');
    } else {
      setDealerWelcome('');
    }
  }, [isLoggedIn, showProfileUpdate, loggedInUser]);

  const handleHomeOpen = () => {
    hideAllViews();
    setShowHomeInfo(true);
    setShowUserMenu(false);
  };

  const handleAboutOpen = () => {
    hideAllViews();
    setShowAboutInfo(true);
    setShowUserMenu(false);
  };

  const handleInvoiceOpen = () => {
    hideAllViews();
    setShowInvoicePage(true);
    setShowUserMenu(false);
  };

  const handleContactOpen = () => {
    hideAllViews();
    setShowContactForm(true);
    setShowUserMenu(false);
  };

  const handleAdminPanel = () => {
    hideAllViews();
    setShowAdminPanel(true);
    setShowUserMenu(false);
  };

  const handleAdminLoginOpen = () => {
    hideAllViews();
    setShowAdminLogin(true);
    setShowUserMenu(false);
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
    hideAllViews();
    setShowAboutInfo(true);
    setAdminLoginId('');
    setAdminPassword('');
    alert('Admin logged out successfully!');
  };

  const handleAdminLoginSubmit = async () => {
    const loginId = adminLoginId.trim().toLowerCase();
    const password = adminPassword.trim();
    if (!loginId || !password) {
      alert('Admin Email and Password required.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginId, password);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminLoginId('');
      setAdminPassword('');
    } catch {
      alert('Admin login failed. Check Firebase Authentication credentials.');
    }
  };

  const RegisterForm = ({ onClose }) => {
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
    const fixedPackages = PACKAGE_OPTIONS;
    const onChange = (e) => {
      const { name, value } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
    };
    const onSubmit = async () => {
      if (form.pin !== form.confirmPin) {
        alert('PIN aur Confirm PIN match nahi kar rahe');
        return;
      }
      if (!form.package) {
        alert('Please select a package.');
        return;
      }
      const request = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        package: form.package,
        dealerCode: form.dealerCode,
        dealerName: form.dealerName,
        mobile: form.mobile,
        email: form.email,
        pin: form.pin,
        utr: form.utr,
        date: form.date,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      let requestRef = null;
      try {
        requestRef = await addDoc(collection(db, 'registrationRequests'), {
          ...request,
          createdAt: serverTimestamp(),
        });

        const usersRef = collection(db, 'users');
        const existingQuery = query(usersRef, where('dealerCode', '==', form.dealerCode.trim()));
        const existing = await getDocs(existingQuery);
        const validity = computeValidityDates(form.package);
        if (existing.empty) {
          await addDoc(usersRef, {
            dealerCode: form.dealerCode.trim(),
            dealerName: form.dealerName.trim(),
            mobile: form.mobile.trim(),
            email: form.email.trim(),
            pin: form.pin.trim(),
            package: form.package,
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            role: 'operator',
            status: 'pending',
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(existing.docs[0].ref, {
            dealerName: form.dealerName.trim(),
            mobile: form.mobile.trim(),
            email: form.email.trim(),
            pin: form.pin.trim(),
            package: form.package,
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            role: 'operator',
            status: 'pending',
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        alert('Registration save to Firebase failed. Check Firebase config.');
        return;
      }
      const requestToStore = { ...request, id: requestRef.id };
      try {
        const existing = localStorage.getItem('registrationRequests');
        const arr = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(arr) ? arr : [];
        next.push(requestToStore);
        localStorage.setItem('registrationRequests', JSON.stringify(next));
      } catch {
        localStorage.setItem('registrationRequests', JSON.stringify([requestToStore]));
      }
      localStorage.setItem('registrationData', JSON.stringify(form));
      alert('Registration request submitted!');
      onClose();
    };
    return (
      <div className="placeholder-container">
        <h2 className="register-title">रजिस्टर करें</h2>
        <div className="register-form">
          <select name="package" value={form.package} onChange={onChange} className="form-input">
            <option value="">पैकेज चुनें</option>
            {fixedPackages.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
          <input name="dealerCode" className="form-input" placeholder="डीलर कोड (8-अंक)" value={form.dealerCode} onChange={onChange} maxLength={8} />
          <input name="dealerName" className="form-input" placeholder="डीलर का नाम" value={form.dealerName} onChange={onChange} />
          <input name="mobile" className="form-input" placeholder="मोबाइल नंबर (10-अंक)" value={form.mobile} onChange={onChange} maxLength={10} />
          <input name="email" className="form-input" placeholder="ईमेल आईडी" type="email" value={form.email} onChange={onChange} />
          <input name="pin" className="form-input" placeholder="पिन (4-अंक)" type="password" value={form.pin} onChange={onChange} maxLength={4} />
          <input name="confirmPin" className="form-input" placeholder="पिन की पुष्टि करें" type="password" value={form.confirmPin} onChange={onChange} maxLength={4} />
          <input name="utr" className="form-input" placeholder="UTR नंबर" value={form.utr} onChange={onChange} />
          <input name="date" className="form-input" placeholder="तिथि चुनें" type="date" value={form.date} onChange={onChange} />
          <div className="upi-note">UPI ID for Payment: 8002074620@ybl</div>
        </div>
        <div className="form-actions">
          <button onClick={onSubmit}>रजिस्टर करें</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const UserProfile = ({ onClose }) => {
    const [data, setData] = useState(null);
    useEffect(() => {
      if (loggedInUser?.profileData) {
        setData(loggedInUser.profileData);
      } else {
        setData(null);
      }
    }, [loggedInUser?.profileData]);
    return (
      <div className="placeholder-container">
        <h2>User Profile</h2>
        {data ? (
          <div className="profile-form">
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
          </div>
        ) : (
          <div>No profile details found. Please update your profile.</div>
        )}
        <div className="form-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const ContactForm = ({ onClose }) => {
    const [text, setText] = useState('');
    const submitFeedback = async () => {
      if (!loggedInUser?.id) {
        alert('Please login to submit feedback.');
        return;
      }
      if (!text.trim()) {
        alert('Please write feedback first.');
        return;
      }
      const key = 'feedbackData';
      const feedbackEntry = {
        clientFeedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: loggedInUser.id,
        dealerCode: loggedInUser.dealerCode || '',
        dealerName: loggedInUser.dealerName || '',
        email: loggedInUser.email || '',
        text: text.trim(),
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
      } catch {}
      try {
        const resolvedId = await updateUserInFirebase(loggedInUser.id, { feedbackEntries: arrayUnion(feedbackEntry) }, loggedInUser.dealerCode);
        updateUserInStore(
          resolvedId,
          (u) => ({ ...u, feedbackEntries: [...(Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : []), feedbackEntry] }),
          loggedInUser.dealerCode
        );
        anySaved = true;
      } catch {}
      try {
        const existing = localStorage.getItem(key);
        const arr = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(arr) ? arr : [];
        next.push({ ...feedbackEntry, source: 'local' });
        localStorage.setItem(key, JSON.stringify(next));
        anySaved = true;
      } catch {}

      if (anySaved) {
        alert('Feedback submitted. Thank you!');
        onClose();
      } else {
        alert('Unable to save feedback.');
      }
    };
    return (
      <div className="placeholder-container">
        <h2>Contact</h2>
        <div className="profile-form">
          <span className="profile-label">Your Feedback</span>
          <textarea className="form-textarea" rows="5" value={text} onChange={(e) => setText(e.target.value)} placeholder="अपना सुझाव/फीडबैक लिखें" />
          <span className="profile-label">Email</span>
          <span>deepak.youvi@gmail.com</span>
          <span>WhatsApp - 8789358400</span>
        </div>
        <div className="form-actions">
          <button onClick={submitFeedback}>Submit</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const AdminPanel = ({ onClose, onAdminLogout }) => {
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [updateApprovals, setUpdateApprovals] = useState([]);
    const [activeAdminTab, setActiveAdminTab] = useState('pending-registration');
    const [viewRequest, setViewRequest] = useState(null);
    const [viewApproval, setViewApproval] = useState(null);
    const [detailView, setDetailView] = useState(null);
    const [hiddenApprovalIds, setHiddenApprovalIds] = useState([]);
    const [registrationStatusOverrides, setRegistrationStatusOverrides] = useState(() => {
      try {
        const raw = localStorage.getItem('registrationStatusOverrides');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    });
    const [newUser, setNewUser] = useState({
      dealerCode: '',
      dealerName: '',
      mobile: '',
      email: '',
      package: '',
      pin: '',
      role: 'operator',
    });
    const [editingUserId, setEditingUserId] = useState('');
    const [editUser, setEditUser] = useState({
      dealerCode: '',
      dealerName: '',
      mobile: '',
      email: '',
      package: '',
      validFrom: '',
      validTill: '',
      pin: '',
      role: 'operator',
      status: 'active',
      profileData: {
        distributorCode: '',
        distributorName: '',
        contact: '',
        email: '',
        gst: '',
        address: '',
      },
      bankDetailsData: {
        bankName: '',
        branch: '',
        accountNo: '',
        ifsc: '',
      },
    });

    const loadData = async () => {
      try {
        let firebaseRequests = [];
        let firebaseUsers = [];
        let firebaseApprovals = [];
        let firebaseFeedback = [];

        try {
          const reqSnap = await getDocs(collection(db, 'registrationRequests'));
          firebaseRequests = reqSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data()?.createdAt?.toDate?.()?.toISOString?.() || d.data()?.createdAt || '',
            approvedAt: d.data()?.approvedAt?.toDate?.()?.toISOString?.() || d.data()?.approvedAt || '',
          }));
        } catch {}

        try {
          const userSnap = await getDocs(collection(db, 'users'));
          firebaseUsers = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {}

        try {
          const approvalSnap = await getDocs(collection(db, 'updateApprovals'));
          firebaseApprovals = approvalSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            requestedAt: d.data()?.requestedAt?.toDate?.()?.toISOString?.() || d.data()?.requestedAt || '',
            approvedAt: d.data()?.approvedAt?.toDate?.()?.toISOString?.() || d.data()?.approvedAt || '',
            rejectedAt: d.data()?.rejectedAt?.toDate?.()?.toISOString?.() || d.data()?.rejectedAt || '',
          }));
        } catch {}

        try {
          const feedbackSnap = await getDocs(collection(db, 'feedback'));
          firebaseFeedback = feedbackSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data()?.createdAt?.toDate?.()?.toISOString?.() || d.data()?.createdAt || '',
          }));
        } catch {}

        if (firebaseRequests.length === 0) {
          const reqRaw = localStorage.getItem('registrationRequests');
          const reqList = reqRaw ? JSON.parse(reqRaw) : [];
          firebaseRequests = Array.isArray(reqList) ? reqList : [];
        }
        if (firebaseUsers.length === 0) {
          const usersRaw = localStorage.getItem('usersData');
          const userList = usersRaw ? JSON.parse(usersRaw) : [];
          firebaseUsers = Array.isArray(userList) ? userList : [];
        }
        if (firebaseFeedback.length === 0) {
          const fbRaw = localStorage.getItem('feedbackData');
          const fbList = fbRaw ? JSON.parse(fbRaw) : [];
          firebaseFeedback = Array.isArray(fbList) ? fbList : [];
        }

        const reqWithOverrides = firebaseRequests.map((r) => {
          const overriddenStatus = registrationStatusOverrides[r.id];
          return overriddenStatus ? { ...r, status: overriddenStatus } : r;
        });

        const userFeedback = firebaseUsers.flatMap((u) => {
          const list = Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : [];
          return list.map((entry, idx) => ({
            ...entry,
            id: entry?.id || `userfb-${u.id}-${entry?.clientFeedbackId || idx}`,
            source: 'userDoc',
            userId: u.id,
            dealerCode: entry?.dealerCode || u.dealerCode || '',
            dealerName: entry?.dealerName || u.dealerName || '',
            email: entry?.email || u.email || '',
            createdAt: entry?.createdAt || '',
          }));
        });

        const mergedFeedbackMap = new Map();
        [...firebaseFeedback.map((f) => ({ ...f, source: f.source || 'collection' })), ...userFeedback].forEach((f, idx) => {
          const key = f.clientFeedbackId
            ? `${f.userId || f.dealerCode || 'x'}-${f.clientFeedbackId}`
            : `${f.id || 'fb'}-${idx}`;
          if (!mergedFeedbackMap.has(key)) {
            mergedFeedbackMap.set(key, f);
          }
        });
        const mergedFeedback = Array.from(mergedFeedbackMap.values());

        setRequests(reqWithOverrides);
        setUsers(firebaseUsers);
        setUpdateApprovals(firebaseApprovals);
        setFeedback(mergedFeedback);
        localStorage.setItem('registrationRequests', JSON.stringify(reqWithOverrides));
        localStorage.setItem('usersData', JSON.stringify(firebaseUsers));
        localStorage.setItem('feedbackData', JSON.stringify(mergedFeedback));
      } catch {
        try {
          const reqRaw = localStorage.getItem('registrationRequests');
          const reqList = reqRaw ? JSON.parse(reqRaw) : [];
          const usersRaw = localStorage.getItem('usersData');
          const userList = usersRaw ? JSON.parse(usersRaw) : [];
          const fbRaw = localStorage.getItem('feedbackData');
          const fbList = fbRaw ? JSON.parse(fbRaw) : [];
          const reqArray = Array.isArray(reqList) ? reqList : [];
          const reqWithOverrides = reqArray.map((r) => {
            const overriddenStatus = registrationStatusOverrides[r.id];
            return overriddenStatus ? { ...r, status: overriddenStatus } : r;
          });
          setRequests(reqWithOverrides);
          setUsers(Array.isArray(userList) ? userList : []);
          setFeedback(Array.isArray(fbList) ? fbList : []);
          setUpdateApprovals([]);
        } catch {
          setRequests([]);
          setUsers([]);
          setFeedback([]);
          setUpdateApprovals([]);
        }
      }
    };

    const writeUsersLocal = (nextUsers) => {
      setUsers(nextUsers);
      localStorage.setItem('usersData', JSON.stringify(nextUsers));
    };

    const toDateInputValue = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
      return d.toISOString().slice(0, 10);
    };

    const toIsoDate = (value) => {
      if (!value) return '';
      if (String(value).includes('T')) return value;
      const d = new Date(`${value}T00:00:00`);
      return Number.isNaN(d.getTime()) ? value : d.toISOString();
    };

    const setRegistrationOverride = (id, status) => {
      setRegistrationStatusOverrides((prev) => {
        const next = { ...(prev || {}), [id]: status };
        localStorage.setItem('registrationStatusOverrides', JSON.stringify(next));
        return next;
      });
    };

    const resolveEditToken = (user) => {
      const dealerCode = String(user?.dealerCode || '').trim();
      return user?.id || (dealerCode ? `dc:${dealerCode}` : '');
    };

    const isSameUserByToken = (user, token) => {
      if (!token) return false;
      if (user?.id && token === user.id) return true;
      const dealerCode = String(user?.dealerCode || '').trim();
      return dealerCode && token === `dc:${dealerCode}`;
    };

    useEffect(() => {
      loadData();
    }, []);

    const approveRequest = async (id) => {
      const req = requests.find((r) => r.id === id);
      if (!req) return;
      try {
        setRegistrationOverride(id, 'approved');
        const validity = computeValidityDates(req.package || '');
        const requestId = String(id || '');
        const isLocalOnlyRequest = requestId.startsWith('req-') || requestId.startsWith('legacy-');
        let requestStatusUpdated = false;
        const existingUser = users.find((u) => String(u?.dealerCode || '').trim() === String(req?.dealerCode || '').trim());
        if (existingUser?.id) {
          await updateDoc(doc(db, 'users', existingUser.id), {
            dealerCode: req.dealerCode || '',
            dealerName: req.dealerName || '',
            mobile: req.mobile || '',
            email: req.email || '',
            package: req.package || '',
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            pin: req.pin || '',
            status: 'active',
            role: existingUser.role || 'operator',
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'users'), {
            dealerCode: req.dealerCode || '',
            dealerName: req.dealerName || '',
            mobile: req.mobile || '',
            email: req.email || '',
            package: req.package || '',
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            pin: req.pin || '',
            role: 'operator',
            status: 'active',
            approvalStatus: {},
            createdAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
          });
        }
        if (!isLocalOnlyRequest) {
          try {
            await updateDoc(doc(db, 'registrationRequests', id), {
              status: 'approved',
              approvedAt: serverTimestamp(),
            });
            requestStatusUpdated = true;
          } catch {
            // If request document update is blocked by rules, keep user activation successful.
          }
          const nextLocal = requests.map((r) => (r.id === id ? { ...r, status: 'approved', approvedAt: new Date().toISOString() } : r));
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        } else {
          const nextLocal = requests.filter((r) => r.id !== id);
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        }
        await loadData();
        if (!isLocalOnlyRequest && !requestStatusUpdated) {
          setRequests((prev) => prev.filter((r) => r.id !== id));
        }
      } catch {
        alert('Approve failed. Firestore rules/permission check karo.');
      }
    };

    const rejectRequest = async (id) => {
      try {
        setRegistrationOverride(id, 'rejected');
        const requestId = String(id || '');
        const isLocalOnlyRequest = requestId.startsWith('req-') || requestId.startsWith('legacy-');
        if (!isLocalOnlyRequest) {
          await updateDoc(doc(db, 'registrationRequests', id), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
          });
        } else {
          const nextLocal = requests.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r));
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        }
        await loadData();
      } catch {
        alert('Reject failed. Check Firestore rules.');
      }
    };

    const addManualUser = async () => {
      if (!newUser.dealerCode || !newUser.dealerName || !newUser.pin || !newUser.package) {
        alert('Dealer code, dealer name, package and PIN required.');
        return;
      }
      try {
        const validity = computeValidityDates(newUser.package);
        await addDoc(collection(db, 'users'), {
          dealerCode: newUser.dealerCode.trim(),
          dealerName: newUser.dealerName.trim(),
          mobile: newUser.mobile.trim(),
          email: newUser.email.trim(),
          package: newUser.package,
          packageDays: validity.packageDays,
          validFrom: validity.validFrom,
          validTill: validity.validTill,
          pin: newUser.pin.trim(),
          role: newUser.role,
          status: 'active',
          approvalStatus: {},
          createdAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
        });
        setNewUser({ dealerCode: '', dealerName: '', mobile: '', email: '', package: '', pin: '', role: 'operator' });
        await loadData();
      } catch {
        alert('Create user failed.');
      }
    };

    const toggleUserStatus = async (userOrId) => {
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return;
      const nextStatus = target.status === 'active' ? 'disabled' : 'active';
      try {
        if (target.id) {
          await updateDoc(doc(db, 'users', target.id), {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
          await loadData();
          return;
        }
        throw new Error('LOCAL_ONLY_USER');
      } catch {
        const token = resolveEditToken(target);
        const nextUsers = users.map((u) => (isSameUserByToken(u, token) ? { ...u, status: nextStatus } : u));
        writeUsersLocal(nextUsers);
        alert('Status updated locally.');
      }
    };

    const deleteUser = async (userOrId) => {
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return;
      try {
        if (target.id) {
          await deleteDoc(doc(db, 'users', target.id));
          await loadData();
          return;
        }
        throw new Error('LOCAL_ONLY_USER');
      } catch {
        const token = resolveEditToken(target);
        const nextUsers = users.filter((u) => !isSameUserByToken(u, token));
        writeUsersLocal(nextUsers);
        alert('User deleted locally.');
      }
    };

    const startEditUser = (u) => {
      setEditingUserId(resolveEditToken(u));
      setEditUser({
        dealerCode: u.dealerCode || '',
        dealerName: u.dealerName || '',
        mobile: u.mobile || '',
        email: u.email || '',
        package: u.package || '',
        validFrom: toDateInputValue(u.validFrom),
        validTill: toDateInputValue(u.validTill),
        pin: u.pin || '',
        role: u.role || 'operator',
        status: u.status || 'active',
        profileData: {
          distributorCode: u.profileData?.distributorCode || '',
          distributorName: u.profileData?.distributorName || '',
          contact: u.profileData?.contact || '',
          email: u.profileData?.email || '',
          gst: u.profileData?.gst || '',
          address: u.profileData?.address || '',
        },
        bankDetailsData: {
          bankName: u.bankDetailsData?.bankName || '',
          branch: u.bankDetailsData?.branch || '',
          accountNo: u.bankDetailsData?.accountNo || '',
          ifsc: u.bankDetailsData?.ifsc || '',
        },
      });
    };

    const saveEditedUser = async () => {
      if (!editingUserId) return;
      const targetUser = users.find((u) => isSameUserByToken(u, editingUserId));
      if (!targetUser) {
        alert('User not found.');
        return;
      }
      try {
        const fallbackValidity = computeValidityDates(editUser.package);
        const validFromIso = toIsoDate(editUser.validFrom) || fallbackValidity.validFrom;
        const validTillIso = toIsoDate(editUser.validTill) || fallbackValidity.validTill;
        const diffDays = Math.max(0, Math.ceil((new Date(validTillIso).getTime() - new Date(validFromIso).getTime()) / (1000 * 60 * 60 * 24)));
        if (!targetUser.id) {
          throw new Error('LOCAL_ONLY_USER');
        }
        await updateDoc(doc(db, 'users', targetUser.id), {
          dealerCode: editUser.dealerCode.trim(),
          dealerName: editUser.dealerName.trim(),
          mobile: editUser.mobile.trim(),
          email: editUser.email.trim(),
          package: editUser.package,
          packageDays: Number.isFinite(diffDays) ? diffDays : fallbackValidity.packageDays,
          validFrom: validFromIso,
          validTill: validTillIso,
          pin: editUser.pin.trim(),
          role: editUser.role,
          status: editUser.status,
          profileData: { ...editUser.profileData },
          bankDetailsData: { ...editUser.bankDetailsData },
          updatedAt: serverTimestamp(),
        });
        setEditingUserId('');
        await loadData();
      } catch {
        const fallbackValidity = computeValidityDates(editUser.package);
        const validFromIso = toIsoDate(editUser.validFrom) || fallbackValidity.validFrom;
        const validTillIso = toIsoDate(editUser.validTill) || fallbackValidity.validTill;
        const diffDays = Math.max(0, Math.ceil((new Date(validTillIso).getTime() - new Date(validFromIso).getTime()) / (1000 * 60 * 60 * 24)));
        const nextUsers = users.map((u) => (
          isSameUserByToken(u, editingUserId)
            ? {
              ...u,
              dealerCode: editUser.dealerCode.trim(),
              dealerName: editUser.dealerName.trim(),
              mobile: editUser.mobile.trim(),
              email: editUser.email.trim(),
              package: editUser.package,
              packageDays: Number.isFinite(diffDays) ? diffDays : fallbackValidity.packageDays,
              validFrom: validFromIso,
              validTill: validTillIso,
              pin: editUser.pin.trim(),
              role: editUser.role,
              status: editUser.status,
              profileData: { ...editUser.profileData },
              bankDetailsData: { ...editUser.bankDetailsData },
            }
            : u
        ));
        writeUsersLocal(nextUsers);
        setEditingUserId('');
        alert('User updated locally. Firebase permission denied.');
      }
    };

    const normalizeApprovalType = (type) => {
      const raw = String(type || '').toLowerCase().trim();
      if (raw === 'profile' || raw === 'profiledata') return 'profile';
      if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
      if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
      return raw;
    };

    const pendingApprovalRequests = updateApprovals.filter((r) => (r.status || 'pending') === 'pending');
    const fallbackPendingApprovals = users.flatMap((u) => {
      const pendingUpdates = u?.pendingUpdates || {};
      return Object.entries(pendingUpdates)
        .filter(([, v]) => (v?.status || 'pending') === 'pending')
        .map(([type, value]) => ({
          id: `userdoc-${u.id}-${type}`,
          source: 'userDoc',
          userId: u.id,
          dealerCode: u.dealerCode || '',
          dealerName: u.dealerName || '',
          type,
          status: value?.status || 'pending',
          payload: value?.payload ?? null,
          requestedAt: value?.requestedAt || '',
        }));
    });
    const collectionPendingApprovals = pendingApprovalRequests.filter((approval) => {
      const approvalType = normalizeApprovalType(approval.type);
      const user = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
      const pendingStatus = user?.pendingUpdates?.[approvalType]?.status;
      if (!pendingStatus) return true;
      return pendingStatus === 'pending';
    });
    const combinedPendingApprovals = [...collectionPendingApprovals, ...fallbackPendingApprovals]
      .filter((approval) => !hiddenApprovalIds.includes(approval.id));

    const approveUpdateRequest = async (approval) => {
      if (!approval?.id) return;
      const approvalType = normalizeApprovalType(approval.type);
      const fieldByType = {
        profile: 'profileData',
        bank: 'bankDetailsData',
        rates: 'ratesData',
      };
      const targetField = fieldByType[approvalType];
      if (!targetField) {
        alert(`Unsupported approval type: ${approval.type || 'unknown'}`);
        return;
      }
      try {
        const targetUser = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
        if (!targetUser?.id) {
          alert('User not found for approval.');
          return;
        }
        const nextStatus = { ...(targetUser.approvalStatus || {}), [approvalType]: 'approved' };
        if (approvalType === 'rates') {
          nextStatus.rate = 'approved';
          nextStatus.ratesData = 'approved';
        }
        if (approvalType === 'profile') {
          nextStatus.profileData = 'approved';
        }
        if (approvalType === 'bank') {
          nextStatus.bankDetailsData = 'approved';
        }
        await updateDoc(doc(db, 'users', targetUser.id), {
          [targetField]: approval.payload,
          approvalStatus: nextStatus,
          [`pendingUpdates.${approvalType}.status`]: 'approved',
          [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
        if (approval.source !== 'userDoc') {
          try {
            await updateDoc(doc(db, 'updateApprovals', approval.id), {
              status: 'approved',
              approvedAt: serverTimestamp(),
            });
          } catch {}
        }
        setHiddenApprovalIds((prev) => (prev.includes(approval.id) ? prev : [...prev, approval.id]));
        await loadData();
        alert('Request approved successfully.');
      } catch {
        alert('Approval failed.');
      }
    };

    const rejectUpdateRequest = async (approval) => {
      if (!approval?.id) return;
      const approvalType = normalizeApprovalType(approval.type);
      try {
        const targetUser = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
        if (targetUser?.id) {
          const nextStatus = { ...(targetUser.approvalStatus || {}), [approvalType]: 'rejected' };
          if (approvalType === 'rates') {
            nextStatus.rate = 'rejected';
            nextStatus.ratesData = 'rejected';
          }
          if (approvalType === 'profile') {
            nextStatus.profileData = 'rejected';
          }
          if (approvalType === 'bank') {
            nextStatus.bankDetailsData = 'rejected';
          }
          await updateDoc(doc(db, 'users', targetUser.id), {
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'rejected',
            [`pendingUpdates.${approvalType}.rejectedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
        if (approval.source !== 'userDoc') {
          try {
            await updateDoc(doc(db, 'updateApprovals', approval.id), {
              status: 'rejected',
              rejectedAt: serverTimestamp(),
            });
          } catch {}
        }
        setHiddenApprovalIds((prev) => (prev.includes(approval.id) ? prev : [...prev, approval.id]));
        await loadData();
      } catch {
        alert('Reject failed.');
      }
    };

    const toggleFeedbackRead = async (item) => {
      const nextRead = !Boolean(item?.read);
      try {
        if (item?.id) {
          try {
            await updateDoc(doc(db, 'feedback', item.id), {
              read: nextRead,
              updatedAt: serverTimestamp(),
            });
          } catch {}
        }
        const nextFeedback = feedback.map((f) => (f.id === item.id ? { ...f, read: nextRead } : f));
        setFeedback(nextFeedback);
        localStorage.setItem('feedbackData', JSON.stringify(nextFeedback));
      } catch {
        alert('Unable to update feedback status.');
      }
    };

    const deleteFeedbackItem = async (item) => {
      const targetUser = users.find((u) => u.id === item?.userId || String(u?.dealerCode || '').trim() === String(item?.dealerCode || '').trim());
      try {
        if (item?.source !== 'userDoc' && item?.id && !String(item.id).startsWith('userfb-')) {
          try {
            await deleteDoc(doc(db, 'feedback', item.id));
          } catch {}
        }

        if (targetUser?.id) {
          const existingEntries = Array.isArray(targetUser.feedbackEntries) ? targetUser.feedbackEntries : [];
          const filteredEntries = existingEntries.filter((entry) => {
            if (item?.clientFeedbackId) {
              return entry?.clientFeedbackId !== item.clientFeedbackId;
            }
            return String(entry?.text || '') !== String(item?.text || '') || String(entry?.createdAt || '') !== String(item?.createdAt || '');
          });
          try {
            await updateDoc(doc(db, 'users', targetUser.id), {
              feedbackEntries: filteredEntries,
              updatedAt: serverTimestamp(),
            });
          } catch {}
          const nextUsers = users.map((u) => (u.id === targetUser.id ? { ...u, feedbackEntries: filteredEntries } : u));
          writeUsersLocal(nextUsers);
        }

        const nextFeedback = feedback.filter((f) => {
          if (item?.clientFeedbackId && f?.clientFeedbackId) {
            return f.clientFeedbackId !== item.clientFeedbackId;
          }
          return f.id !== item.id;
        });
        setFeedback(nextFeedback);
        localStorage.setItem('feedbackData', JSON.stringify(nextFeedback));
      } catch {
        alert('Unable to delete feedback.');
      }
    };

    const openDetailView = (user, type) => {
      if (type === 'profile') {
        setDetailView({ title: `Profile - ${user?.dealerCode || ''}`, data: user?.profileData || {} });
        return;
      }
      if (type === 'bank') {
        setDetailView({ title: `Bank - ${user?.dealerCode || ''}`, data: user?.bankDetailsData || {} });
        return;
      }
      setDetailView({ title: `Rates - ${user?.dealerCode || ''}`, data: user?.ratesData || [] });
    };

    const pendingRegistrationRequests = requests.filter((r) => (r.status || 'pending') === 'pending');
    const pendingCount = pendingRegistrationRequests.length;
    const activeUsers = users.filter((u) => u.status === 'active').length;
    const activeUsersList = users.filter((u) => u.status === 'active');

    return (
      <div className="placeholder-container admin-panel">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button className="admin-logout-btn" onClick={onAdminLogout}>Log Out</button>
        </div>
        <div className="admin-grid">
          <div className="admin-card">
            <div className="admin-stat-label">Pending Registration Request</div>
            <div className="admin-stat-value">{pendingCount}</div>
          </div>
          <div className="admin-card">
            <div className="admin-stat-label">Active User</div>
            <div className="admin-stat-value">{activeUsers}</div>
          </div>
          <div className="admin-card">
            <div className="admin-stat-label">Total User</div>
            <div className="admin-stat-value">{users.length}</div>
          </div>
        </div>

        <div className="admin-tab-row">
          <button className={activeAdminTab === 'create-user' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('create-user')}>Create User Manually</button>
          <button className={activeAdminTab === 'active-user' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('active-user')}>Active User</button>
          <button className={activeAdminTab === 'total-user' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('total-user')}>Total User</button>
          <button className={activeAdminTab === 'pending-registration' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('pending-registration')}>Pending Registration Request</button>
          <button className={activeAdminTab === 'approval' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('approval')}>Approval</button>
          <button className={activeAdminTab === 'feedback' ? 'admin-tab active' : 'admin-tab'} onClick={() => setActiveAdminTab('feedback')}>Feedback</button>
        </div>

        {activeAdminTab === 'pending-registration' && (
        <div className="admin-section">
          <h3>Pending Registration Requests</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dealer Code</th>
                  <th>Dealer Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Package</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRegistrationRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6">No requests found.</td>
                  </tr>
                ) : (
                  pendingRegistrationRequests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.dealerCode || '-'}</td>
                      <td>{r.dealerName || '-'}</td>
                      <td>{r.mobile || '-'}</td>
                      <td>{r.email || '-'}</td>
                      <td>{r.package || '-'}</td>
                      <td>
                        <div className="admin-actions">
                          <button onClick={() => setViewRequest(r)}>View</button>
                          <button onClick={() => approveRequest(r.id)}>Approve</button>
                          <button onClick={() => rejectRequest(r.id)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeAdminTab === 'create-user' && (
        <div className="admin-section">
          <h3>Create User (Manual)</h3>
          <div className="admin-form">
            <input className="form-input" placeholder="Dealer Code" value={newUser.dealerCode} onChange={(e) => setNewUser((p) => ({ ...p, dealerCode: e.target.value }))} />
            <input className="form-input" placeholder="Dealer Name" value={newUser.dealerName} onChange={(e) => setNewUser((p) => ({ ...p, dealerName: e.target.value }))} />
            <input className="form-input" placeholder="Mobile" value={newUser.mobile} onChange={(e) => setNewUser((p) => ({ ...p, mobile: e.target.value }))} />
            <input className="form-input" placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <select className="form-input" value={newUser.package} onChange={(e) => setNewUser((p) => ({ ...p, package: e.target.value }))}>
              <option value="">Select Package</option>
              {PACKAGE_OPTIONS.map((pkg) => (
                <option key={pkg} value={pkg}>{pkg}</option>
              ))}
            </select>
            <input className="form-input" placeholder="PIN" type="password" maxLength={6} value={newUser.pin} onChange={(e) => setNewUser((p) => ({ ...p, pin: e.target.value }))} />
            <select className="form-input" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={addManualUser}>Create User</button>
          </div>
        </div>
        )}

        {(activeAdminTab === 'active-user' || activeAdminTab === 'total-user') && (
        <div className="admin-section">
          <h3>{activeAdminTab === 'active-user' ? 'Active User' : 'Total User'}</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Package</th>
                  <th>Validity</th>
                  <th>Pin</th>
                  <th>Profile Updated</th>
                  <th>Bank Updated</th>
                  <th>Rate Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeAdminTab === 'active-user' ? activeUsersList : users).length === 0 ? (
                  <tr>
                    <td colSpan="11">No users found.</td>
                  </tr>
                ) : (
                  (activeAdminTab === 'active-user' ? activeUsersList : users).map((u, idx) => (
                    <tr key={u.id || `${u.dealerCode || 'user'}-${idx}`}>
                      <td>{u.dealerCode || '-'}</td>
                      <td>{u.dealerName || '-'}</td>
                      <td>{u.mobile || '-'}</td>
                      <td>{u.email || '-'}</td>
                      <td>{u.package || '-'}</td>
                      <td>
                        {formatDisplayDate(u.validTill)}
                        {getRemainingDays(u.validTill) !== null ? ` (${getRemainingDays(u.validTill)}d)` : ''}
                      </td>
                      <td>{u.pin || '-'}</td>
                      <td>{u.profileData ? <button onClick={() => openDetailView(u, 'profile')}>View</button> : '-'}</td>
                      <td>{u.bankDetailsData ? <button onClick={() => openDetailView(u, 'bank')}>View</button> : '-'}</td>
                      <td>{Array.isArray(u.ratesData) && u.ratesData.length > 0 ? <button onClick={() => openDetailView(u, 'rates')}>View</button> : '-'}</td>
                      <td>
                        <div className="admin-actions">
                          <button onClick={() => startEditUser(u)}>Edit</button>
                          <button onClick={() => toggleUserStatus(u)}>
                            {u.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => deleteUser(u)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {editingUserId && (
          <div className="admin-section">
            <h3>Edit User Details</h3>
            <div className="admin-edit-grid">
              <input className="form-input" placeholder="Dealer Code" value={editUser.dealerCode} onChange={(e) => setEditUser((p) => ({ ...p, dealerCode: e.target.value }))} />
              <input className="form-input" placeholder="Dealer Name" value={editUser.dealerName} onChange={(e) => setEditUser((p) => ({ ...p, dealerName: e.target.value }))} />
              <input className="form-input" placeholder="Mobile" value={editUser.mobile} onChange={(e) => setEditUser((p) => ({ ...p, mobile: e.target.value }))} />
              <input className="form-input" placeholder="Email" value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} />
              <select className="form-input" value={editUser.package} onChange={(e) => setEditUser((p) => ({ ...p, package: e.target.value }))}>
                <option value="">Select Package</option>
                {PACKAGE_OPTIONS.map((pkg) => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
              <input className="form-input" type="date" value={editUser.validFrom} onChange={(e) => setEditUser((p) => ({ ...p, validFrom: e.target.value }))} />
              <input className="form-input" type="date" value={editUser.validTill} onChange={(e) => setEditUser((p) => ({ ...p, validTill: e.target.value }))} />
              <input className="form-input" placeholder="PIN" value={editUser.pin} onChange={(e) => setEditUser((p) => ({ ...p, pin: e.target.value }))} />
              <select className="form-input" value={editUser.role} onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <select className="form-input" value={editUser.status} onChange={(e) => setEditUser((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="admin-edit-grid admin-edit-grid-profile">
              <input className="form-input" placeholder="Profile Distributor Code" value={editUser.profileData.distributorCode} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorCode: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Distributor Name" value={editUser.profileData.distributorName} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorName: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Contact" value={editUser.profileData.contact} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, contact: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Email" value={editUser.profileData.email} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, email: e.target.value } }))} />
              <input className="form-input" placeholder="Profile GST" value={editUser.profileData.gst} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, gst: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Address" value={editUser.profileData.address} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, address: e.target.value } }))} />
            </div>
            <div className="admin-edit-grid admin-edit-grid-bank">
              <input className="form-input" placeholder="Bank Name" value={editUser.bankDetailsData.bankName} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, bankName: e.target.value } }))} />
              <input className="form-input" placeholder="Branch" value={editUser.bankDetailsData.branch} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, branch: e.target.value } }))} />
              <input className="form-input" placeholder="Account No" value={editUser.bankDetailsData.accountNo} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, accountNo: e.target.value } }))} />
              <input className="form-input" placeholder="IFSC" value={editUser.bankDetailsData.ifsc} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, ifsc: e.target.value } }))} />
            </div>
            <div className="form-actions">
              <button onClick={saveEditedUser}>Save User Changes</button>
              <button onClick={() => setEditingUserId('')}>Cancel</button>
            </div>
          </div>
        )}

        {activeAdminTab === 'approval' && (
          <div className="admin-section">
            <h3>Approval</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedPendingApprovals.length === 0 ? (
                    <tr>
                      <td colSpan="5">No pending approval requests.</td>
                    </tr>
                  ) : (
                    combinedPendingApprovals.map((a) => (
                      <tr key={a.id}>
                        <td>{a.dealerCode || '-'}</td>
                        <td>{a.dealerName || '-'}</td>
                        <td>{a.type || '-'}</td>
                        <td>{formatDisplayDate(a.requestedAt)}</td>
                        <td>
                          <div className="admin-actions">
                            <button onClick={() => setViewApproval(a)}>View</button>
                            <button onClick={() => approveUpdateRequest(a)}>Approve</button>
                            <button onClick={() => rejectUpdateRequest(a)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeAdminTab === 'feedback' && (
          <div className="admin-section">
            <h3>Feedback</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Feedback</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.length === 0 ? (
                    <tr>
                      <td colSpan="7">No feedback found.</td>
                    </tr>
                  ) : (
                    feedback.map((f, index) => (
                      <tr key={f.id || index}>
                        <td>{f.dealerCode || '-'}</td>
                        <td>{f.dealerName || '-'}</td>
                        <td>{f.email || '-'}</td>
                        <td>{f.text || '-'}</td>
                        <td className={f.read ? 'feedback-read' : 'feedback-unread'}>{f.read ? 'Read' : 'Unread'}</td>
                        <td>{formatDisplayDate(f.createdAt || f.date)}</td>
                        <td>
                          <div className="admin-actions">
                            <button className={f.read ? 'feedback-unread-btn' : 'feedback-read-btn'} onClick={() => toggleFeedbackRead(f)}>
                              {f.read ? 'Mark Unread' : 'Mark Read'}
                            </button>
                            <button className="feedback-delete-btn" onClick={() => deleteFeedbackItem(f)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewRequest && (
          <div className="admin-section admin-book">
            <h3>Request Details</h3>
            <pre>{JSON.stringify(viewRequest, null, 2)}</pre>
            <div className="form-actions">
              <button onClick={() => setViewRequest(null)}>Close</button>
            </div>
          </div>
        )}

        {viewApproval && (
          <div className="admin-section admin-book">
            <h3>Approval Details</h3>
            <pre>{JSON.stringify(viewApproval.payload || {}, null, 2)}</pre>
            <div className="form-actions">
              <button onClick={() => setViewApproval(null)}>Close</button>
            </div>
          </div>
        )}

        {detailView && (
          <div className="admin-section admin-book">
            <h3>{detailView.title}</h3>
            <pre>{JSON.stringify(detailView.data || {}, null, 2)}</pre>
            <div className="form-actions">
              <button onClick={() => setDetailView(null)}>Close</button>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button onClick={loadData}>Refresh</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const HomeInfo = () => {
    return (
      <div className="placeholder-container">
        <h2 className="home-info-title">This website is only for HPCL Distributor for Cashmemo Printing</h2>
      </div>
    );
  };

  const AboutInfo = () => {
    return (
      <div className="placeholder-container">
        <h2 className="about-info-title">Under Updation</h2>
      </div>
    );
  };
  const InvoicePage = () => {
    const initialInvoiceRates = (() => {
      try {
        const userRates = Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null;
        const parsedRates = userRates || (() => {
          const savedRates = localStorage.getItem('ratesData');
          return savedRates ? JSON.parse(savedRates) : [];
        })();
        if (!Array.isArray(parsedRates)) return [];
        return parsedRates
          .map((rate) => ({
            Code: rate?.Code ?? '',
            HSNCode: String(rate?.HSNCode ?? '27111900').trim() || '27111900',
            Item: String(rate?.Item ?? '').trim(),
            BasicPrice: parseFloat(rate?.BasicPrice) || 0,
            SGST: parseFloat(rate?.SGST) || 0,
            CGST: parseFloat(rate?.CGST) || 0,
            RSP: parseFloat(rate?.RSP) || 0,
          }))
          .filter((rate) => rate.Item);
      } catch {
        return [];
      }
    })();

    const invoiceProfileData = loggedInUser?.profileData || {};
    const dealer = {
      name: invoiceProfileData.distributorName
        ? (invoiceProfileData.distributorCode
          ? `${invoiceProfileData.distributorName} (${invoiceProfileData.distributorCode})`
          : invoiceProfileData.distributorName)
        : '-',
      address: invoiceProfileData.address || '-',
      contact: invoiceProfileData.contact || '-',
      gstn: invoiceProfileData.gst || '-',
    };
    const defaultBankDetails = {
      bankName: '',
      branch: '',
      accountNo: '',
      ifsc: '',
    };
    const [invoiceRates] = useState(initialInvoiceRates);
    const [bankDetails, setBankDetails] = useState(defaultBankDetails);
    const [invoiceRows, setInvoiceRows] = useState([
      { id: `row-${Date.now()}`, item: '', quantity: 1, customRate: '', discount: '' },
    ]);
    const [billToName, setBillToName] = useState('');
    const [billToConsumerNo, setBillToConsumerNo] = useState('');
    const [billToMobileNo, setBillToMobileNo] = useState('');
    const [billToCenterNo, setBillToCenterNo] = useState('');
    const [billToDate, setBillToDate] = useState(new Date().toISOString().slice(0, 10));
    const [billToAddress, setBillToAddress] = useState('');
    const [billToGstin, setBillToGstin] = useState('');
    const invoicePrintRef = useRef(null);
    const toUpperValue = (value) => (value || '').toUpperCase();

    const buildInvoiceRow = () => ({
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item: '',
      quantity: 1,
      customRate: '',
      discount: '',
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = billToDate ? new Date(`${billToDate}T00:00:00`) : null;
    const isPastInvoiceDate = !!selectedDate && !isNaN(selectedDate.getTime()) && selectedDate < today;

    const itemRateMap = useMemo(
      () => new Map(invoiceRates.map((rate) => [rate.Item, rate])),
      [invoiceRates]
    );

    const lineItems = invoiceRows.map((row) => {
      const rate = itemRateMap.get(row.item) || null;
      const qty = Math.max(0, parseFloat(row.quantity) || 0);
      const sgstPct = rate?.SGST || 0;
      const cgstPct = rate?.CGST || 0;
      const fetchedRate = parseFloat(rate?.RSP) || 0;
      const customRateNum = parseFloat(row.customRate);
      const unitRate = isPastInvoiceDate && row.customRate !== '' && !isNaN(customRateNum)
        ? customRateNum
        : fetchedRate;
      const grossTotal = unitRate * qty;
      const discountInput = parseFloat(row.discount);
      const discount = Number.isFinite(discountInput) ? Math.min(Math.max(discountInput, 0), grossTotal) : 0;
      const discountedTotal = Math.max(0, grossTotal - discount);
      const gstFactor = 1 + (sgstPct / 100) + (cgstPct / 100);
      const taxable = gstFactor > 0 ? (discountedTotal / gstFactor) : discountedTotal;
      const sgst = taxable * sgstPct / 100;
      const cgst = taxable * cgstPct / 100;
      const gst = sgst + cgst;
      const total = discountedTotal;

      return {
        id: row.id,
        item: row.item,
        quantity: qty,
        rateData: rate,
        taxable,
        sgstPct,
        cgstPct,
        gstPercent: sgstPct + cgstPct,
        sgst,
        cgst,
        gst,
        unitRate,
        discount,
        total,
      };
    });

    const taxableAmount = lineItems.reduce((sum, row) => sum + row.taxable, 0);
    const sgstAmount = lineItems.reduce((sum, row) => sum + row.sgst, 0);
    const cgstAmount = lineItems.reduce((sum, row) => sum + row.cgst, 0);
    const gstAmount = sgstAmount + cgstAmount;
    const lineTotal = lineItems.reduce((sum, row) => sum + row.total, 0);
    const roundOff = Math.round(lineTotal) - lineTotal;
    const payableTotal = lineTotal + roundOff;
    const numberToWords = (num) => {
      const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen',
      ];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      const belowThousand = (n) => {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
        return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowThousand(n % 100)}` : ''}`;
      };

      if (num === 0) return 'Zero';
      const parts = [];
      const crore = Math.floor(num / 10000000);
      const lakh = Math.floor((num % 10000000) / 100000);
      const thousand = Math.floor((num % 100000) / 1000);
      const hundred = num % 1000;

      if (crore) parts.push(`${belowThousand(crore)} Crore`);
      if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
      if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
      if (hundred) parts.push(belowThousand(hundred));
      return parts.join(' ').trim();
    };

    const rupees = Math.floor(Math.abs(payableTotal));
    const paise = Math.round((Math.abs(payableTotal) - rupees) * 100);
    const payableTotalInWords = `Rupees ${numberToWords(rupees)}${paise ? ` and ${numberToWords(paise)} Paise` : ''} Only`;

    const handleAddProduct = () => {
      setInvoiceRows((prev) => [...prev, buildInvoiceRow()]);
    };

    const buildEmptyProductRow = () => ({
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item: '',
      quantity: 1,
      customRate: '',
      discount: '',
    });

    const handleRemoveProduct = (rowId) => {
      setInvoiceRows((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((row) => row.id !== rowId);
      });
    };

    const handleRowItemChange = (rowId, item) => {
      setInvoiceRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, item, customRate: '' } : row))
      );
    };

    const handleRowQuantityChange = (rowId, quantity) => {
      setInvoiceRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, quantity } : row))
      );
    };

    const handleRowRateChange = (rowId, customRate) => {
      setInvoiceRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, customRate } : row))
      );
    };

    const handleRowDiscountChange = (rowId, discount) => {
      setInvoiceRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, discount } : row))
      );
    };

    const handleClearInvoice = () => {
      setBillToDate('');
      setInvoiceRows([buildEmptyProductRow()]);
    };

    const handleResetInvoice = () => {
      setBillToName('');
      setBillToConsumerNo('');
      setBillToMobileNo('');
      setBillToCenterNo('');
      setBillToAddress('');
      setBillToGstin('');
      setBillToDate('');
      setInvoiceRows([buildEmptyProductRow()]);
    };

    const handlePrintInvoice = () => {
      if (!invoicePrintRef.current) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Unable to open print window. Please allow pop-ups.');
        return;
      }
      const liveSelectTexts = Array.from(invoicePrintRef.current.querySelectorAll('select')).map((selectEl) => {
        return selectEl.options?.[selectEl.selectedIndex]?.text || selectEl.value || '';
      });
      const printClone = invoicePrintRef.current.cloneNode(true);
      printClone.querySelectorAll('select').forEach((selectEl, index) => {
        const selectedText = liveSelectTexts[index] || '';
        const valueNode = document.createElement('span');
        valueNode.className = 'print-select-value';
        valueNode.textContent = selectedText;
        selectEl.replaceWith(valueNode);
      });
      printClone.querySelectorAll('input, textarea').forEach((fieldEl) => {
        const fieldValue = (fieldEl.value || '').trim();
        const isOptionalBillToField =
          fieldEl.classList.contains('billto-consumerno') ||
          fieldEl.classList.contains('billto-centerno') ||
          fieldEl.classList.contains('billto-gstin');
        const isBillToDateField = fieldEl.classList.contains('billto-date');

        if (isOptionalBillToField && !fieldValue) {
          const fieldWrapper = fieldEl.closest('.billto-field');
          if (fieldWrapper) {
            fieldWrapper.remove();
          } else {
            fieldEl.remove();
          }
          return;
        }

        const valueNode = document.createElement('span');
        if (isBillToDateField) {
          const dt = fieldValue ? new Date(`${fieldValue}T00:00:00`) : null;
          const formattedDate = dt && !isNaN(dt.getTime())
            ? `${String(dt.getDate()).padStart(2, '0')}-${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dt.getMonth()]}-${dt.getFullYear()}`
            : '';
          valueNode.className = `${fieldEl.className} print-field-value print-date-value`;
          valueNode.textContent = formattedDate ? `Date: - ${formattedDate}` : 'Date: -';
        } else {
          valueNode.className = fieldEl.tagName === 'TEXTAREA'
            ? `${fieldEl.className} print-field-value print-field-textarea`
            : `${fieldEl.className} print-field-value`;
          valueNode.textContent = fieldValue;
        }
        fieldEl.replaceWith(valueNode);
      });
      const printConsumerNo = printClone.querySelector('.billto-consumerno.print-field-value');
      const printDateValue = printClone.querySelector('.billto-date.print-date-value');
      if (printConsumerNo && printDateValue) {
        const dateStrong = document.createElement('strong');
        dateStrong.className = 'print-date-inline';
        dateStrong.textContent = printDateValue.textContent;
        printConsumerNo.classList.add('print-consumerno-with-date');
        printConsumerNo.appendChild(dateStrong);
        const dateRow = printDateValue.closest('.billto-date-row');
        if (dateRow) {
          dateRow.remove();
        }
      }
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('');
      const printOnlyStyles = `
        <style>
          @page {
            margin: 6mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
          }
          body {
            display: block !important;
            place-items: initial !important;
            align-items: initial !important;
            justify-content: initial !important;
            overflow: auto !important;
          }
          .book-view {
            margin-top: 20px !important;
            padding: 0 !important;
          }
          .invoice-container {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .invoice-tax-label {
            font-size: 12px !important;
            margin-bottom: 4px !important;
          }
          .invoice-header {
            padding: 6px 6px 8px 6px !important;
            gap: 8px !important;
          }
          .invoice-brand {
            grid-template-columns: 180px 1fr !important;
            gap: 8px !important;
          }
          .invoice-logo-image {
            width: 180px !important;
            height: 60px !important;
          }
          .invoice-title {
            font-size: 14px !important;
            line-height: 1.2 !important;
            letter-spacing: 0 !important;
          }
          .invoice-sub {
            font-size: 10px !important;
            line-height: 1.25 !important;
          }
          .invoice-table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          .invoice-table th,
          .invoice-table td {
            padding: 4px 5px !important;
            word-break: break-word !important;
            white-space: normal !important;
          }
          .invoice-table thead th {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }
          .invoice-table tbody td {
            font-size: 9px !important;
          }
          .invoice-table th:nth-child(2),
          .invoice-table td:nth-child(2) {
            width: 34% !important;
            min-width: 0 !important;
          }
          .invoice-table th:nth-child(1),
          .invoice-table td:nth-child(1) {
            width: 4% !important;
          }
          .invoice-table th:nth-child(3),
          .invoice-table td:nth-child(3) {
            width: 6% !important;
          }
          .invoice-table th:nth-child(4),
          .invoice-table td:nth-child(4) {
            width: 9% !important;
          }
          .invoice-table th:nth-child(5),
          .invoice-table td:nth-child(5),
          .invoice-table th:nth-child(6),
          .invoice-table td:nth-child(6),
          .invoice-table th:nth-child(7),
          .invoice-table td:nth-child(7),
          .invoice-table th:nth-child(8),
          .invoice-table td:nth-child(8),
          .invoice-table th:nth-child(9),
          .invoice-table td:nth-child(9),
          .invoice-table th:nth-child(10),
          .invoice-table td:nth-child(10) {
            width: 7% !important;
          }
          .invoice-actions,
          .invoice-row-remove {
            display: none !important;
          }
          .invoice-table th:last-child,
          .invoice-table td:last-child {
            display: none !important;
          }
          .print-select-value {
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
            padding: 6px 8px;
            font-size: 11px;
            line-height: 1.3;
            word-break: break-word;
          }
          .print-field-value {
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
            padding: 6px 8px;
            font-size: 11px;
            line-height: 1.3;
            word-break: break-word;
            white-space: pre-wrap;
          }
          .print-field-textarea {
            min-height: 54px;
          }
          .print-consumerno-with-date {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .print-date-inline {
            font-weight: 700;
            white-space: nowrap;
          }
        </style>
      `;
      const html = `
        <html>
          <head>
            <title>Invoice</title>
            ${styles}
            ${printOnlyStyles}
          </head>
          <body>
            <div class="book-view">
              ${printClone.outerHTML}
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.scrollTo(0, 0);
        printWindow.print();
      }, 300);
    };

    useEffect(() => {
      if (loggedInUser?.bankDetailsData) {
        setBankDetails((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
      } else {
        setBankDetails(defaultBankDetails);
      }
    }, [loggedInUser?.bankDetailsData]);

    return (
      <div className="placeholder-container">
        <div className="invoice-container" ref={invoicePrintRef}>
          <div className="invoice-tax-label">Tax Invoice</div>
          <div className="invoice-header">
            <div className="invoice-brand">
              <div className="invoice-brand-logo">
                <img src="/logo.jpg" alt="Distributor Logo" className="invoice-logo-image" />
              </div>
              <div className="invoice-brand-details">
                <div className="invoice-title">{dealer.name}</div>
                <div className="invoice-sub">{dealer.address}</div>
                <div className="invoice-sub">Contact: {dealer.contact}</div>
                <div className="invoice-sub">GSTIN: {dealer.gstn}</div>
              </div>
            </div>
            
          </div>
          <div className="invoice-grid">
            <div className="section-box billto-section">
              <span className="section-label">Bill To</span>
              <div className="billto-form">
                <div className="billto-field billto-name">
                  <label>Consumer Name</label>
                  <input className="invoice-input" placeholder="Consumer Name" value={billToName} onChange={(e)=>setBillToName(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-field billto-consumerno">
                  <label>Consumer No (if available)</label>
                  <input className="invoice-input billto-consumerno" placeholder="Consumer No (if available)" value={billToConsumerNo} onChange={(e)=>setBillToConsumerNo(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-inline-row">
                  <div className="billto-field">
                    <label>Mobile No</label>
                    <input className="invoice-input billto-mobile" placeholder="Mobile No" value={billToMobileNo} onChange={(e)=>setBillToMobileNo(toUpperValue(e.target.value))} />
                  </div>
                  <div className="billto-field">
                    <label>Center No</label>
                    <input className="invoice-input billto-centerno" placeholder="Center No" value={billToCenterNo} onChange={(e)=>setBillToCenterNo(toUpperValue(e.target.value))} />
                  </div>
                </div>
                <div className="billto-field billto-address">
                  <label>Address</label>
                  <textarea className="invoice-textarea" placeholder="Address" value={billToAddress} onChange={(e)=>setBillToAddress(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-field billto-gstin">
                  <label>GSTIN (if available)</label>
                  <input className="invoice-input billto-gstin" placeholder="GSTIN (if available)" value={billToGstin} onChange={(e)=>setBillToGstin(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-date-row">
                  <div className="billto-field">
                    <label>Date</label>
                    <input className="invoice-input billto-date" type="date" value={billToDate} onChange={(e)=>setBillToDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Goods & Service Description</th>
                <th>HSN</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Discount</th>
                <th>Taxable</th>
                <th>GST %</th>
                <th>GST Amt</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRates.length > 0 ? (
                lineItems.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      <select className="invoice-input" value={row.item} onChange={(e) => handleRowItemChange(row.id, e.target.value)}>
                        <option value="">Select Product</option>
                        {invoiceRates.map((rate) => (
                          <option key={`${rate.Code}-${rate.Item}`} value={rate.Item}>{rate.Item}</option>
                        ))}
                      </select>
                    </td>
                    <td>{row.rateData?.HSNCode ?? row.rateData?.Code ?? '-'}</td>
                    <td>
                      <input
                        className="invoice-input"
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(e) => handleRowQuantityChange(row.id, e.target.value)}
                      />
                    </td>
                    <td>
                      {isPastInvoiceDate ? (
                        <input
                          className="invoice-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.customRate === '' ? (row.rateData?.RSP ?? '') : row.customRate}
                          onChange={(e) => handleRowRateChange(row.id, e.target.value)}
                        />
                      ) : (
                        row.unitRate.toFixed(2)
                      )}
                    </td>
                    <td>
                      <input
                        className="invoice-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.discount || ''}
                        onChange={(e) => handleRowDiscountChange(row.id, e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>{row.taxable.toFixed(2)}</td>
                    <td>{row.gstPercent.toFixed(2)}%</td>
                    <td>{row.gst.toFixed(2)}</td>
                    <td>{row.total.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="invoice-row-remove"
                        onClick={() => handleRemoveProduct(row.id)}
                        disabled={invoiceRows.length <= 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center' }}>
                    No rate data found. Please update rates from the Rate Update section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="invoice-actions">
            <button type="button" className="btn-add-product" onClick={handleAddProduct}>Add Product</button>
            <button type="button" className="btn-print-invoice" onClick={handlePrintInvoice}>Print Invoice</button>
            <button type="button" className="btn-clear-invoice" onClick={handleClearInvoice}>Clear</button>
            <button type="button" className="btn-reset-invoice" onClick={handleResetInvoice}>Reset</button>
          </div>
          <div className="invoice-summary">
            <div className="summary-box">
              <div className="summary-header">SUMMARY</div>
              <table className="summary-table">
                <tbody>
                  <tr><td>Sub-Total</td><td>{taxableAmount.toFixed(2)}</td></tr>
                  <tr><td>GST</td><td>{gstAmount.toFixed(2)}</td></tr>
                  <tr><td>Total</td><td>{lineTotal.toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="summary-box">
              <div className="summary-header">AMOUNT</div>
              <table className="summary-table">
                <tbody>
                  <tr><td>CGST Amt</td><td>{cgstAmount.toFixed(2)}</td></tr>
                  <tr><td>SGST Amt</td><td>{sgstAmount.toFixed(2)}</td></tr>
                  <tr><td>Round Off</td><td>{roundOff.toFixed(2)}</td></tr>
                  <tr><td>Total Amount</td><td><strong>{payableTotal.toFixed(2)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="invoice-total-words-bar">
            <strong>Invoice Total in Words: {payableTotalInWords}</strong>
          </div>
          <div className="invoice-footer">
            <div className="invoice-bank">
              <div><strong>Our Bank Details</strong></div>
              <div>Bank Name: {bankDetails.bankName}</div>
              <div>Branch: {bankDetails.branch}</div>
              <div>Account No: {bankDetails.accountNo}</div>
              <div>IFSC Code: {bankDetails.ifsc}</div>
            </div>
            <div className="invoice-declaration">
              <div><strong>Declaration</strong></div>
              <div>1. Terms & conditions are subject to our trade policy</div>
              <div>2. Our risk & responsibility ceases after the delivery of goods.</div>
              <div>E & O.E.</div>
              
            </div>
          </div>
          <div className="invoice-bottom">“This is computer generated invoice no signature required.”</div>
        </div>
      </div>
    );
  };

  const [parsedData, setParsedData] = useState([]);

  const [headers, setHeaders] = useState([]);
  const [visibleHeaders, setVisibleHeaders] = useState([]); // New state for visible headers
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1); // New state for current page
  const [itemsPerPage] = useState(25); // Number of items per page
  const [pageType, setPageType] = useState('A4 3 Cashmemo/Page'); // New state for page type
  const [customersToPrint, setCustomersToPrint] = useState([]); // New state to hold multiple customers for printing
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]); // New state to track selected customer IDs
  const cashMemoRef = useRef(); // Ref for the cash memo component

  // Sample Dealer Details (to be updated by user registration later)
  const sampleDealerDetails = {
    name: 'RAJE BHAWANISHANKAR ENTERPRISES (41012240)',
    gstn: '27AEXPB6427K1ZZ',
    address: {
      plotNo: 'PLOT NO-3, SECTOR-6, CBD BELAPUR, MAHARASHTRA-400614',
    },
    contact: {
      email: 'raje.thane@hpgas.hpcl.co.in',
      telephone: '022-27571972, 27573871',
    },
  };

  // Filter states
  const [eKycFilter, setEKycFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [natureFilter, setNatureFilter] = useState('All');
  const [mobileStatusFilter, setMobileStatusFilter] = useState('All'); // Assuming this is derived from Mobile No.
  const [consumerStatusFilter, setConsumerStatusFilter] = useState('All');
  const [connectionTypeFilter, setConnectionTypeFilter] = useState('All');
  const [onlineRefillPaymentStatusFilter, setOnlineRefillPaymentStatusFilter] = useState('All');


  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');
  const [cashMemoDateStart, setCashMemoDateStart] = useState('');
  const [cashMemoDateEnd, setCashMemoDateEnd] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // New Filter states
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSourceFilter, setOrderSourceFilter] = useState('All');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [cashMemoStatusFilter, setCashMemoStatusFilter] = useState('All');
  const [deliveryManFilter, setDeliveryManFilter] = useState('All');
  const [isRegMobileFilter, setIsRegMobileFilter] = useState('All');

  // Unique options for filters
  const [uniqueEkycStatuses, setUniqueEkycStatuses] = useState([]);
  const [uniqueAreas, setUniqueAreas] = useState([]);
  const [uniqueNatures, setUniqueNatures] = useState([]);
  const [uniqueMobileStatuses, setUniqueMobileStatuses] = useState([]);
  const [uniqueConsumerStatuses, setUniqueConsumerStatuses] = useState([]);
  const [uniqueConnectionTypes, setUniqueConnectionTypes] = useState([]);
  const [uniqueOnlineRefillPaymentStatuses, setUniqueOnlineRefillPaymentStatuses] = useState([]);



  // New Unique options for filters
  const [uniqueOrderStatuses, setUniqueOrderStatuses] = useState([]);
  const [uniqueOrderSources, setUniqueOrderSources] = useState([]);
  const [uniqueOrderTypes, setUniqueOrderTypes] = useState([]);
  const [uniqueCashMemoStatuses, setUniqueCashMemoStatuses] = useState([]);
  const [uniqueDeliveryMen, setUniqueDeliveryMen] = useState([]);
  const [uniqueIsRegMobileStatuses, setUniqueIsRegMobileStatuses] = useState([]);

  const defaultVisibleHeaders = [
    'Consumer No.',
    'Consumer Name',
    'Delivery Area',
    'Mobile No.',
    'Order Date',
    'Cash Memo Date',
    'Online Refill Payment status',
    'EKYC Status'
  ];

  const handleFileUpload = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target.result;
      if (file.name.endsWith('.csv')) {
        Papa.parse(data, {
          header: true,
          complete: (results) => {
            if (results.data.length > 0) {
              const allHeaders = Object.keys(results.data[0]);
              setHeaders(allHeaders);
              setParsedData(results.data);
              setVisibleHeaders(defaultVisibleHeaders.filter(header => allHeaders.includes(header))); // Set default visible headers

              // Extract unique values for filters
              setUniqueEkycStatuses([...new Set(results.data.map(row => row['EKYC Status']).filter(Boolean))]);
              setUniqueAreas([...new Set(results.data.map(row => row['Delivery Area']).filter(Boolean))]);
              setUniqueNatures([...new Set(results.data.map(row => row['Consumer Nature']).filter(Boolean))]);
              setUniqueMobileStatuses([...new Set(results.data.map(row => row['Mobile No.'] ? 'Available' : 'Not Available').filter(Boolean))]); // Example for Mobile Status
              setUniqueConsumerStatuses([...new Set(results.data.map(row => row['Consumer Type']).filter(Boolean))]);
              setUniqueConnectionTypes([...new Set(results.data.map(row => row['Consumer Package']).filter(Boolean))]);
              setUniqueOnlineRefillPaymentStatuses([...new Set(results.data.map(row => row['Online Refill Payment status']).filter(Boolean))]);


              // New unique options for filters
              setUniqueOrderStatuses([...new Set(results.data.map(row => row['Order Status']).filter(Boolean))]);
              setUniqueOrderSources([...new Set(results.data.map(row => row['Order Source']).filter(Boolean))]);
              setUniqueOrderTypes([...new Set(results.data.map(row => row['Order Type']).filter(Boolean))]);
              setUniqueCashMemoStatuses([...new Set(results.data.map(row => row['Cash Memo Status']).filter(Boolean))]);
              setUniqueDeliveryMen([...new Set(results.data.map(row => row['Delivery Man']).filter(Boolean))]);
              setUniqueIsRegMobileStatuses([...new Set(results.data.map(row => row['Is Reg Mobile'] ? 'Yes' : 'No').filter(Boolean))]);
              setShowDataButton(true);
              setShowParsedData(false);
              setFileUploadMessage('File uploaded successfully!');
              setTimeout(() => {
                setFileUploadMessage('');
              }, 5000); // Hide message after 5 seconds
            } else {
              setHeaders([]);
              setParsedData([]);
              setVisibleHeaders([]);
              // Clear unique options as well
              setUniqueEkycStatuses([]);
              setUniqueAreas([]);
              setUniqueNatures([]);
              setUniqueMobileStatuses([]);
              setUniqueConsumerStatuses([]);
              setUniqueConnectionTypes([]);
              setShowDataButton(false);
              setShowParsedData(false);
              setFileUploadMessage('No data found in file.');
              setTimeout(() => {
                setFileUploadMessage('');
              }, 5000);
            }
            setSelectedCustomerIds([]);
            setCustomersToPrint([]); // Clear customers to print on new file upload
            setSelectedCustomerIds([]); // Clear selected customer IDs on new file upload
          },
          error: (error) => {
            console.error('CSV पार्स करने में त्रुटि:', error);
            alert('CSV फ़ाइल को पार्स करने में त्रुटि हुई।');
            setFileUploadMessage('Error parsing CSV file.');
            setTimeout(() => {
              setFileUploadMessage('');
            }, 5000);
            setShowParsedData(false);
          }
        });
      } else if (file.name.endsWith('.xlsx')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length > 0) {
          const allHeaders = json[0];
          setHeaders(allHeaders);
          setParsedData(json.slice(1).map(row => {
            const rowObject = {};
            json[0].forEach((header, index) => {
              rowObject[header] = row[index];
            });
            return rowObject;
          }));
          setVisibleHeaders(defaultVisibleHeaders.filter(header => allHeaders.includes(header))); // Set default visible headers

          // Extract unique values for filters
          setUniqueEkycStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('EKYC Status')]).filter(Boolean))]);
          setUniqueAreas([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Delivery Area')]).filter(Boolean))]);
          setUniqueNatures([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Nature')]).filter(Boolean))]);
          setUniqueMobileStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Mobile No.')] ? 'Available' : 'Not Available').filter(Boolean))]);
          setUniqueConsumerStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Type')]).filter(Boolean))]);
          setUniqueConnectionTypes([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Consumer Package')]).filter(Boolean))]);
          setUniqueOnlineRefillPaymentStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Online Refill Payment status')]).filter(Boolean))]);


          // New unique options for filters
          setUniqueOrderStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Status')]).filter(Boolean))]);
          setUniqueOrderSources([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Source')]).filter(Boolean))]);
          setUniqueOrderTypes([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Order Type')]).filter(Boolean))]);
          setUniqueCashMemoStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Cash Memo Status')]).filter(Boolean))]);
          setUniqueDeliveryMen([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Delivery Man')]).filter(Boolean))]);
          setUniqueIsRegMobileStatuses([...new Set(json.slice(1).map(row => row[allHeaders.indexOf('Is Reg Mobile')] ? 'Yes' : 'No').filter(Boolean))]);
          setShowDataButton(true);
          setShowParsedData(false);
          setFileUploadMessage('File uploaded successfully!');
          setTimeout(() => {
            setFileUploadMessage('');
          }, 5000); // Hide message after 5 seconds
        } else {
          setHeaders([]);
          setParsedData([]);
          setVisibleHeaders([]);
          // Clear unique options as well
          setUniqueEkycStatuses([]);
          setUniqueAreas([]);
          setUniqueNatures([]);
          setUniqueMobileStatuses([]);
          setUniqueConsumerStatuses([]);
          setUniqueConnectionTypes([]);
          setShowDataButton(false);
          setShowParsedData(false);
          setFileUploadMessage('No data found in file.');
          setTimeout(() => {
            setFileUploadMessage('');
          }, 5000);
        }
        setSelectedCustomerIds([]);
        setCustomersToPrint([]); // Clear customers to print on new file upload
      }
    };

    reader.onerror = (error) => {
      console.error('फ़ाइल पढ़ने में त्रुटि:', error);
      alert('फ़ाइल पढ़ने में त्रुटि हुई।');
      setFileUploadMessage('Error reading file.');
      setTimeout(() => {
        setFileUploadMessage('');
      }, 5000);
      setShowParsedData(false);
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };




  const handleResetFilters = () => {
    setSearchTerm('');
    setEKycFilter('All');
    setAreaFilter('All');
    setNatureFilter('All');
    setMobileStatusFilter('All');
    setConsumerStatusFilter('All');
    setConnectionTypeFilter('All');
    setOnlineRefillPaymentStatusFilter('All');


    setOrderDateStart('');
    setOrderDateEnd('');
    setCashMemoDateStart('');
    setCashMemoDateEnd('');
    setSortBy('');
    setSortOrder('asc');
    setOrderStatusFilter('All');
    setOrderSourceFilter('All');
    setOrderTypeFilter('All');
    setCashMemoStatusFilter('All');
    setDeliveryManFilter('All');
    setIsRegMobileFilter('All');
    setCurrentPage(1);
    setSelectedCustomerIds([]); // Clear selected customer IDs on reset
  };

  const handlePrintData = () => {
    const printContent = `
      <style>
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid black;
          padding: 8px;
          text-align: left;
        }
      </style>
      <h1>List of Cash Memo</h1>
      <table>
        <thead>
          <tr>
            ${visibleHeaders.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filteredData.map(row => `
            <tr>
              ${visibleHeaders.map(header => {
                let displayValue = row[header];

                if (header === 'Order Date' || header === 'Cash Memo Date') {
                  let date = null;
                  if (typeof row[header] === 'number') {
                    date = excelSerialDateToJSDate(row[header]);
                  } else if (typeof row[header] === 'string') {
                    date = parseDateString(row[header]);
                  }
                  displayValue = formatDateToDDMMYYYY(date);
                } else if (header === 'Online Refill Payment status') {
                  displayValue = row[header] === 'PAID' ? 'PAID' : 'COD';
                }

                return `<td>${displayValue}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p>Total Records: ${filteredData.length}</p>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };
  const handlePrintCashmemo = () => {
      if (selectedCustomerIds.length === 0) {
        alert('Please select at least one cashmemo to print.');
        return;
      }

      const customersToPrint = parsedData.filter(customer =>
        selectedCustomerIds.includes(String(customer['Consumer No.']))
      );

      let allCashMemosHtml = '';

      const pd = loggedInUser?.profileData || null;
      const dealerDetails = {
        name: pd?.distributorName
          ? (pd?.distributorCode ? `${pd.distributorName} (${pd.distributorCode})` : pd.distributorName)
          : '-',
        gstn: pd?.gst || '-',
        address: { plotNo: pd?.address || '-' },
        contact: {
          email: pd?.email || '-',
          telephone: pd?.contact || '-',
        },
      };

      customersToPrint.forEach((customer, index) => {
        const processedCustomer = { ...customer };

        // Convert 'Order Date'
        if (typeof processedCustomer['Order Date'] === 'number') {
          processedCustomer['Order Date'] = excelSerialDateToJSDate(processedCustomer['Order Date']);
        } else if (typeof processedCustomer['Order Date'] === 'string') {
          processedCustomer['Order Date'] = parseDateString(processedCustomer['Order Date']);
        } else {
          processedCustomer['Order Date'] = null; // Set to null if not a number or string
        }

        // Convert 'Cash Memo Date'
        if (typeof processedCustomer['Cash Memo Date'] === 'number') {
          processedCustomer['Cash Memo Date'] = excelSerialDateToJSDate(processedCustomer['Cash Memo Date']);
        } else if (typeof processedCustomer['Cash Memo Date'] === 'string') {
          processedCustomer['Cash Memo Date'] = parseDateString(processedCustomer['Cash Memo Date']);
        } else {
          processedCustomer['Cash Memo Date'] = null; // Set to null if not a number or string
        }

        try {
          const rates = Array.isArray(loggedInUser?.ratesData)
            ? loggedInUser.ratesData
            : (() => {
              const savedRates = localStorage.getItem('ratesData');
              return savedRates ? JSON.parse(savedRates) : [];
            })();
          if (Array.isArray(rates) && rates.length > 0) {
              const productText = String(processedCustomer['Consumer Package'] || '').toLowerCase();
              const match = rates.find(r => {
                const itemText = String(r.Item || '').toLowerCase();
                return productText.includes(itemText) || itemText.includes(productText);
              });
              if (match) {
                const basic = parseFloat(match.BasicPrice) || 0;
                const sgstPct = parseFloat(match.SGST) || 0;
                const cgstPct = parseFloat(match.CGST) || 0;
                const cgstAmt = parseFloat((basic * cgstPct / 100).toFixed(2));
                const sgstAmt = parseFloat((basic * sgstPct / 100).toFixed(2));
                const rsp = parseFloat(match.RSP) || 0;
                processedCustomer['Base Price (₹)'] = basic;
                processedCustomer['Delivery Charges (₹)'] = processedCustomer['Delivery Charges (₹)'] || 0;
                processedCustomer['Cash & Carry Rebate (₹)'] = processedCustomer['Cash & Carry Rebate (₹)'] || 0;
                processedCustomer['CGST (2.50%) (₹)'] = cgstAmt;
                processedCustomer['SGST (2.50%) (₹)'] = sgstAmt;
                processedCustomer['Total Amount (₹)'] = rsp;
              }
          }
        } catch {}

        const cashMemoHtml = renderToString(
          <CashMemoEnglish customer={processedCustomer} pageType={pageType} dealerDetails={dealerDetails} formatDateToDDMMYYYY={formatDateToDDMMYYYY} />
        );

        let wrapperStyles = `
          width: 100%;
          box-sizing: border-box;
          padding: 5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        `;

        if (pageType === 'A4 3 Cashmemo/Page') {
          wrapperStyles += `height: 97.66mm;`; // A4 height (297mm) / 3 - 2mm margin
          if ((index + 1) % 3 !== 0) {
            wrapperStyles += `margin-bottom: 2mm;`;
          }
          if ((index + 1) % 3 === 0) {
            wrapperStyles += `page-break-after: always;`;
          }
        } else if (pageType === 'Lager 4 Cashmemo/Page') {
          wrapperStyles += `height: 72.75mm;`; // A4 height (297mm) / 4 - 2mm margin
          if ((index + 1) % 4 !== 0) {
            wrapperStyles += `margin-bottom: 2mm;`;
          }
          if ((index + 1) % 4 === 0) {
            wrapperStyles += `page-break-after: always;`;
          }
        }

        allCashMemosHtml += `<div style="${wrapperStyles}">${cashMemoHtml}</div>`;
      });

      const fullHtml = `
        <html>
          <head>
            <title>Cash Memos</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; }
              /* Styles from CashMemoEnglish.jsx */
              .cash-memo-container {
                font-family: Arial, sans-serif;
                border: 1px solid #000;
                padding: 5mm;
                margin: 0 auto;
                box-sizing: border-box;
                background-color: white; /* Outer background white */
                color: black; /* Default text color black */
              }
              .cash-memo-wrapper {
                border: 1px solid #ccc;
                page-break-inside: avoid; /* Prevent cash memo from breaking across pages */
              }
              .cash-memo-single {
                display: flex;
                font-family: Arial, sans-serif;
                width: 100%;
                box-sizing: border-box;
                height: 100%;
                background-color: white;
                page-break-inside: avoid; /* Prevent cash memo content from breaking across pages */
              }
              .distributor-copy {
                width: 50%;
                border-right: 1px dashed black;
                padding: 5px;
                box-sizing: border-box;
                font-size: 10px;
                height: 100%;
                color: black;
              }
              .tax-invoice {
                width: 50%;
                padding: 5px;
                box-sizing: border-box;
                font-size: 10px;
                height: 100%;
                color: black;
              }
              .distributor-header {
                position: relative;
                width: 100%;
              }
              .distributor-header-details {
                position: absolute;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                text-align: right;
                color: black;
                font-size: 8px;
                font-weight: bold;
              }
              .distributor-copy-title {
                margin: 5px 0 5px 0;
                font-weight: bold;
                font-size: 12px;
                color: black;
              }
              .customer-details-distributor {
                border: 1px solid black;
                padding: 5px;
                margin-bottom: 5px;
                display: flex;
                font-size: 8px;
              }
              .distributor-details-left {
                flex: 1;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 1px;
                padding-right: 5px;
                border-right: 1px dashed #ccc;
              }
              .distributor-details-right {
                width: 150px;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 1px;
                padding-left: 5px;
              }
              .tax-invoice-header {
                position: relative;
                width: 100%;
              }
              .tax-invoice-header-details {
                position: absolute;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                text-align: right;
                color: black;
                font-size: 8px;
                font-weight: bold;
              }
              .tax-invoice-title {
                margin: 5px 0;
                font-weight: bold;
                font-size: 12px;
                color: black;
              }
              .customer-details-tax-invoice {
                border: 1px solid black;
                padding: 5px;
                margin-bottom: 5px;
                display: flex;
                font-size: 8px;
              }
              .tax-invoice-details-left {
                flex: 1;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 1px;
                padding-right: 5px;
                border-right: 1px dashed #ccc;
              }
              .tax-invoice-details-right {
                width: 150px;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 1px;
                padding-left: 5px;
              }
              .delivery-details {
                border: 1px solid black;
                padding: 5px;
                margin-bottom: 5px;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 1px;
                font-size: 8px;
              }
              .product-details {
                padding: 5px;
                margin-bottom: 5px;
                font-size: 8px;
              }
              .declaration {
                border: 1px solid black;
                padding: 30px;
                margin-bottom: 5px;
                font-size: 7px;
                color: red;
              }
              .signature-section {
                margin-top: 10px;
                border-top: 1px solid black;
                width: 150px;
                margin-left: auto;
              }
              .contact-info {
                display: flex;
                grid-template-columns: 1fr 1fr 1fr 1fr auto;
                gap: 0px;
                align-items: center;
                padding: 0px 0;
                font-size: 7px;
                border-bottom: 1px solid black;
                margin-bottom: 5px;
                background-color: rgb(0, 0, 128);
                color: white;
              }
              .contact-info-strong {
                color: white;
                font-size: 9px;
              }
              .hp-pay-image-container {
                text-align: center;
                width: 30%;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .hp-pay-image {
                width: 70px;
                margin-bottom: 5px;
              }
              .image-1906-container {
                flex: 1;
                text-align: right;
              }
              .image-1906 {
                height: 15px;
                vertical-align: middle;
              }
              .header-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin: 5px 0;
              }
              .distributor-header-image {
                width: 35%;
              }
              .distributor-header-detail-text {
                margin: 0;
              }
              .tax-invoice-header-image {
                width: 100%;
              }
              .tax-invoice-header-detail-text {
                margin: 0;
              }
              .declaration-text {
                margin: 0;
              }
              .signature-text {
                margin: 0;
                font-size: 8px;
                text-align: right;
              }
              .price-value {
                text-align: right;
              }
              .total-amount {
                font-weight: bold;
              }
              .status-alert {
                color: #d32f2f;
                font-weight: bold;
              }
              .status-paid {
                font-weight: bold;
              }
              .payable-bold {
                font-weight: bold;
              }
              .instructions-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 5px;
                font-size: 7px;
              }
              .instructions-text-container {
                line-height: 1.2;
                width: 70%;
              }
              .instructions-title {
                margin: 0;
                font-weight: bold;
              }
              .instructions-list {
                margin: 0;
                padding-left: 10px;
              }
              .header-content-flex-spacer {
                flex: 1;
              }
              .header, .customer-details, .delivery-details, .product-details, .amount-details, .declaration, .contact-info {
                margin-bottom: 5px;
              }
              .header div, .customer-details div, .delivery-details div, .product-details div, .amount-details div {
                display: flex;
                justify-content: space-between;
                margin-bottom: 2px;
              }
              .header span, .customer-details span, .delivery-details span, .product-details span, .amount-details span {
                font-size: 9px;
              }
              .header .title {
                font-size: 12px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 5px;
              }
              .declaration {
                font-size: 8px;
                font-weight: bold;
                text-align: center;
                margin-top: 5px;
                color: red; /* Declaration text red */
              }
              .contact-info {
               
                gap: 120px;
                background-color: #00008B; /* Blue background */
                color: white; /* White text */
                padding: 3px 5mm;
                font-size: 8px;
                margin-top: 5px;
              }
              .contact-info span {
                font-weight: bold;
              }
              .section-title {
                font-weight: bold;
                background-color: #eee;
                padding: 2px;
                margin-bottom: 3px;
                font-size: 9px;
              }
              .text-center {
                text-align: center;
              }
              .text-right {
                text-align: right;
              }
              .font-bold {
                font-weight: bold;
              }
              .flex-container {
                display: flex;
                justify-content: space-between;
              }
              .flex-item {
                width: 48%; /* Adjust as needed */
              }
              .address-value {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            </style>
          </head>
          <body>
            <div id="print-root" style="display: flex; flex-wrap: wrap; align-content: flex-start;">
              ${allCashMemosHtml}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(fullHtml);
      printWindow.document.close();

      // Wait for images and other resources to load before printing
      printWindow.onload = () => {
        printWindow.print();
            // printWindow.close(); // Keep the window open after printing
      };
    };

  const handleCheckboxChange = (consumerNo) => {
    setSelectedCustomerIds(prev => {
      const stringConsumerNo = String(consumerNo);
      if (prev.includes(stringConsumerNo)) {
        return prev.filter(id => id !== stringConsumerNo);
      } else {
        return [...prev, stringConsumerNo];
      }
    });
  };

  const handleSelectAllChange = (event) => {
    if (event.target.checked) {
      const allConsumerNos = filteredData.map(customer => String(customer['Consumer No.']));
      setSelectedCustomerIds(allConsumerNos);
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const filteredData = useMemo(() => {

    let tempFilteredData = parsedData.filter(row => {
      const consumerNo = String(row['Consumer No.']);
      return /^\d{6}$/.test(consumerNo);
    });

    // Search Term Filter
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      tempFilteredData = tempFilteredData.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(lowercasedSearchTerm)
        )
      );
    }

    // Dropdown Filters
    if (eKycFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['EKYC Status'] === eKycFilter);
    }
    if (areaFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Area'] === areaFilter);
    }
    if (natureFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Nature'] === natureFilter);
    }
    if (mobileStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        mobileStatusFilter === 'Available' ? (row['Mobile No.'] && row['Mobile No.'] !== '') : (!row['Mobile No.'] || row['Mobile No.'] === '')
      );
    }
    if (consumerStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Type'] === consumerStatusFilter);
    }
    if (connectionTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Package'] === connectionTypeFilter);
    }
    if (onlineRefillPaymentStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Online Refill Payment status'] === onlineRefillPaymentStatusFilter);
    }



    // New Dropdown Filters
    if (orderStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Status'] === orderStatusFilter);
    }
    if (orderSourceFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Source'] === orderSourceFilter);
    }
    if (orderTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Type'] === orderTypeFilter);
    }
    if (cashMemoStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Cash Memo Status'] === cashMemoStatusFilter);
    }
    if (deliveryManFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Man'] === deliveryManFilter);
    }
    if (isRegMobileFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        isRegMobileFilter === 'Yes' ? (row['Is Reg Mobile'] && row['Is Reg Mobile'] !== '') : (!row['Is Reg Mobile'] || row['Is Reg Mobile'] === '')
      );
    }

    // Date Range Filters
    // Order Date (assuming 'Order Date' is the order date)
    if (orderDateStart && orderDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const rowDate = row['Order Date'];
        if (!rowDate) return false; // Skip if date is not available

        // Convert Excel serial date to JS Date object if it's a number, otherwise try to parse directly
        const convertedRowDate = typeof rowDate === 'number' ? excelSerialDateToJSDate(rowDate) : new Date(rowDate);

        if (!convertedRowDate || isNaN(convertedRowDate.getTime())) return false; // Skip if conversion failed

        const orderDate = convertedRowDate;
        const start = new Date(orderDateStart);
        const end = new Date(orderDateEnd);
        end.setHours(23, 59, 59, 999);
        // Set time to 00:00:00 for accurate date comparison
        orderDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return orderDate >= start && orderDate <= end;
      });
    }

    // Cash Memo Date
    if (cashMemoDateStart && cashMemoDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const rowDate = row['Cash Memo Date'];
        if (!rowDate) return false; // Skip if date is not available

        // Convert Excel serial date to JS Date object if it's a number, otherwise try to parse directly
        const convertedRowDate = typeof rowDate === 'number' ? excelSerialDateToJSDate(rowDate) : new Date(rowDate);

        if (!convertedRowDate || isNaN(convertedRowDate.getTime())) return false; // Skip if conversion failed

        const cashMemoDate = convertedRowDate;
        const start = new Date(cashMemoDateStart);
        const end = new Date(cashMemoDateEnd);
        end.setHours(23, 59, 59, 999);
        // Set time to 00:00:00 for accurate date comparison
        cashMemoDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return cashMemoDate >= start && cashMemoDate <= end;
      });
    }

    // Sorting
    if (sortBy) {
      tempFilteredData = [...tempFilteredData].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (aValue === undefined || aValue === null) return sortOrder === 'asc' ? 1 : -1;
        if (bValue === undefined || bValue === null) return sortOrder === 'asc' ? -1 : 1;

        // Handle date sorting
        if (sortBy === 'Order Date' || sortBy === 'Cash Memo Date') {
          const dateA = new Date(aValue);
          const dateB = new Date(bValue);
          return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
        // Fallback for other types or mixed types
        return 0;
      });
    }

    return tempFilteredData;
  }, [
    parsedData,
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,


    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
  ]);

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
  ]);



  // Calculate total pages
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Get current page data
  const currentTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const addColumn = (header) => {
    if (!visibleHeaders.includes(header)) {
      setVisibleHeaders(prev => [...prev, header]);
    }
  };

  const removeColumn = (header) => {
    setVisibleHeaders(prev => prev.filter(h => h !== header));
  };

  const handleSaveRatesForUser = async (rates) => {
    if (!loggedInUser?.id) return;
    const normalizedRates = Array.isArray(rates) ? rates : [];
    await submitUpdateApprovalRequest({
      type: 'rates',
      payload: normalizedRates,
      localKey: 'ratesData',
      successMessage: 'Rate update request submitted. Your request is pending with admin for approval.',
    });
  };

  const availableHeadersToAdd = headers.filter(header => !visibleHeaders.includes(header));
  const hideUserNavbar = showAdminPanel;
  const pendingTypesFromUpdates = Object.entries(loggedInUser?.pendingUpdates || {})
    .filter(([, value]) => String(value?.status || '').toLowerCase() === 'pending')
    .map(([type]) => normalizePendingTypeLabel(type));
  const pendingTypesFromStatus = Object.entries(loggedInUser?.approvalStatus || {})
    .filter(([, status]) => status === 'pending')
    .map(([type]) => normalizePendingTypeLabel(type));
  const pendingUserApprovalTypes = Array.from(new Set([...pendingTypesFromUpdates, ...pendingTypesFromStatus]));

  return (
    <>
      {!hideUserNavbar && (
        <nav className="navbar">
          <div className="navbar-left">
            <button className="navbar-button" onClick={handleHomeOpen}>Home</button>
            <button className="navbar-button" onClick={handleAboutOpen}>About</button>
            {isLoggedIn && <button className="navbar-button" onClick={handleInvoiceOpen}>Invoice</button>}
            <button className="navbar-button" onClick={handleContactOpen}>Contact</button>
            {isLoggedIn && !showDataButton && <FileUpload onFileUpload={handleFileUpload} />}
            {isLoggedIn && showDataButton && (
              <button onClick={handleShowData} className="navbar-button">{showParsedData ? 'Hide Data' : 'Show Data'}</button>
            )}
          </div>
          <div className="navbar-right">
            {isLoggedIn ? (
              <div className="user-menu-container">
                <span className="navbar-welcome">Welcome, {dealerWelcome}</span>
                {pendingUserApprovalTypes.length > 0 && (
                  <span className="navbar-pending-msg">
                    Your {pendingUserApprovalTypes.join(', ')} request is pending with admin for approval.
                  </span>
                )}
                <div className="user-icon" onClick={() => setShowUserMenu(!showUserMenu)}>
                  &#128100; {/* User icon */}
                </div>
                {showUserMenu && (
                  <div className="dropdown-menu">
                    <button onClick={handleUserProfile}>User Profile</button>
                    <button onClick={handleProfileUpdate}>Profile Update</button>
                    <button onClick={handleBankDetails}>Bank Details</button>
                    <button onClick={handleRateUpdate}>Rate Update</button>
                    <button onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button onClick={handleLogin}>Login</button>
                <button onClick={handleRegister}>Register</button>
              </>
            )}
            {!isLoggedIn && (
              <button className="admin-nav-button" onClick={handleAdminLoginOpen}>
                <span aria-hidden="true">&#128274;</span> Admin
              </button>
            )}
          </div>
        </nav>
      )}
      {(showProfileUpdate || showRateUpdate || showBankDetails || showRegisterForm || showUserProfile || showContactForm || showHomeInfo || showAboutInfo || showInvoicePage || showAdminPanel || showAdminLogin || showUserLogin) && (
        <div className="book-view">
          {showHomeInfo && <HomeInfo />}
          {showAboutInfo && <AboutInfo />}
          {showInvoicePage && <InvoicePage />}
          {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} onAdminLogout={handleAdminLogout} />}
          {showAdminLogin && (
            <div className="placeholder-container admin-login-panel">
              <h2>Admin Login</h2>
              <div className="register-form">
                <input
                  className="form-input"
                  placeholder="Admin Email"
                  value={adminLoginId}
                  onChange={(e) => setAdminLoginId(e.target.value)}
                />
                <input
                  className="form-input"
                  type="password"
                  placeholder="Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdminLoginSubmit();
                  }}
                />
              </div>
              <div className="form-actions">
                <button onClick={handleAdminLoginSubmit}>Login</button>
                <button onClick={() => setShowAdminLogin(false)}>Close</button>
              </div>
            </div>
          )}
          {showUserLogin && (
            <div className="placeholder-container admin-login-panel">
              <h2>User Login</h2>
              <div className="register-form">
                <input
                  className="form-input"
                  placeholder="Dealer Code"
                  value={userDealerCode}
                  onChange={(e) => setUserDealerCode(e.target.value)}
                />
                <input
                  className="form-input"
                  type="password"
                  placeholder="PIN"
                  value={userPin}
                  onChange={(e) => setUserPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUserLoginSubmit();
                  }}
                />
              </div>
              <div className="form-actions">
                <button onClick={handleUserLoginSubmit}>Login</button>
                <button onClick={() => setShowUserLogin(false)}>Close</button>
              </div>
            </div>
          )}
          {showProfileUpdate && <ProfileUpdateForm onClose={() => setShowProfileUpdate(false)} />}
          {showRateUpdate && (
            <RateUpdatePage
              onClose={() => setShowRateUpdate(false)}
              initialRatesData={Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null}
              onSaveRates={handleSaveRatesForUser}
            />
          )}
          {showBankDetails && <BankDetailsForm onClose={() => setShowBankDetails(false)} />}
          {showRegisterForm && <RegisterForm onClose={() => setShowRegisterForm(false)} />}
          {showUserProfile && <UserProfile onClose={() => setShowUserProfile(false)} />}
          {showContactForm && <ContactForm onClose={() => setShowContactForm(false)} />}
        </div>
      )}
      
      <style>{`
        input[type="checkbox"] {
          -webkit-appearance: checkbox;
          -moz-appearance: checkbox;
          appearance: checkbox;
          width: 16px;
          height: 16px;
          border: 1px solid #ccc;
          background-color: #fff;
          vertical-align: middle;
          position: relative;
        }

        input[type="checkbox"]:checked::before {
          content: '✔';
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          color: #000; /* Or any color that makes it visible */
        }
      `}</style>


      {parsedData.length > 0 && showParsedData && (
        <div style={{ marginTop: '20px' }}>





          {/* New Filter UI */}
          <div className="filters-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            {/* eKYC Filter */}
            <select value={eKycFilter} onChange={(e) => setEKycFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All eKYC</option>
              {uniqueEkycStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Area Filter */}
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Areas</option>
              {uniqueAreas.map((area, index) => (
                <option key={index} value={area}>{area}</option>
              ))}
            </select>

            {/* Nature Filter */}
            <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Nature</option>
              {uniqueNatures.map((nature, index) => (
                <option key={index} value={nature}>{nature}</option>
              ))}
            </select>

            {/* Mobile Status Filter */}
            <select value={mobileStatusFilter} onChange={(e) => setMobileStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Mobile Status</option>
              {uniqueMobileStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Consumer Status Filter */}
            <select value={consumerStatusFilter} onChange={(e) => setConsumerStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Consumer Status</option>
              {uniqueConsumerStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Connection Type Filter */}
            <select value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Connection Types</option>
              {uniqueConnectionTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>

            {/* Online Refill Payment Status Filter */}
            <select value={onlineRefillPaymentStatusFilter} onChange={(e) => setOnlineRefillPaymentStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Online Refill Payment Status</option>
              {uniqueOnlineRefillPaymentStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>





            {/* Order Status Filter */}
            <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Status</option>
              {uniqueOrderStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Order Source Filter */}
            <select value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Source</option>
              {uniqueOrderSources.map((source, index) => (
                <option key={index} value={source}>{source}</option>
              ))}
            </select>

            {/* Order Type Filter */}
            <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Order Type</option>
              {uniqueOrderTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>

            {/* Cash Memo Status Filter */}
            <select value={cashMemoStatusFilter} onChange={(e) => setCashMemoStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Cash Memo Status</option>
              {uniqueCashMemoStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Delivery Man Filter */}
            <select value={deliveryManFilter} onChange={(e) => setDeliveryManFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Delivery Man</option>
              {uniqueDeliveryMen.map((man, index) => (
                <option key={index} value={man}>{man}</option>
              ))}
            </select>

            {/* Is Reg Mobile Filter */}
            <select value={isRegMobileFilter} onChange={(e) => setIsRegMobileFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="All">All Is Reg Mobile</option>
              {uniqueIsRegMobileStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>

            {/* Refill Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <span>Order date</span>
              <input type="date" value={orderDateStart} onChange={(e) => setOrderDateStart(e.target.value)} style={{ border: 'none', outline: 'none' }} />
              <span>to</span>
              <input type="date" value={orderDateEnd} onChange={(e) => setOrderDateEnd(e.target.value)} style={{ border: 'none', outline: 'none' }} />
            </div>

            {/* Cash Memo Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <span>Cash Memo Date</span>
              <input type="date" value={cashMemoDateStart} onChange={(e) => setCashMemoDateStart(e.target.value)} style={{ border: 'none', outline: 'none' }} />
              <span>to</span>
              <input type="date" value={cashMemoDateEnd} onChange={(e) => setCashMemoDateEnd(e.target.value)} style={{ border: 'none', outline: 'none' }} />
            </div>

            {/* Sort By */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="">Sort By</option>
              {headers.map((header, index) => (
                <option key={index} value={header}>{header}</option>
              ))}
            </select>

            {/* Sort Order */}
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>

            <button onClick={() => { /* filteredData useMemo will react to state changes */ }} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>Filter</button>
            <button onClick={handleResetFilters} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#6c757d', color: 'white', cursor: 'pointer' }}>Reset Filters</button>
          </div>

          <div className="table-controls" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '10px' }}>
            <input type="text" placeholder="Search within data..." value={searchTerm} onChange={handleSearchChange} style={{ padding: '8px', width: '240px' }} />

            <label htmlFor="addColumnSelect">Add Column:</label>
            <select id="addColumnSelect" onChange={(e) => addColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {availableHeadersToAdd.map(header => <option key={header} value={header}>{header}</option>)}
            </select>
            <label htmlFor="removeColumnSelect">Remove Column:</label>
            <select id="removeColumnSelect" onChange={(e) => removeColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {visibleHeaders.map(header => <option key={header} value={header}>{header}</option>)}
            </select>

            {/* Page Type Dropdown */}
            <label htmlFor="pageTypeSelect">Page Type:</label>
            <select id="pageTypeSelect" onChange={(e) => setPageType(e.target.value)} value={pageType}>
              <option value="A4 3 Cashmemo/Page">A4 3 Cashmemo/Page</option>
              <option value="Lager 4 Cashmemo/Page">Lager 4 Cashmemo/Page</option>
            </select>
            <button className="action-button" onClick={handlePrintData} style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Print Data</button>
            <button className="action-button" onClick={handlePrintCashmemo} style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Print Cashmemo</button>

            </div>

          <div className="table-container">
            <table>
            <thead>
              <tr>
                    <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        onChange={handleSelectAllChange}
                        checked={selectedCustomerIds.length === currentTableData.length && currentTableData.length > 0}
                      />
                    </th>
                    {visibleHeaders.map((header, index) => (
                  <th key={index} style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                    {header}
                  </th>
                ))}
  
              </tr>
            </thead>
            <tbody>
                  {currentTableData.map((customer, index) => {
                    const isEkycStatusPending = customer['EKYC Status'] === 'Pending' || customer['EKYC Status'] === 'EKYC NOT DONE';
                    return (
                      <tr
                        key={index}
                        style={{
                          border: '1px solid black',
                          color: isEkycStatusPending ? 'red' : 'inherit',
                          fontWeight: isEkycStatusPending ? 'bold' : 'normal',
                        }}
                      >
                        <td style={{ border: '1px solid black', padding: '8px' }}>
                          <input
                              type="checkbox"
                              checked={selectedCustomerIds.includes(String(customer['Consumer No.']))}
                              onChange={() => handleCheckboxChange(customer['Consumer No.'])}
                            />
                        </td>
                    {visibleHeaders.map((header, colIndex) => {
                          return (
                            <td
                              key={colIndex}
                              style={{
                                border: '1px solid black',
                                padding: '8px',
                              }}
                            >
                              {String(
                                  header === 'Online Refill Payment status'
                                     ? (customer[header] === 'PAID' ? 'PAID' : 'COD')
                                     : (header === 'IVR Booking No.' && customer[header] === undefined
                                       ? ''
                                       : (header === 'Order Date' || header === 'Cash Memo Date'
                                         ? formatDateToDDMMYYYY(excelSerialDateToJSDate(customer[header]))
                                         : customer[header]))
                                 )}
                            </td>
                          );
                        })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>Total Records: {filteredData.length}</p>

        <div className="pagination">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
        </div>
      </div>
        </div>
      )}



      {customersToPrint.length > 0 && (
        <div style={{ marginTop: '40px' }}>

          <div ref={cashMemoRef}>
            {customersToPrint.map((item, index) => (
              <div
                key={index}
                style={{
                  pageBreakAfter:
                    pageType === 'A4 3 Cashmemo/Page'
                      ? (index + 1) % 3 === 0 ? 'always' : 'auto'
                      : (index + 1) % 4 === 0 ? 'always' : 'auto',
                }}
              >
                  <CashMemoEnglish customerData={item.customer} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default App;


