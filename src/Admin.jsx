import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LoaderCircle, LogOut, Save } from 'lucide-react';
import siteLogo from '../Editz/20261014_121743.jpg';
import { defaultSiteContent } from './content.js';
import { supabase } from './lib/supabase.js';
import AdminLogin from './sections/AdminLogin.jsx';

function displayLabel(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
          if (contentResult.data?.content) setContent(contentResult.data.content);
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
      setContent(contentResult.data?.content ?? defaultSiteContent);
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

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    const { data, error } = await supabase
      .from('site_content')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', 'public')
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setErrorMessage('The changes could not be saved. Check your internet connection and admin permissions.');
    } else {
      setMessage('Changes saved. Refresh the public website to see the latest content.');
    }
    setIsSaving(false);
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
              <div><p className="eyebrow">REAL HUSTLERS’ AGENCY</p><h1>Website content</h1><p>Update the words visitors see. Your saved edits appear on the public site.</p></div>
              <a className="admin-preview-link" href="/" target="_blank" rel="noreferrer">View public site <ArrowLeft size={14} /></a>
            </div>
            {message && <p className="admin-success"><Check size={16} /> {message}</p>}
            {errorMessage && <p className="form-error admin-error" role="alert">{errorMessage}</p>}
            <form className="content-editor" onSubmit={handleSave}>
              <ContentFields value={content} onChange={(path, value) => setContent((current) => updateContentAtPath(current, path, value))} />
              <div className="editor-actions">
                <p>Edits are published when you save. The UGX 150,000 fee and job categories used for payment records are fixed settings.</p>
                <button className="button button-dark" type="submit" disabled={isSaving}>{isSaving ? <><LoaderCircle className="spinner" size={16} /> Saving…</> : <>Save changes <Save size={16} /></>}</button>
              </div>
            </form>
          </>
        )}
      </section>
      <footer className="admin-footer">Applicant information and payment details are never shown in this content editor.</footer>
    </main>
  );
}
