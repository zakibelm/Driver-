import React, { useState } from 'react';
import { backend } from '../services/storage';
import { UserSession } from '../types';
import { Car, Sparkles, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await backend.login(email);
      onLogin(session);
    } catch (error) {
      alert("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const session = await backend.login('demo@cooptaxi.com');
      onLogin(session);
    } catch (error) {
      alert("Erreur de connexion démo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header Image Area */}
      <div className="relative h-64 bg-slate-900 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10"></div>
        <img 
            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" 
            alt="Taxi City" 
            className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute top-6 left-6 z-20">
            <div className="flex items-center gap-2">
                <div className="bg-red-600 p-1.5 rounded-lg">
                    <Car className="text-white" size={20} />
                </div>
                <span className="text-white font-bold tracking-wide text-sm">CO-OP TAXI</span>
            </div>
        </div>
      </div>

      {/* Login Form Container - Overlapping */}
      <div className="flex-1 -mt-10 z-20 px-6 pb-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Bon retour !</h1>
                <p className="text-slate-500 text-sm mt-1">Entrez vos identifiants pour commencer votre quart.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 ml-1">Courriel</label>
                    <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                        placeholder="driver@coop.com"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 ml-1">Mot de passe</label>
                    <input 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 font-medium placeholder-slate-400 outline-none transition-all"
                        placeholder="••••••••"
                    />
                    <div className="flex justify-end mt-2">
                        <button type="button" className="text-xs text-red-500 font-medium hover:underline">Mot de passe oublié ?</button>
                    </div>
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
        
        <p className="text-center text-xs text-slate-400 mt-6">
            Nouveau chauffeur ? <span className="text-red-600 font-bold cursor-pointer">Postuler ici</span>
        </p>
      </div>
    </div>
  );
};

export default Login;