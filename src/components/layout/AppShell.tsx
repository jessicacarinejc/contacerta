import { useEffect, useState, type PropsWithChildren } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
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
import { upcomingBills } from '../../lib/finance';
import { useAuthStore } from '../../store/useAuthStore';
import { useFinanceStore } from '../../store/useFinanceStore';

const navigationSections = [
  {
    title: 'Visão geral',
    items: [
      { to: '/', label: 'Visão geral', icon: Gauge },
      { to: '/movimentacoes', label: 'Movimentações', icon: ReceiptText },
      { to: '/lancamentos-futuros', label: 'Lançamentos futuros', icon: CalendarClock },
    ],
  },
  {
    title: 'Meu dinheiro',
    items: [
      { to: '/contas', label: 'Contas bancárias', icon: Landmark },
      { to: '/cartoes', label: 'Cartões de crédito', icon: CreditCard },
      { to: '/contas-a-pagar', label: 'Contas a pagar', icon: TrendingDown },
      { to: '/contas-a-receber', label: 'Contas a receber', icon: TrendingUp },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { to: '/orcamentos', label: 'Orçamentos', icon: WalletCards },
      { to: '/metas', label: 'Metas financeiras', icon: Target },
      { to: '/patrimonio', label: 'Patrimônio', icon: BriefcaseBusiness },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { to: '/documentos', label: 'Central de documentos', icon: FileScan },
      { to: '/relatorios', label: 'Relatórios', icon: ChartNoAxesCombined },
      { to: '/inteligencia', label: 'Inteligência financeira', icon: Sparkles },
    ],
  },
  {
    title: 'Minha conta',
    items: [
      { to: '/perfil', label: 'Meu perfil', icon: UserRound },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
] as const;

const mobileNavigation = [
  { to: '/', label: 'Início', icon: Gauge },
  { to: '/movimentacoes', label: 'Lançamentos', icon: ReceiptText },
  { to: '/documentos', label: 'Documentos', icon: FileScan },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
] as const;

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
    <nav className="navigation" aria-label="Menu principal">
      {navigationSections.map((section) => (
        <div className="nav-section" key={section.title}>
          <p className="nav-section-title">{section.title}</p>
          {section.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const documents = useFinanceStore((state) => state.documents);
  const transactions = useFinanceStore((state) => state.transactions);
  const user = useAuthStore((state) => state.user)!;
  const logout = useAuthStore((state) => state.logout);

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
  const reviewCount = documents.filter((document) => document.status === 'review').length;
  const dueCount = upcomingBills(transactions, Number.MAX_SAFE_INTEGER).length;
  const notificationCount = reviewCount + dueCount;
  const isMoreActive = !mobileNavigation.some(({ to }) => to === location.pathname);
  const firstName = user.name.trim().split(/\s+/)[0] || 'você';

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function toggleTheme() {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function openNotifications() {
    navigate(reviewCount > 0 ? '/documentos' : '/contas-a-pagar');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <Navigation />
        <div className="sidebar-tip">
          <PiggyBank size={22} aria-hidden="true" />
          <strong>Finanças no controle</strong>
          <p>Organize receitas, despesas e compromissos em um só lugar.</p>
        </div>
      </aside>

      {open && (
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)}>
          <aside
            className="mobile-drawer"
            aria-label="Menu de navegação"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <Logo />
              <button
                type="button"
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
            type="button"
            className="mobile-menu-button"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="topbar-greeting">
            <strong>Olá, {firstName}!</strong>
            <span>Suas finanças, de forma simples e organizada.</span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              onClick={toggleTheme}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              type="button"
              className="icon-button notification"
              aria-label={notificationCount ? 'Ver ' + notificationCount + ' pendências financeiras' : 'Consultar vencimentos'}
              onClick={openNotifications}
            >
              <Bell size={20} />
              {notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}
            </button>
            <button
              type="button"
              className="profile-button"
              onClick={() => navigate('/perfil')}
              aria-label="Abrir perfil"
            >
              <div className="avatar">
                {user.avatar ? <img src={user.avatar} alt="" /> : firstName.slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </button>
            <button type="button" className="icon-button logout-action" aria-label="Sair" onClick={handleLogout}>
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main className="main-content" id="conteudo-principal">
          {children}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Navegação rápida">
        {mobileNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={isMoreActive || open ? 'mobile-nav-item active' : 'mobile-nav-item'}
          aria-label="Mais opções"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={21} aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
