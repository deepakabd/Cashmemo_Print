import { formatPackageOptionLabel } from '../../utils/packageHelpers';
import './AboutInfo.css';

const AboutInfo = ({ isLoggedIn }) => {
  return (
    <div className="placeholder-container about-summary-modern">
      <h2 className="about-info-title-modern">🚀 About Cashmemo_Print | Cashmemo_Print के बारे में</h2>

      <div className="about-tagline">
        <p>
          A Complete Digital Solution for HPCL LPG Distributors | HPCL LPG डिस्ट्रीब्यूटर्स के लिए एक संपूर्ण डिजिटल समाधान
        </p>
        <div className="about-tagline-hindi">
          तेजी से बिलिंग करें, गलतियां कम करें, और अपना व्यवसाय आसानी से संचालित करें
        </div>
      </div>

      <div className="home-important-note">
        {!isLoggedIn && <h2>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</h2>}
        <h3>📌 महत्वपूर्ण सूचना (Cashmemo Print हेतु)</h3>
        <p>Cashmemo प्रिंट करने से पहले कृपया अपने Pending Cashmemo को cDCMS से डाउनलोड या सेव अवश्य करें।</p>
        <p><strong>डाउनलोड करने का पथ (Path):</strong> cDCMS {'->'} Order Fulfillment {'->'} Pending Booking</p>
        <p>डाउनलोड की गई फ़ाइल को इस पोर्टल के Top Navbar में Upload करें, फिर “Show Data” पर क्लिक करके डेटा प्रदर्शित करें।</p>
        <p><strong>बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</strong></p>
      </div>

      <div className="about-content-grid">
        <div className="about-card about-card--gradient-bg" style={{ gridColumn: '1 / -1' }}>
          <h3>🎯 विस्तृत विवरण (Detailed Description)</h3>
          <p><strong>Cashmemo_Print</strong> एक आधुनिक, वेब-आधारित एप्लिकेशन है जिसे <strong>Hindustan Petroleum Corporation Limited (HPCL)</strong> के LPG डिस्ट्रीब्यूटर्स के लिए विशेष रूप से डिज़ाइन किया गया है।</p>
          <p>यह प्लेटफॉर्म कैश मेमो बनाने की प्रक्रिया को न केवल सरल बनाता है, बल्कि इसे तेज़, सुरक्षित और पूरी तरह से ट्रैक योग्य भी बनाता है। हर दिन हजारों डिलीवरी के साथ काम करने वाले डिस्ट्रीब्यूटर्स अब अपने बिलिंग को कुछ ही क्लिक में पूरा कर सकते हैं।</p>
          <p className="hindi-text">यह सिस्टम <strong>LPG वितरण के वास्तविक कार्यप्रवाह</strong> को गहराई से समझकर बनाया गया है, जिससे डिलीवरी के समय <strong>तुरंत और सही बिलिंग</strong> संभव है।</p>
        </div>

        <div className="about-card about-card--green" style={{ gridColumn: '1 / -1' }}>
          <h3>✨ मुख्य क्षमताएं (Key System Capabilities)</h3>
          <div className="about-capability-grid">
            <div className="about-capability-item about-capability-item--teal">
              <strong>📊 डेटा प्रबंधन</strong>
              <p>cDCMS से सीधे फ़ाइल अपलोड, Pending Booking की पहचान, Aging reports (2-5 दिन), और स्मार्ट डेटा सत्यापन।</p>
            </div>
            <div className="about-capability-item about-capability-item--pink">
              <strong>🖨️ बल्क प्रिंटिंग</strong>
              <p>2, 3, या 4 Cashmemos प्रति पेज, ऑटोमैटिक GST कैलकुलेशन, डायनामिक रेट, और Tax Invoice जनरेशन।</p>
            </div>
            <div className="about-capability-item about-capability-item--mint">
              <strong>🌐 बहुभाषी समर्थन</strong>
              <p>ऑटोमैटिक English-to-Hindi Dictionary, कस्टमाइज़्ड हेडर, डिलीवरी स्टाफ प्रबंधन, और एरिया सेटअप।</p>
            </div>
            <div className="about-capability-item about-capability-item--coral">
              <strong>🛡️ सुरक्षित एक्सेस</strong>
              <p>PIN-based सुरक्षित लॉगिन, Role-based एक्सेस कंट्रोल, Approval workflows, और एडमिन सपोर्ट चैट।</p>
            </div>
          </div>
        </div>

        <div className="about-card about-card--green">
          <h3>🎯 मुख्य उद्देश्य (Core Objectives)</h3>
          <ul>
            <li>✅ <strong>बिलिंग प्रक्रिया को सरल करना</strong> - कोडित डेटा, प्रि-फिल्ड फॉर्म, और एक-क्लिक प्रिंटिंग</li>
            <li>✅ <strong>मानवीय त्रुटियों को कम करना</strong> - डेटा वेलिडेशन, ऑटोमैटिक कैलकुलेशन, और रीयल-टाइम चेक</li>
            <li>✅ <strong>तेजी से प्रिंटिंग</strong> - बल्क प्रिंटिंग (2, 3, या 4 प्रति पेज), सिंगल-क्लिक वर्कफ्लो</li>
            <li>✅ <strong>डेटा प्रबंधन में सुधार</strong> - फ़िल्टर्स, सर्च, एडवांस्ड रिपोर्ट्स, और डाउनलोड विकल्प</li>
            <li>✅ <strong>डिस्ट्रीब्यूटर्स का समर्थन</strong> - इन-ऐप चैट, FAQ, और डेडिकेटेड एडमिन सपोर्ट</li>
          </ul>
        </div>

        <div className="about-card about-card--yellow">
          <h3>💻 तकनीकी आधार (Technology Stack)</h3>
          <p>यह सिस्टम <strong>React + Vite</strong> जैसी आधुनिक तकनीकों पर बनाया गया है, जो इसे:</p>
          <ul>
            <li><strong>हल्का और तेज़</strong> - तेजी से लोडिंग और रिस्पॉन्स</li>
            <li><strong>सुरक्षित</strong> - Firebase-based सुरक्षित लॉगिन और डेटा स्टोरेज</li>
            <li><strong>स्कैलेबल</strong> - हजारों यूजर्स को एक साथ सपोर्ट कर सकता है</li>
            <li><strong>मोबाइल-फ्रेंडली</strong> - किसी भी डिवाइस से एक्सेस करें</li>
          </ul>
          <div className="about-feature-box">
            <strong>🚀 Performance:</strong> Optimized for speed with minimal data transfer
          </div>
        </div>

        <div className="about-card about-card--pink">
          <h3>📦 सदस्यता पैकेज (Subscription Plans)</h3>
          <ul>
            <li>
              <strong>{formatPackageOptionLabel('Premium Package - 30 Days')}:</strong><br/>
              <span className="hindi-text">Core billing, reports, filters, printing, and support access.</span>
            </li>
            <li>
              <strong>{formatPackageOptionLabel('Enterprise Package - 365 Days')}:</strong><br/>
              <span className="hindi-text">Annual access with advanced workflow tools and admin support.</span>
            </li>
            <li>
              <strong>{formatPackageOptionLabel('Enterprise Package with (हिंदी) - 365 Days')}:</strong><br/>
              <span className="hindi-text">Annual access with Hindi dictionary, header, delivery area, and staff tools.</span>
            </li>
          </ul>
        </div>

        <div className="about-card about-card--yellow">
          <h3>🔐 सुरक्षा और गोपनीयता (Security & Privacy)</h3>
          <ul>
            <li>
              <strong>PIN-आधारित लॉगिन:</strong> सभी यूजर्स के लिए सुरक्षित एक्सेस, डुअल-लेयर सुरक्षा
            </li>
            <li>
              <strong>एडमिन अप्रूवल वर्कफ्लो:</strong> Profile, Bank Details, और Rate परिवर्तन को सख्ती से सत्यापित
            </li>
            <li>
              <strong>एन्क्रिप्टेड डेटा:</strong> Firebase के साथ एंड-टू-एंड एन्क्रिप्शन
            </li>
            <li>
              <strong>ऑडिट ट्रेल:</strong> हर ऑपरेशन को लॉग किया जाता है ट्रैकिंग के लिए
            </li>
            <li>
              <strong>24/7 सहायता:</strong> Built-in feedback और support ticket workflow, Direct admin chat
            </li>
          </ul>
        </div>

        <div className="about-card about-card--purple" style={{ gridColumn: '1 / -1' }}>
          <h3>🌟 लाभ और विशेषताएं (Benefits & Features)</h3>
          <div className="about-benefits-grid">
            <div className="about-benefit-item about-benefit-item--green">
              <strong>⏱️ समय बचाएं</strong>
              <p>मैनुअल डेटा एंट्री से बचें, bulk operations करें, और घंटों का काम मिनटों में पूरा करें।</p>
            </div>
            <div className="about-benefit-item about-benefit-item--red">
              <strong>📈 बेहतर सटीकता</strong>
              <p>ऑटोमैटिक कैलकुलेशन, GST हिसाब, और रीयल-टाइम वेलिडेशन से त्रुटियां शून्य।</p>
            </div>
            <div className="about-benefit-item about-benefit-item--teal">
              <strong>🔒 पूर्ण सुरक्षा</strong>
              <p>Firebase integration, encrypted data, audit trails, और role-based access control।</p>
            </div>
            <div className="about-benefit-item about-benefit-item--teal">
              <strong>📱 कहीं से भी एक्सेस</strong>
              <p>Desktop, tablet, या phone से कहीं भी, कभी भी काम करें।</p>
            </div>
          </div>
        </div>
      </div>

      <div className="about-cta-block">
        <p><strong>🚀 यह केवल एक बिलिंग सॉफ्टवेयर नहीं है...</strong></p>
        <p>यह HPCL LPG डिस्ट्रीब्यूटर्स के <strong>दैनिक संचालन को पूरी तरह सरल बनाने का एक समाधान</strong> है।</p>
        <p className="hindi">यह एक <strong>भरोसेमंद पार्टनर</strong> है जो आपके व्यवसाय को और भी बेहतर बनाता है।</p>
        <p>सिस्टम को समझें, इसका उपयोग करें, और अपनी बिलिंग को अगले स्तर पर ले जाएं।</p>
      </div>
    </div>
  );
};

export default AboutInfo;
