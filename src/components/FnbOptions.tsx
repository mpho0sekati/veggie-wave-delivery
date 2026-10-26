import { useState } from "react";
import { ArrowLeft, Banknote, Building2, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createLenderRecordCsv } from "@/lib/finance-record";
import type { ExportRecord, MoneyProfile } from "@/lib/finance.functions";

export function FnbCashOut() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        className="mt-4 h-auto min-h-11 w-full whitespace-normal py-3"
        onClick={() => setOpen(true)}
      >
        <Banknote /> FNB eWallet cash-out{" "}
        <span className="text-xs text-muted-foreground">Not connected</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>FNB eWallet cash-out</DialogTitle>
          <DialogDescription>
            Mdeko cannot send your earnings or savings to FNB eWallet yet.
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            If someone has already sent you an FNB eWallet, follow FNB’s instructions to withdraw
            it. Your Mdeko sales record is not an eWallet balance. No money moves when you open this
            page.
          </p>
          <Button asChild className="h-auto min-h-11 whitespace-normal py-3">
            <a
              href="https://www.fnb.co.za/send-money/eWallet/"
              target="_blank"
              rel="noopener noreferrer"
            >
              FNB eWallet information <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
            <ArrowLeft /> Back to My Money
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FnbAccountInfo() {
  return (
    <section className="space-y-3 border-b pb-4" aria-label="FNB business account information">
      <h3 className="flex items-center gap-2 font-semibold">
        <Building2 className="size-4 text-primary" /> FNB First Business Zero
      </h3>
      <p className="text-sm text-muted-foreground">
        Need a business account? Explore FNB’s account for sole proprietors. FNB decides
        eligibility, fees and terms. You apply directly with FNB, not through Mdeko.
      </p>
      <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
        <a
          href="https://www.fnb.co.za/business-banking/accounts/FirstBusinessZeroAccount.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore account at FNB <ExternalLink />
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">
        Mdeko is not partnered with or endorsed by FNB. Bank linking below is optional and separate
        from opening an account.
      </p>
    </section>
  );
}

export function DownloadLenderRecord({
  record,
  profile,
}: {
  record: ExportRecord | null;
  profile: MoneyProfile | null;
}) {
  const download = () => {
    const csv = createLenderRecordCsv(record, profile);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mdeko-financial-record.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Record downloaded. Nothing was sent to FNB.");
  };
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Record for lender review">
      <Button
        className="h-auto min-h-11 w-full whitespace-normal py-3"
        onClick={download}
        disabled={!record && !profile}
      >
        <Download /> {record ? "Download record for FNB review" : "Download summary for FNB review"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A CSV file for you to share yourself. Not sent to FNB; not a loan application or a promise
        of credit. FNB decides which records it accepts.
      </p>
      <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
        <a
          href="https://www.fnb.co.za/business/borrow.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore FNB business funding <ExternalLink />
        </a>
      </Button>
    </section>
  );
}
