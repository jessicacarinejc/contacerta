import type { PropsWithChildren } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CreditCard,
  FileScan,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  ReceiptText,
  Settings,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
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
  ['/perfil', 'Meu perfil', UserRound],
  ['/configuracoes', 'Configurações', Settings],
] as const;

const mobile = navigation.filter(([to]) =>
  ['/', '/movimentacoes', '/documentos', '/metas', '/perfil'].includes(to),
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
  const navigate = useNavigate();
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const user = useAuthStore((state) => state.user)!;
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function toggleTheme() {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

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
              <button className="icon-button" aria-label="Fechar menu" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <Navigation onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="topbar-greeting">
            <strong>Olá, {user.name}! 👋</strong>
            <span>Veja como está sua vida financeira hoje.</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={toggleTheme}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-button notification" aria-label="Notificações">
              <Bell size={20} /><i>3</i>
            </button>
            <button className="profile-button" onClick={() => navigate('/perfil')} aria-label="Abrir perfil">
              <div className="avatar">
                {user.avatar ? <img src={user.avatar} alt="" /> : user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-text"><strong>{user.name}</strong><span>{user.email}</span></div>
            </button>
            <button className="icon-button" aria-label="Sair" onClick={handleLogout}><LogOut size={19} /></button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav">
        {mobile.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>
            <Icon size={20} />
            <span>{label === 'Central de documentos' ? 'Documentos' : label === 'Meu perfil' ? 'Perfil' : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
