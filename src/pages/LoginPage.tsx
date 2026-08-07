import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const [mode, setMode] = useState<'login' | 'register'>(user ? 'login' : 'register');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          <img className="auth-mobile-logo" src="/branding/logo-full.svg" alt="Conta Certa" />
          <span className="auth-eyebrow">ACESSO SEGURO</span>
          <h2>{mode === 'login' ? 'Entrar na sua conta' : 'Criar perfil de usuário'}</h2>
          <p>
            {mode === 'login'
              ? 'Informe suas credenciais para continuar.'
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
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
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
