const HomeDashboardMarketing = ({ isLoggedIn }) => (
  <>
    <h2 className="home-info-title">
      Smart Cash Memo System for HPCL LPG Distributors
      <br />
      <small>Fast billing, print-ready workflow, and simple daily operations.</small>
    </h2>
    <div className="home-important-note">
      {!isLoggedIn && <h2>Demo login: ID 41099999 and PIN 0000</h2>}
      <h3>Important Note For Cashmemo Print</h3>
      <p>Cashmemo print karne se pehle Pending Booking file cDCMS se download karna zaroori hai.</p>
      <p><strong>Path:</strong> cDCMS -&gt; Order Fulfillment -&gt; Pending Booking</p>
      <p>File upload ke baad Show Data se rows verify kijiye, phir filters aur print workflow use kijiye.</p>
      <p><strong>Without Pending Booking upload, cashmemo print available nahi hoga.</strong></p>
    </div>
  </>
);

export default HomeDashboardMarketing;
