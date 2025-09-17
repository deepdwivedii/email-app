import { aggregateEmailsByDomain, mockEmails } from '@/lib/data';
import DomainTable from '@/components/domain-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MailX, CheckCircle } from 'lucide-react';

export default async function DashboardPage() {
  const domains = aggregateEmailsByDomain(mockEmails);
  const totalSubscriptions = domains.length;
  const unsubscribedCount = domains.filter((d) => d.isUnsubscribed).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          An overview of your email subscriptions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Subscriptions
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              domains sending you emails
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
            <MailX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unsubscribedCount}</div>
            <p className="text-xs text-muted-foreground">
              subscriptions you've opted out of
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbox Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSubscriptions > 0
                ? `${Math.round(
                    (unsubscribedCount / totalSubscriptions) * 100
                  )}%`
                : '100%'}
            </div>
            <p className="text-xs text-muted-foreground">
              unsubscription rate
            </p>
          </CardContent>
        </Card>
      </div>
      <DomainTable domains={domains} />
    </div>
  );
}
