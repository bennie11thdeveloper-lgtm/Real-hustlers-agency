import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleCheck,
  FileUp,
  LoaderCircle,
  X,
} from 'lucide-react';
import { generateReactHelpers } from '@uploadthing/react';
import siteLogo from '../Editz/20261014_121743.jpg';
import { isSupabaseConfigured, supabase, uploadThingUrl } from './lib/supabase.js';
import { defaultSiteContent } from './content.js';
import Admin from './Admin.jsx';
import AboutUs from './sections/AboutUs.jsx';
import Carousel from './sections/Carousel.jsx';
import Footer from './sections/Footer.jsx';
import Header from './sections/Header.jsx';
import Home from './sections/Home.jsx';
import HowItWorks from './sections/HowItWorks.jsx';
import Opportunities from './sections/Opportunities.jsx';
import { useSiteContent } from './useSiteContent.js';
import { supabase } from './supabaseClient.js'

const { useUploadThing } = generateReactHelpers({ url: uploadThingUrl });
const roleDesigns = [
  { icon: '✳', tone: 'peach' },
  { icon: '↗', tone: 'lime' },
  { icon: '◈', tone: 'lavender' },
  { icon: '⌘', tone: 'blue' },
];

function DocumentUploader({ submission, files, setFiles, uploadedCount, onUploaded, onError, content }) {
  const { startUpload, isUploading } = useUploadThing('documentsUploader', {
    onUploadError: (error) => onError(error.message),
  });

  async function uploadDocuments() {
    if (!files.length) return;
    onError('');
    try {
      const uploaded = await startUpload(files, {
        applicationId: submission.applicationId,
        uploadToken: submission.uploadToken,
      });
      if (!uploaded?.length) throw new Error('No documents were uploaded. Please try again.');
      onUploaded(uploaded.length);
      setFiles([]);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Document upload failed. Please try again.');
    }
  }

  return (
    <div className="document-upload">
      <label className="upload-label" htmlFor="application-documents"><FileUp size={18} /> {content.applicationForm.documentsTitle} <span className="optional-label">{content.applicationForm.documentsOptional}</span></label>
      <p>{content.applicationForm.documentsDescription}</p>
      <input id="application-documents" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={setFiles} />
      {files.length > 0 && <span className="selected-files">{files.map((file) => file.name).join(', ')}</span>}
      {uploadedCount > 0 && <span className="upload-success"><Check size={14} /> {uploadedCount} {uploadedCount === 1 ? content.applicationForm.documentsSuccessSingle : content.applicationForm.documentsSuccessMultiple}</span>}
      {files.length > 0 && (
        <button className="button button-dark" type="button" disabled={isUploading} onClick={uploadDocuments}>
          {isUploading ? <><LoaderCircle className="spinner" size={16} /> {content.applicationForm.uploading}</> : <>{content.applicationForm.documentsUploadAction} <FileUp size={15} /></>}
        </button>
      )}
    </div>
  );
}

function ApplicationForm({ onClose, roles, content }) {
  const [stage, setStage] = useState('details');
  const [submission, setSubmission] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [notificationWarnings, setNotificationWarnings] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  let hasValidPaymentTermsUrl = false;
  try {
    const parsedTermsUrl = new URL(content.paymentTermsUrl);
    hasValidPaymentTermsUrl = parsedTermsUrl.protocol === 'https:' && Boolean(parsedTermsUrl.hostname);
  } catch {
    hasValidPaymentTermsUrl = false;
  }
  const isApplicationConfigured = isSupabaseConfigured && hasValidPaymentTermsUrl;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (!supabase) throw new Error('Applications are not configured yet. Please contact the agency.');
      const formData = new FormData(event.currentTarget);
      const { data, error } = await supabase.functions.invoke('submit-application', {
        body: {
          fullName: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          role: formData.get('role'),
          experience: formData.get('experience'),
          feeAcknowledged: formData.get('feeAcknowledged') === 'on',
        },
      });

      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || 'We could not submit your application. Please try again.');
      }
      if (!data?.applicationId || !data?.uploadToken || !data?.checkoutUrl) {
        throw new Error('The agency returned an incomplete application response. Please contact the agency before retrying.');
      }

      setSubmission(data);
      setNotificationWarnings(data.notificationWarnings || []);
      setStage('documents');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not submit your application.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFileChange(event) {
    setErrorMessage('');
    const selected = Array.from(event.target.files || []);
    if (selected.length + uploadedCount > 5) {
      setErrorMessage('You can upload up to five documents.');
      event.target.value = '';
      return;
    }
    const invalid = selected.find((file) =>
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      file.size > 4 * 1024 * 1024,
    );
    if (invalid) {
      setErrorMessage('Choose PDF, JPG, or PNG files up to 4 MB each.');
      event.target.value = '';
      return;
    }
    setFiles(selected);
    event.target.value = '';
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="application-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Close application form">
          <X size={20} />
        </button>
        <img className="application-logo" src={siteLogo} alt="Real Hustlers Agency logo" />
        {stage === 'documents' ? (
          <div className="success-state">
            <span className="success-icon"><CircleCheck size={30} /></span>
            <p className="eyebrow">{content.applicationForm.receivedEyebrow}</p>
            <h2 id="form-title">{content.applicationForm.receivedTitle}</h2>
            <p>{content.applicationForm.receivedIntroduction}</p>
            {notificationWarnings.length > 0 && (
              <p className="form-warning">{notificationWarnings.join(' ')} {content.applicationForm.notificationWarning}</p>
            )}
            {isSupabaseConfigured && (
              <DocumentUploader
                submission={submission}
                files={files}
                setFiles={handleFileChange}
                uploadedCount={uploadedCount}
                onUploaded={(count) => setUploadedCount((current) => current + count)}
                onError={setErrorMessage}
                content={content}
              />
            )}
            <p className="payment-disclosure"><strong>Registration and paperwork: UGX 150,000.</strong> {content.applicationForm.paymentAfterSubmission} It does not guarantee job placement, a visa, or employment. <a href={content.paymentTermsUrl} target="_blank" rel="noreferrer">Read the agency’s fee and refund terms</a> before paying.</p>
            {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
            <button className="button button-dark" type="button" onClick={() => window.location.assign(submission.checkoutUrl)}>{content.applicationForm.continuePayment} <ArrowRight size={16} /></button>
            <p className="form-note">{content.applicationForm.closedPageNote}</p>
          </div>
        ) : (
          <>
            <p className="eyebrow">{content.applicationForm.eyebrow}</p>
            <h2 id="form-title">{content.applicationForm.title}</h2>
            <p className="modal-intro">{content.applicationForm.introduction}</p>
            <form className="application-form" onSubmit={handleSubmit}>
              <label>
                {content.applicationForm.nameLabel}
                <input name="name" autoComplete="name" placeholder={content.applicationForm.namePlaceholder} required />
              </label>
              <div className="form-row">
                <label>
                  {content.applicationForm.phoneLabel}
                  <input name="phone" type="tel" autoComplete="tel" placeholder={content.applicationForm.phonePlaceholder} required />
                </label>
                <label>
                  {content.applicationForm.emailLabel} <span className="optional-label">{content.applicationForm.emailHint}</span>
                  <input name="email" type="email" autoComplete="email" placeholder={content.applicationForm.emailPlaceholder} required />
                </label>
              </div>
              <label>
                {content.applicationForm.roleLabel}
                <select name="role" required defaultValue="">
                  <option value="" disabled>{content.applicationForm.rolePlaceholder}</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                  <option value="Other">{content.applicationForm.otherRole}</option>
                </select>
              </label>
              <label>
                {content.applicationForm.experienceLabel} <span className="optional-label">{content.applicationForm.optionalLabel}</span>
                <textarea name="experience" rows="3" placeholder={content.applicationForm.experiencePlaceholder} />
              </label>
              {hasValidPaymentTermsUrl && (
                <label className="fee-acknowledgement">
                  <input name="feeAcknowledged" type="checkbox" required />
                  <span>{content.applicationForm.acknowledgementBefore} <a href={content.paymentTermsUrl} target="_blank" rel="noreferrer">{content.applicationForm.termsLinkLabel}</a>{content.applicationForm.acknowledgementAfter}</span>
                </label>
              )}
              <p className="payment-disclosure"><strong>Registration and paperwork: UGX 150,000.</strong> {content.applicationForm.feeDisclosure} {hasValidPaymentTermsUrl && <a href={content.paymentTermsUrl} target="_blank" rel="noreferrer">{content.applicationForm.termsPrompt}</a>}</p>
              {!isSupabaseConfigured && <p className="form-warning">{content.applicationForm.notConfigured}</p>}
              {isSupabaseConfigured && !hasValidPaymentTermsUrl && <p className="form-warning">{content.applicationForm.termsMissing}</p>}
              {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
              <button className="button button-dark form-submit" type="submit" disabled={isSubmitting || !isApplicationConfigured}>
                {isSubmitting ? <><LoaderCircle className="spinner" size={16} /> {content.applicationForm.submitting}</> : <>{content.applicationForm.submitAction} <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function PaymentResult() {
  const txRef = new URLSearchParams(window.location.search).get('tx_ref');
  const [status, setStatus] = useState('checking');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!txRef || !supabase) {
      setStatus('unavailable');
      return undefined;
    }

    let active = true;
    let attempts = 0;
    let timer;
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('payment-status', { body: { txRef } });
        if (error) throw new Error('Payment status is temporarily unavailable.');
        if (!active) return;
        setStatus(data.status);
        setErrorMessage('');
        attempts += 1;
        if (data.status === 'pending' && attempts < 20) {
          timer = window.setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'Payment status is temporarily unavailable.');
        setStatus('unavailable');
      }
    };

    checkStatus();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [txRef]);

  const paid = status === 'paid';
  return (
    <main className="payment-result-page">
      <a className="brand" href="/" aria-label="Real Hustlers home"><img className="brand-logo" src={siteLogo} alt="" /><span className="brand-name">REAL<br />HUSTLERS</span></a>
      <section className="payment-result-card">
        <span className="success-icon">{paid ? <CircleCheck size={30} /> : status === 'checking' || status === 'pending' ? <LoaderCircle className="spinner" size={28} /> : <CircleCheck size={30} />}</span>
        <p className="eyebrow">{paid ? 'PAYMENT CONFIRMED' : status === 'failed' || status === 'cancelled' ? 'PAYMENT NOT COMPLETED' : 'PAYMENT STATUS'}</p>
        <h1>{paid ? 'You’re all set.' : status === 'failed' || status === 'cancelled' ? 'Payment wasn’t completed.' : status === 'unavailable' ? 'We couldn’t confirm it here.' : 'We’re confirming your payment.'}</h1>
        <p>{paid
          ? 'Your UGX 150,000 payment is confirmed. The agency will follow up about your application by SMS or email.'
          : status === 'failed' || status === 'cancelled'
            ? 'Your application is saved, but payment has not been confirmed. Use the payment link sent to you or contact the agency for help.'
            : status === 'unavailable'
              ? 'We could not confirm your payment on this page. Check your SMS or email for an update, or contact the agency before making another payment.'
              : 'Flutterwave is processing your payment. This page checks for confirmation automatically. You can safely wait here; we’ll also send a confirmation by SMS or email.'}</p>
        {errorMessage && <p className="form-warning">{errorMessage} Check your SMS or email, or contact the agency.</p>}
        <a className="button button-dark" href="/">Back to Real Hustlers <ArrowRight size={16} /></a>
      </section>
    </main>
  );
}

function PublicSite() {
  const [applicationOpen, setApplicationOpen] = useState(false);
  const content = useSiteContent();
  const roles = content.opportunities.roles.map((role, index) => ({
    ...roleDesigns[index],
    ...role,
    id: defaultSiteContent.opportunities.roles[index].label,
    number: String(index + 1).padStart(2, '0'),
  }));

  function openApplication() {
    setApplicationOpen(true);
  }

  return (
    <main>
      <Header content={content.navigation} onApply={openApplication} />
      <Home content={content.hero} onApply={openApplication} />
      <Carousel content={content.proof} description={content.about.firstParagraph} />
      <Opportunities content={content.opportunities} roles={roles} onApply={openApplication} />
      <HowItWorks content={content.journey} onApply={openApplication} />
      <AboutUs content={content.about} onApply={openApplication} />

      <section className="final-cta">
        <img className="cta-decoration" src={siteLogo} alt="" aria-hidden="true" />
        <p className="eyebrow">{content.closing.eyebrow}</p>
        <h2>{content.closing.titleFirst}<br />{content.closing.titleSecond}</h2>
        <p>{content.closing.description}</p>
        <button className="button button-lime" type="button" onClick={openApplication}>{content.closing.action} <ArrowRight size={17} /></button>
      </section>

      <Footer content={content.footer} />

      {applicationOpen && <ApplicationForm onClose={() => setApplicationOpen(false)} roles={roles} content={content} />}
    </main>
  );
}

function App() {
  if (window.location.pathname === '/admin') return <Admin />;
  if (window.location.pathname === '/payment-result') return <PaymentResult />;
  return <PublicSite />;
}

export default App;
