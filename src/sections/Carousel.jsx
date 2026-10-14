import { ArrowDownRight, CircleCheck, Globe2, Sparkles } from 'lucide-react';
import './Carousel.css';

const proofIcons = [Globe2, CircleCheck, Sparkles];

export default function Carousel({ content, description }) {
  return (
    <section className="proof-strip" aria-label="About our company and our approach">
      <div className="company-description">
        <p className="company-description-label">ABOUT REAL HUSTLERS’ AGENCY</p>
        <p className="company-description-copy">{description}</p>
      </div>
      <div className="proof-items">
        {content.items.map((item, index) => {
          const Icon = proofIcons[Math.min(index, proofIcons.length - 1)];
          return (
            <div className="proof-item" key={index}>
              <span className="proof-icon"><Icon size={19} /></span>
              <span>{item.first}<br />{item.second}</span>
            </div>
          );
        })}
      </div>
      <p className="proof-tagline">{content.tagline} <ArrowDownRight size={16} /></p>
    </section>
  );
}
