import { useEffect, useState } from 'react';

const blogDetails = {
  'How to Manage LPG Booking Data Efficiently': 'Start with a clean booking upload, then use search and filters to find pending records quickly. Reviewing customer details before processing helps the team reduce duplicate work and keep every booking accurate.',
  'Cash Memo Management: From Data to Print': 'Select the correct customer record, verify booking and payment details, choose the required memo format, and print only after the information has been checked. This simple review step keeps documents accurate.',
  'Understanding the LPG Stock Register': 'Record stock received, stock delivered, and the remaining balance regularly. A current register helps distributors spot differences early and plan the next refill cycle with confidence.',
};

const HomeKnowledgeHub = ({ children }) => {
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    const buttons = document.querySelectorAll('.home-marketing__articles button');
    const openArticle = (event) => {
      const article = event.currentTarget.closest('article');
      const title = article?.querySelector('h3')?.textContent?.trim();
      const summary = article?.querySelector('p')?.textContent?.trim();
      if (title) setSelectedArticle({ title, summary, detail: blogDetails[title] || summary });
    };
    buttons.forEach((button) => button.addEventListener('click', openArticle));
    return () => buttons.forEach((button) => button.removeEventListener('click', openArticle));
  }, []);

  return (
    <>
      {children}
      {selectedArticle && <div className="home-article-dialog" role="dialog" aria-modal="true" aria-labelledby="home-article-title" onClick={() => setSelectedArticle(null)}>
        <article className="home-article-dialog__panel" onClick={(event) => event.stopPropagation()}>
          <span>KNOWLEDGE HUB · BLOG</span>
          <h2 id="home-article-title">{selectedArticle.title}</h2>
          <p className="home-article-dialog__summary">{selectedArticle.summary}</p>
          <p>{selectedArticle.detail}</p>
          <button type="button" onClick={() => setSelectedArticle(null)}>Close article</button>
        </article>
      </div>}
      <style>{`.home-article-dialog{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;padding:20px;background:rgba(11,35,64,.5)}.home-article-dialog__panel{width:min(100%,620px);max-height:calc(100vh - 40px);overflow:auto;padding:32px;border:1px solid #d7e3f2;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(16,39,71,.24);text-align:left;box-sizing:border-box}.home-article-dialog__panel>span{color:#1672cf;font-size:10px;font-weight:800;letter-spacing:.12em}.home-article-dialog__panel h2{margin:12px 0;color:#123762;font-size:clamp(24px,4vw,36px);line-height:1.15}.home-article-dialog__panel p{color:#526b86;line-height:1.75}.home-article-dialog__panel .home-article-dialog__summary{color:#71859b;font-size:14px}.home-article-dialog__panel button{padding:10px 18px;border:0;border-radius:8px;background:#126bc5;color:#fff;font-weight:800;cursor:pointer}`}</style>
    </>
  );
};

export default HomeKnowledgeHub;
