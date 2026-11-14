import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationInbox {
  items: NotificationItem[];
  unreadCount: number;
}

interface NotificationCenterProps {
  notify: (message: string) => void;
}

const emptyInbox: NotificationInbox = { items: [], unreadCount: 0 };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function NotificationCenter({ notify }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<NotificationInbox>(emptyInbox);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API}/notifications?size=30`);
      if (!response.ok) throw new Error('Could not load notifications');
      const body: NotificationInbox = await response.json();
      setInbox(body);
    } catch (error) {
      notify(errorMessage(error, 'Could not load notifications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const markRead = async (id: string) => {
    const response = await apiFetch(`${API}/notifications/${id}/read`, { method: 'PATCH' });
    if (!response.ok) {
      notify('Could not update notification');
      return;
    }
    const updated: NotificationItem = await response.json();
    setInbox((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? updated : item),
      unreadCount: Math.max(0, current.unreadCount - 1),
    }));
  };

  const markAll = async () => {
    const response = await apiFetch(`${API}/notifications/read-all`, { method: 'PATCH' });
    if (!response.ok) {
      notify('Could not mark notifications as read');
      return;
    }
    const body: NotificationInbox = await response.json();
    setInbox(body);
  };

  return (
    <div className="notification-center">
      <button
        className="icon-button"
        aria-label={`Notifications${inbox.unreadCount ? `, ${inbox.unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); if (!open) void load(); }}
      >
        <Bell size={17} aria-hidden="true" />
        {inbox.unreadCount > 0 && <span className="notification-badge">{inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}</span>}
      </button>
      {open && <section className="notification-popover" aria-label="Notifications">
        <div className="notification-popover-head">
          <div><b>Notifications</b><small>{inbox.unreadCount} unread</small></div>
          <button onClick={() => void markAll()} disabled={!inbox.unreadCount}>Mark all read</button>
        </div>
        {loading && !inbox.items.length
          ? <p className="notification-empty">Loading notifications…</p>
          : inbox.items.length
            ? <div className="notification-list">{inbox.items.map((item) => (
              <button className={`notification-item ${item.readAt ? 'read' : ''}`} key={item.id} onClick={() => { if (!item.readAt) void markRead(item.id); }}>
                <span className="notification-dot" aria-hidden="true" />
                <span><b>{item.title}</b><small>{item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></span>
              </button>
            ))}</div>
            : <p className="notification-empty">You’re all caught up.</p>}
      </section>}
    </div>
  );
}
