'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { ArrowRight, BookOpen, Check, Layers3, LockKeyhole, Moon, Sun } from 'lucide-react';

type Props = {
  signInHref: string;
  deskHref: string;
  signOutHref: string;
  signedInIdentity: string | null;
  localPreview: boolean;
  authReady: boolean;
  errorMessage: string;
};

export default function LoginScreen({ signInHref, deskHref, signOutHref, signedInIdentity, localPreview, authReady, errorMessage }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setMounted(true);
    const resetPending = () => setPending(false);
    window.addEventListener('pageshow', resetPending);
    return () => window.removeEventListener('pageshow', resetPending);
  }, []);
  const dark = mounted && resolvedTheme === 'dark';

  return <div className="login-page">
    <header className="login-header">
      <a href="/" className="login-brand" aria-label="Current Affairs home">
        <span className="login-brand-mark"><BookOpen size={22} strokeWidth={1.6}/></span>
        <span>Current Affairs<small>YOUR UPSC DESK</small></span>
      </a>
      <button className="page-theme-toggle login-theme-toggle" role="switch" aria-label="Dark theme" aria-checked={dark} title={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
        <span className="theme-icon-stack" aria-hidden="true"><Moon className="theme-icon-moon" size={19} strokeWidth={1.7}/><Sun className="theme-icon-sun" size={19} strokeWidth={1.7}/></span>
      </button>
    </header>

    <main className="login-main">
      <section className="login-story" aria-labelledby="login-story-title">
        <div className="login-eyebrow"><span/> READ. CONNECT. REMEMBER.</div>
        <h1 id="login-story-title">Today’s news.<br/><em>Tomorrow’s answers.</em></h1>
        <p className="login-story-copy">A quieter space to make sense of the headlines.<br className="login-desktop-break"/> Collect what matters. Come back with clarity.</p>
        <div className="login-note-illustration" aria-hidden="true">
          <div className="login-note-index"><span>YOUR DAILY READING</span><BookOpen size={16}/></div>
          <div className="login-note-title">One story. A bigger picture.</div>
          <div className="login-note-lines"><i/><i/><i/></div>
          <div className="login-note-subjects"><span>Economy</span><span>Environment</span><span>GS III</span></div>
          <div className="login-note-saved"><Check size={13}/> A little more prepared, every day.</div>
        </div>
        <div className="login-story-footer"><Layers3 size={17} strokeWidth={1.6}/><span>Your subjects. Your connections. Your pace.</span></div>
      </section>

      <section className="login-card" aria-labelledby="login-title">
        <span className="login-card-icon"><BookOpen size={26} strokeWidth={1.4}/></span>
        <div className="login-eyebrow">YOUR PERSONAL WORKSPACE</div>
        <h2 id="login-title">Welcome back.</h2>
        <p className="login-card-copy">Your notes and the connections between them.<br/>All in one place, ready when you are.</p>
        {signedInIdentity && <div className="login-current-account"><span className="login-account-check"><Check size={16}/></span><span>Signed in as<strong>{signedInIdentity}</strong></span></div>}
        {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}
        {authReady ? <a className={'login-signin ' + (pending ? 'is-pending' : '')} href={signedInIdentity ? deskHref : signInHref} aria-busy={pending} onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (pending) { event.preventDefault(); return; }
          setPending(true);
        }}>
          <span>{pending ? 'Opening your desk…' : signedInIdentity ? 'Open your desk' : localPreview ? 'Continue to your desk' : 'Continue with GitHub'}</span><ArrowRight size={18}/>
        </a> : <button className="login-signin" disabled>Sign-in unavailable</button>}
        {!authReady ? <p className="login-provider-note" role="status">Sign-in setup is in progress. Please try again later.</p> : signedInIdentity ? <a href={signOutHref} className="login-switch-account">Sign out</a> : <p className="login-provider-note">{localPreview ? 'This local preview uses a development account.' : 'Sign in with your GitHub account. No repository access required.'}</p>}
        <div className="login-card-divider"/>
        <div className="login-privacy"><LockKeyhole size={16} strokeWidth={1.6}/><p>Your collection is private to your account.<br/>Pick up where you left off, on any device.</p></div>
      </section>
    </main>

    <footer className="login-footer"><span>Built for clarity. Kept for revision.</span><span>A LITTLE EVERY DAY.</span></footer>
  </div>;
}
