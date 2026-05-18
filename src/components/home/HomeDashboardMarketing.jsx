const HomeDashboardMarketing = ({ isLoggedIn }) => (
  <>
    <h2 className="home-info-title">
      Smart Cash Memo System for HPCL LPG Distributors
      <br />
      <small>Streamline Your LPG Distribution Workflow | तेज़ी से बिलिंग, प्रिंट-तैयार वर्कफ़्लो और आसान दैनिक संचालन</small>
    </h2>
    <div className="home-important-note" style={{ background: '#f0f8ff', borderLeft: '6px solid #007bff' }}>
      {!isLoggedIn && (
        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#1565c0', fontSize: '1.3em' }}>🔓 Demo Access Available</h2>
          <p style={{ margin: '5px 0', fontSize: '1.1em', color: '#0d47a1' }}>
            <strong>ID:</strong> 41099999 | <strong>PIN:</strong> 0000
          </p>
          <p style={{ margin: '5px 0', fontSize: '0.95em', color: '#555' }}>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</p>
        </div>
      )}
      <h3 style={{ color: '#d32f2f', marginTop: '0', marginBottom: '12px' }}>📌 आवश्यक निर्देश: Cashmemo प्रिंट के लिए (Important Instructions for Printing)</h3>
      
      <div style={{ background: '#fff9c4', padding: '12px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #fbc02d' }}>
        <p style={{ margin: '0 0 8px 0', lineHeight: '1.6', color: '#333' }}>
          <strong>Step 1:</strong> cDCMS में जाएं और Pending Booking file डाउनलोड करें
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.95em', color: '#666' }}>
          <strong>Path:</strong> cDCMS → Order Fulfillment → Pending Booking (डाउनलोड करें)
        </p>
      </div>

      <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #9c27b0' }}>
        <p style={{ margin: '0 0 8px 0', lineHeight: '1.6', color: '#333' }}>
          <strong>Step 2:</strong> इस पोर्टल के Top Navbar में CSV/Excel फ़ाइल Upload करें
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.95em', color: '#666' }}>
          Upload खंड में जाएं और Pending Booking फ़ाइल चुनें
        </p>
      </div>

      <div style={{ background: '#e0f2f1', padding: '12px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #009688' }}>
        <p style={{ margin: '0 0 8px 0', lineHeight: '1.6', color: '#333' }}>
          <strong>Step 3:</strong> "Show Data" बटन दबाकर डेटा को सत्यापित करें
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.95em', color: '#666' }}>
          सभी rows को जांचें और आवश्यक फ़ील्ड सही हैं यह सुनिश्चित करें
        </p>
      </div>

      <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #4caf50' }}>
        <p style={{ margin: '0 0 8px 0', lineHeight: '1.6', color: '#333' }}>
          <strong>Step 4:</strong> फ़िल्टर्स लागू करें और Cashmemo प्रिंट करें
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.95em', color: '#666' }}>
          Advanced filters (eKYC, Payment Status, Area) का उपयोग करके चयनित cashmemos प्रिंट करें
        </p>
      </div>

      <div style={{ background: '#ffebee', padding: '15px', borderRadius: '6px', marginTop: '15px', borderLeft: '4px solid #d32f2f' }}>
        <p style={{ margin: '0', lineHeight: '1.6', color: '#c62828', fontWeight: 'bold' }}>
          ⚠️ <strong>महत्वपूर्ण:</strong> बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।
        </p>
      </div>

      <h3 style={{ marginTop: '20px', marginBottom: '12px', color: '#1565c0' }}>✨ मुख्य विशेषताएं (Key Features):</h3>
      <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
        <li style={{ marginBottom: '8px', color: '#333' }}><strong>📊 स्मार्ट डेटा विश्लेषण:</strong> Aging reports (2-5 दिन), Advanced filters और Real-time insights</li>
        <li style={{ marginBottom: '8px', color: '#333' }}><strong>🖨️ बल्क प्रिंटिंग:</strong> 2, 3, या 4 cashmemos प्रति पेज, GST कैलकुलेशन स्वचालित</li>
        <li style={{ marginBottom: '8px', color: '#333' }}><strong>🌐 बहुभाषी समर्थन:</strong> Hindi-English Dictionary, कस्टमाइज़्ड हेडर और स्टाफ प्रबंधन</li>
        <li style={{ marginBottom: '8px', color: '#333' }}><strong>🛡️ सुरक्षित एक्सेस:</strong> PIN-based login, Role-based access और Approval workflows</li>
      </ul>
    </div>
  </>
);

export default HomeDashboardMarketing;
