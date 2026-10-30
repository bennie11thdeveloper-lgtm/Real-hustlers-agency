import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import siteLogo from '../../Editz/20261014_121743.jpg';
import './Header.css';

export default function Header({ content, onApply }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleApply() {
    setMenuOpen(false);
    onApply();
  }

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Real Hustlers home">
        <img className="brand-logo" src={content.logo || siteLogo} alt="" />
        <span className="brand-name">REAL<br />HUSTLERS</span>
      </a>
      <button className="mobile-menu icon-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
        {content.links.map((link, index) => (
          <a key={`${link.href}-${index}`} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>
        ))}
        <button className="button button-dark nav-cta" type="button" onClick={handleApply}>{content.action} <ArrowRight size={15} /></button>
      </nav>
    </header>
  );
}
