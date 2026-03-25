"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { importApplications } from "@/lib/actions/applications";
import { toast } from "sonner";

// ─── Column name aliases ──────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  company: "company",
  "company name": "company",
  employer: "company",
  organization: "company",
  role: "roleTitle",
  "role title": "roleTitle",
  position: "roleTitle",
  "job title": "roleTitle",
  title: "roleTitle",
  job: "roleTitle",
  status: "status",
  location: "location",
  city: "location",
  date: "applicationDate",
  "application date": "applicationDate",
  "applied date": "applicationDate",
  "date applied": "applicationDate",
  "applied on": "applicationDate",
  source: "source",
  platform: "source",
  where: "source",
  "applied via": "source",
  via: "source",
  board: "source",
  notes: "notes",
  note: "notes",
  comments: "notes",
  comment: "notes",
  contact: "contactInfo",
  recruiter: "contactInfo",
  "contact info": "contactInfo",
  "recruiter name": "contactInfo",
};

const STATUS_MAP: Record<string, string> = {
  applied: "APPLIED",
  submitted: "APPLIED",
  oa: "OA",
  "online assessment": "OA",
  "online test": "OA",
  assessment: "OA",
  interview: "INTERVIEW",
  "phone screen": "INTERVIEW",
  "phone interview": "INTERVIEW",
  "technical interview": "INTERVIEW",
  final: "FINAL_ROUND",
  "final round": "FINAL_ROUND",
  "final interview": "FINAL_ROUND",
  onsite: "FINAL_ROUND",
  offer: "OFFER",
  accepted: "OFFER",
  rejected: "REJECTED",
  declined: "REJECTED",
  withdrawn: "WITHDRAWN",
  withdrew: "WITHDRAWN",
  cancelled: "WITHDRAWN",
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  for (let i = 0; i <= normalized.length; i++) {
    const ch = i < normalized.length ? normalized[i] : "\n";

    if (inQuotes) {
      if (ch === '"' && normalized[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  return rows;
}

type ParsedRow = {
  company: string;
  roleTitle: string;
  status?: string;
  location?: string;
  applicationDate?: string;
  source?: string;
  notes?: string;
  contactInfo?: string;
};

function mapRows(raw: string[][]): { rows: ParsedRow[]; skipped: number } {
  if (raw.length < 2) return { rows: [], skipped: 0 };

  const headers = raw[0].map((h) => COLUMN_MAP[h.toLowerCase().trim()] ?? null);

  let skipped = 0;
  const rows: ParsedRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    const obj: Record<string, string> = {};

    headers.forEach((field, idx) => {
      if (field && cells[idx]) obj[field] = cells[idx];
    });

    if (!obj.company || !obj.roleTitle) {
      skipped++;
      continue;
    }

    // Normalise status
    if (obj.status) {
      const mapped = STATUS_MAP[obj.status.toLowerCase().trim()];
      obj.status = mapped ?? "APPLIED";
    }

    rows.push(obj as ParsedRow);
  }

  return { rows, skipped };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportCsvDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportCsvDialogProps) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setParsed(null);
    setSkipped(0);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large — maximum 5MB");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const raw = parseCSV(text);
      const { rows, skipped } = mapRows(raw);
      setParsed(rows);
      setSkipped(skipped);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setLoading(true);
    const result = await importApplications(parsed);
    setLoading(false);

    if (!result.success) {
      toast.error("Import failed");
      return;
    }

    toast.success(`Imported ${result.count} application${result.count === 1 ? "" : "s"}`);
    handleClose(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Upload a CSV file exported from Google Sheets or any spreadsheet.
            Columns are matched by name — recognised headers include{" "}
            <span className="font-medium text-foreground">
              Company, Role, Status, Location, Date, Source, Notes, Contact
            </span>
            .
          </p>

          {/* File drop zone */}
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-8 cursor-pointer hover:border-muted-foreground/50 transition-colors">
            {fileName ? (
              <>
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium text-foreground">{fileName}</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-muted-foreground">Click to select a .csv file</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFile}
            />
          </label>

          {/* Parse results */}
          {parsed !== null && (
            <div className="rounded-md border p-3 space-y-1">
              {parsed.length > 0 ? (
                <p className="text-green-700">
                  <span className="font-medium">{parsed.length}</span> row
                  {parsed.length === 1 ? "" : "s"} ready to import
                </p>
              ) : (
                <p className="text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  No valid rows found — make sure columns are named Company and
                  Role (or similar).
                </p>
              )}
              {skipped > 0 && (
                <p className="text-muted-foreground">
                  {skipped} row{skipped === 1 ? "" : "s"} skipped (missing
                  Company or Role)
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Rows without a date will use today's date.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || parsed.length === 0 || loading}
          >
            {loading ? "Importing..." : `Import${parsed ? ` (${parsed.length})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
