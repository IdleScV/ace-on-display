import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Send, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listAdminChat,
  postAdminChat,
  deleteAdminChat,
  type AdminChatMessage,
} from "@/lib/admin-chat.functions";
import { useAuth } from "@/lib/auth-context";

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function shortName(email: string | null) {
  if (!email) return "Unknown";
  return email.split("@")[0];
}

export function AdminChat() {
  const { isSuperadmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const list = useServerFn(listAdminChat);
  const post = useServerFn(postAdminChat);
  const del = useServerFn(deleteAdminChat);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-chat"],
    queryFn: () => list(),
    enabled: isSuperadmin,
    refetchInterval: open ? 5000 : 20000,
    refetchOnWindowFocus: true,
  });

  const postMut = useMutation({
    mutationFn: (body: string) => post({ data: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-chat"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-chat"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!isSuperadmin) return null;

  const count = messages?.length ?? 0;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || postMut.isPending) return;
    setInput("");
    await postMut.mutateAsync(text);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-44 z-50 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg ring-1 ring-foreground/30 transition hover:scale-105"
          aria-label="Open SuperAdmin chat"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="hidden sm:inline">Team chat</span>
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b bg-foreground px-4 py-2.5 text-background">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <div className="text-sm font-semibold">SuperAdmin Team Chat</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-background/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-3 py-3">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && (messages?.length ?? 0) === 0 && (
              <div className="px-2 py-8 text-center text-xs text-muted-foreground">
                No messages yet. Start the conversation — visible to all SuperAdmins.
              </div>
            )}
            {messages?.map((m: AdminChatMessage) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`group max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
                  }`}>
                    <div className={`mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}>
                      <span className="font-semibold">{mine ? "You" : shortName(m.author_email)}</span>
                      <span>·</span>
                      <span>{formatTime(m.created_at)}</span>
                      {mine && (
                        <button
                          onClick={() => delMut.mutate(m.id)}
                          className="ml-auto opacity-0 transition group-hover:opacity-100"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={submit} className="border-t bg-card p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Message the team…"
                rows={2}
                maxLength={4000}
                className="flex-1 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!input.trim() || postMut.isPending}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                aria-label="Send"
              >
                {postMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
