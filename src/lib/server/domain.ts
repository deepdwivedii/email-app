export function extractEmailAddress(from?: string): string | undefined {
  if (!from) return undefined;
  const match = from.match(/<([^>]+)>/);
  const email = (match ? match[1] : from).match(/[\w.+-]+@([\w.-]+)/);
  return email?.[0];
}

export function extractDomain(from?: string): string | undefined {
  if (!from) return undefined;
  const match = from.match(/<([^>]+)>/);
  const email = (match ? match[1] : from).match(/[\w.+-]+@([\w.-]+)/);
  const domain = email?.[1]?.toLowerCase();
  return domain;
}

export function extractRegistrableDomain(from?: string): string | undefined {
  const domain = extractDomain(from);
  if (!domain) return undefined;
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const tld2 = ['co', 'com', 'org', 'net', 'gov', 'edu'];
  if (tld2.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

