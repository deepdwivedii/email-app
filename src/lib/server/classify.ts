import type { Message } from '@/lib/server/db';

export type Intent =
  | 'account_created'
  | 'email_verification'
  | 'login_alert'
  | 'password_reset'
  | 'billing_receipt'
  | 'subscription_newsletter'
  | 'security_alert'
  | 'marketing'
  | 'unknown';

export function classifyMessage(msg: Pick<Message, 'from'|'subject'|'listUnsubscribe'|'listUnsubscribePost'>) {
  const subject = (msg.subject || '').toLowerCase();
  const hasUnsub = !!msg.listUnsubscribe;
  const signals: Record<string, unknown> = {};
  let intent: Intent = 'unknown';
  let weight = 0.5;

  if (subject.match(/welcome|thanks for signing up|getting started/)) {
    intent = 'account_created';
    weight = 2.0;
    signals.subject = 'welcome';
  } else if (subject.match(/verify your email|confirm your email|email verification/)) {
    intent = 'email_verification';
    weight = 2.5;
    signals.subject = 'verification';
  } else if (subject.match(/new (sign[- ]?in|login)|login alert|signed in/)) {
    intent = 'login_alert';
    weight = 2.0;
    signals.subject = 'login_alert';
  } else if (subject.match(/reset your password|password reset|change password/)) {
    intent = 'password_reset';
    weight = 2.2;
    signals.subject = 'password_reset';
  } else if (subject.match(/receipt|invoice|payment|order confirmation/)) {
    intent = 'billing_receipt';
    weight = 1.8;
    signals.subject = 'billing';
  } else if (hasUnsub && subject.match(/newsletter|updates|digest|news/)) {
    intent = 'subscription_newsletter';
    weight = 1.5;
    signals.listUnsubscribe = true;
  } else if (subject.match(/security alert|suspicious activity|protect|warning/)) {
    intent = 'security_alert';
    weight = 2.0;
    signals.subject = 'security_alert';
  } else if (hasUnsub) {
    intent = 'marketing';
    weight = 1.0;
    signals.listUnsubscribe = true;
  }

  return { intent, weight, signals };
}
