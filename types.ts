export interface Driver {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  license_number: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

export type ServiceType = string;

export const SERVICE_TYPES = ['Régulier', 'TCT', 'Olymel', 'Bombardier', 'Handami', 'James Miron'];
export const serviceTypeLabel = (type: string) => type === 'Regular' ? 'Régulier' : type;

export interface Service {
  id: string;
  driver_email: string;
  type: ServiceType;
  amount: number;
  date: string; // ISO string
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyGoal {
  id: string;
  driver_email: string;
  year: number;
  month: number;
  revenue_goal: number;
  services_goal: number;
  created_at: string;
}

export interface AIConversation {
  id: string;
  driver_email: string;
  user_message: string;
  ai_response: string;
  context_data?: any;
  created_at: string;
}

export interface UserSession {
  mode?: 'demo';
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'chauffeur';
  };
}

export interface UserSettings {
  enableRAG: boolean;
}
