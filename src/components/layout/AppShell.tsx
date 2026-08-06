import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CreditCard,
  FileScan,
  Gauge,
  Landmark,
  Menu,
  PiggyBank,
  ReceiptText,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';

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
        <img
          src="/branding/logo-horizontal.svg"
          alt="Conta Certa — Gestão Financeira"
          width="1240"
          height="360"
        />
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
  const name = useFinanceStore((state) => state.settings.userName);

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
            <strong>Olá, {name}! 👋</strong>
            <span>Veja como está sua vida financeira hoje.</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification" aria-label="Notificações">
              <Bell size={20} />
              <i>3</i>
            </button>
            <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
            <div className="profile-text">
              <strong>{name}</strong>
              <span>Conta local</span>
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
