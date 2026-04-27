import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Undo2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface RefundRequest {
  id: string; buyer_id: string; seller_id: string; card_id: string | null;
  kind: string; reason: string | null; status: string; created_at: string;
  resolved_at?: string | null;
}
interface Card { id: string; bin: string; brand: string; price: number; }
interface Profile { id: string; username: string; balance: number; }

const AdminRefunds = () => {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [cards, setCards] = useState<Map<string, Card>>(new Map());
  const [users, setUsers] = useState<Map<string, Profile>>(new Map());
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const load = async () => {
    const { data: rf } = await (supabase.from("refund_requests" as never) as any)
      .select("*").order("created_at", { ascending: false }).limit(200);
    const list = (rf ?? []) as RefundRequest[];
    setRefunds(list);

    const cardIds = Array.from(new Set(list.map((r) => r.card_id).filter(Boolean) as string[]));
    const userIds = Array.from(new Set([...list.map((r) => r.buyer_id), ...list.map((r) => r.seller_id)]));
    if (cardIds.length) {
      const { data: cs } = await supabase.from("cards").select("id,bin,brand,price").in("id", cardIds);
      setCards(new Map((cs ?? []).map((c: any) => [c.id, c])));
    }
    if (userIds.length) {
      const { data: us } = await supabase.from("profiles").select("id,username,balance").in("id", userIds);
      setUsers(new Map((us ?? []).map((u: any) => [u.id, u])));
    }
  };
  useEffect(() => { load(); }, []);

  const decide = async (r: RefundRequest, approve: boolean) => {
    const { error } = await (supabase.from("refund_requests" as never) as any)
      .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    if (approve) {
      const card = r.card_id ? cards.get(r.card_id) : null;
      const buyer = users.get(r.buyer_id);
      if (card && buyer) {
        await supabase.from("profiles").update({ balance: Number(buyer.balance) + Number(card.price) }).eq("id", buyer.id);
        await supabase.from("transactions").insert({
          user_id: buyer.id, amount: Number(card.price), kind: "refund", method: "admin",
          note: `Refund for card ${card.bin}`,
        });
      }
    }
    toast.success(approve ? "Refund approved & credited" : "Refund rejected");
    load();
  };

  const counts = useMemo(() => ({
    pending: refunds.filter((r) => r.status === "pending").length,
    approved: refunds.filter((r) => r.status === "approved").length,
    rejected: refunds.filter((r) => r.status === "rejected").length,
  }), [refunds]);

  const list = tab === "pending"
    ? refunds.filter((r) => r.status === "pending")
    : refunds.filter((r) => r.status !== "pending");

  return (
    <AdminLayout title="Refund Requests">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Undo2 className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">REFUND / REPLACE QUEUE</h2>
          <div className="ml-auto flex gap-2">
            {(["pending", "history"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition ${
                  tab === t ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                }`}>{t === "pending" ? `Pending (${counts.pending})` : `History (${counts.approved + counts.rejected})`}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
          <Stat label="Pending" value={counts.pending} tone="warning" />
          <Stat label="Approved" value={counts.approved} tone="success" />
          <Stat label="Rejected" value={counts.rejected} tone="muted" />
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests in this view.</p>
        ) : (
          <div className="space-y-2">
            {list.map((r) => {
              const buyer = users.get(r.buyer_id);
              const seller = users.get(r.seller_id);
              const card = r.card_id ? cards.get(r.card_id) : null;
              return (
                <div key={r.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/40 border border-border/40 flex-wrap gap-3">
                  <div className="text-sm min-w-0 flex-1">
                    <p>
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        r.kind === "refund" ? "bg-warning/20 text-warning border-warning/40" : "bg-primary/20 text-primary-glow border-primary/40"
                      }`}>{r.kind.toUpperCase()}</span>
                      {" "}<span className="text-muted-foreground">buyer:</span> {buyer?.username ?? r.buyer_id.slice(0, 8)}
                      <span className="text-muted-foreground"> · seller:</span> {seller?.username ?? r.seller_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Card: {card ? `${card.brand} ${card.bin}` : "n/a"}
                      {card && <> · <span className="text-primary-glow">${Number(card.price).toFixed(2)}</span></>}
                    </p>
                    {r.reason && <p className="text-xs italic text-muted-foreground mt-1">"{r.reason}"</p>}
                    <p className="text-[10px] mt-1">
                      status: <span className={
                        r.status === "pending" ? "text-warning" :
                        r.status === "approved" ? "text-success" : "text-destructive"
                      }>{r.status}</span>
                      {" · "}{new Date(r.created_at).toLocaleString()}
                      {r.resolved_at && ` · resolved ${new Date(r.resolved_at).toLocaleString()}`}
                    </p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r, true)} className="bg-success text-white">
                        <Check className="h-3 w-3 mr-1" />Approve & credit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(r, false)}>
                        <X className="h-3 w-3 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "muted" }) => {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-muted-foreground";
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
      <p className={`font-display text-xl ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
};

export default AdminRefunds;
