import { ArrowDown } from 'lucide-react';
import siteLogo from '../../Editz/20261014_121743.jpg';
import './Footer.css';

export default function Footer({ content }) {
  return (
    <footer className="site-footer">
      <a className="brand footer-brand" href="#home" aria-label="Real Hustlers home">
        <img className="brand-logo" src={siteLogo} alt="" />
        <span className="brand-name">REAL<br />HUSTLERS</span>
      </a>
      <p>{content.description}</p>
      <a className="admin-footer-link" href="/admin">Edit website content</a>
      <a className="back-top" href="#home">{content.backToTop} <ArrowDown size={14} /></a>
      <span className="copyright">{content.copyright}</span>
    </footer>
  );
}
