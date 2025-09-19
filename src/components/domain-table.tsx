"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  MailX,
  Archive,
  ShieldCheck,
} from "lucide-react";
import type { DomainInfo } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { AppLogo, GmailIcon, OutlookIcon } from "./icons";
import EmailDetailRow from "./email-detail-row";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DomainIcon = ({ domain }: { domain: string }) => {
  if (domain.includes("google") || domain.includes("youtube")) {
    return <GmailIcon className="h-5 w-5" />;
  }
  if (domain.includes("microsoft") || domain.includes("outlook")) {
    return <OutlookIcon className="h-5 w-5" />;
  }
  return <AppLogo className="h-5 w-5 text-muted-foreground" />;
};

export default function DomainTable({ domains }: { domains: DomainInfo[] }) {
  const [openStates, setOpenStates] = React.useState<Record<string, boolean>>(
    {}
  );
  const [localDomains, setLocalDomains] = React.useState(domains);
  React.useEffect(() => setLocalDomains(domains), [domains]);

  const toggleRow = (domain: string) => {
    setOpenStates((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const handleUnsubscribeDomain = async (d: DomainInfo) => {
    const firstEmail = d.emails.find((e) => e.listUnsubscribe) || d.emails[0];
    if (!firstEmail) return;

    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listUnsubscribe: firstEmail.listUnsubscribe,
          listUnsubscribePost: firstEmail.listUnsubscribePost,
          inventoryId: d.inventoryId,
        }),
      });
      const j = await res.json();
      if (res.ok && (j.status === 'ok' || j.status === 'ack')) {
        setLocalDomains((prev) =>
          prev.map((x) =>
            x.domain === d.domain ? { ...x, isUnsubscribed: true } : x
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!domains.length) {
    return (
      <Card className="py-12 text-center">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">
            No Subscriptions Found
          </CardTitle>
          <CardDescription>
            Connect your email account to get started.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Your Subscriptions</CardTitle>
        <CardDescription>
          Here are all the domains we've found in your inbox.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Domain</TableHead>
            <TableHead className="text-center">Emails</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.map((domainInfo) => {
            const domainInfoLocal = localDomains.find(d => d.domain === domainInfo.domain) || domainInfo;
            const isOpen = openStates[domainInfo.domain] || false;
            return (
              <React.Fragment key={domainInfo.domain}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleRow(domainInfo.domain)}
                      aria-label={`Toggle details for ${domainInfo.domain}`}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <DomainIcon domain={domainInfo.domain} />
                      <span className="font-semibold">{domainInfo.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {domainInfo.count}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(domainInfo.lastSeen), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{domainInfo.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {domainInfoLocal.isUnsubscribed ? (
                      <Badge className="border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                        Unsubscribed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Subscribed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnsubscribeDomain(domainInfoLocal)}
                      disabled={domainInfoLocal.isUnsubscribed}
                    >
                      <MailX className="mr-2 h-4 w-4" />
                      Unsubscribe
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Mark as Safe</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="mr-2 h-4 w-4" />
                          <span>Archive All</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/50 p-0">
                      <div className="p-4">
                        <h4 className="mb-2 ml-2 font-semibold">
                          Recent emails from {domainInfo.domain}
                        </h4>
                        <div className="flex flex-col gap-1">
                          {domainInfo.emails.slice(0, 5).map((email) => (
                            <EmailDetailRow
                              key={email.id}
                              email={email}
                              subscriptions={domains.map((d) => d.domain)}
                            />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
