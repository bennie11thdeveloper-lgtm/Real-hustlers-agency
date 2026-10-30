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
      {content.team.length > 0 && (
        <div className="about-team">
          <div className="about-team-heading">
            <h3>{content.teamTitle}</h3>
            <p>{content.teamIntroduction}</p>
          </div>
          <div className="team-grid">
            {content.team.map((member, index) => (
              <article className="team-card" key={`${member.name}-${index}`}>
                {member.image
                  ? <img className="team-photo" src={member.image} alt={member.name} />
                  : <div className="team-photo team-photo-placeholder" aria-hidden="true">
                    {member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                  </div>}
                <h4>{member.name}</h4>
                <p>{member.position}</p>
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="about-bottom"><span>{content.footerLeft}</span><span>{content.footerRight} <ArrowDownRight size={14} /></span></div>
    </section>
  );
}
