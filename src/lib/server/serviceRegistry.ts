export type ServiceInfo = {
  name: string;
  category: 'bank'|'social'|'ecommerce'|'saas'|'subscription'|'other';
  settingsUrlTemplate?: string;
};

const registry: Record<string, ServiceInfo> = {
  'google.com': { name: 'Google', category: 'saas', settingsUrlTemplate: 'https://myaccount.google.com/' },
  'microsoft.com': { name: 'Microsoft', category: 'saas', settingsUrlTemplate: 'https://account.microsoft.com/' },
  'facebook.com': { name: 'Facebook', category: 'social', settingsUrlTemplate: 'https://www.facebook.com/settings' },
  'amazon.com': { name: 'Amazon', category: 'ecommerce', settingsUrlTemplate: 'https://www.amazon.com/your-account' },
};

export function lookupService(domain: string): ServiceInfo | null {
  domain = domain.toLowerCase();
  if (registry[domain]) return registry[domain];
  const two = domain.split('.').slice(-2).join('.');
  return registry[two] || null;
}

