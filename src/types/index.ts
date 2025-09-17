export type Email = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  listUnsubscribe?: string;
};

export type DomainInfo = {
  domain: string;
  count: number;
  lastSeen: string;
  category: 'Marketing' | 'Social' | 'Transactional' | 'Updates' | 'Other';
  isUnsubscribed: boolean;
  emails: Email[];
};
