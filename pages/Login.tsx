import React, { useEffect, useRef, useState } from 'react';
import { backend } from '../services/storage';
import { UserSession } from '../types';
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react';

type View = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
const inputStyle = 'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-slate-900 placeholder-slate-400 outline-none transition-all';
const labelStyle = 'block text-xs font-semibold text-slate-600 mb-2';

export default function Login({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [action] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [view, setView] = useState<View>(() => action.has('reset') ? 'reset' : action.has('verify') ? 'verify' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const verification = useRef<Promise<{ message: string }> | null>(null);

  useEffect(() => {
    if (action.has('verify') || action.has('reset')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!action.has('verify')) return;
    let active = true;
    setLoading(true);
    verification.current ??= backend.verifyEmail(action.get('verify') || '');
    verification.current.then(result => { if (active) { setMessage(result.message); setView('login'); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Confirmation impossible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [action]);

  function changeView(next: View) {
    setView(next); setError(''); setMessage(''); setPassword(''); setConfirm('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if ((view === 'register' || view === 'reset') && password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      if (view === 'login') { onLogin(await backend.login(email, password)); return; }
      let result: { message: string };
      if (view === 'register') result = await backend.register(name, email, password);
      else if (view === 'forgot') result = await backend.forgotPassword(email);
      else result = await backend.resetPassword(action.get('reset') || '', password);
      setMessage(result.message); setPassword(''); setConfirm(''); setView('login');
    } catch (error) { setError(error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.'); }
    finally { setLoading(false); }
  }
  const titles: Record<View, string> = { login: 'Bon retour !', register: 'Créer votre compte', forgot: 'Mot de passe oublié ?', reset: 'Choisir un nouveau mot de passe', verify: 'Confirmation de votre compte' };
  const subtitles: Record<View, string> = { login: 'Connectez-vous pour suivre votre activité.', register: 'Votre espace personnel pour enregistrer et retrouver vos courses.', forgot: 'Recevez un lien sécurisé pour retrouver votre accès.', reset: 'Ce nouveau mot de passe remplacera l’ancien sur tous vos appareils.', verify: 'Nous vérifions votre lien de confirmation.' };
  const labels: Record<View, string> = { login: 'Se connecter', register: 'Créer mon compte', forgot: 'Recevoir le lien', reset: 'Enregistrer le mot de passe', verify: 'Vérification…' };
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
    <div className="w-full max-w-md">
      <img src="/drivepilot-logo.png" alt="DrivePilot" className="w-64 h-36 object-contain mx-auto mb-5" />
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
        {view !== 'login' && <button type="button" onClick={() => changeView('login')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-5"><ArrowLeft size={16} />Retour à la connexion</button>}
        <h1 className="text-2xl font-bold text-slate-900">{titles[view]}</h1>
        <p className="text-slate-500 text-sm mt-2 mb-6">{subtitles[view]}</p>
        {error && <p role="alert" className="mb-5 text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}
        {message && <p role="status" className="mb-5 text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3 flex items-start gap-2"><Mail size={18} className="shrink-0 mt-0.5" />{message}</p>}
        {view === 'verify' ? <p role="status" className="text-sm text-slate-500">{loading ? 'Vérification en cours…' : 'Demandez un nouveau lien si celui-ci a expiré.'}</p> : <form onSubmit={submit} className="space-y-4">
          {view === 'register' && <div><label htmlFor="account-name" className={labelStyle}>Nom complet</label><input id="account-name" autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom" className={inputStyle} /></div>}
          {view !== 'reset' && <div><label htmlFor="login-identifier" className={labelStyle}>{view === 'login' ? 'Courriel ou nom d’utilisateur' : 'Courriel'}</label><input id="login-identifier" type={view === 'login' ? 'text' : 'email'} autoComplete={view === 'login' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder={view === 'login' ? 'test@drivepilot.com' : 'vous@exemple.com'} className={inputStyle} /></div>}
          {view !== 'forgot' && <div><div className="flex items-center justify-between gap-2"><label htmlFor="login-password" className={labelStyle}>Mot de passe</label>{view === 'login' && <button type="button" onClick={() => changeView('forgot')} className="text-xs text-red-600 hover:text-red-700 font-medium mb-2">Mot de passe oublié ?</button>}</div><input id="login-password" type="password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} required minLength={view === 'login' ? undefined : 12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} placeholder={view === 'login' ? 'test1234' : '12 caractères minimum'} className={inputStyle} /></div>}
          {(view === 'register' || view === 'reset') && <div><label htmlFor="confirm-password" className={labelStyle}>Confirmer le mot de passe</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Saisissez à nouveau le mot de passe" className={inputStyle} /><p className="mt-2 text-xs text-slate-500">Utilisez au moins 12 caractères et un mot de passe unique.</p></div>}
          <button type="submit" disabled={loading} className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">{loading ? 'Veuillez patienter…' : labels[view]}<ArrowRight size={18} /></button>
        </form>}
        {view === 'login' && <>
          <p className="text-center text-sm text-slate-500 mt-6">Pas encore de compte ? <button type="button" onClick={() => changeView('register')} className="text-red-600 hover:text-red-700 font-semibold">S’inscrire</button></p>
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 leading-relaxed"><p className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><ShieldCheck size={14} />Découvrir DrivePilot</p><p>Utilisez <span className="font-medium text-slate-700">test@drivepilot.com</span> et <span className="font-medium text-slate-700">test1234</span> pour essayer l’interface. Vos essais restent dans ce navigateur, séparés des données réelles.</p></div>
        </>}
      </div>
    </div>
  </div>;
}
