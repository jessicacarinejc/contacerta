import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronDown,
  CreditCard,
  FileScan,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  PiggyBank,
  ReceiptText,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

const navigation = [
  ['/', 'Dashboard', Gauge],
  ['/movimentacoes', 'Movimentações', ReceiptText],
  ['/contas', 'Contas', Landmark],
  ['/cartoes', 'Cartões', CreditCard],
  ['/contas-a-pagar', 'Contas a pagar', TrendingDown],
  ['/contas-a-receber', 'Contas a receber', TrendingUp],
  ['/documentos', 'Central de documentos', FileScan],
  ['/orcamentos', 'Orçamentos', WalletCards],
  ['/metas', 'Metas', Target],
  ['/patrimonio', 'Patrimônio', BriefcaseBusiness],
  ['/relatorios', 'Relatórios', ChartNoAxesCombined],
  ['/inteligencia', 'Inteligência financeira', Sparkles],
  ['/configuracoes', 'Configurações', Settings],
] as const;

const mobile = navigation.filter(([to]) =>
  ['/', '/movimentacoes', '/documentos', '/metas', '/inteligencia'].includes(to),
);

function Logo() {
  return (
    <div className="brand">
      <div className="brand-lockup">
        <img src="/branding/logo-horizontal.svg" alt="Conta Certa — Gestão Financeira" />
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="navigation">
      {navigation.map(([to, label, Icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);
  const name = profile?.name ?? 'Usuário';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <Navigation />
        <div className="sidebar-tip">
          <PiggyBank />
          <strong>Reserva protegida</strong>
          <p>Acompanhe a evolução e receba alertas antes de comprometer o caixa.</p>
        </div>
      </aside>

      {open && (
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <Logo />
              <button
                className="icon-button"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </div>
            <Navigation onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="topbar-greeting">
            <strong>Olá, {name.split(' ')[0]}! 👋</strong>
            <span>Veja como está sua vida financeira hoje.</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification" aria-label="Notificações">
              <Bell size={20} />
              <i>3</i>
            </button>
            <div className="profile-menu-wrap">
              <button
                className="profile-trigger"
                type="button"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((current) => !current)}
              >
                <span className="avatar">{initials}</span>
                <span className="profile-text">
                  <strong>{name}</strong>
                  <span>Administrador</span>
                </span>
                <ChevronDown size={16} />
              </button>

              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    <span className="avatar">{initials}</span>
                    <div>
                      <strong>{name}</strong>
                      <span>{profile?.email}</span>
                    </div>
                  </div>
                  <NavLink to="/configuracoes" onClick={() => setProfileOpen(false)}>
                    <UserRound size={17} /> Perfil e segurança
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={17} /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav">
        {mobile.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
            }
          >
            <Icon size={20} />
            <span>{label === 'Inteligência financeira' ? 'Insights' : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
