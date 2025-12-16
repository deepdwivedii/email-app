import { accountsTable, accountEvidenceTable, serviceAliasesTable, type Account, type AccountEvidence } from '@/lib/server/db';

type InferInput = {
  userId: string;
  mailboxId: string;
  emailIdentityId: string;
  rootDomain?: string;
  serviceDomain?: string;
  serviceName?: string;
  intent: string;
  weight: number;
  messageId: string;
  subject?: string;
  from?: string;
  receivedAt: number;
  signals: Record<string, unknown>;
};

async function resolveAlias(raw: string) {
  try {
    const { data } = await serviceAliasesTable().select('*').eq('id', raw).limit(1);
    const row = data && (data[0] as Record<string, unknown>);
    if (row?.canonical) return String(row.canonical).toLowerCase();
  } catch {}
  return null;
}

async function canonicalServiceDomain(rootDomain?: string, serviceDomain?: string) {
  const raw = (serviceDomain || rootDomain || '').toLowerCase();
  const aliases: Record<string, string> = {
    'instagrammail.com': 'instagram.com',
    'facebookmail.com': 'facebook.com',
    'mailer.netflix.com': 'netflix.com',
    'accounts.google.com': 'google.com',
    'mail.github.com': 'github.com',
    'e.mail.paypal.com': 'paypal.com',
    'office.com': 'microsoft.com',
  };
  if (aliases[raw]) return aliases[raw];
  const parts = raw.split('.');
  if (parts.length > 2) {
    const tail2 = parts.slice(-2).join('.');
    if (aliases[tail2]) return aliases[tail2];
  }
  const dynamic = await resolveAlias(raw);
  return dynamic || raw;
}

function defaultCategoryFor(domain: string): Account['category'] {
  if (domain.includes('bank') || domain.includes('chase') || domain.includes('boa')) return 'bank';
  if (domain.includes('facebook') || domain.includes('instagram') || domain.includes('twitter')) return 'social';
  if (domain.includes('amazon') || domain.includes('shop') || domain.includes('ebay')) return 'ecommerce';
  if (domain.includes('microsoft') || domain.includes('google') || domain.includes('github')) return 'saas';
  return 'other';
}

function defaultServiceName(domain: string) {
  return domain.split('.').slice(-2).join('.');
}

export async function recordEvidenceAndInfer(input: InferInput) {
  const domain = await canonicalServiceDomain(input.rootDomain, input.serviceDomain);
  if (!domain) return;
  const accountId = `${input.emailIdentityId}:${domain}`;
  const evidenceId = `${input.messageId}:${input.intent}`;

  const ev: AccountEvidence = {
    id: evidenceId,
    userId: input.userId,
    accountId,
    mailboxId: input.mailboxId,
    messageId: input.messageId,
    evidenceType: mapIntentToEvidenceType(input.intent),
    excerpt: input.subject,
    signals: input.signals,
    weight: input.weight,
    createdAt: Date.now(),
  };
  await accountEvidenceTable().upsert(ev).eq('id', evidenceId);

  const { data: existingRows } = await accountsTable().select('*').eq('id', accountId).limit(1);
  const existing = existingRows && existingRows[0] as Account | undefined;
  const explanation = buildExplanation(input.intent, input.signals, domain);
  const evidenceType = mapIntentToEvidenceType(input.intent);
  const strongEvidence = ['welcome','verify','billing','login','reset','security'].includes(evidenceType);
  const createThreshold = 0.7;
  const categoryByEvidence: Record<string, Account['category']> = {
    welcome: 'saas',
    verify: 'saas',
    billing: 'ecommerce',
    login: 'saas',
    reset: 'saas',
    security: 'saas',
    newsletter: 'subscription',
    other: defaultCategoryFor(domain),
  };
  const base: Partial<Account> = {
    id: accountId,
    userId: input.userId,
    emailIdentityId: input.emailIdentityId,
    serviceName: input.serviceName || defaultServiceName(domain),
    serviceDomain: domain,
    category: categoryByEvidence[evidenceType] || defaultCategoryFor(domain),
    explanation,
    lastSeenAt: input.receivedAt,
    status: 'unknown',
  };

  if (!existing) {
    if (strongEvidence || input.weight >= createThreshold) {
      await accountsTable().upsert({
        ...base,
        confidenceScore: input.weight,
        firstSeenAt: input.receivedAt,
      } as Account).eq('id', accountId);
    } else {
      return;
    }
  } else {
    const acc = existing as Account;
    const recencyDays = Math.max(0, (Date.now() - input.receivedAt) / (1000 * 60 * 60 * 24));
    const recencyFactor = recencyDays < 7 ? 0.15 : recencyDays < 30 ? 0.08 : 0.03;
    const typeFactor = strongEvidence ? 0.2 : evidenceType === 'newsletter' ? 0.02 : 0.08;
    const increment = Math.max(0.01, input.weight * (recencyFactor + typeFactor));
    const confidenceScore = Math.min(1, (acc.confidenceScore || 0) + increment);
    await accountsTable().update({
      ...base,
      firstSeenAt: acc.firstSeenAt || input.receivedAt,
      confidenceScore,
    } as Account).eq('id', accountId);
  }
}

function mapIntentToEvidenceType(intent: string): AccountEvidence['evidenceType'] {
  switch (intent) {
    case 'account_created': return 'welcome';
    case 'email_verification': return 'verify';
    case 'login_alert': return 'login';
    case 'password_reset': return 'reset';
    case 'billing_receipt': return 'billing';
    case 'subscription_newsletter': return 'newsletter';
    case 'security_alert': return 'security';
    case 'marketing': return 'other';
    default: return 'other';
  }
}

function buildExplanation(intent: string, signals: Record<string, unknown>, domain: string) {
  const parts = [intent.replace('_', ' '), domain];
  const subj = (signals as Record<string, unknown>)['subject'];
  if (typeof subj !== 'undefined') parts.push(String(subj));
  const lu = (signals as Record<string, unknown>)['listUnsubscribe'];
  if (lu) parts.push('list-unsubscribe present');
  return parts.join(' • ');
}
