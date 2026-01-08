import { Driver, Service, ServiceType, AIConversation, UserSession, UserSettings } from '../types';

// Initial Mock Data to populate the app if empty
const MOCK_DRIVER: Driver = {
  id: 'd1',
  email: 'chauffeur@cooptaxi.com',
  first_name: 'Jean',
  last_name: 'Tremblay',
  license_number: 'TX-12345',
  status: 'active',
  created_at: new Date().toISOString()
};

const INITIAL_SERVICES: Service[] = [
  { id: 's1', driver_email: 'chauffeur@cooptaxi.com', type: 'Regular', amount: 45.50, date: new Date(Date.now() - 86400000 * 1).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 's2', driver_email: 'chauffeur@cooptaxi.com', type: 'Olymel', amount: 32.00, date: new Date(Date.now() - 86400000 * 1).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 's3', driver_email: 'chauffeur@cooptaxi.com', type: 'TCT', amount: 120.00, date: new Date(Date.now() - 86400000 * 2).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 's4', driver_email: 'chauffeur@cooptaxi.com', type: 'Regular', amount: 15.00, date: new Date(Date.now() - 86400000 * 3).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 's5', driver_email: 'chauffeur@cooptaxi.com', type: 'Bombardier', amount: 65.00, date: new Date(Date.now() - 86400000 * 4).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEFAULT_SETTINGS: UserSettings = {
  openRouterApiKey: '',
  model: 'moonshot/moonshot-v1-32k',
  enableRAG: true,
  systemPrompt: `Tu es un assistant expert pour les chauffeurs de taxi. Tu réponds de manière concise, professionnelle et utile. Tu utilises les données fournies pour analyser les performances.`,
  n8nUrl: 'http://localhost:5678/webhook',
  useN8nBackend: false
};

class BackendService {
  // Simulate network delay for mock
  private async delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Auth ---
  async login(email: string): Promise<UserSession> {
    await this.delay();
    // For demo purposes, any login works
    return {
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: MOCK_DRIVER.id,
        email: email,
        name: email.includes('demo') ? 'Demo Driver' : `${MOCK_DRIVER.first_name} ${MOCK_DRIVER.last_name}`,
        role: 'chauffeur'
      }
    };
  }

  // --- Services CRUD ---
  async getServices(): Promise<Service[]> {
    const settings = this.getSettings();

    // Real n8n Backend
    if (settings.useN8nBackend && settings.n8nUrl) {
        try {
            // Using the path defined in 05-crud-operations-workflow.json: api/services/list/:email
            const response = await fetch(`${settings.n8nUrl}/api/services/list/test@cooptaxi.com`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.services)) {
                    // Normalize data types coming from API
                    return data.services.map((s: any) => ({
                        ...s,
                        amount: parseFloat(s.amount)
                    }));
                }
            }
            console.error("n8n getServices failed:", await response.text());
        } catch (error) {
            console.error("n8n Connection Error:", error);
        }
    }

    // Fallback Mock
    await this.delay(100);
    const stored = localStorage.getItem('n8n_table_services');
    if (!stored) {
      localStorage.setItem('n8n_table_services', JSON.stringify(INITIAL_SERVICES));
      return INITIAL_SERVICES;
    }
    return JSON.parse(stored);
  }

  async addService(serviceData: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> {
    const settings = this.getSettings();
    
    // Real n8n Backend
    if (settings.useN8nBackend && settings.n8nUrl) {
        try {
             // Using the path defined in 05-crud-operations-workflow.json: api/services/create
            const response = await fetch(`${settings.n8nUrl}/api/services/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serviceData)
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.service) {
                    return data.service;
                }
            }
            console.error("n8n addService failed:", await response.text());
        } catch (error) {
            console.error("n8n Connection Error:", error);
            throw error;
        }
    }

    // Fallback Mock
    await this.delay();
    const services = await this.getServices(); // use await since we made it async
    const newService: Service = {
      ...serviceData,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // For mock, we re-read from local storage to simulate persistence properly
    const storedServices = JSON.parse(localStorage.getItem('n8n_table_services') || '[]');
    storedServices.unshift(newService);
    localStorage.setItem('n8n_table_services', JSON.stringify(storedServices));
    return newService;
  }

  async deleteService(id: string): Promise<void> {
    // Note: The CRUD workflow provided didn't explicitly show a DELETE endpoint in the summary, 
    // but assuming standard implementation or local mock for now if missing.
    // If n8n backend is used, we would fetch DELETE endpoint here.
    
    await this.delay();
    // For now, always delete from local mock even if n8n is on, unless we add DELETE node to workflow
    const storedServices = JSON.parse(localStorage.getItem('n8n_table_services') || '[]');
    const filtered = storedServices.filter((s: Service) => s.id !== id);
    localStorage.setItem('n8n_table_services', JSON.stringify(filtered));
  }

  // --- Settings ---
  getSettings(): UserSettings {
    const stored = localStorage.getItem('user_settings');
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    await this.delay(200);
    localStorage.setItem('user_settings', JSON.stringify(settings));
  }

  // --- AI Chat ---
  getConversations(): AIConversation[] {
    const stored = localStorage.getItem('n8n_table_conversations');
    return stored ? JSON.parse(stored) : [];
  }

  async sendChatMessage(message: string, context: any): Promise<AIConversation> {
    const settings = this.getSettings();
    let aiResponse = "";

    // If API Key is present, try to call OpenRouter
    if (settings.openRouterApiKey && settings.openRouterApiKey.trim() !== "") {
        try {
            let fullSystemPrompt = settings.systemPrompt;
            
            // RAG Logic: Inject context into system prompt if enabled
            if (settings.enableRAG) {
                const services = await this.getServices(); // Async fetch
                const recentServices = services.slice(0, 10);
                const stats = {
                    totalRevenue: services.reduce((acc, curr) => acc + curr.amount, 0),
                    totalRides: services.length,
                    recentHistory: recentServices.map(s => `${s.date.split('T')[0]}: ${s.type} - ${s.amount}$`).join('\n')
                };
                
                fullSystemPrompt += `\n\n[CONTEXTE DE DONNÉES EN TEMPS RÉEL (RAG)]:\nVoici les statistiques actuelles du chauffeur:\n- Revenu Total: ${stats.totalRevenue.toFixed(2)}$\n- Nombre de courses: ${stats.totalRides}\n- 10 dernières courses:\n${stats.recentHistory}`;
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${settings.openRouterApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin, // Required by OpenRouter
                    "X-Title": "Co-op Taxi Dashboard"
                },
                body: JSON.stringify({
                    "model": settings.model,
                    "messages": [
                        { "role": "system", "content": fullSystemPrompt },
                        { "role": "user", "content": message }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                aiResponse = data.choices[0]?.message?.content || "Erreur de réponse du modèle.";
            } else {
                const errorData = await response.json();
                console.error("OpenRouter Error:", errorData);
                aiResponse = `Erreur API (${response.status}): ${errorData.error?.message || 'Vérifiez votre clé API.'}`;
            }

        } catch (error) {
            console.error("Network Error:", error);
            aiResponse = "Erreur de connexion à OpenRouter. Veuillez vérifier votre connexion internet.";
        }
    } else {
        // Fallback to Mock Logic if no API Key
        await this.delay(1000); 
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('revenu') || lowerMsg.includes('argent') || lowerMsg.includes('gagné')) {
            aiResponse = `(Mode Démo) D'après vos données récentes, vos revenus sont stables. Le secteur Olymel semble le plus performant cette semaine. Configurer une clé API pour une vraie analyse.`;
        } else if (lowerMsg.includes('bonjour') || lowerMsg.includes('salut')) {
            aiResponse = "(Mode Démo) Bonjour ! Je suis l'assistant IA de Co-op Taxi Terrebonne. Configurez ma clé API dans les paramètres pour m'activer pleinement.";
        } else {
            aiResponse = "(Mode Démo) Je suis en mode simulation. Veuillez entrer une clé OpenRouter dans les paramètres pour activer l'intelligence réelle.";
        }
    }

    const conversation: AIConversation = {
        id: Math.random().toString(36).substr(2, 9),
        driver_email: MOCK_DRIVER.email,
        user_message: message,
        ai_response: aiResponse,
        context_data: context,
        created_at: new Date().toISOString()
    };

    const convs = this.getConversations();
    convs.push(conversation);
    localStorage.setItem('n8n_table_conversations', JSON.stringify(convs));
    
    return conversation;
  }
}

export const backend = new BackendService();