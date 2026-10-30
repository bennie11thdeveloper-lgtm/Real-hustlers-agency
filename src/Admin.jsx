import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LoaderCircle, LogOut, Plus, Save, Trash2, Upload } from 'lucide-react';
import siteLogo from '../Editz/20261014_121743.jpg';
import { defaultOpportunityImages, defaultSiteContent, normalizeSiteContent } from './content.js';
import { supabase } from './lib/supabase.js';
import AdminLogin from './sections/AdminLogin.jsx';

const contentSections = [
  { key: 'navigation', label: 'Header' },
  { key: 'hero', label: 'Homepage hero' },
  { key: 'proof', label: 'Highlights' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'journey', label: 'How it works' },
  { key: 'about', label: 'About us' },
  { key: 'closing', label: 'Final call to action' },
  { key: 'footer', label: 'Footer' },
  { key: 'applicationForm', label: 'Application form' },
  { key: 'paymentTermsUrl', label: 'Payment terms' },
];

function displayLabel(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
}

function isValidNavigationHref(value) {
  const href = value.trim();
  if (/^#[A-Za-z0-9_-]+$/.test(href) || /^\/(?!\/)/.test(href)) return true;
  if (/^https:\/\/\S+$/i.test(href)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return true;
  return /^tel:\+?[0-9(). -]+$/i.test(href);
}

function HeaderFields({ value, onChange, onUploadLogo, isUploadingLogo }) {
  return (
    <div className="header-editor">
      <div className="header-logo-editor">
        <div>
          <label className="editor-field-label" htmlFor="header-logo-upload">Header logo</label>
          <p>Upload a PNG, JPG, or WebP image up to 2 MB.</p>
          <label className="button button-dark editor-upload-button" htmlFor="header-logo-upload">
            {isUploadingLogo ? <><LoaderCircle className="spinner" size={15} /> Uploading…</> : <><Upload size={15} /> Choose image</>}
          </label>
          <input
            id="header-logo-upload"
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isUploadingLogo}
            onChange={onUploadLogo}
          />
        </div>
        <img className="editor-logo-preview" src={value.logo || siteLogo} alt="Current header logo preview" />
      </div>

      <div className="header-links-heading">
        <div>
          <h2>Navigation links</h2>
          <p>Edit the text and destination visitors see in the header.</p>
        </div>
        <button
          className="editor-add-link"
          type="button"
          onClick={() => onChange({ ...value, links: [...value.links, { label: 'New link', href: '#home' }] })}
        >
          <Plus size={15} /> Add link
        </button>
      </div>
      <div className="header-link-list">
        {value.links.map((link, index) => (
          <fieldset className="header-link-row" key={`header-link-${index}`}>
            <legend>Link {index + 1}</legend>
            <label className="editor-field">
              <span>Link text</span>
              <input
                type="text"
                value={link.label}
                onChange={(event) => {
                  const links = value.links.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item,
                  );
                  onChange({ ...value, links });
                }}
              />
            </label>
            <label className="editor-field">
              <span>Destination</span>
              <input
                type="text"
                value={link.href}
                placeholder="#about or https://example.com"
                onChange={(event) => {
                  const links = value.links.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, href: event.target.value } : item,
                  );
                  onChange({ ...value, links });
                }}
              />
            </label>
            <button
              className="editor-remove-link"
              type="button"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => onChange({
                ...value,
                links: value.links.filter((_, itemIndex) => itemIndex !== index),
              })}
            >
              <Trash2 size={16} />
            </button>
          </fieldset>
        ))}
        {value.links.length === 0 && <p className="header-links-empty">No navigation links yet. Add a link to get started.</p>}
      </div>
      <label className="editor-field header-action-field">
        <span>Application button text</span>
        <input
          type="text"
          value={value.action}
          onChange={(event) => onChange({ ...value, action: event.target.value })}
        />
      </label>
    </div>
  );
}

function OpportunityFields({ value, onChange, onUploadImage, uploadingRoleIndex }) {
  function updateRole(index, changes) {
    onChange(value.roles.map((role, roleIndex) =>
      roleIndex === index ? { ...role, ...changes } : role,
    ));
  }

  return (
    <div className="opportunity-editor">
      <div className="header-links-heading">
        <div>
          <h2>Opportunity cards</h2>
          <p>Manage each card’s title, description, and image. Images can be PNG, JPG, or WebP up to 2 MB.</p>
        </div>
        <button
          className="editor-add-link"
          type="button"
          disabled={uploadingRoleIndex !== null}
          onClick={() => onChange([
            ...value.roles,
            { label: '', detail: '', image: '' },
          ])}
        >
          <Plus size={15} /> Add opportunity
        </button>
      </div>
      <div className="opportunity-editor-list">
        {value.roles.map((role, index) => (
          <fieldset className="opportunity-editor-card" key={`opportunity-${index}`}>
            <legend>Card {String(index + 1).padStart(2, '0')}</legend>
            <div className="opportunity-editor-fields">
              <label className="editor-field">
                <span>Job title</span>
                <input
                  type="text"
                  maxLength={120}
                  value={role.label}
                  placeholder="e.g. Hospitality workers"
                  onChange={(event) => updateRole(index, { label: event.target.value })}
                />
              </label>
              <label className="editor-field">
                <span>Job description</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={role.detail}
                  placeholder="Describe the work or example roles"
                  onChange={(event) => updateRole(index, { detail: event.target.value })}
                />
              </label>
              <div className="opportunity-image-editor">
                <span className="editor-field-label">Card image</span>
                <div className="opportunity-image-controls">
                  <img
                    src={role.image || defaultOpportunityImages[index % defaultOpportunityImages.length]}
                    alt=""
                    onError={(event) => {
                      const fallback = defaultOpportunityImages[index % defaultOpportunityImages.length];
                      if (event.currentTarget.src !== new URL(fallback, window.location.href).href) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <label className="button button-dark editor-upload-button" htmlFor={`opportunity-image-${index}`}>
                    {uploadingRoleIndex === index
                      ? <><LoaderCircle className="spinner" size={15} /> Uploading…</>
                      : <><Upload size={15} /> {role.image ? 'Change image' : 'Add image'}</>}
                  </label>
                  <input
                    id={`opportunity-image-${index}`}
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingRoleIndex !== null}
                    onChange={(event) => onUploadImage(index, event)}
                  />
                </div>
              </div>
              <button
                className="editor-remove-link opportunity-remove-card"
                type="button"
                disabled={uploadingRoleIndex !== null}
                aria-label={`Delete ${role.label || `opportunity card ${index + 1}`}`}
                onClick={() => onChange(value.roles.filter((_, roleIndex) => roleIndex !== index))}
              >
                <Trash2 size={16} /> Delete card
              </button>
            </div>
          </fieldset>
        ))}
        {value.roles.length === 0 && <p className="header-links-empty">No opportunity cards yet. Add one to get started.</p>}
      </div>
    </div>
  );
}

function AboutFields({ value, onChange, onUploadImage, uploadingTeamIndex }) {
  const { team, ...aboutCopy } = value;

  function updateMember(index, changes) {
    onChange({
      ...value,
      team: team.map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...changes } : member,
      ),
    });
  }

  return (
    <div className="about-editor">
      <ContentFields
        value={aboutCopy}
        path={['about']}
        onChange={(path, fieldValue) => onChange(updateContentAtPath(value, path.slice(1), fieldValue))}
      />
      <div className="team-editor">
        <div className="header-links-heading">
          <div>
            <h2>Our Team</h2>
            <p>Add each person’s name, position, and portrait. Portraits can be PNG, JPG, or WebP up to 2 MB.</p>
          </div>
          <button
            className="editor-add-link"
            type="button"
            disabled={uploadingTeamIndex !== null}
            onClick={() => onChange({ ...value, team: [...team, { name: '', position: '', image: '' }] })}
          >
            <Plus size={15} /> Add team member
          </button>
        </div>
        <div className="team-editor-list">
          {team.map((member, index) => (
            <fieldset className="team-editor-card" key={`team-member-${index}`}>
              <legend>Team member {index + 1}</legend>
              <div className="team-editor-fields">
                <label className="editor-field">
                  <span>Name</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={member.name}
                    placeholder="Full name"
                    onChange={(event) => updateMember(index, { name: event.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>Position</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={member.position}
                    placeholder="e.g. Agency Director"
                    onChange={(event) => updateMember(index, { position: event.target.value })}
                  />
                </label>
                <div className="team-image-editor">
                  <span className="editor-field-label">Portrait</span>
                  <div className="team-image-controls">
                    {member.image
                      ? <img src={member.image} alt="" />
                      : <div className="team-image-placeholder" aria-hidden="true">
                        {member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                      </div>}
                    <label className="button button-dark editor-upload-button" htmlFor={`team-image-${index}`}>
                      {uploadingTeamIndex === index
                        ? <><LoaderCircle className="spinner" size={15} /> Uploading…</>
                        : <><Upload size={15} /> {member.image ? 'Change portrait' : 'Add portrait'}</>}
                    </label>
                    <input
                      id={`team-image-${index}`}
                      className="visually-hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploadingTeamIndex !== null}
                      onChange={(event) => onUploadImage(index, event)}
                    />
                  </div>
                </div>
                <button
                  className="editor-remove-link opportunity-remove-card"
                  type="button"
                  disabled={uploadingTeamIndex !== null}
                  aria-label={`Delete ${member.name || `team member ${index + 1}`}`}
                  onClick={() => onChange({ ...value, team: team.filter((_, memberIndex) => memberIndex !== index) })}
                >
                  <Trash2 size={16} /> Delete member
                </button>
              </div>
            </fieldset>
          ))}
          {team.length === 0 && <p className="header-links-empty">No team members yet. Add a person to create the Our Team section.</p>}
        </div>
      </div>
    </div>
  );
}

function ContentFields({ value, path = [], onChange }) {
  if (Array.isArray(value)) {
    return (
      <div className="editor-array">
        {value.map((item, index) => (
          <fieldset className="editor-group" key={`${path.join('.')}.${index}`}>
            <legend>Item {index + 1}</legend>
            <ContentFields value={item} path={[...path, index]} onChange={onChange} />
          </fieldset>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="editor-object">
        {Object.entries(value).map(([key, item]) => (
          <div className="editor-field" key={`${path.join('.')}.${key}`}>
            <label>{displayLabel(key)}</label>
            <ContentFields value={item} path={[...path, key]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }

  const key = String(path.at(-1) ?? '');
  const fieldLabel = displayLabel(key);
  const termsField = key === 'paymentTermsUrl';
  return termsField ? (
    <input
      type="url"
      value={value}
      placeholder="https://yourdomain.com/registration-terms"
      aria-label={fieldLabel}
      onChange={(event) => onChange(path, event.target.value)}
    />
  ) : (
    <textarea
      rows={String(value).length > 100 ? 4 : 2}
      value={value}
      aria-label={fieldLabel}
      onChange={(event) => onChange(path, event.target.value)}
    />
  );
}

function updateContentAtPath(content, path, value) {
  if (!path.length) return value;
  const [key, ...remaining] = path;
  const copy = Array.isArray(content) ? [...content] : { ...content };
  copy[key] = remaining.length
    ? updateContentAtPath(content[key], remaining, value)
    : value;
  return copy;
}

export default function Admin() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [content, setContent] = useState(defaultSiteContent);
  const [activeSection, setActiveSection] = useState('navigation');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadingRoleIndex, setUploadingRoleIndex] = useState(null);
  const [uploadingTeamIndex, setUploadingTeamIndex] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setErrorMessage('The site owner needs to finish connecting the Supabase project first.');
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    async function loadAdmin() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setErrorMessage('We could not check the admin session. Please reload the page.');
        setIsLoading(false);
        return;
      }
      setSession(data.session);

      if (data.session) {
        const [adminResult, contentResult] = await Promise.all([
          supabase.from('site_admins').select('user_id').maybeSingle(),
          supabase.from('site_content').select('content').eq('id', 'public').maybeSingle(),
        ]);
        if (!active) return;

        if (adminResult.error || contentResult.error) {
          setErrorMessage('We could not load the editor. Check the one-time admin setup and database migration.');
        } else if (!adminResult.data) {
          setErrorMessage('This account is not authorized to edit website content.');
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setIsAdmin(true);
          if (contentResult.data?.content) setContent(normalizeSiteContent(contentResult.data.content));
        }
      }
      setIsLoading(false);
    }

    loadAdmin();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsAdmin(false);
        if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn(event) {
    event.preventDefault();
    if (!supabase) return;
    setIsLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMessage('Sign-in failed. Check your admin email and password.');
      setIsLoading(false);
      return;
    }

    setSession(data.session);
    const [adminResult, contentResult] = await Promise.all([
      supabase.from('site_admins').select('user_id').maybeSingle(),
      supabase.from('site_content').select('content').eq('id', 'public').maybeSingle(),
    ]);
    if (adminResult.error || contentResult.error) {
      setErrorMessage('We could not load the editor. Check the database setup and your admin access.');
      await supabase.auth.signOut();
    } else if (!adminResult.data) {
      setErrorMessage('This account is not authorized to edit website content.');
      await supabase.auth.signOut();
    } else {
      setIsAdmin(true);
      setContent(normalizeSiteContent(contentResult.data?.content ?? defaultSiteContent));
      setPassword('');
    }
    setIsLoading(false);
  }

  async function handleRequestPasswordReset() {
    if (!supabase || !email) {
      setErrorMessage('Enter your admin email first.');
      return;
    }
    setErrorMessage('');
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`,
    });
    if (error) {
      setErrorMessage('We could not send a password reset. Check your email and try again.');
      return;
    }
    setMessage('If this email belongs to an admin account, a secure reset link is on its way.');
  }

  async function handlePasswordRecovery(event) {
    event.preventDefault();
    if (!supabase || password.length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage('We could not update your password. Please request another reset link.');
      setIsLoading(false);
      return;
    }
    setPassword('');
    setIsRecovery(false);
    const { data, error: roleError } = await supabase
      .from('site_admins')
      .select('user_id')
      .maybeSingle();
    if (roleError || !data) {
      setErrorMessage('Your password was updated, but admin access could not be confirmed. Please sign in again.');
      await supabase.auth.signOut();
      setSession(null);
      setIsAdmin(false);
    } else {
      setIsAdmin(true);
      setMessage('Your password was updated.');
    }
    setIsLoading(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const termsUrl = content.paymentTermsUrl.trim();
    if (termsUrl) {
      try {
        if (new URL(termsUrl).protocol !== 'https:') throw new Error();
      } catch {
        setErrorMessage('Enter a complete HTTPS link to the published fee and refund terms.');
        return;
      }
    }

    const invalidLink = content.navigation.links.find(({ label, href }) =>
      !label.trim() || !isValidNavigationHref(href),
    );
    if (invalidLink) {
      setErrorMessage('Each header link needs text and a valid destination (a #section, /page, HTTPS URL, email, or phone link).');
      return;
    }

    const roleLabels = content.opportunities.roles.map((role) => role.label.trim());
    if (content.opportunities.roles.some((role) =>
      role.label.trim().length < 2 ||
      role.label.trim().length > 120 ||
      !role.detail.trim() ||
      role.label.trim().toLowerCase() === 'other',
    )) {
      setErrorMessage('Each opportunity needs a 2–120 character job title and a description. “Other” is reserved for the application form.');
      return;
    }
    if (roleLabels.some((label, index) =>
      roleLabels.findIndex((other) => other.toLowerCase() === label.toLowerCase()) !== index,
    )) {
      setErrorMessage('Each opportunity must have a unique job title.');
      return;
    }
    if (content.about.team.some((member) =>
      !member.name.trim() || !member.position.trim() || !member.image,
    )) {
      setErrorMessage('Each team member needs a name, position, and portrait before you can save.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    const contentToSave = {
      ...content,
      opportunities: {
        ...content.opportunities,
        roles: content.opportunities.roles.map((role) => ({
          ...role,
          label: role.label.trim(),
          detail: role.detail.trim(),
        })),
      },
      about: {
        ...content.about,
        team: content.about.team.map((member) => ({
          ...member,
          name: member.name.trim(),
          position: member.position.trim(),
        })),
      },
    };
    const { data, error } = await supabase
      .from('site_content')
      .update({ content: contentToSave, updated_at: new Date().toISOString() })
      .eq('id', 'public')
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setErrorMessage('The changes could not be saved. Check your internet connection and admin permissions.');
    } else {
      setContent(contentToSave);
      setMessage('Changes saved. Refresh the public website to see the latest content.');
    }
    setIsSaving(false);
  }

  async function handleLogoUpload(event) {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    if (!file) return;
    if (!supabase || !isAdmin) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setErrorMessage('Choose a PNG, JPG, or WebP image up to 2 MB.');
      return;
    }

    setIsUploadingLogo(true);
    setErrorMessage('');
    setMessage('');
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const objectPath = `header-logo/${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(objectPath);
      setContent((current) => ({
        ...current,
        navigation: { ...current.navigation, logo: data.publicUrl },
      }));
      setMessage('Logo uploaded. Save changes to publish it.');
    } catch {
      setErrorMessage('Logo upload failed. Check the site-assets storage setup and try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleOpportunityImageUpload(index, event) {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    if (!file || !supabase || !isAdmin) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setErrorMessage('Choose a PNG, JPG, or WebP image up to 2 MB.');
      return;
    }

    setUploadingRoleIndex(index);
    setErrorMessage('');
    setMessage('');
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const objectPath = `opportunity-images/${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(objectPath);
      setContent((current) => ({
        ...current,
        opportunities: {
          ...current.opportunities,
          roles: current.opportunities.roles.map((role, roleIndex) =>
            roleIndex === index ? { ...role, image: data.publicUrl } : role,
          ),
        },
      }));
      setMessage('Image uploaded. Save changes to publish it.');
    } catch {
      setErrorMessage('Image upload failed. Check the site-assets storage setup and try again.');
    } finally {
      setUploadingRoleIndex(null);
    }
  }

  async function handleTeamImageUpload(index, event) {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    if (!file || !supabase || !isAdmin) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setErrorMessage('Choose a PNG, JPG, or WebP image up to 2 MB.');
      return;
    }

    setUploadingTeamIndex(index);
    setErrorMessage('');
    setMessage('');
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const objectPath = `team-portraits/${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(objectPath);
      setContent((current) => ({
        ...current,
        about: {
          ...current.about,
          team: current.about.team.map((member, memberIndex) =>
            memberIndex === index ? { ...member, image: data.publicUrl } : member,
          ),
        },
      }));
      setMessage('Portrait uploaded. Save changes to publish it.');
    } catch {
      setErrorMessage('Portrait upload failed. Check the site-assets storage setup and try again.');
    } finally {
      setUploadingTeamIndex(null);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage('Could not sign out. Please close this tab and try again.');
    else {
      setSession(null);
      setIsAdmin(false);
      setMessage('');
      setErrorMessage('');
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="brand" href="/" aria-label="Return to Real Hustlers website">
          <img className="brand-logo" src={siteLogo} alt="" />
          <span className="brand-name">REAL<br />HUSTLERS</span>
        </a>
        {isAdmin && <button className="admin-signout" type="button" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>}
      </header>

      <section className="admin-content">
        {isLoading ? (
          <div className="admin-message"><LoaderCircle className="spinner" size={22} /> Checking your account…</div>
        ) : !session || !isAdmin ? (
          <AdminLogin
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            isRecovery={isRecovery}
            isLoading={isLoading}
            message={message}
            errorMessage={errorMessage}
            onSignIn={handleSignIn}
            onPasswordRecovery={handlePasswordRecovery}
            onRequestPasswordReset={handleRequestPasswordReset}
          />
        ) : (
          <>
            <div className="admin-title-row">
              <div><p className="eyebrow">REAL HUSTLERS’ AGENCY</p><h1>Website content</h1><p>Update what visitors see. Your saved edits appear on the public site.</p></div>
              <a className="admin-preview-link" href="/" target="_blank" rel="noreferrer">View public site <ArrowLeft size={14} /></a>
            </div>
            {message && <p className="admin-success"><Check size={16} /> {message}</p>}
            {errorMessage && <p className="form-error admin-error" role="alert">{errorMessage}</p>}
            <form className="content-editor" onSubmit={handleSave}>
              <div className="content-section-tabs" role="group" aria-label="Editable website sections">
                {contentSections.map((section) => (
                  <button
                    className={activeSection === section.key ? 'content-section-tab is-active' : 'content-section-tab'}
                    type="button"
                    aria-pressed={activeSection === section.key}
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <section
                className="content-section-panel"
                aria-label={contentSections.find((section) => section.key === activeSection)?.label}
              >
                {activeSection === 'navigation' ? (
                  <HeaderFields
                    value={content.navigation}
                    onChange={(navigation) => setContent((current) => ({ ...current, navigation }))}
                    onUploadLogo={handleLogoUpload}
                    isUploadingLogo={isUploadingLogo}
                  />
                ) : activeSection === 'opportunities' ? (
                  <OpportunityFields
                    value={content.opportunities}
                    onChange={(roles) => setContent((current) => ({
                      ...current,
                      opportunities: { ...current.opportunities, roles },
                    }))}
                    onUploadImage={handleOpportunityImageUpload}
                    uploadingRoleIndex={uploadingRoleIndex}
                  />
                ) : activeSection === 'about' ? (
                  <AboutFields
                    value={content.about}
                    onChange={(about) => setContent((current) => ({ ...current, about }))}
                    onUploadImage={handleTeamImageUpload}
                    uploadingTeamIndex={uploadingTeamIndex}
                  />
                ) : (
                  <ContentFields
                    value={content[activeSection]}
                    path={[activeSection]}
                    onChange={(path, value) => setContent((current) => updateContentAtPath(current, path, value))}
                  />
                )}
              </section>
              <div className="editor-actions">
                <p>Edits are published when you save. The UGX 150,000 fee and job categories used for payment records are fixed settings.</p>
                <button className="button button-dark" type="submit" disabled={isSaving || isUploadingLogo || uploadingRoleIndex !== null || uploadingTeamIndex !== null}>{isSaving ? <><LoaderCircle className="spinner" size={16} /> Saving…</> : <>Save changes <Save size={16} /></>}</button>
              </div>
            </form>
          </>
        )}
      </section>
      <footer className="admin-footer">Applicant information and payment details are never shown in this content editor.</footer>
    </main>
  );
}
