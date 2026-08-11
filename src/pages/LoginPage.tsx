import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, Fingerprint, LockKeyhole, Mail, ScanFace, UserRound } from 'lucide-react';
import {
  BiometryType,
  biometricButtonLabel,
  checkBiometricStatus,
  type BiometricStatus,
} from '../lib/biometric';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const unlockWithBiometrics = useAuthStore((state) => state.unlockWithBiometrics);
  const [mode, setMode] = useState<'login' | 'register'>(user ? 'login' : 'register');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (mode !== 'login' || !user) {
      setBiometricStatus(null);
      return () => {
        active = false;
      };
    }

    async function refreshBiometricStatus() {
      const status = await checkBiometricStatus();
      if (active) setBiometricStatus(status);
    }

    // No Android o plugin nativo pode terminar de inicializar logo após o WebView.
    // Fazemos uma segunda checagem curta e também rechecamos quando o app volta ao foco.
    void refreshBiometricStatus();
    const retryTimer = window.setTimeout(() => void refreshBiometricStatus(), 700);
    const handleFocus = () => void refreshBiometricStatus();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshBiometricStatus();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mode, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register({ name, email, password });
      } else {
        const valid = await login(email, password);
        if (!valid) setError('E-mail ou senha inválidos.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricUnlock() {
    setError('');
    setBiometricLoading(true);
    try {
      const unlocked = await unlockWithBiometrics();
      if (!unlocked) {
        setError('Não foi possível confirmar a biometria. Você ainda pode entrar com sua senha.');
      }
    } finally {
      setBiometricLoading(false);
    }
  }

  const biometricType = biometricStatus?.biometryType ?? BiometryType.None;
  const biometricAvailable = Boolean(mode === 'login' && user && biometricStatus?.isAvailable);
  const isFaceUnlock = biometricType === BiometryType.FaceID;

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Conta Certa">
        <img src="/branding/logo-full-light.svg" alt="Conta Certa — Gestão Financeira" />
        <div>
          <h1>Sua vida financeira protegida e sob controle.</h1>
          <p>Organize receitas, despesas, documentos, metas e decisões em um único ambiente.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand" aria-label="Conta Certa — Gestão Financeira">
            <img
              className="auth-mobile-logo"
              src="/branding/logo-horizontal.svg"
              alt="Conta Certa — Gestão Financeira"
            />
          </div>
          <span className="auth-eyebrow">ACESSO SEGURO</span>
          <h2>{mode === 'login' ? 'Entrar na sua conta' : 'Criar perfil de usuário'}</h2>
          <p>
            {mode === 'login'
              ? 'Use sua senha ou, quando disponível no aparelho, a biometria para continuar.'
              : 'Seus dados ficam armazenados localmente neste dispositivo.'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <label>
                Nome completo
                <span className="input-with-icon">
                  <UserRound size={18} />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </span>
              </label>
            )}

            <label>
              E-mail
              <span className="input-with-icon">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label>
              Senha
              <span className="input-with-icon">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === 'register' && (
              <label>
                Confirmar senha
                <span className="input-with-icon">
                  <LockKeyhole size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </span>
              </label>
            )}

            {error && <div className="auth-error" role="alert">{error}</div>}

            <button className="button button-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar com senha' : 'Criar conta'}
            </button>

            {biometricAvailable && (
              <button
                className="button button-secondary auth-submit"
                type="button"
                onClick={() => void handleBiometricUnlock()}
                disabled={biometricLoading}
              >
                {isFaceUnlock ? <ScanFace size={19} /> : <Fingerprint size={19} />}
                {biometricLoading
                  ? 'Confirmando biometria...'
                  : biometricButtonLabel(biometricType)}
              </button>
            )}
          </form>

          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode((value) => (value === 'login' ? 'register' : 'login'));
              setError('');
            }}
          >
            {mode === 'login' ? 'Criar um novo perfil' : 'Já tenho um perfil'}
          </button>
        </div>
      </section>
    </main>
  );
}
