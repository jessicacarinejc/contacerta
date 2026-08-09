import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { AssetsPage } from './pages/AssetsPage';
import { BillsPage } from './pages/BillsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { CardsPage } from './pages/CardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FutureTransactionsPage } from './pages/FutureTransactionsPage';
import { GoalsPage } from './pages/GoalsPage';
import { IntelligencePage } from './pages/IntelligencePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { useAuthStore } from './store/useAuthStore';
import { useFinanceStore } from './store/useFinanceStore';

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const theme = useFinanceStore((state) => state.settings.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      const resolvedTheme = dark ? 'dark' : 'light';
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
      document.body.dataset.theme = resolvedTheme;
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  if (!isAuthenticated) return <LoginPage />;

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/movimentacoes" element={<TransactionsPage />} />
          <Route path="/lancamentos-futuros" element={<FutureTransactionsPage />} />
          <Route path="/contas" element={<AccountsPage />} />
          <Route path="/cartoes" element={<CardsPage />} />
          <Route path="/contas-a-pagar" element={<BillsPage type="payable" />} />
          <Route path="/contas-a-receber" element={<BillsPage type="receivable" />} />
          <Route path="/documentos" element={<DocumentsPage />} />
          <Route path="/orcamentos" element={<BudgetsPage />} />
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/patrimonio" element={<AssetsPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/inteligencia" element={<IntelligencePage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
}
