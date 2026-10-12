import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Pin } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { InboxAnnouncement, listInboxAnnouncements, markAnnouncementRead } from '@/services/announcements';

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  NORMAL: 'bg-brand-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-500',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AnnouncementBell() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InboxAnnouncement[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const rows = await listInboxAnnouncements();
    setItems(rows);
  }

  useEffect(() => {
    if (!profile) return;
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  const unread = items.filter((i) => !i.read);

  async function openItem(item: InboxAnnouncement) {
    if (!item.read && profile) {
      await markAnnouncementRead(item.id, profile.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        title="Announcements"
      >
        <Bell size={19} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-14 z-40 mt-2 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-ink-900">Announcements</p>
              {unread.length > 0 && <span className="text-xs text-slate-400">{unread.length} unread</span>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={clsx(
                    'flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50',
                    !item.read && 'bg-brand-50/40'
                  )}
                >
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[item.priority])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {item.is_pinned && <Pin size={11} className="shrink-0 text-brand-500" />}
                      <p className={clsx('truncate text-sm', item.read ? 'text-slate-600' : 'font-semibold text-ink-900')}>{item.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{item.created_by_name} · {timeAgo(item.created_at)}</p>
                  </div>
                </button>
              ))}
              {!items.length && <p className="px-4 py-8 text-center text-sm text-slate-400">No announcements yet.</p>}
            </div>
            <Link
              to="/announcements"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              View all announcements
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
