import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import './HowItWorks.css';

export default function HowItWorks({ content, onApply }) {
  return (
    <section className="journey" id="how-it-works">
      <div className="journey-side">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2>{content.titleFirst}<br />{content.titleSecond}<br /><span>{content.titleAccent}</span></h2>
        <p>{content.description}</p>
        <button className="button button-lime" type="button" onClick={onApply}>{content.action} <ArrowRight size={16} /></button>
      </div>
      <div className="steps-list">
        {content.steps.map((step, index) => (
          <div className="step-row" key={index}>
            <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{step.title}</h3><p>{step.description}</p></div>
            <ChevronDown className="step-chevron" size={18} />
          </div>
        ))}
        <div className="journey-note"><Check size={16} /><span>{content.reassurance}</span></div>
      </div>
    </section>
  );
}
