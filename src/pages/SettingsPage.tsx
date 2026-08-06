import { Bell, DatabaseBackup, KeyRound, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { useFinanceStore } from '../store/useFinanceStore';

export function SettingsPage() {
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const reset = useFinanceStore((state) => state.resetDemo);
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);

  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [profileMessage, setProfileMessage] = useState<string>();
  const [passwordMessage, setPasswordMessage] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  useEffect(() => {
    setName(profile?.name ?? '');
    setEmail(profile?.email ?? '');
  }, [profile]);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = updateProfile({ name, email });
    setProfileMessage(result.ok ? 'Perfil atualizado com sucesso.' : result.error);
    if (result.ok) updateSettings({ userName: name.trim() });
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(undefined);
    setPasswordError(undefined);

    if (newPassword !== passwordConfirmation) {
      setPasswordError('A confirmação da nova senha não confere.');
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setPasswordConfirmation('');
    setPasswordMessage('Senha alterada com segurança.');
  }

  return (
    <div className="page">
      <PageHeader
        title="Configurações"
        description="Perfil, segurança, aparência e comportamento do aplicativo."
      />

      <div className="settings-grid">
        <Card>
          <h2>Perfil do usuário</h2>
          <form className="settings-form" onSubmit={saveProfile}>
            <label>
              Nome de exibição
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              E-mail de acesso
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {profileMessage && <p className="form-message">{profileMessage}</p>}
            <Button type="submit">
              <Save size={17} /> Salvar perfil
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Aparência</h2>
          <div className="settings-form">
            <label>
              Tema da aplicação
              <select
                value={settings.theme}
                onChange={(event) =>
                  updateSettings({ theme: event.target.value as typeof settings.theme })
                }
              >
                <option value="system">Seguir o sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </label>
            <p className="setting-help">
              A alteração é aplicada imediatamente em todas as telas, gráficos e formulários.
            </p>
          </div>
        </Card>

        <Card>
          <h2>Alterar senha</h2>
          <form className="settings-form" onSubmit={savePassword}>
            <label>
              Senha atual
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Confirme a nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
              />
            </label>
            {passwordError && <p className="form-error">{passwordError}</p>}
            {passwordMessage && <p className="form-message">{passwordMessage}</p>}
            <Button type="submit">
              <KeyRound size={17} /> Atualizar senha
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Planejamento</h2>
          <div className="settings-form">
            <label>
              Meta de receita mensal
              <input
                type="number"
                value={settings.monthlyIncomeGoal}
                onChange={(event) =>
                  updateSettings({ monthlyIncomeGoal: Number(event.target.value) })
                }
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
                  updateSettings({ emergencyReserveMonths: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </Card>

        <Card>
          <h2>Privacidade e dados</h2>
          <div className="setting-row">
            <ShieldCheck />
            <div>
              <strong>Credencial protegida</strong>
              <span>A senha não é salva em texto puro.</span>
            </div>
          </div>
          <div className="setting-row">
            <DatabaseBackup />
            <div>
              <strong>Dados locais</strong>
              <span>Persistidos no armazenamento privado do aplicativo.</span>
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
              onChange={(event) =>
                updateSettings({ notificationsEnabled: event.target.checked })
              }
            />
          </div>
        </Card>

        <Card className="danger-zone">
          <h2>Dados de demonstração</h2>
          <p>Restaura contas, lançamentos, metas e orçamentos originais.</p>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Restaurar os dados de demonstração?')) reset();
            }}
          >
            <RotateCcw size={17} /> Restaurar demonstração
          </Button>
        </Card>
      </div>
    </div>
  );
}
