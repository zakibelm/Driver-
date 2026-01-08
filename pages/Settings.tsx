import React, { useState, useEffect } from 'react';
import { backend } from '../services/storage';
import { UserSettings } from '../types';
import { Save, Key, Cpu, Database, MessageSquareQuote, CheckCircle, Server, Link } from 'lucide-react';

const MODELS = [
  { id: 'moonshot/moonshot-v1-32k', name: 'Moonshot Kimi K2 (32k)' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
  { id: 'anthropic/claude-3-haiku', name: 'Anthropic Claude 3 Haiku' },
  { id: 'mistral/mistral-tiny', name: 'Mistral Tiny' },
];

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(backend.getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setSettings(backend.getSettings());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await backend.saveSettings(settings);
    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-0">
      <div className="px-2">
        <h2 className="text-2xl font-bold text-slate-900">Paramètres</h2>
        <p className="text-slate-500 text-sm">Configurez l'intelligence IA et la base de données</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* n8n Backend Configuration */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Server size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Backend n8n Data Tables</h3>
                        <p className="text-xs text-slate-400">Connecter à une instance n8n réelle</p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={settings.useN8nBackend}
                        onChange={(e) => setSettings({...settings, useN8nBackend: e.target.checked})}
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </div>

            {settings.useN8nBackend && (
                <div className="mt-4 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                            <Link size={12} /> URL Webhook n8n
                        </label>
                        <input 
                            type="text"
                            value={settings.n8nUrl}
                            onChange={(e) => setSettings({...settings, n8nUrl: e.target.value})}
                            placeholder="http://localhost:5678/webhook"
                            className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                        />
                        <p className="text-[10px] text-slate-400 px-2">
                            L'URL de base où sont hébergés vos workflows (ex: http://localhost:5678/webhook).
                        </p>
                    </div>
                </div>
            )}
        </div>

        {/* API Key Section */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                    <Key size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">Clé API OpenRouter</h3>
                    <p className="text-xs text-slate-400">Nécessaire pour activer l'IA réelle</p>
                </div>
            </div>
            <div className="space-y-2">
                <input 
                    type="password"
                    value={settings.openRouterApiKey}
                    onChange={(e) => setSettings({...settings, openRouterApiKey: e.target.value})}
                    placeholder="sk-or-v1-..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-400 px-2">
                    Votre clé est stockée localement dans votre navigateur et n'est jamais envoyée à nos serveurs.
                </p>
            </div>
        </div>

        {/* Model Selection */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Cpu size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">Modèle IA</h3>
                    <p className="text-xs text-slate-400">Choisissez le cerveau de votre assistant</p>
                </div>
            </div>
            <div className="relative">
                <select 
                    value={settings.model}
                    onChange={(e) => setSettings({...settings, model: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-none appearance-none cursor-pointer"
                >
                    {MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>
        </div>

        {/* RAG & System Prompt */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Database size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Contextualisation (RAG)</h3>
                        <p className="text-xs text-slate-400">Donner accès à vos statistiques</p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={settings.enableRAG}
                        onChange={(e) => setSettings({...settings, enableRAG: e.target.checked})}
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>

            <div className="border-t border-slate-50 pt-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center">
                        <MessageSquareQuote size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Prompt Système</h3>
                        <p className="text-xs text-slate-400">Instructions de base pour l'IA</p>
                    </div>
                </div>
                <textarea 
                    value={settings.systemPrompt}
                    onChange={(e) => setSettings({...settings, systemPrompt: e.target.value})}
                    rows={4}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-yellow-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all text-sm leading-relaxed"
                />
            </div>
        </div>

        <button 
            type="submit"
            disabled={isSaving}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                showSuccess ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-300'
            }`}
        >
            {showSuccess ? (
                <>
                    <CheckCircle size={20} />
                    <span>Enregistré !</span>
                </>
            ) : (
                <>
                    <Save size={20} />
                    <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
                </>
            )}
        </button>
      </form>
    </div>
  );
};

export default Settings;