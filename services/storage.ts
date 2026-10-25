import { Service, AIConversation, UserSession, UserSettings } from '../types';

const DEMO_SERVICES = 'drivepilot_demo_services';
const DEMO_CHAT = 'drivepilot_demo_chat';
const DEFAULT_SETTINGS: UserSettings = { enableRAG: true };
class BackendService {
  constructor() {
    localStorage.removeItem('user_settings');
    if (localStorage.getItem('drivepilot_demo_reset_version') !== '2026-10-25') {
      localStorage.removeItem(DEMO_SERVICES);
      localStorage.removeItem(DEMO_CHAT);
      sessionStorage.removeItem('drivepilot_demo');
      localStorage.setItem('drivepilot_demo_reset_version', '2026-10-25');
    }
  }
  private demo = false;
  private conversations: AIConversation[] = [];
  private async api(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(path, { method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Service indisponible.');
    return data;
  }
  async login(identifier: string, password: string): Promise<UserSession> {
    const session = await this.api('/api/auth/login', 'POST', { identifier, password });
    this.demo = false;
    sessionStorage.removeItem('drivepilot_demo');
    this.conversations = [];
    return session;
  }
  async getSession(): Promise<UserSession | null> {
    if (sessionStorage.getItem('drivepilot_demo') === '1') return this.loginDemo();
    const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Session indisponible.');
    return response.json();
  }
  async logout(): Promise<void> {
    if (!this.demo) await this.api('/api/auth/logout', 'POST');
    this.demo = false;
    this.conversations = [];
    sessionStorage.removeItem('drivepilot_demo');
  }
  async loginDemo(): Promise<UserSession> {
    this.demo = true;
    sessionStorage.setItem('drivepilot_demo', '1');
    return { mode: 'demo', user: { id: 'demo', email: 'demo@example.test', name: 'Chauffeur démo', role: 'chauffeur' } };
  }
  private demoRows(): Service[] {
    const saved = localStorage.getItem(DEMO_SERVICES);
    if (saved) { try { const rows = JSON.parse(saved); if (Array.isArray(rows)) return rows; } catch {} }
    const rows: Service[] = [];
    localStorage.setItem(DEMO_SERVICES, JSON.stringify(rows));
    return rows;
  }
  async getServices(): Promise<Service[]> {
    if (this.demo) return this.demoRows();
    return (await this.api('/api/services')).services;
  }
  async addService(data: Pick<Service, 'type' | 'amount' | 'date' | 'description'>): Promise<Service> {
    if (!this.demo) return (await this.api('/api/services', 'POST', data)).service;
    const value = { ...data, id: crypto.randomUUID(), driver_email: 'demo@example.test', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_SERVICES, JSON.stringify([value, ...this.demoRows()]));
    return value;
  }
  async deleteService(id: string): Promise<void> {
    if (!this.demo) { await this.api('/api/services/' + encodeURIComponent(id), 'DELETE'); return; }
    localStorage.setItem(DEMO_SERVICES, JSON.stringify(this.demoRows().filter(s => s.id !== id)));
  }
  getSettings(): UserSettings {
    // Discard legacy provider credentials and URLs; only a non-secret preference remains.
    localStorage.removeItem('user_settings');
    try { return { enableRAG: JSON.parse(localStorage.getItem('drivepilot_preferences') || '{}').enableRAG !== false }; }
    catch { return DEFAULT_SETTINGS; }
  }
  async saveSettings(settings: UserSettings) {
    localStorage.setItem('drivepilot_preferences', JSON.stringify({ enableRAG: settings.enableRAG }));
  }
  getConversations(): AIConversation[] {
    if (!this.demo) return this.conversations;
    try { return JSON.parse(localStorage.getItem(DEMO_CHAT) || '[]'); } catch { return []; }
  }
  async sendChatMessage(message: string, context?: unknown): Promise<AIConversation> {
    const response = this.demo ? '(Démo) Réponse simulée : aucune requête envoyée à un fournisseur externe.' : (await this.api('/api/chat', 'POST', { message, includeServices: this.getSettings().enableRAG })).response;
    const conversation: AIConversation = { id: crypto.randomUUID(), driver_email: 'demo@example.test', user_message: message,
      ai_response: response, context_data: null, created_at: new Date().toISOString() };
    if (this.demo) localStorage.setItem(DEMO_CHAT, JSON.stringify([...this.getConversations(), conversation]));
    else this.conversations.push(conversation);
    return conversation;
  }
}
export const backend = new BackendService();
