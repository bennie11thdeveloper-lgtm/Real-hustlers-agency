import { ArrowLeft, ShieldCheck } from 'lucide-react';
import './AdminLogin.css';

export default function AdminLogin({
  email,
  setEmail,
  password,
  setPassword,
  isRecovery,
  isLoading,
  message,
  errorMessage,
  onSignIn,
  onPasswordRecovery,
  onRequestPasswordReset,
}) {
  return (
    <div className="admin-login">
      <div className="admin-badge"><ShieldCheck size={17} /> SECURE OWNER ACCESS</div>
      <h1>Website content,<br />on your terms.</h1>
      <p>Sign in with your authorized agency admin account to update the public website. You don’t need to visit the database dashboard for everyday edits.</p>
      {isRecovery ? (
        <form className="admin-login-form" onSubmit={onPasswordRecovery}>
          <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <button className="button button-dark" type="submit" disabled={isLoading}>Update password <ShieldCheck size={16} /></button>
        </form>
      ) : (
        <form className="admin-login-form" onSubmit={onSignIn}>
          <label>Admin email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          {message && <p className="admin-success">{message}</p>}
          <button className="button button-dark" type="submit" disabled={isLoading}>Sign in <ShieldCheck size={16} /></button>
          <button className="admin-reset" type="button" onClick={onRequestPasswordReset}>Forgot your password?</button>
        </form>
      )}
      <a className="admin-back-link" href="/"><ArrowLeft size={14} /> Back to the public website</a>
    </div>
  );
}
