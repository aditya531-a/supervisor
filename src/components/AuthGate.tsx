import { useState, type FormEvent } from 'react';
import { ArrowRight, Droplets, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import type { Profile } from '../supervisor';
import WaterScene from './WaterScene';

export default function AuthGate({ onAuthenticated }: { onAuthenticated: (profile: Profile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Unable to sign in. Check your details and try again.');
        return;
      }
      onAuthenticated(result);
    } catch {
      setError('Unable to connect. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About JalSakshi">
        <div className="auth-story__top">
          <div className="identity identity--light">
            <span className="identity-icon"><Droplets size={25} strokeWidth={1.8} /></span>
            <span>JalSakshi<small>Water quality workspace</small></span>
          </div>
          <span className="auth-story__marker">Field evidence. Clear action.</span>
        </div>
        <div className="auth-story__copy">
          <h1>Every source.<br />Every signal.<br /><em>In focus.</em></h1>
          <p>Turn field evidence into clear, accountable action for the communities you serve.</p>
        </div>
        <WaterScene />
        <p className="auth-story__footer">From first screening to verified resolution.</p>
      </section>

      <section className="auth-form-side" aria-label="Supervisor sign in">
        <div className="auth-form-wrap">
          <span className="auth-form__icon"><ShieldCheck size={22} strokeWidth={1.7} /></span>
          <h2>Welcome back.</h2>
          <p className="auth-form__intro">Sign in to your district workspace.</p>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" placeholder="you@district.gov.in" value={email} onChange={event => setEmail(event.target.value)} required disabled={pending} />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required disabled={pending} />
              <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="sign-in" disabled={pending} type="submit">
              <span>{pending ? 'Signing in…' : 'Sign in'}</span><ArrowRight size={19} />
            </button>
          </form>
          <p className="auth-help">Use your assigned district account. Contact your administrator if you need access.</p>
        </div>
        <p className="auth-bottom">JalSakshi <span aria-hidden="true">/</span> Supervisor portal</p>
      </section>
    </main>
  );
}
