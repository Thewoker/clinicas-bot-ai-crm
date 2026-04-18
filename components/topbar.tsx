"use client";

import {
  Bell,
  LogOut,
  ChevronDown,
  CalendarPlus,
  CalendarX,
  CalendarClock,
  MessageCircle,
  CheckCheck,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Clinic = { id: string; name: string; slug: string };
type User = { name: string; email: string; role: string };

type NotificationType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "HUMAN_REQUESTED";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string; href: string }
> = {
  APPOINTMENT_CREATED: {
    icon: CalendarPlus,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    href: "/calendar",
  },
  APPOINTMENT_CANCELLED: {
    icon: CalendarX,
    color: "text-red-500",
    bg: "bg-red-50",
    href: "/calendar",
  },
  APPOINTMENT_RESCHEDULED: {
    icon: CalendarClock,
    color: "text-amber-500",
    bg: "bg-amber-50",
    href: "/calendar",
  },
  HUMAN_REQUESTED: {
    icon: MessageCircle,
    color: "text-blue-500",
    bg: "bg-blue-50",
    href: "/conversations",
  },
};

export function Topbar({ clinic, user }: { clinic: Clinic; user: User }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPending, startTransition] = useTransition();
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleNotificationClick(n: Notification) {
    setNotifOpen(false);
    if (!n.read) {
      fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    const href = NOTIFICATION_CONFIG[n.type]?.href ?? "/dashboard";
    router.push(href);
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Clinic badge */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-semibold text-gray-800">{clinic.name}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {user.role === "ADMIN" ? "Administrador" : "Staff"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-80 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-800">Notificaciones</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar todo como leído
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Sin notificaciones</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const cfg = NOTIFICATION_CONFIG[n.type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                          !n.read ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}
                        >
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-800 truncate">
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 text-left">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              locale: es,
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative pl-2 border-l border-gray-100">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-emerald-700">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-gray-400 leading-tight truncate max-w-32">
                {user.email}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-52 py-1">
                <div className="px-4 py-2.5 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
