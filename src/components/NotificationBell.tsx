import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, MessageSquare, HelpCircle, Eye, Check, CalendarDays } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  groupNotifications,
  notificationTarget,
  type NotificationGroup,
} from "@/lib/notification-groups";

const ICONS: Record<string, typeof Bell> = {
  question: HelpCircle,
  annotation: MessageSquare,
  read: Eye,
  sst_calendar: CalendarDays,
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const channelName = `notifications-rt-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const [filter, setFilter] = useState<NotificationGroup | "all">("all");
  const unread = (notifs ?? []).filter((n) => !n.is_read).length;
  const groups = groupNotifications(notifs ?? []);
  const shown = filter === "all" ? groups : groups.filter((g) => g.group === filter);

  const inv = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: inv,
  });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: inv });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative text-muted-foreground hover:text-foreground"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="w-[min(96vw,36rem)] max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => readAll.mutate()}
            >
              <Check className="mr-1 h-3 w-3" /> Tout lire
            </Button>
          )}
        </div>
        {groups.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
            {(["all", ...GROUP_ORDER] as const)
              .filter((g) => g === "all" || groups.some((x) => x.group === g))
              .map((g) => {
                const count =
                  g === "all" ? unread : (groups.find((x) => x.group === g)?.unread ?? 0);
                return (
                  <button
                    key={g}
                    onClick={() => setFilter(g)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                      filter === g
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {g === "all" ? "Tout" : GROUP_LABELS[g]}
                    {count > 0 ? ` (${count})` : ""}
                  </button>
                );
              })}
          </div>
        )}
        <div className="max-h-[min(72dvh,34rem)] overflow-y-auto overscroll-contain">
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            shown.map((g) => (
              <section key={g.group}>
                {(filter === "all" ? groups.length > 1 : false) && (
                  <h3 className="sticky top-0 z-10 bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </h3>
                )}
                {g.items.map((n: AppNotification) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) readOne.mutate(n.id);
                        const target = notificationTarget(n);
                        if (target) void navigate({ to: target as never });
                      }}
                      className={`flex w-full items-start gap-2.5 border-b px-3 py-3 text-left transition-colors hover:bg-accent/40 ${
                        n.is_read ? "opacity-60" : "bg-primary/5"
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="mt-1 whitespace-pre-line break-words text-sm leading-snug text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
