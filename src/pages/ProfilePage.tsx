import { FormEvent, useState } from 'react';
import { Camera, ClipboardPaste, KeyRound, Landmark, Save, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { detectPixKeyType, parsePixPayload, sanitizePixKey } from '../lib/pix';
import type { PixKeyType } from '../types/finance';

async function optimizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 512;
  const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.82);
}

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(settings.pixKeyType || 'cpf');
  const [pixKey, setPixKey] = useState(settings.pixKey || '');
  const [pixHolderName, setPixHolderName] = useState(settings.pixHolderName || user.name);
  const [pixInstitution, setPixInstitution] = useState(settings.pixInstitution || '');
  const [pixCity, setPixCity] = useState(settings.pixCity || 'Salvador');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [showPixInReports, setShowPixInReports] = useState(
    settings.showPixInThirdPartyReports ?? true,
  );
  const [includePixQrCode, setIncludePixQrCode] = useState(settings.includePixQrCode ?? true);
  const [message, setMessage] = useState('');

  async function readAvatar(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessage('A imagem original deve ter no máximo 8 MB.');
      return;
    }

    try {
      const optimized = await optimizeAvatar(file);
      setAvatar(optimized);
      setMessage('Foto preparada. Clique em Salvar perfil para gravá-la.');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setAvatar(String(reader.result));
        setMessage('Foto preparada. Clique em Salvar perfil para gravá-la.');
      };
      reader.readAsDataURL(file);
    }
  }

  function importPixCopyPaste() {
    const parsed = parsePixPayload(pixCopyPaste);
    if (!parsed) {
      setMessage('Não foi possível reconhecer o PIX Copia e Cola informado.');
      return;
    }

    const keyType = detectPixKeyType(parsed.key);
    setPixKeyType(keyType);
    setPixKey(sanitizePixKey(parsed.key, keyType));
    if (parsed.merchantName) setPixHolderName(parsed.merchantName);
    if (parsed.merchantCity) setPixCity(parsed.merchantCity);
    setMessage('PIX reconhecido. Confira os dados abaixo e clique em Salvar dados PIX.');
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile({ name: name.trim(), email: email.trim().toLowerCase(), avatar });
    updateSettings({ userName: name.trim() });
    setMessage('Perfil e foto atualizados com sucesso.');
  }

  function savePix(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedKey = sanitizePixKey(pixKey, pixKeyType);
    if (!normalizedKey) {
      setMessage('Informe a chave PIX antes de salvar os dados de recebimento.');
      return;
    }
    if (pixKeyType === 'cpf' && normalizedKey.length !== 11) {
      setMessage('A chave PIX do tipo CPF deve possuir 11 dígitos.');
      return;
    }
    if (pixKeyType === 'cnpj' && normalizedKey.length !== 14) {
      setMessage('A chave PIX do tipo CNPJ deve possuir 14 dígitos.');
      return;
    }

    updateSettings({
      pixKeyType,
      pixKey: normalizedKey,
      pixHolderName: pixHolderName.trim() || name.trim(),
      pixInstitution: pixInstitution.trim(),
      pixCity: pixCity.trim() || 'Salvador',
      showPixInThirdPartyReports: showPixInReports,
      includePixQrCode,
    });
    setPixKey(normalizedKey);
    setPixCopyPaste('');
    setMessage('Dados PIX salvos. Eles poderão ser incluídos nos relatórios para terceiros.');
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
          <p>Gerencie seus dados pessoais, imagem, PIX e credenciais de acesso.</p>
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
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => void readAvatar(event.target.files?.[0])}
              />
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
          <button className="button button-primary" type="submit">
            <Save size={16} /> Salvar perfil
          </button>
        </form>

        <form className="card profile-card" onSubmit={savePix}>
          <div className="profile-section-title">
            <Landmark />
            <div>
              <h2>Dados para recebimento</h2>
              <p>Configure o PIX que poderá aparecer nos relatórios enviados a terceiros.</p>
            </div>
          </div>

          <label>
            PIX Copia e Cola
            <textarea
              rows={3}
              value={pixCopyPaste}
              onChange={(event) => setPixCopyPaste(event.target.value)}
              placeholder="Cole aqui um PIX Copia e Cola para preencher a chave, titular e cidade automaticamente"
            />
          </label>
          <button
            className="button button-secondary"
            type="button"
            onClick={importPixCopyPaste}
            disabled={!pixCopyPaste.trim()}
          >
            <ClipboardPaste size={16} /> Importar dados do PIX
          </button>

          <label>
            Tipo da chave PIX
            <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PixKeyType)}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="phone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="random">Chave aleatória</option>
            </select>
          </label>
          <label>
            Chave PIX
            <input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : 'Informe sua chave PIX'}
              autoComplete="off"
              required
            />
          </label>
          <label>
            Titular
            <input value={pixHolderName} onChange={(event) => setPixHolderName(event.target.value)} required />
          </label>
          <label>
            Instituição financeira
            <input
              value={pixInstitution}
              onChange={(event) => setPixInstitution(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Cidade do titular
            <input value={pixCity} onChange={(event) => setPixCity(event.target.value)} required />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPixInReports}
              onChange={(event) => setShowPixInReports(event.target.checked)}
            />
            Exibir PIX por padrão nos relatórios para terceiros
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={includePixQrCode}
              onChange={(event) => setIncludePixQrCode(event.target.checked)}
            />
            Incluir QR Code quando o PIX for exibido
          </label>
          <button className="button button-primary" type="submit">
            <Save size={16} /> Salvar dados PIX
          </button>
        </form>

        <form className="card profile-card" onSubmit={savePassword}>
          <div className="profile-section-title">
            <KeyRound />
            <div>
              <h2>Alterar senha</h2>
              <p>Use uma senha forte com pelo menos 8 caracteres.</p>
            </div>
          </div>
          <label>
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <button className="button button-primary" type="submit">
            <Save size={16} /> Atualizar senha
          </button>
        </form>
      </div>
    </div>
  );
}
