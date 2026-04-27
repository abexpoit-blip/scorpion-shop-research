import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Trash2, Search, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

interface Card {
  id: string; seller_id: string; bin: string; brand: string; country: string;
  price: number; status: string; created_at: string;
}
interface Profile { id: string; username: string; seller_display_name?: string | null; }

const PAGE = 100;

const AdminCards = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [sellers, setSellers] = useState<Map<string, Profile>>(new Map());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold" | "hidden">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (reset = false) => {
    setLoading(true);
    const from = reset ? 0 : page * PAGE;
    let q = supabase.from("cards").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (query) q = q.or(`bin.ilike.${query}%,brand.ilike.%${query}%,country.ilike.%${query}%`);
    const { data, count } = await q;
    setCards(reset ? ((data ?? []) as Card[]) : [...cards, ...((data ?? []) as Card[])]);
    setTotal(count ?? 0);
    setLoading(false);

    const ids = Array.from(new Set((data ?? []).map((c: any) => c.seller_id)));
    if (ids.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id,username,seller_display_name").in("id", ids);
      const m = new Map(sellers);
      (ps ?? []).forEach((p: any) => m.set(p.id, p));
      setSellers(m);
    }
  };

  useEffect(() => { setPage(0); load(true); /* eslint-disable-next-line */ }, [query, statusFilter]);

  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) cards.forEach((c) => n.delete(c.id));
      else cards.forEach((c) => n.add(c.id));
      return n;
    });

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} cards? This cannot be undone.`)) return;
    const { error } = await supabase.from("cards").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length}`);
    setSelected(new Set()); setPage(0); load(true);
  };

  const bulkSetStatus = async (status: "available" | "hidden") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await (supabase.from("cards") as any).update({ status }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${status} on ${ids.length} cards`);
    setSelected(new Set()); setPage(0); load(true);
  };

  const removeOne = async (id: string) => {
    if (!confirm("Delete this card?")) return;
    await supabase.from("cards").delete().eq("id", id);
    setCards((cs) => cs.filter((c) => c.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const stats = useMemo(() => ({
    available: cards.filter((c) => c.status === "available").length,
    sold: cards.filter((c) => c.status === "sold").length,
    hidden: cards.filter((c) => c.status === "hidden").length,
  }), [cards]);

  const remaining = total - cards.length;

  return (
    <AdminLayout title="Card Moderation">
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <CreditCard className="h-4 w-4 text-primary-glow" />
          <h2 className="font-display tracking-wider text-primary-glow">ALL CARDS ({total})</h2>
          <span className="ml-auto text-xs text-muted-foreground flex gap-3">
            <span>{stats.available} avail</span>
            <span>· {stats.sold} sold</span>
            <span>· {stats.hidden} hidden (loaded)</span>
          </span>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search BIN / brand / country…" className="bg-input/60 pl-9" />
          </div>
          <div className="flex gap-1">
            {(["all", "available", "sold", "hidden"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs uppercase tracking-wider transition ${
                  statusFilter === s ? "bg-primary/20 border border-primary/60 text-primary-glow" : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/40 flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm text-primary-glow">{selected.size} selected</span>
            <Button size="sm" onClick={() => bulkSetStatus("available")} className="bg-success/20 text-success border border-success/40 hover:bg-success/30">
              <Eye className="h-3.5 w-3.5 mr-1" />Show
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetStatus("hidden")}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />Hide
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
            </Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="p-2 w-10 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary cursor-pointer" />
                </th>
                <th className="p-2 text-left">BIN</th>
                <th className="p-2 text-left">Brand</th>
                <th className="p-2 text-left">Country</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">Seller</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const u = sellers.get(c.seller_id);
                return (
                  <tr key={c.id} className={`border-t border-border/40 ${selected.has(c.id) ? "bg-primary/5" : ""} hover:bg-secondary/20`}>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="accent-primary cursor-pointer" />
                    </td>
                    <td className="p-2 font-mono">{c.bin}</td>
                    <td className="p-2">{c.brand}</td>
                    <td className="p-2">{c.country}</td>
                    <td className="p-2 text-right text-primary-glow font-display">${Number(c.price).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        c.status === "available" ? "bg-success/20 text-success border-success/40" :
                        c.status === "sold" ? "bg-secondary text-muted-foreground border-border" :
                        "bg-warning/20 text-warning border-warning/40"
                      }`}>{c.status}</span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {u?.seller_display_name || u?.username || c.seller_id.slice(0, 8)}
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => removeOne(c.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && cards.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">No cards match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {remaining > 0 && (
          <div className="mt-4 text-center">
            <Button variant="outline" disabled={loading}
              onClick={() => { setPage((p) => p + 1); setTimeout(load, 0); }}>
              {loading ? "Loading…" : `Load more (${remaining} remaining)`}
            </Button>
          </div>
        )}
      </section>
    </AdminLayout>
  );
};

export default AdminCards;
