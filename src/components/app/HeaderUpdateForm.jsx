import { useState, useEffect } from 'react';

const HeaderUpdateForm = ({ onClose, loggedInUser, submitUpdateApprovalRequest, logRecentActivity }) => {
  const [formData, setFormData] = useState({
    distributorName: '',
    address: '',
    email: '',
    gstn: '',
    telephone: '',
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loggedInUser?.hindiHeaderData) {
      setFormData((prev) => ({ ...prev, ...loggedInUser.hindiHeaderData }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateHeaderForm = () => {
    const nextErrors = {};
    if (!formData.distributorName.trim()) nextErrors.distributorName = 'Distributor name is required.';
    if (!formData.address.trim()) nextErrors.address = 'Address is required.';
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!formData.gstn.trim()) nextErrors.gstn = 'GSTN is required.';
    if (!/^\d{10}$/.test(formData.telephone.trim())) nextErrors.telephone = 'Enter a valid 10-digit telephone number.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    if (!validateHeaderForm()) return;
    setIsSaving(true);
    const ok = await submitUpdateApprovalRequest({
      type: 'header',
      payload: formData,
      localKey: 'hindiHeaderData',
      successMessage: 'Header details update request submitted. Your request is pending with admin for approval.',
    });
    setIsSaving(false);
    if (ok) {
      logRecentActivity('Submitted header update request');
      onClose();
    }
  };

  return (
    <div className="placeholder-container local-header-update-panel">
      <div className="local-header-update-panel__header">
        <div className="local-header-update-panel__icon" aria-hidden="true">हि</div>
        <div><h2>Header Update (Hindi / Local)</h2><p>Hindi cashmemo par print hone wale distributor header details update karein.</p></div>
      </div>
      <div className="local-header-preview" aria-label="Header preview">
        <span>LIVE PREVIEW</span>
        <strong>{formData.distributorName || 'Distributor Name'}</strong>
        <p>{formData.address || 'Distributor address'}</p>
        <small>{formData.telephone || 'Telephone'} · {formData.email || 'Email'} · GSTN: {formData.gstn || '—'}</small>
      </div>
      <form className="profile-form local-header-update-form" onSubmit={handleSave}>
        <span className="profile-label">Distributor Name</span>
        <div>
          <input className={`form-input${errors.distributorName ? ' form-input--error' : ''}`} name="distributorName" type="text" value={formData.distributorName} onChange={handleChange} placeholder="उदा: MAHADEV HP GAS..." />
          {errors.distributorName && <div className="form-error">{errors.distributorName}</div>}
        </div>
        <span className="profile-label">Address</span>
        <div>
          <textarea className={`form-textarea${errors.address ? ' form-input--error' : ''}`} name="address" rows="3" value={formData.address} onChange={handleChange} placeholder="उदा: ATHARI, RUNNISAIDPUR..." />
          {errors.address && <div className="form-error">{errors.address}</div>}
        </div>
        <span className="profile-label">Email</span>
        <div>
          <input className={`form-input${errors.email ? ' form-input--error' : ''}`} name="email" type="text" value={formData.email} onChange={handleChange} placeholder="उदा: mahadev.sitamarhi@gmail.com" />
          {errors.email && <div className="form-error">{errors.email}</div>}
        </div>
        <span className="profile-label">GSTN</span>
        <div>
          <input className={`form-input${errors.gstn ? ' form-input--error' : ''}`} name="gstn" type="text" value={formData.gstn} onChange={handleChange} placeholder="उदा: 10ABBFM6137E1ZU" />
          {errors.gstn && <div className="form-error">{errors.gstn}</div>}
        </div>
        <span className="profile-label">Telephone</span>
        <div>
          <input className={`form-input${errors.telephone ? ' form-input--error' : ''}`} name="telephone" type="text" value={formData.telephone} onChange={handleChange} placeholder="उदा: 7070236555" />
          {errors.telephone && <div className="form-error">{errors.telephone}</div>}
        </div>
        <p className="local-header-update-panel__note">Changes admin approval ke baad Hindi / Local cashmemo header mein दिखाई देंगे।</p>
        <div className="form-actions local-header-update-panel__actions">
          <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Submit for Approval'}</button>
          <button type="button" onClick={onClose} disabled={isSaving}>Close</button>
        </div>
      </form>
    </div>
  );
};

export default HeaderUpdateForm;
