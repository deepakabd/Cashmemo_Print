const HomeDashboard = ({
  isLoggedIn,
  todayOrders,
  pendingEkycCount,
  activePackageStatus,
  homeQuickActions,
  homeTodayFocus,
  homeSupportPoints,
  homeAccountDetails,
  actionCenterCards,
  recentActivities,
  onQuickAction,
}) => (
  <div className="placeholder-container home-dashboard">
    <style>{`
      .home-dashboard { max-width: 1200px; margin: 40px auto; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafd; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); }
      .home-info-title { text-align: center; font-size: 2.5rem; font-weight: 800; background: linear-gradient(90deg, #1e3c72, #2a5298); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 35px; }
      .home-info-title small { font-size: 0.45em; letter-spacing: 1px; color: #666; -webkit-text-fill-color: initial; display: block; margin-top: 12px; font-weight: 600; }
      .home-important-note { background: #fff3cd; border-left: 6px solid #ffecb5; padding: 25px; border-radius: 12px; margin-bottom: 35px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); color: #856404; }
      .home-important-note h2, .home-important-note h3 { color: #856404; margin-top: 0; }
      .home-modern-section { background: #ffffff; padding: 35px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.06); margin-bottom: 35px; border-top: 5px solid #0056b3; transition: transform 0.3s ease; }
      .home-modern-section:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.1); }
      .home-modern-section h3 { margin-top: 0; color: #1e3c72; font-size: 1.6em; margin-bottom: 25px; border-bottom: 2px solid #f0f4f8; padding-bottom: 10px; }
      .home-desc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
      .home-desc-card { background: #f8faff; padding: 25px; border-radius: 12px; border-left: 4px solid #007bff; transition: all 0.3s; }
      .home-desc-card:hover { background: #f1f5ff; transform: translateX(5px); }
      .home-desc-card p { margin: 0 0 10px 0; line-height: 1.7; font-size: 1.05em; color: #333; }
      .home-desc-card p.hindi-text { color: #555; font-size: 0.95em; margin: 0; }
      .home-modern-section h4 { color: #1e3c72; font-size: 1.3em; margin: 30px 0 15px; }
      .home-feature-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; list-style: none; padding: 0; margin-bottom: 35px; }
      .home-feature-list li { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border: 1px solid #f0f4f8; border-left: 5px solid #28a745; transition: all 0.3s; }
      .home-feature-list li:hover { box-shadow: 0 8px 25px rgba(0,0,0,0.08); transform: translateY(-3px); }
      .home-feature-list strong { display: block; margin-bottom: 8px; color: #111; font-size: 1.1em; }
      .home-user-roles { display: flex; flex-wrap: wrap; gap: 15px; list-style: none; padding: 0; margin-bottom: 35px; }
      .home-user-roles li { background: #eef6ff; color: #0056b3; padding: 12px 22px; border-radius: 25px; font-weight: 600; font-size: 1em; border: 1px solid #cce5ff; box-shadow: 0 2px 8px rgba(0,86,179,0.1); }
      .home-cta-box { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; text-align: center; padding: 30px; border-radius: 16px; box-shadow: 0 12px 30px rgba(30, 60, 114, 0.3); }
      .home-cta-box p { margin: 8px 0; font-size: 1.2em; font-weight: 500; }
      
      .home-hero-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; margin-bottom: 35px; }
      .home-highlight-card { background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,0.05); border: 1px solid #eee; }
      .home-highlight-card h3 { margin-top: 0; color: #1e3c72; border-bottom: 2px solid #f0f4f8; padding-bottom: 10px; margin-bottom: 20px; }
      .home-steps-list { padding-left: 20px; line-height: 1.8; color: #444; font-size: 1.05em; }
      .home-steps-list li { margin-bottom: 10px; }
      .home-account-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .home-account-item { background: #f8faff; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
      .home-account-item span { display: block; font-size: 0.85em; color: #666; margin-bottom: 5px; }
      .home-account-item strong { display: block; color: #111; font-size: 1.05em; word-break: break-word; }
      
      .home-action-center { background: #fff; padding: 35px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.06); margin-bottom: 35px; }
      .home-action-center__header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #f0f4f8; padding-bottom: 15px; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
      .home-action-center__eyebrow { margin: 0 0 5px 0; color: #007bff; font-weight: 700; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1px; }
      .home-action-center__header h3 { margin: 0; color: #1e3c72; font-size: 1.6em; }
      .home-action-center__meta { display: flex; gap: 15px; flex-wrap: wrap; }
      .home-action-center__meta span { background: #eef6ff; color: #0056b3; padding: 6px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 600; border: 1px solid #cce5ff; }
      .home-action-center__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
      .home-action-card { background: #fff; border: 2px solid #eef2f5; border-radius: 12px; padding: 25px; text-align: left; cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden; }
      .home-action-card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.08); border-color: #007bff; }
      .home-action-card__top { display: flex; justify-content: space-between; margin-bottom: 15px; align-items: center; }
      .home-action-card__label { font-size: 0.85em; color: #666; font-weight: 600; text-transform: uppercase; }
      .home-action-card__badge { background: #ffc107; color: #212529; font-size: 0.75em; padding: 4px 8px; border-radius: 12px; font-weight: 700; }
      .home-action-card strong { display: block; font-size: 1.25em; color: #111; margin-bottom: 10px; }
      .home-action-card p { margin: 0 0 20px 0; color: #555; font-size: 0.95em; line-height: 1.6; }
      .home-action-card__cta { display: inline-block; color: #007bff; font-weight: 700; font-size: 0.95em; }
      .home-action-card:hover .home-action-card__cta { color: #0056b3; text-decoration: underline; }
      
      .home-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 35px; }
      .home-layout .home-section { background: #fff; padding: 25px; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,0.05); border: 1px solid #eee; }
      .home-layout h3 { margin-top: 0; color: #1e3c72; border-bottom: 2px solid #f0f4f8; padding-bottom: 10px; margin-bottom: 15px; }
      .home-layout ul { padding-left: 20px; color: #444; line-height: 1.7; }
      .home-layout li { margin-bottom: 8px; }
      
      .home-recent-activity { background: #fff; padding: 35px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.06); }
      .home-recent-activity__header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f4f8; padding-bottom: 15px; margin-bottom: 20px; }
      .home-recent-activity__header h3 { margin: 0; color: #1e3c72; font-size: 1.5em; }
      .home-recent-activity__header span { background: #e9ecef; color: #495057; padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
      .home-recent-activity__item { padding: 15px 0; border-bottom: 1px solid #f0f4f8; display: flex; justify-content: space-between; align-items: center; }
      .home-recent-activity__item:last-child { border-bottom: none; padding-bottom: 0; }
      .home-recent-activity__item strong { color: #333; font-weight: 500; font-size: 1.05em; }
      .home-recent-activity__item span { color: #888; font-size: 0.9em; }
    `}</style>
    <h2 className="home-info-title">
      🏠 Smart Cash Memo System for HPCL LPG Distributors <br />
      <small>HPCL LPG डिस्ट्रीब्यूटर के लिए स्मार्ट कैश मेमो सिस्टम</small>
    </h2>

    <div className="home-important-note">
      {!isLoggedIn && <h2>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</h2>}
      <h3>📌 महत्वपूर्ण सूचना (Cashmemo Print हेतु)</h3>
      <p>Cashmemo प्रिंट करने से पहले कृपया अपने Pending Cashmemo को cDCMS से डाउनलोड या सेव अवश्य करें।</p>
      <p><strong>डाउनलोड करने का पथ (Path):</strong> cDCMS -&gt; Order Fulfillment -&gt; Pending Booking</p>
      <p>डाउनलोड की गई फ़ाइल को इस पोर्टल के Top Navbar में Upload करें, फिर “Show Data” पर क्लिक करके डेटा प्रदर्शित करें।</p>
      <p><strong>बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</strong></p>
    </div>

    <div className="home-modern-section">
      <h3>
        Fast, accurate, and easy billing and printing solution for HP Gas distribution operations.
        <br /><span style={{ fontSize: '0.85em', fontWeight: 'normal', color: '#666' }}>HP Gas वितरण कार्यों के लिए तेज़, सटीक और आसान बिलिंग एवं प्रिंटिंग समाधान।</span>
      </h3>
      
      <div className="home-desc-grid">
        <div className="home-desc-card">
          <p>Cashmemo_Print is a specially developed system designed keeping in mind the daily billing requirements of HPCL LPG Distributors. This application provides the facility to generate cash memos during gas cylinder distribution, manage customer information, and print instantly.</p>
          <p className="hindi-text">Cashmemo_Print एक विशेष रूप से विकसित किया गया सिस्टम है जो HPCL LPG डिस्ट्रीब्यूटर्स की दैनिक बिलिंग आवश्यकताओं को ध्यान में रखकर बनाया गया है। यह एप्लिकेशन गैस सिलेंडर वितरण के दौरान कैश मेमो तैयार करने, ग्राहक की जानकारी मैनेज करने और तुरंत प्रिंट निकालने की सुविधा प्रदान करता है।</p>
        </div>
        <div className="home-desc-card">
          <p>In LPG distribution operations, speed and accuracy are extremely important. Manual billing often leads to wasted time, incorrect entries, and record management issues. This system eliminates all these problems and provides a digital and reliable platform.</p>
          <p className="hindi-text">LPG वितरण कार्यों में तेज़ी और सटीकता बेहद महत्वपूर्ण होती है। मैन्युअल बिलिंग में अक्सर समय की बर्बादी, गलत एंट्री और रिकॉर्ड मैनेजमेंट की समस्याएँ सामने आती हैं। यह सिस्टम इन सभी समस्याओं को खत्म करके एक डिजिटल और भरोसेमंद प्लेटफॉर्म उपलब्ध कराता है।</p>
        </div>
        <div className="home-desc-card">
          <p>It is specifically designed for HP Gas agencies, allowing them to provide better and faster service to their consumers.</p>
          <p className="hindi-text">यह विशेष रूप से HP Gas एजेंसियों के लिए डिज़ाइन किया गया है, जिससे वे अपने उपभोक्ताओं को बेहतर और तेज़ सेवा दे सकें。</p>
        </div>
      </div>

      <h4>Key Features / मुख्य विशेषताएँ</h4>
      <ul className="home-feature-list">
        <li><strong>✔ Specifically Designed for HPCL LPG Billing / HPCL LPG बिलिंग के लिए विशेष रूप से डिज़ाइन</strong> <br/>Prepared according to the requirements of HP Gas distribution. <br/><span className="hindi-text">HP Gas डिस्ट्रीब्यूशन की आवश्यकताओं के अनुसार तैयार।</span></li>
        <li><strong>✔ Fast Cash Memo Generation / तेज़ कैश मेमो जनरेशन</strong> <br/>Generate bills instantly at the time of cylinder delivery. <br/><span className="hindi-text">सिलेंडर डिलीवरी के समय तुरंत बिल तैयार करें।</span></li>
        <li><strong>✔ Consumer Details Management / उपभोक्ता विवरण प्रबंधन</strong> <br/>Easily manage Consumer Name, Address, Connection Details. <br/><span className="hindi-text">Consumer Name, Address, Connection Details को आसानी से मैनेज करें।</span></li>
        <li><strong>✔ Print-Ready Format / प्रिंट-रेडी फॉर्मेट</strong> <br/>Simple and clean cash memo ready for instant printing. <br/><span className="hindi-text">सरल और साफ कैश मेमो जो तुरंत प्रिंट के लिए तैयार हो।</span></li>
        <li><strong>✔ Error Reduction / गलतियों में कमी</strong> <br/>Reduces manual entry mistakes. <br/><span className="hindi-text">मैन्युअल एंट्री की गलतियों को कम करता है।</span></li>
        <li><strong>✔ Suitable for Daily Operations / डेली ऑपरेशन के लिए उपयुक्त</strong> <br/>Useful for both delivery boys and office staff. <br/><span className="hindi-text">डिलीवरी बॉय और ऑफिस स्टाफ दोनों के लिए उपयोगी।</span></li>
      </ul>

      <h4>Who Can Use This System? / यह सिस्टम किनके लिए उपयोगी है?</h4>
      <ul className="home-user-roles">
        <li>HPCL LPG Distributors / HPCL LPG डिस्ट्रीब्यूटर</li>
        <li>HP Gas Agency Staff / HP Gas एजेंसी स्टाफ</li>
        <li>Billing Operators / बिलिंग ऑपरेटर</li>
        <li>Delivery Management Team / डिलीवरी मैनेजमेंट टीम</li>
      </ul>

      <div className="home-cta-box">
        <p><strong>Make HP Gas distribution faster, accurate, and digital—with Cashmemo_Print.</strong></p>
        <p><strong>HP Gas वितरण को और तेज़, सटीक और डिजिटल बनाइए—Cashmemo_Print के साथ।</strong></p>
      </div>
    </div>

    {isLoggedIn && (
      <>
        <div className="home-hero-grid">
          <div className="home-section home-highlight-card">
            <h3>काम करने का आसान क्रम</h3>
            <ol className="home-steps-list">
              {homeQuickActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="home-section home-highlight-card">
            <h3>अकाउंट की झलक</h3>
            <div className="home-account-grid">
              {homeAccountDetails.map((item) => (
                <div key={item.label} className="home-account-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="home-action-center">
          <div className="home-action-center__header">
            <div>
              <p className="home-action-center__eyebrow">Action Center</p>
              <h3>आज का अगला काम यही से पकड़ें</h3>
            </div>
            <div className="home-action-center__meta">
              <span>{todayOrders} bookings today</span>
              <span>{pendingEkycCount} eKYC pending</span>
              <span>{activePackageStatus}</span>
            </div>
          </div>
          <div className="home-action-center__grid">
            {actionCenterCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className={`home-action-card home-action-card--${card.tone || 'default'}`}
                onClick={() => onQuickAction(card.action)}
                disabled={card.disabled}
                title={card.description}
              >
                <div className="home-action-card__top">
                  <span className="home-action-card__label">{card.label}</span>
                  {card.badge ? <span className="home-action-card__badge">{card.badge}</span> : null}
                </div>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
                <span className="home-action-card__cta">{card.cta}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-layout">
          <div className="home-section">
            <h3>त्वरित कार्य</h3>
            <ul>
              {homeQuickActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="home-section">
            <h3>आज का फोकस</h3>
            <ul>
              {homeTodayFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="home-section">
            <h3>सहायता और सुझाव</h3>
            <ul>
              {homeSupportPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="home-recent-activity">
          <div className="home-recent-activity__header">
            <h3>Recent Activity</h3>
            <span>{recentActivities.length} recent actions</span>
          </div>
          {recentActivities.length === 0 ? (
            <p className="home-recent-activity__empty">Abhi recent activity available nahi hai. Upload, login, ya request submit karte hi yahan summary dikhegi.</p>
          ) : (
            <div className="home-recent-activity__list">
              {recentActivities.map((item) => (
                <div key={item.id} className="home-recent-activity__item">
                  <strong>{item.message}</strong>
                  <span>{item.createdAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}
  </div>
);

export default HomeDashboard;
