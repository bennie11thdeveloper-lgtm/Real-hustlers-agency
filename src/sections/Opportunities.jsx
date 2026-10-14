import { ArrowRight, MoveUpRight } from 'lucide-react';
import domesticWorkerImage from '../../Editz/Domestic-worker.jpg';
import driverImage from '../../Editz/Driver.jpg';
import machineOperatorImage from '../../Editz/Operator.jpg';
import securityWorkerImage from '../../Editz/Security.webp';
import './Opportunities.css';

const roleImages = [
  domesticWorkerImage,
  driverImage,
  securityWorkerImage,
  machineOperatorImage,
];

export default function Opportunities({ content, roles, onApply }) {
  return (
    <section className="opportunities section-wrap" id="opportunities">
      <div className="section-heading">
        <div><p className="eyebrow">{content.eyebrow}</p><h2>{content.titleFirst}<br /><span>{content.titleSecond}</span></h2></div>
        <p className="section-intro">{content.introduction}</p>
      </div>
      <div className="role-grid">
        {roles.map((role, index) => (
          <button
            className={`role-card ${role.tone}`}
            key={role.number}
            type="button"
            onClick={onApply}
            aria-label={`${role.label}: ${role.detail}. ${content.roleAction}`}
          >
            <img className="role-image" src={roleImages[index]} alt="" />
            <span className="role-card-content">
              <span className="role-top"><span>{role.number} / ROLE</span></span>
              <span className="role-card-copy">
                <span className="role-name">{role.label}</span>
                <span className="role-detail">{role.detail}</span>
              </span>
              <span className="role-link">{content.roleAction} <ArrowRight size={16} /></span>
            </span>
          </button>
        ))}
      </div>
      <div className="opportunity-foot"><span>{content.fitNote}</span><button type="button" className="inline-link" onClick={onApply}>{content.fitAction} <MoveUpRight size={15} /></button></div>
    </section>
  );
}
