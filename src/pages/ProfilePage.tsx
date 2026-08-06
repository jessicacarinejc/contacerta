import { FormEvent, useState } from 'react';
import { Camera, KeyRound, Save, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useFinanceStore } from '../store/useFinanceStore';

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [message, setMessage] = useState('');

  function readAvatar(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('A imagem deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile({ name: name.trim(), email: email.trim().toLowerCase(), avatar });
    updateSettings({ userName: name.trim() });
    setMessage('Perfil atualizado com sucesso.');
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPassword.length < 8) {
      setMessage('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    const changed = await changePassword(currentPassword, nextPassword);
    setMessage(changed ? 'Senha alterada com sucesso.' : 'A senha atual está incorreta.');
    if (changed) {
      setCurrentPassword('');
      setNextPassword('');
    }
  }

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div>
          <h1>Perfil de usuário</h1>
          <p>Gerencie seus dados pessoais, imagem e credenciais de acesso.</p>
        </div>
      </header>

      {message && <div className="profile-message">{message}</div>}

      <div className="profile-grid">
        <form className="card profile-card" onSubmit={saveProfile}>
          <div className="profile-avatar-editor">
            <div className="profile-avatar-large">
              {avatar ? <img src={avatar} alt="Foto do perfil" /> : <UserRound size={38} />}
            </div>
            <label className="button button-secondary">
              <Camera size={16} /> Alterar foto
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => readAvatar(event.target.files?.[0])} />
            </label>
          </div>

          <label>
            Nome completo
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="button button-primary" type="submit"><Save size={16} /> Salvar perfil</button>
        </form>

        <form className="card profile-card" onSubmit={savePassword}>
          <div className="profile-section-title"><KeyRound /><div><h2>Alterar senha</h2><p>Use uma senha forte com pelo menos 8 caracteres.</p></div></div>
          <label>
            Senha atual
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          <label>
            Nova senha
            <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" required minLength={8} />
          </label>
          <button className="button button-primary" type="submit"><Save size={16} /> Atualizar senha</button>
        </form>
      </div>
    </div>
  );
}
