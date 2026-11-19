import { useEffect } from 'react';
import { ChevronDown, Command, Ellipsis, Search, Settings2 } from 'lucide-react';
import { navGroups, navModuleCode } from '../../app/navigation';
import type { AppSession } from '../../types/session';

interface SidebarProps {
  session: AppSession;
  enabledModules: string[] | null;
  section: string;
  mobileOpen: boolean;
  onNavigate: (label: string) => void;
  onSearch: () => void;
  onSignOut: () => void;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({ session, enabledModules, section, mobileOpen, onNavigate, onSearch, onSignOut, onMobileOpenChange }: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileOpenChange(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen, onMobileOpenChange]);

  const initials = session.name
    ? session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => onMobileOpenChange(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="workspace-header">
          <button className="workspace-switch" title={session.tenantName || 'Workspace'}>
            <span className="workspace-avatar">
              {session.tenantName?.[0] || 'S'}
            </span>
            <span className="workspace-meta">
              <b>{session.tenantName || 'Spindl'}</b>
              <small>{session.role || 'Member'}</small>
            </span>
            <ChevronDown size={13} className="workspace-chevron" aria-hidden="true" />
          </button>
        </div>

        <button className="quick-search" onClick={onSearch}>
          <Search size={13} aria-hidden="true" />
          <span>Search anything…</span>
          <kbd>
            <Command size={10} aria-hidden="true" /> K
          </kbd>
        </button>

        <nav aria-label="Workspace navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-caption">{group.title}</div>
              {group.items
                .filter(
                  ({ label }) =>
                    (label !== 'Audit log' || ['OWNER', 'ADMIN', 'MANAGER'].includes(session.role ?? '')) &&
                    (!enabledModules || enabledModules.includes(navModuleCode(label)))
                )
                .map(({ label, icon: Icon, count }) => (
                  <button
                    key={label}
                    aria-current={section === label ? 'page' : undefined}
                    className={`nav-item ${section === label ? 'active' : ''}`}
                    onClick={() => onNavigate(label)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                    {count && <small className="nav-count">{count}</small>}
                  </button>
                ))}
            </div>
          ))}
          <div className="nav-group">
            <div className="nav-caption">PREFERENCES</div>
            <button
              aria-current={section === 'Settings' ? 'page' : undefined}
              className={`nav-item ${section === 'Settings' ? 'active' : ''}`}
              onClick={() => onNavigate('Settings')}
            >
              <Settings2 size={14} aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <button className="profile" onClick={onSignOut} title="Sign out">
            <span className="profile-avatar">{initials}</span>
            <span className="profile-meta">
              <b>{session.name}</b>
              <small>{session.role} · Sign out</small>
            </span>
            <Ellipsis size={14} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
