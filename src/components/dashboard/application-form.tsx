"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applicationStatuses, statusLabels } from "@/lib/schemas";
import { createApplication, updateApplication } from "@/lib/actions/applications";
import { toast } from "sonner";
import type { Application } from "@/generated/prisma/client";

interface ApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application?: Application | null;
}

const commonSources = [
  "LinkedIn",
  "Company Website",
  "WaterlooWorks",
  "Referral",
  "Indeed",
  "Glassdoor",
  "Handshake",
  "Other",
];

function toDateString(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  return new Date(d).toISOString().split("T")[0];
}

export function ApplicationForm({
  open,
  onOpenChange,
  application,
}: ApplicationFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!application;

  const [company, setCompany] = useState(application?.company ?? "");
  const [roleTitle, setRoleTitle] = useState(application?.roleTitle ?? "");
  const [location, setLocation] = useState(application?.location ?? "");
  const [applicationDate, setApplicationDate] = useState(
    toDateString(application?.applicationDate)
  );
  const [status, setStatus] = useState(application?.status ?? "APPLIED");
  const [source, setSource] = useState(application?.source ?? "");
  const [notes, setNotes] = useState(application?.notes ?? "");
  const [contactInfo, setContactInfo] = useState(application?.contactInfo ?? "");

  // Reset all fields whenever the target application changes
  useEffect(() => {
    setCompany(application?.company ?? "");
    setRoleTitle(application?.roleTitle ?? "");
    setLocation(application?.location ?? "");
    setApplicationDate(toDateString(application?.applicationDate));
    setStatus(application?.status ?? "APPLIED");
    setSource(application?.source ?? "");
    setNotes(application?.notes ?? "");
    setContactInfo(application?.contactInfo ?? "");
  }, [application?.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const data = {
      company,
      roleTitle,
      location,
      applicationDate,
      status,
      source,
      notes,
      contactInfo,
    };

    const result = isEditing
      ? await updateApplication(application.id, data)
      : await createApplication(data);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? "Application updated" : "Application added");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Application" : "Add Application"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                name="company"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleTitle">Role Title *</Label>
              <Input
                id="roleTitle"
                name="roleTitle"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Software Engineer Intern"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                value={status}
                onValueChange={(v) => { if (v) setStatus(v); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {applicationStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                name="source"
                value={source}
                onValueChange={(v) => { if (v !== null) setSource(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {commonSources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicationDate">Application Date</Label>
              <Input
                id="applicationDate"
                name="applicationDate"
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact / Recruiter</Label>
            <Input
              id="contactInfo"
              name="contactInfo"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="e.g. Jane Doe - jane@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this application..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                ? "Save Changes"
                : "Add Application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
