"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import type { Email } from "@/types";
import type { SuggestUnsubscribeDomainOutput } from "@/ai/flows/suggest-unsubscribe-domain";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MailX } from "lucide-react";

export default function SuggestUnsubscribeDialog({
  isOpen,
  setIsOpen,
  email,
  subscriptions,
  inventoryId,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  email: Email;
  subscriptions: string[];
  inventoryId?: string;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] =
    React.useState<SuggestUnsubscribeDomainOutput | null>(null);
  const { toast } = useToast();

  const handleSuggestion = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/suggest-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: email.from,
          to: email.to,
          subject: email.subject,
          listUnsubscribe: email.listUnsubscribe || "",
          existingSubscriptions: subscriptions,
        }),
      });
      if (!res.ok) throw new Error("Suggestion API failed");
      const suggestion = (await res.json()) as SuggestUnsubscribeDomainOutput;
      setResult(suggestion);
    } catch (error) {
      console.error("AI suggestion failed:", error);
      toast({
        variant: "destructive",
        title: "Suggestion Failed",
        description:
          "Could not get a suggestion from the AI. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset state after a short delay to allow for exit animation
    setTimeout(() => {
      setResult(null);
      setIsLoading(false);
    }, 300);
  };

  const handleUnsubscribe = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listUnsubscribe: email.listUnsubscribe,
          listUnsubscribePost: email.listUnsubscribePost,
          inventoryId,
        }),
      });
      if (res.ok) {
        toast({ title: 'Unsubscribe sent', description: 'We sent an unsubscribe request for you.' });
        handleClose();
      } else {
        toast({ variant: 'destructive', title: 'Unsubscribe failed', description: 'The sender did not accept the request.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]" onEscapeKeyDown={handleClose} onPointerDownOutside={handleClose}>
        <DialogHeader>
          <DialogTitle className="font-headline">
            Unsubscribe Suggestion
          </DialogTitle>
          <DialogDescription>
            Use AI to find the right domain to unsubscribe from for this email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="truncate font-semibold">Subject: {email.subject}</p>
            <p className="truncate text-muted-foreground">From: {email.from}</p>
          </div>

          {!result && !isLoading && (
            <Button onClick={handleSuggestion} className="w-full">
              Get Suggestion
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Suggestion</h3>
              <p>The most likely domain for this subscription is:</p>
              <p className="font-headline rounded-md bg-accent/10 py-2 text-center text-lg font-bold text-accent-foreground">
                {result.suggestedDomain}
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold">Confidence:</span>{" "}
                  {Math.round(result.confidence * 100)}%
                </p>
                <p>
                  <span className="font-semibold">Reason:</span> {result.reason}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {result && (
            <Button onClick={handleUnsubscribe} disabled={isLoading}>
              <MailX className="mr-2 h-4 w-4" />
              Unsubscribe from {result.suggestedDomain}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
