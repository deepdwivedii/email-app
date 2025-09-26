"use client";

import React from "react";
import type { Email } from "@/types";
import { Button } from "./ui/button";
import { Sparkles } from "lucide-react";
import SuggestUnsubscribeDialog from "./suggest-unsubscribe-dialog";

export default function EmailDetailRow({
  email,
  subscriptions,
  inventoryId,
}: {
  email: Email;
  subscriptions: string[];
  inventoryId?: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-background">
        <div className="flex-1 truncate">
          <p className="truncate text-sm font-medium">{email.subject}</p>
          <p className="truncate text-xs text-muted-foreground">{email.from}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4 text-accent" />
          Suggest
        </Button>
      </div>
      <SuggestUnsubscribeDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        email={email}
        subscriptions={subscriptions}
        inventoryId={inventoryId}
      />
    </>
  );
}
