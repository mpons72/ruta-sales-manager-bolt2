"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildReceiptInnerHtml, type RemisionData } from "@/lib/remision";
import { getBusinessConfig } from "@/lib/business-config";
import { Printer, Share2, X } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import CapacitorPrint from "@/lib/PrintPlugin";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RemisionData;
}

export function ReceiptDialog({ open, onOpenChange, data }: ReceiptDialogProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const cfg = getBusinessConfig();
  const paperWidthPx = cfg.paperWidth === "58mm" ? "219px" : "302px";

  const isValidData = (d: RemisionData | null | undefined): d is RemisionData => {
    return d !== null && d !== undefined && !!d.client && !!d.sale && !!d.products;
  };

  const handlePrint = async () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:'Courier New',monospace;font-size:11px;color:#000;margin:0;padding:4mm;}@media print{body{margin:0;padding:0;}}</style></head><body>${content}</body></html>`;

    try {
      if (Capacitor.isNativePlatform()) {
        // Usar plugin nativo de impresión
        await CapacitorPrint.print({ content: fullHtml });
      } else {
        // Fallback para web
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(fullHtml);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      }
    } catch (error) {
      console.error("Print error:", error);
      // Fallback a simple window.print
      window.print();
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current || !isValidData(data)) return;
    const text = receiptRef.current.innerText || "";
    try {
      await Share.share({
        title: "Nota de Remisión",
        text: text,
        dialogTitle: "Compartir nota de remisión",
      });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nota de Remisión</DialogTitle>
        </DialogHeader>

        {!isValidData(data) ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="text-lg font-semibold mb-2">Error</div>
            <div>Datos del recibo incompletos</div>
          </div>
        ) : (
          <div
            id="receipt-content"
            ref={receiptRef}
            className="bg-white p-4 mx-auto shadow-sm border"
            style={{
              maxWidth: paperWidthPx,
              width: "100%",
              fontFamily: "'Courier New', ui-monospace, monospace",
              fontSize: "11px",
              lineHeight: "1.4",
              overflow: "auto",
              color: "#000",
            }}
            dangerouslySetInnerHTML={{ __html: buildReceiptInnerHtml(data) }}
          />
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button onClick={handlePrint} className="flex-1 sm:flex-none" size="lg">
            <Printer className="h-5 w-5 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 sm:flex-none" size="lg">
            <Share2 className="h-5 w-5 mr-2" />
            Compartir
          </Button>
          <Button onClick={handleClose} variant="ghost" className="flex-1 sm:flex-none" size="lg">
            <X className="h-5 w-5 mr-2" />
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
