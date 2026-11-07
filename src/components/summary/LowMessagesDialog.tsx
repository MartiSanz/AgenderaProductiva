import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MessageSquareWarning } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMyMessages } from "@/lib/api/messages.functions";
import { availableMessages } from "@/lib/messageCredits";

export const LOW_MESSAGES_THRESHOLD = 10;
const KEY = "low-messages-warned";

/** Popup una vez por día cuando quedan 10 mensajes o menos. */
export function LowMessagesDialog() {
  const fn = useServerFn(getMyMessages);
  const { data } = useQuery({ queryKey: ["my-messages"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const total = data ? availableMessages(data.sentThisMonth, data.packs).total : null;

  useEffect(() => {
    if (total === null || total > LOW_MESSAGES_THRESHOLD) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEY) === today) return;
    localStorage.setItem(KEY, today);
    setOpen(true);
  }, [total]);

  if (total === null) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquareWarning className="h-6 w-6" />
          </div>
          <DialogTitle>{total === 0 ? "Te quedaste sin mensajes" : `Te quedan ${total} mensajes`}</DialogTitle>
          <DialogDescription>
            {total === 0
              ? "Los recordatorios por WhatsApp no se enviarán hasta que compres un pack o empiece el próximo mes."
              : "Comprá un pack a tiempo para que tus pacientes sigan recibiendo sus recordatorios."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Más tarde</Button>
          <Button onClick={() => { setOpen(false); navigate({ to: "/resumen", search: { tab: "mensajes" } as never }); }}>
            Comprar mensajes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
