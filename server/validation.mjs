export const SERVICE_TYPES = ['Régulier', 'TCT', 'Olymel', 'Bombardier', 'Handami', 'James Miron'];
export function serviceType(value) {
  const type = text(value, 80);
  if (/^autres?$/i.test(type) || type === '__other__' || /[\u0000-\u001f\u007f]/.test(type)) throw new Error('Nom de service invalide.');
  return type === 'Regular' ? 'Régulier' : type;
}
export function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error('Champs invalides ou inconnus.');
}
export function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Texte invalide.');
  return value.trim();
}
export function email(value) {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error('Courriel invalide.');
  return result;
}
export function serviceInput(value, withOwner = false) {
  object(value, ['type', 'amount', 'date', 'description', ...(withOwner ? ['driver_email', 'service_id'] : [])]);
  const type = serviceType(value.type);
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount > 10000) throw new Error('Montant entre 0 et 10 000 $ requis.');
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().replace('.000Z','Z') !== value.date.replace('.000Z','Z')) throw new Error('Date ISO UTC valide requise.');
  return { type, amount: value.amount, date: value.date, description: text(value.description ?? '', 500, false), ...(withOwner ? { driver_email: email(value.driver_email), service_id: serviceId(value.service_id) } : {}) };
}
export function serviceId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new Error('Identifiant invalide.');
  return value;
}
export function driverInput(value) {
  object(value, ['email', 'first_name', 'last_name', 'phone', 'license_number']);
  return { email: email(value.email), first_name: text(value.first_name, 100), last_name: text(value.last_name, 100), phone: text(value.phone ?? '', 30, false), license_number: text(value.license_number, 100) };
}
