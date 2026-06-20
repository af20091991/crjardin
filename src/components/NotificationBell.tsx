import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell, MessageSquare, HelpCircle, Eye, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

const ICONS: Record<string, typeof Bell> = {
  question: HelpCircle,
  annotation: MessageSquare,
  read: Eye,
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const unread = (notifs ?? []).filter((n) => !n.is_read).length;

  const inv = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({ mutationFn: (id: string) => markNotificationRead(id), onSuccess: inv });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: inv });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground" title="Notifications" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => readAll.mutate()}>
              <Check className="mr-1 h-3 w-3" /> Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {(notifs ?? []).length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            (notifs ?? []).map((n: AppNotification) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && readOne.mutate(n.id)}
                  className={`flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/40 ${
                    n.is_read ? "opacity-60" : "bg-primary/5"
                  }`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    {n.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
