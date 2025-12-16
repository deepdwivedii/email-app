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
  ShieldCheck,
} from "lucide-react";
import type { DomainInfo } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { AppLogo, GmailIcon, OutlookIcon } from "./icons";
import EmailDetailRow from "./email-detail-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
          Here are all the domains we&apos;ve found in your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 md:hidden">
          {domains.map((domainInfo) => {
            const domainInfoLocal =
              localDomains.find((d) => d.domain === domainInfo.domain) ||
              domainInfo;
            const isOpen = openStates[domainInfo.domain] || false;
            return (
              <div
                key={domainInfo.domain}
                className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <DomainIcon domain={domainInfo.domain} />
                    <div>
                      <div className="font-semibold">
                        {domainInfo.domain}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(domainInfo.lastSeen),
                          {
                            addSuffix: true,
                          }
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">{domainInfo.category}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Emails</span>
                    <span className="font-medium">
                      {domainInfo.count}
                    </span>
                  </div>
                  <div>
                    {domainInfoLocal.isUnsubscribed ? (
                      <Badge className="border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                        Unsubscribed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Subscribed</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnsubscribeDomain(domainInfoLocal)}
                    disabled={domainInfoLocal.isUnsubscribed}
                  >
                    <MailX className="mr-2 h-4 w-4" />
                    Unsubscribe
                  </Button>
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
                </div>
                {isOpen && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Recent emails from {domainInfo.domain}
                    </div>
                    <div className="flex flex-col gap-1">
                      {domainInfo.emails.slice(0, 5).map((email) => (
                        <EmailDetailRow
                          key={email.id}
                          email={email}
                          subscriptions={domains.map((d) => d.domain)}
                          inventoryId={domainInfo.inventoryId}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hidden md:block">
          <div className="overflow-x-auto">
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
                  const domainInfoLocal =
                    localDomains.find(
                      (d) => d.domain === domainInfo.domain
                    ) || domainInfo;
                  const isOpen = openStates[domainInfo.domain] || false;
                  return (
                    <React.Fragment key={domainInfo.domain}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleRow(domainInfo.domain)
                            }
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
                            <span className="font-semibold">
                              {domainInfo.domain}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {domainInfo.count}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(
                            new Date(domainInfo.lastSeen),
                            {
                              addSuffix: true,
                            }
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {domainInfo.category}
                          </Badge>
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
                            onClick={() =>
                              handleUnsubscribeDomain(
                                domainInfoLocal
                              )
                            }
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
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (
                                    !domainInfoLocal.inventoryId
                                  )
                                    return;
                                  try {
                                    const res = await fetch(
                                      `/api/inventory/${encodeURIComponent(
                                        domainInfoLocal.inventoryId
                                      )}/mark`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type":
                                            "application/json",
                                        },
                                        body: JSON.stringify({
                                          status: "ignored",
                                        }),
                                      }
                                    );
                                    if (res.ok) {
                                      setLocalDomains((prev) =>
                                        prev.map((d) =>
                                          d.domain ===
                                          domainInfoLocal.domain
                                            ? {
                                                ...d,
                                                isUnsubscribed: true,
                                              }
                                            : d
                                        )
                                      );
                                    }
                                  } catch {}
                                }}
                              >
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                <span>Mark as Safe</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="bg-muted/50 p-0"
                          >
                            <div className="p-4">
                              <h4 className="mb-2 ml-2 font-semibold">
                                Recent emails from{" "}
                                {domainInfo.domain}
                              </h4>
                              <div className="flex flex-col gap-1">
                                {domainInfo.emails
                                  .slice(0, 5)
                                  .map((email) => (
                                    <EmailDetailRow
                                      key={email.id}
                                      email={email}
                                      subscriptions={domains.map(
                                        (d) => d.domain
                                      )}
                                      inventoryId={
                                        domainInfo.inventoryId
                                      }
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
