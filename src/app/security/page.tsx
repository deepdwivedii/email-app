export default function SecurityPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-4 font-headline text-3xl font-bold">Security</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Atlas is built on top of Supabase Postgres and Next.js. Tokens are encrypted at rest and
        only header metadata is stored for email messages.
      </p>
      <p className="text-sm text-muted-foreground">
        For production deployments, ensure you enforce HTTPS, rotate credentials regularly, and
        restrict access to your Supabase project to trusted operators.
      </p>
    </div>
  );
}

