import {
  Bell,
  DatabaseBackup,
  Eraser,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';

export function SettingsPage() {
  const settings = useFinanceStore((state) => state.settings);
  const update = useFinanceStore((state) => state.updateSettings);
  const clearFinancialData = useFinanceStore((state) => state.clearFinancialData);
  const resetDemo = useFinanceStore((state) => state.resetDemo);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function hardResetApplication() {
    if (
      !confirm(
        'Restaurar o Conta Certa para uma base vazia? Todos os dados financeiros locais serão removidos. O aplicativo será recarregado.',
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('Limpando o armazenamento local...');
    try {
      await useFinanceStore.persist.clearStorage();
      clearFinancialData();
      setMessage('Base restaurada. Recarregando o aplicativo...');
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      console.error('Falha ao restaurar a base financeira.', error);
      setMessage('Não foi possível restaurar a base. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Configurações"
        description="Preferências locais, segurança e comportamento do aplicativo."
      />
      <div className="settings-grid">
        <Card>
          <h2>Perfil</h2>
          <label>
            Nome de exibição
            <input
              value={settings.userName}
              onChange={(event) => update({ userName: event.target.value })}
            />
          </label>
          <label>
            Tema
            <select
              value={settings.theme}
              onChange={(event) =>
                update({ theme: event.target.value as typeof settings.theme })
              }
            >
              <option value="system">Seguir o sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
        </Card>

        <Card>
          <h2>Planejamento</h2>
          <label>
            Meta de receita mensal
            <input
              type="number"
              value={settings.monthlyIncomeGoal}
              onChange={(event) => update({ monthlyIncomeGoal: Number(event.target.value) })}
            />
          </label>
          <label>
            Meses desejados de reserva
            <input
              type="number"
              min="1"
              max="24"
              value={settings.emergencyReserveMonths}
              onChange={(event) =>
                update({ emergencyReserveMonths: Number(event.target.value) })
              }
            />
          </label>
        </Card>

        <Card>
          <h2>Privacidade e dados</h2>
          <div className="setting-row">
            <ShieldCheck />
            <div>
              <strong>Dados locais</strong>
              <span>Persistidos no armazenamento privado do aplicativo.</span>
            </div>
          </div>
          <div className="setting-row">
            <DatabaseBackup />
            <div>
              <strong>Exportações</strong>
              <span>Geradas somente quando você solicita.</span>
            </div>
          </div>
          <div className="setting-row">
            <Bell />
            <div>
              <strong>Notificações</strong>
              <span>Alertas de vencimentos e orçamento.</span>
            </div>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(event) => update({ notificationsEnabled: event.target.checked })}
            />
          </div>
        </Card>

        <Card className="danger-zone">
          <h2>Base financeira</h2>
          <p>
            Se a demonstração antiga continuar aparecendo, use “Restaurar base vazia”. Essa
            opção apaga também o estado persistido do aplicativo e recarrega o Conta Certa.
          </p>

          {message && <div className="settings-message">{message}</div>}

          <div className="danger-actions">
            <Button variant="danger" disabled={busy} onClick={() => void hardResetApplication()}>
              <RefreshCcw size={17} /> {busy ? 'Restaurando...' : 'Restaurar base vazia'}
            </Button>

            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'Limpar contas, lançamentos, cartões, patrimônio, metas, orçamentos e documentos atuais?',
                  )
                ) {
                  clearFinancialData();
                  setMessage('Dados financeiros removidos. A base está pronta para novos lançamentos.');
                }
              }}
            >
              <Eraser size={17} /> Limpar dados financeiros
            </Button>

            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (confirm('Carregar novamente os dados de demonstração?')) {
                  resetDemo();
                  setMessage('Dados de demonstração carregados.');
                }
              }}
            >
              <RotateCcw size={17} /> Carregar demonstração
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
