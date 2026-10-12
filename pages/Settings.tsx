import React, { useEffect, useState } from 'react';
import { Archive, RotateCcw, Plus, Check, Ban, Shield, ShieldOff } from 'lucide-react';
import { backend } from '../services/storage';
import { AccountUser, ServiceTypeEntry } from '../types';

interface SettingsProps {
  serviceTypes: ServiceTypeEntry[];
  onServiceTypesChange: (types: ServiceTypeEntry[]) => void;
  /** Admin (ou mode démo, où les changements restent dans ce navigateur). */
  canManageTypes: boolean;
  isDemo: boolean;
  /** Admin connecté (hors démo) : affiche la gestion des utilisateurs. */
  currentUser?: { email: string; role: 'admin' | 'chauffeur' };
}

const STATUS_LABEL: Record<AccountUser['status'], string> = {
  pending: 'En attente d’approbation', active: 'Actif', unverified: 'Courriel non confirmé', disabled: 'Désactivé',
};
const STATUS_STYLE: Record<AccountUser['status'], string> = {
  pending: 'bg-amber-100 text-amber-900', active: 'bg-green-100 text-green-800', unverified: 'bg-slate-100 text-slate-600', disabled: 'bg-red-50 text-red-700',
};

function UsersManager({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const load = () => backend.listUsers().then(setUsers).catch(e => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  useEffect(() => { load(); }, []);

  const act = async (u: AccountUser, patch: { status?: 'active' | 'disabled'; role?: 'admin' | 'chauffeur' }, done: string) => {
    setBusy(u.id); setError(''); setStatus('');
    try { await backend.updateUser(u.id, patch); setStatus(done); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.'); }
    finally { setBusy(''); }
  };
  const pending = users?.filter(u => u.status === 'pending').length ?? 0;
  const btn = 'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl disabled:opacity-40';

  return (
    <section aria-labelledby="users-title" className="bg-white rounded-3xl p-6 space-y-4">
      <div>
        <h3 id="users-title" className="text-lg font-bold text-slate-900">
          Utilisateurs {pending > 0 && <span className="ml-2 align-middle text-xs font-bold bg-amber-100 text-amber-900 rounded-full px-2 py-0.5">{pending} en attente</span>}
        </h3>
        <p className="text-slate-600 text-sm">Les chauffeurs inscrits doivent être approuvés avant de pouvoir se connecter. Désactiver un compte ferme ses sessions ouvertes.</p>
      </div>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      {status && <p role="status" className="text-green-700 text-sm">{status}</p>}
      {!users ? <p className="text-slate-500 text-sm" role="status">Chargement…</p> : users.length === 0 ? (
        <p className="text-slate-500 text-sm">Aucun compte inscrit pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {users.map(u => {
            const self = u.email === currentEmail;
            return (
              <li key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{u.username} {u.role === 'admin' && <span className="ml-1 text-xs font-bold text-red-700">ADMIN</span>}</p>
                  <p className="text-sm text-slate-500 truncate">{u.email}</p>
                  <span className={`mt-1 inline-block text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[u.status]}`}>{STATUS_LABEL[u.status]}</span>
                </div>
                {self ? <span className="text-xs text-slate-500">Votre compte</span> : (
                  <div className="flex flex-wrap gap-2">
                    {(u.status === 'pending' || u.status === 'disabled') && (
                      <button type="button" disabled={!!busy} onClick={() => act(u, { status: 'active' }, `${u.email} peut maintenant se connecter.`)}
                        aria-label={`${u.status === 'pending' ? 'Approuver' : 'Réactiver'} ${u.email}`} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
                        <Check size={16} aria-hidden="true" /> {u.status === 'pending' ? 'Approuver' : 'Réactiver'}
                      </button>
                    )}
                    {(u.status === 'active' || u.status === 'pending') && (
                      <button type="button" disabled={!!busy} onClick={() => act(u, { status: 'disabled' }, `${u.email} est désactivé.`)}
                        aria-label={`${u.status === 'pending' ? 'Refuser' : 'Désactiver'} ${u.email}`} className={`${btn} text-slate-700 hover:bg-red-50 hover:text-red-700`}>
                        <Ban size={16} aria-hidden="true" /> {u.status === 'pending' ? 'Refuser' : 'Désactiver'}
                      </button>
                    )}
                    {u.status === 'active' && (
                      <button type="button" disabled={!!busy}
                        onClick={() => act(u, { role: u.role === 'admin' ? 'chauffeur' : 'admin' }, u.role === 'admin' ? `${u.email} redevient chauffeur.` : `${u.email} est maintenant administrateur.`)}
                        aria-label={u.role === 'admin' ? `Retirer le rôle admin de ${u.email}` : `Rendre ${u.email} administrateur`} className={`${btn} text-slate-700 hover:bg-slate-100`}>
                        {u.role === 'admin' ? <ShieldOff size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />} {u.role === 'admin' ? 'Retirer admin' : 'Rendre admin'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ServiceTypesManager({ serviceTypes, onServiceTypesChange, isDemo }: Omit<SettingsProps, 'canManageTypes'>) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const active = serviceTypes.filter(t => t.active);
  const archived = serviceTypes.filter(t => !t.active);

  const run = async (action: () => Promise<ServiceTypeEntry[]>, done: string) => {
    setBusy(true); setError(''); setStatus('');
    try { onServiceTypesChange(await action()); setStatus(done); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.'); return false; }
    finally { setBusy(false); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name;
    if (await run(() => backend.addServiceType(value), `« ${value.trim()} » est disponible dans le formulaire.`)) setName('');
  };

  return (
    <section aria-labelledby="types-title" className="bg-white rounded-3xl p-6 space-y-5">
      <div>
        <h3 id="types-title" className="text-lg font-bold text-slate-900">Types de service</h3>
        <p className="text-slate-600 text-sm">
          Les types actifs sont proposés aux chauffeurs dans « Nouvelle course ». Un type archivé n’est plus proposé,
          mais les courses déjà enregistrées le gardent et restent filtrables dans l’historique.
          {isDemo && ' Mode démo : les changements restent dans ce navigateur.'}
        </p>
      </div>

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="new-type" className="sr-only">Nom du nouveau type</label>
        <input id="new-type" value={name} onChange={e => { setName(e.target.value); setError(''); }}
          maxLength={40} required placeholder="Ex. Navette aéroport"
          className="flex-1 bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500" />
        <button type="submit" disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl px-5 py-3 font-medium disabled:opacity-50">
          <Plus size={18} aria-hidden="true" /> Ajouter
        </button>
      </form>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      {status && <p role="status" className="text-green-700 text-sm">{status}</p>}

      <div>
        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Actifs ({active.length})</h4>
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {active.map(t => (
            <li key={t.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium text-slate-900">{t.name}</span>
              <button type="button" disabled={busy || active.length <= 1}
                onClick={() => run(() => backend.setServiceTypeActive(t.name, false), `« ${t.name} » est archivé.`)}
                aria-label={`Archiver le type ${t.name}`}
                title={active.length <= 1 ? 'Au moins un type doit rester actif' : undefined}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-700 px-3 py-1.5 rounded-xl hover:bg-red-50 disabled:opacity-40">
                <Archive size={16} aria-hidden="true" /> Archiver
              </button>
            </li>
          ))}
        </ul>
      </div>

      {archived.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Archivés ({archived.length})</h4>
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
            {archived.map(t => (
              <li key={t.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-slate-500 line-through decoration-slate-300">{t.name}</span>
                <button type="button" disabled={busy}
                  onClick={() => run(() => backend.setServiceTypeActive(t.name, true), `« ${t.name} » est de nouveau actif.`)}
                  aria-label={`Réactiver le type ${t.name}`}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-40">
                  <RotateCcw size={16} aria-hidden="true" /> Réactiver
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function Settings({ serviceTypes, onServiceTypesChange, canManageTypes, isDemo, currentUser }: SettingsProps) {
  const [settings, setSettings] = useState(backend.getSettings());
  const [saved, setSaved] = useState(false);
  return <div className="space-y-6">
    <h2 className="text-2xl font-bold text-slate-900">Paramètres</h2>
    {!isDemo && currentUser?.role === 'admin' && <UsersManager currentEmail={currentUser.email} />}
    {canManageTypes && <ServiceTypesManager serviceTypes={serviceTypes} onServiceTypesChange={onServiceTypesChange} isDemo={isDemo} />}
    <form className="bg-white rounded-3xl p-6 space-y-5" onSubmit={async e => { e.preventDefault(); await backend.saveSettings(settings); setSaved(true); }}>
      <p className="text-slate-600">Les connexions aux services sont configurées par l’administrateur sur le serveur.</p>
      <label className="flex items-center gap-3"><input type="checkbox" checked={settings.enableRAG} onChange={e => { setSaved(false); setSettings({ enableRAG: e.target.checked }); }} />Inclure les statistiques de mes courses dans mes demandes à l’assistant</label>
      <button className="bg-red-600 text-white rounded-xl px-5 py-3" type="submit">Enregistrer</button>
      {saved && <p role="status">Préférence enregistrée.</p>}
    </form>
  </div>;
}
