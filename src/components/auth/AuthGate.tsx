import { Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { type FormEvent, type PropsWithChildren, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFinanceStore } from '../../store/useFinanceStore';

export function AuthGate({ children }: PropsWithChildren) {
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const updateSettings = useFinanceStore((state) => state.updateSettings);

  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!hasHydrated) return;
    setMode(profile ? 'login' : 'register');
    if (profile) setEmail(profile.email);
  }, [hasHydrated, profile]);

  if (!hasHydrated) {
    return (
      <div className="auth-loading" role="status" aria-label="Carregando Conta Certa">
        <img src="/app-icon.svg" alt="" />
        <span>Preparando sua Conta Certa...</span>
      </div>
    );
  }

  if (isAuthenticated) return children;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== passwordConfirmation) {
          setError('As senhas informadas não são iguais.');
          return;
        }

        const result = await register({ name, email, password, rememberSession });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        updateSettings({ userName: name.trim() });
        return;
      }

      const result = await login(email, password, rememberSession);
      if (!result.ok) setError(result.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <img className="auth-brand-logo" src="/branding/logo-full.svg" alt="Conta Certa" />
        <div className="auth-brand-copy">
          <span className="auth-eyebrow">GESTÃO FINANCEIRA PROFISSIONAL</span>
          <h1>Organize, acompanhe e decida com segurança.</h1>
          <p>
            Seus dados ficam protegidos neste dispositivo. A senha é armazenada somente como hash
            criptográfico PBKDF2.
          </p>
        </div>
        <div className="auth-security-note">
          <ShieldCheck size={22} />
          <div>
            <strong>Privacidade em primeiro lugar</strong>
            <span>Perfil local, sessão protegida e controle total sobre seus dados.</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-icon">
              {mode === 'login' ? <LockKeyhole size={24} /> : <UserPlus size={24} />}
            </div>
            <div>
              <span>CONTA CERTA</span>
              <h2>{mode === 'login' ? 'Acesse sua conta' : 'Crie seu perfil'}</h2>
              <p>
                {mode === 'login'
                  ? 'Informe suas credenciais para continuar.'
                  : 'Cadastre o perfil administrador deste dispositivo.'}
              </p>
            </div>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Nome completo
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </label>
            )}

            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </label>

            <label>
              Senha
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === 'register' && (
              <label>
                Confirme a senha
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(event) => setRememberSession(event.target.checked)}
              />
              <span>Manter sessão neste dispositivo</span>
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar perfil'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
