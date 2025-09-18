export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-headline text-3xl font-bold mb-6">Privacy & Data Use</h1>
      <p className="mb-4">We only index email headers (From, To, Subject, Date, List-Unsubscribe, List-Unsubscribe-Post, DKIM-Signature, Authentication-Results). We do not store or process email bodies.</p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>Gmail scopes: gmail.metadata (preferred) or gmail.readonly for header indexing.</li>
        <li>Microsoft Graph scope: Mail.Read for header indexing.</li>
        <li>Tokens are encrypted at rest using AES-256-GCM and stored in Firestore.</li>
        <li>You can disconnect your mailbox at any time.</li>
        <li>We respect RFC 8058 one-click unsubscribe where provided by senders.</li>
      </ul>
      <p className="text-sm text-muted-foreground">For production, ensure your Google app is verified for restricted scopes if applicable, and maintain a clear, public privacy policy.</p>
    </div>
  );
}