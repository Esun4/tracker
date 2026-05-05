"use client";

import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { generateEmailDraft, sendEmailReply } from "@/lib/actions/suggestions";
import type { EmailSuggestion } from "@/generated/prisma/client";

interface EmailReplyDialogProps {
  suggestion: EmailSuggestion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function EmailReplyDialog({
  suggestion,
  open,
  onOpenChange,
  onSent,
}: EmailReplyDialogProps) {
  const [phase, setPhase] = useState<"loading" | "editing" | "sending">("loading");
  const [editedText, setEditedText] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    generateEmailDraft(suggestion.id).then((result) => {
      if ("error" in result) {
        setDraftError(result.error ?? "Failed to generate draft");
      } else {
        setEditedText(result.draft);
        setPhase("editing");
      }
    });
  }, []);

  async function handleSend() {
    setPhase("sending");
    const result = await sendEmailReply(suggestion.id, editedText);
    if ("error" in result && result.error) {
      toast.error(result.error);
      setPhase("editing");
      return;
    }
    toast.success("Reply sent");
    onSent();
    onOpenChange(false);
  }

  function handleSkip() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reply to Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">To:</span>{" "}
            {suggestion.emailSender}
          </p>
          <p>
            <span className="font-medium text-foreground">Subject:</span>{" "}
            Re: {suggestion.emailSubject}
          </p>
        </div>

        {phase === "loading" && !draftError && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Drafting reply…
          </div>
        )}

        {draftError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{draftError}</p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {(phase === "editing" || phase === "sending") && !draftError && (
          <>
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={6}
              disabled={phase === "sending"}
              className="resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkip}
                disabled={phase === "sending"}
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={phase === "sending"}
              >
                {phase === "sending" ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
