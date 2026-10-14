import { ArrowDownRight, ArrowRight } from 'lucide-react';
import './AboutUs.css';

export default function AboutUs({ content, onApply }) {
  return (
    <section className="about section-wrap" id="about">
      <div className="about-tag"><span className="live-dot" /> {content.tag}</div>
      <div className="about-content">
        <h2>{content.titleFirst}<br />{content.titleSecond}<br /><span>{content.titleAccent}</span></h2>
        <div className="about-copy">
          <p>{content.firstParagraph}</p>
          <p>{content.secondParagraph}</p>
          <button type="button" className="inline-link" onClick={onApply}>{content.action} <ArrowRight size={16} /></button>
        </div>
      </div>
      <div className="about-bottom"><span>{content.footerLeft}</span><span>{content.footerRight} <ArrowDownRight size={14} /></span></div>
    </section>
  );
}
