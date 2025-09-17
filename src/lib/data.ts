import type { Email, DomainInfo } from '@/types';
import { subDays, subHours, subMinutes } from 'date-fns';

const now = new Date();

export const mockEmails: Email[] = [
  {
    id: '1',
    from: '"Adobe Creative Cloud" <mail@email.adobe.com>',
    to: 'user@example.com',
    subject: 'Your Creative Cloud Files are Ready to Review',
    date: subMinutes(now, 25).toISOString(),
    listUnsubscribe: '<mailto:unsubscribe-123@email.adobe.com>, <https://e.adobe.com/?unsubscribe>',
  },
  {
    id: '2',
    from: '"GitHub" <noreply@github.com>',
    to: 'user@example.com',
    subject: '[GitHub] A new vulnerability has been found in your repository',
    date: subHours(now, 1).toISOString(),
    listUnsubscribe: '<https://github.com/users/notifications/unsubscribe>',
  },
  {
    id: '3',
    from: '"Figma" <team@figma.com>',
    to: 'user@example.com',
    subject: '🚀 New features in Figma for better collaboration',
    date: subHours(now, 5).toISOString(),
    listUnsubscribe: '<mailto:unsubscribe-figma-123@figma.com>',
  },
    {
    id: '4',
    from: '"Grammarly" <info@em.grammarly.com>',
    to: 'user@example.com',
    subject: 'Your weekly writing stats are here!',
    date: subDays(now, 1).toISOString(),
  },
  {
    id: '5',
    from: '"Vercel" <noreply@vercel.com>',
    to: 'user@example.com',
    subject: 'Deployment "header-harbor" is ready!',
    date: subDays(now, 2).toISOString(),
    listUnsubscribe: '<https://vercel.com/unsubscribe>',
  },
  {
    id: '6',
    from: '"Notion" <team@m.notion.so>',
    to: 'user@example.com',
    subject: 'You have 5 new notifications',
    date: subDays(now, 3).toISOString(),
    listUnsubscribe: '<https://www.notion.so/unsubscribe>',
  },
  {
    id: '7',
    from: '"Next.js Conf" <conf@vercel.com>',
    to: 'user@example.com',
    subject: 'Last call to register for Next.js Conf!',
    date: subDays(now, 4).toISOString(),
  },
  {
    id: '8',
    from: '"Loom" <updates@loom.com>',
    to: 'user@example.com',
    subject: 'Your video has been viewed 10 times',
    date: subDays(now, 5).toISOString(),
    listUnsubscribe: '<https://www.loom.com/settings/notifications>',
  },
  {
    id: '9',
    from: '"Adobe Creative Cloud" <mail@email.adobe.com>',
    to: 'user@example.com',
    subject: 'Did you know you can do this in Photoshop?',
    date: subDays(now, 6).toISOString(),
    listUnsubscribe: '<mailto:unsubscribe-123@email.adobe.com>, <https://e.adobe.com/?unsubscribe>',
  },
];

// Simple function to extract root domain
const getRootDomain = (email: string): string => {
  const emailMatch = email.match(/@([^>]+)/);
  if (!emailMatch) return 'unknown';

  const domainParts = emailMatch[1].split('.');
  if (domainParts.length > 2) {
    // Handle common subdomains like .co.uk
    if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(domainParts[domainParts.length - 2])) {
        return domainParts.slice(-3).join('.');
    }
    return domainParts.slice(-2).join('.');
  }
  return emailMatch[1];
};


const categorizeDomain = (domain: string): DomainInfo['category'] => {
    if (['github.com', 'vercel.com', 'figma.com'].includes(domain)) return 'Transactional';
    if (['loom.com', 'notion.so'].includes(domain)) return 'Updates';
    if (['adobe.com', 'grammarly.com'].includes(domain)) return 'Marketing';
    return 'Other';
}

export const aggregateEmailsByDomain = (emails: Email[]): DomainInfo[] => {
  const domainMap: Record<string, DomainInfo> = {};

  emails.forEach((email) => {
    const domain = getRootDomain(email.from);
    if (domain === 'unknown') return;

    if (!domainMap[domain]) {
      domainMap[domain] = {
        domain,
        count: 0,
        lastSeen: '1970-01-01T00:00:00.000Z',
        category: categorizeDomain(domain),
        isUnsubscribed: false, // In a real app, this would be stored
        emails: [],
      };
    }

    domainMap[domain].count++;
    domainMap[domain].emails.push(email);

    if (new Date(email.date) > new Date(domainMap[domain].lastSeen)) {
      domainMap[domain].lastSeen = email.date;
    }
  });

  // Sort emails within each domain by date
  Object.values(domainMap).forEach(domainInfo => {
    domainInfo.emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  return Object.values(domainMap).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
};
