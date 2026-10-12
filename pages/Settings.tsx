import React, { useState } from 'react';
import { backend } from '../services/storage';
export default function Settings() {
  const [settings, setSettings] = useState(backend.getSettings());
  const [saved, setSaved] = useState(false);
  return <div className="space-y-6">
    <h2 className="text-2xl font-bold text-slate-900">Paramètres</h2>
    <form className="bg-white rounded-3xl p-6 space-y-5" onSubmit={async e => { e.preventDefault(); await backend.saveSettings(settings); setSaved(true); }}>
      <p className="text-slate-600">Les connexions aux services sont configurées par l’administrateur sur le serveur.</p>
      <label className="flex items-center gap-3"><input type="checkbox" checked={settings.enableRAG} onChange={e => { setSaved(false); setSettings({ enableRAG: e.target.checked }); }} />Inclure les statistiques de mes courses dans mes demandes à l’assistant</label>
      <button className="bg-red-600 text-white rounded-xl px-5 py-3" type="submit">Enregistrer</button>
      {saved && <p role="status">Préférence enregistrée.</p>}
    </form>
  </div>;
}
