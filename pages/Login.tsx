import React, { useState } from 'react';
import { backend } from '../services/storage';
import { UserSession } from '../types';
import { Sparkles, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await backend.login(email, password);
      onLogin(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connexion impossible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const session = await backend.loginDemo();
      onLogin(session);
    } catch (error) {
      setError('Connexion démo indisponible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* DrivePilot brand */}
      <div className="h-64 bg-white w-full flex items-center justify-center px-6 pb-10">
        <img 
            src="/drivepilot-logo.png"
            alt="DrivePilot"
            className="w-full max-w-sm h-44 object-contain"
        />
      </div>

      {/* Login Form Container - Overlapping */}
      <div className="flex-1 -mt-10 z-20 px-6 pb-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Bon retour !</h1>
                <p className="text-slate-500 text-sm mt-1">Entrez vos identifiants pour commencer votre quart.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}
                <div>
                    <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 ml-1">Courriel ou nom d’utilisateur</label>
                    <input 
                        id="login-identifier"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                        placeholder="Courriel ou nom d’utilisateur"
                    />
                </div>
                <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 ml-1">Mot de passe</label>
                    <input 
                        type="password" 
                        id="login-password"
                        autoComplete="current-password"
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                        placeholder="••••••••"
                    />

                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                >
                    {loading ? 'Connexion...' : 'Se connecter'}
                    <ArrowRight size={20} />
                </button>

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-300 text-xs font-medium">OU</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <button 
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <Sparkles size={18} className="text-yellow-400" />
                    <span>Mode Démo</span>
                </button>
            </form>
        </div>
        

      </div>
    </div>
  );
};

export default Login;
