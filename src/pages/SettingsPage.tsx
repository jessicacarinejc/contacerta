import {
  Bell,
  CloudDownload,
  CloudUpload,
  DatabaseBackup,
  Eraser,
  FileJson,
  HardDrive,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card } from '../components/ui';
import {
  clearBrowserStateMirrors,
  formatBackupSize,
  importLegacyStore,
  restoreDatabaseBackup,
  saveDatabaseBackupToDrive,
  selectDatabaseBackupFromDrive,
  selectLegacyStoreFile,
} from '../lib/database-backup';
import { useFinanceStore } from '../store/useFinanceStore';

export function SettingsPage() {
  const settings = useFinanceStore((state) => state.settings);
  const update = useFinanceStore((state) => state.updateSettings);
  const clearFinancialData = useFinanceStore((state) => state.clearFinancialData);
  const resetDemo = useFinanceStore((state) => state.resetDemo);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function backupToDrive() {
    setBusy(true);
    setMessage('Preparando uma cópia íntegra da base SQLite...');
    try {
      const info = await saveDatabaseBackupToDrive();
      setMessage(
        `Backup SQLite criado (${formatBackupSize(info.byteSize)}). No Android, escolha Google Drive na tela de compartilhamento para guardar a cópia na nuvem.`,
      );
    } catch (error) {
      console.error('Falha ao criar backup SQLite.', error);
      setMessage(
        error instanceof Error
          ? `Não foi possível criar o backup: ${error.message}`
          : 'Não foi possível criar o backup SQLite.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromDrive() {
    setBusy(true);
    setMessage('Selecione no Google Drive um backup SQLite do Conta Certa...');
    try {
      const selected = await selectDatabaseBackupFromDrive();
      if (!selected) {
        setMessage('Restauração cancelada. Nenhum dado foi alterado.');
        setBusy(false);
        return;
      }

      if (!selected.info.hasFinanceState) {
        setMessage('O arquivo é válido, mas não contém a base financeira do Conta Certa.');
        setBusy(false);
        return;
      }

      const confirmed = confirm(
        [
          `Restaurar o backup “${selected.fileName}”?`,
          `Tamanho: ${formatBackupSize(selected.info.byteSize)}`,
          `Base financeira: ${selected.info.hasFinanceState ? 'encontrada' : 'não encontrada'}`,
          `Perfil de acesso: ${selected.info.hasAuthState ? 'encontrado' : 'não encontrado'}`,
          '',
          'A base atual será preservada como cópia de segurança local antes da substituição.',
        ].join('\n'),
      );
      if (!confirmed) {
        setMessage('Restauração cancelada. A base atual foi mantida.');
        setBusy(false);
        return;
      }

      setMessage('Validando e restaurando a base SQLite...');
      await restoreDatabaseBackup(selected.dataBase64);
      clearBrowserStateMirrors();
      setMessage('Backup restaurado com sucesso. Recarregando o Conta Certa...');
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      console.error('Falha ao restaurar backup SQLite.', error);
      setMessage(
        error instanceof Error
          ? `Não foi possível restaurar o backup: ${error.message}`
          : 'Não foi possível restaurar o backup selecionado.',
      );
      setBusy(false);
    }
  }

  async function importOldLocalBase() {
    setBusy(true);
    setMessage('Selecione o arquivo conta-certa.store.json recuperado da instalação antiga...');
    try {
      const legacy = await selectLegacyStoreFile();
      if (!legacy) {
        setMessage('Importação cancelada. Nenhum dado foi alterado.');
        setBusy(false);
        return;
      }
      if (!legacy.hasFinanceState) {
        setMessage('O arquivo antigo não contém os dados financeiros esperados.');
        setBusy(false);
        return;
      }

      const confirmed = confirm(
        [
          `Importar os dados de “${legacy.fileName}” para a nova base SQLite?`,
          `Base financeira: ${legacy.hasFinanceState ? 'encontrada' : 'não encontrada'}`,
          `Perfil de acesso: ${legacy.hasAuthState ? 'encontrado' : 'não encontrado'}`,
          '',
          'O arquivo antigo não será apagado nem modificado.',
        ].join('\n'),
      );
      if (!confirmed) {
        setMessage('Importação cancelada. A base atual foi mantida.');
        setBusy(false);
        return;
      }

      await importLegacyStore(legacy.entries);
      clearBrowserStateMirrors();
      setMessage('Base antiga importada para SQLite. Recarregando o Conta Certa...');
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      console.error('Falha ao importar base antiga.', error);
      setMessage(
        error instanceof Error
          ? `Não foi possível importar a base antiga: ${error.message}`
          : 'Não foi possível importar a base antiga.',
      );
      setBusy(false);
    }
  }

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
              <span>Persistidos na base SQLite privada do aplicativo, com espelho de migração.</span>
            </div>
          </div>
          <div className="setting-row">
            <DatabaseBackup />
            <div>
              <strong>Backup sob seu controle</strong>
              <span>A cópia só é enviada ou restaurada quando você solicita.</span>
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

        <Card>
          <h2>Backup e recuperação</h2>
          <p>
            A base principal agora é SQLite. O backup inclui os estados financeiros e, quando
            disponível, o perfil local. Antes de restaurar, o arquivo é validado e a base atual
            recebe uma cópia de segurança interna.
          </p>

          {message && <div className="settings-message">{message}</div>}

          <div className="danger-actions">
            <Button variant="secondary" disabled={busy} onClick={() => void backupToDrive()}>
              <CloudUpload size={17} /> {busy ? 'Aguarde...' : 'Salvar backup no Drive'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void restoreFromDrive()}>
              <CloudDownload size={17} /> Restaurar do Drive
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void importOldLocalBase()}>
              <FileJson size={17} /> Importar base antiga
            </Button>
          </div>

          <div className="setting-row">
            <HardDrive />
            <div>
              <strong>Migração protegida</strong>
              <span>
                Dados do armazenamento antigo são copiados para o SQLite sem apagar a origem.
              </span>
            </div>
          </div>
        </Card>

        <Card className="danger-zone">
          <h2>Base financeira</h2>
          <p>
            As opções abaixo removem ou substituem dados locais. Faça um backup no Drive antes
            de usar estas ações quando houver informações que deseja preservar.
          </p>

          <div className="danger-actions">
            <Button variant="danger" disabled={busy} onClick={() => void hardResetApplication()}>
              <RefreshCcw size={17} /> {busy ? 'Aguarde...' : 'Restaurar base vazia'}
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
