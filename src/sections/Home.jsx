import { ArrowDown, ArrowDownRight, ArrowRight, Globe2, ShieldCheck, Sparkles } from 'lucide-react';
import './Home.css';

export default function Home({ content, onApply }) {
  return (
    <section className="hero" id="home">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="live-dot" /> {content.kicker}</div>
        <h1>{content.titleFirst}<br />{content.titleSecond} <span>{content.titleAccent}</span></h1>
        <p className="hero-description">{content.description}</p>
        <div className="hero-actions">
          <button className="button button-lime" type="button" onClick={onApply}>{content.primaryAction} <ArrowRight size={17} /></button>
          <a className="text-link" href="#how-it-works">{content.secondaryAction} <ArrowDown size={15} /></a>
        </div>
        <div className="hero-footnote"><ShieldCheck size={16} /> {content.reassurance}</div>
      </div>
      <div className="hero-art" aria-label="An illustration celebrating the journey from Uganda to new opportunities">
        <div className="hero-art-top"><span>{content.artTop}</span><ArrowDownRight size={18} /></div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="sun-disc" />
        <div className="figure-shadow" />
        <div className="figure">
          <div className="figure-head" />
          <div className="figure-body" />
          <div className="figure-arm" />
          <div className="figure-leg figure-leg-one" />
          <div className="figure-leg figure-leg-two" />
          <div className="figure-bag"><span /></div>
        </div>
        <div className="art-sticker sticker-top"><Sparkles size={15} /> {content.artSticker}</div>
        <div className="art-sticker sticker-bottom"><Globe2 size={16} /><span>{content.artWorldFirst}<br />{content.artWorldSecond}</span></div>
        <div className="art-caption">{content.artCaptionFirst}<br />{content.artCaptionSecond}</div>
        <div className="art-dots" aria-hidden="true">· &nbsp; · &nbsp; ·<br />· &nbsp; · &nbsp; ·<br />· &nbsp; · &nbsp; ·</div>
      </div>
      <div className="hero-index"><span>01</span><span className="index-line" /><span>03</span></div>
    </section>
  );
}
