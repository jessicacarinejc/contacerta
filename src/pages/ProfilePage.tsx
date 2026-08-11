import { FormEvent, useEffect, useState } from 'react';
import {
  Camera,
  ClipboardPaste,
  KeyRound,
  Landmark,
  QrCode,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
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

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
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
  const [pixCopyPaste, setPixCopyPaste] = useState(settings.pixPayload || '');
  const [pixPayload, setPixPayload] = useState(settings.pixPayload || '');
  const [pixQrCodeImage, setPixQrCodeImage] = useState(settings.pixQrCodeImage || '');
  const [showPixInReports, setShowPixInReports] = useState(
    settings.showPixInThirdPartyReports ?? true,
  );
  const [includePixQrCode, setIncludePixQrCode] = useState(settings.includePixQrCode ?? true);
  const [message, setMessage] = useState('');

  // O armazenamento do Tauri/Zustand é assíncrono no Android. Sem esta sincronização,
  // a tela podia montar com os valores padrão e continuar exibindo campos vazios mesmo
  // depois de o estado persistido ter sido restaurado corretamente.
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setAvatar(user.avatar ?? '');
  }, [user.name, user.email, user.avatar]);

  useEffect(() => {
    setPixKeyType(settings.pixKeyType || 'cpf');
    setPixKey(settings.pixKey || '');
    setPixHolderName(settings.pixHolderName || user.name);
    setPixInstitution(settings.pixInstitution || '');
    setPixCity(settings.pixCity || 'Salvador');
    setPixCopyPaste(settings.pixPayload || '');
    setPixPayload(settings.pixPayload || '');
    setPixQrCodeImage(settings.pixQrCodeImage || '');
    setShowPixInReports(settings.showPixInThirdPartyReports ?? true);
    setIncludePixQrCode(settings.includePixQrCode ?? true);
  }, [
    settings.pixKeyType,
    settings.pixKey,
    settings.pixHolderName,
    settings.pixInstitution,
    settings.pixCity,
    settings.pixPayload,
    settings.pixQrCodeImage,
    settings.showPixInThirdPartyReports,
    settings.includePixQrCode,
    user.name,
  ]);

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
      try {
        setAvatar(await readImageAsDataUrl(file));
        setMessage('Foto preparada. Clique em Salvar perfil para gravá-la.');
      } catch {
        setMessage('Não foi possível carregar a foto selecionada.');
      }
    }
  }

  async function readPixQrCode(file?: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setMessage('A imagem do QR Code deve ter no máximo 3 MB.');
      return;
    }

    try {
      const dataUrl = await readImageAsDataUrl(file);
      setPixQrCodeImage(dataUrl);
      setMessage('QR Code preparado. Clique em Salvar dados PIX para gravá-lo.');
    } catch {
      setMessage('Não foi possível carregar a imagem do QR Code.');
    }
  }

  function importPixCopyPaste() {
    const cleanedPayload = pixCopyPaste.replace(/[\r\n\t]+/g, '').trim();
    const parsed = parsePixPayload(cleanedPayload);
    if (!parsed) {
      setMessage('Não foi possível reconhecer o PIX Copia e Cola informado.');
      return;
    }

    const keyType = detectPixKeyType(parsed.key);
    setPixKeyType(keyType);
    setPixKey(sanitizePixKey(parsed.key, keyType));
    setPixPayload(cleanedPayload);
    setPixCopyPaste(cleanedPayload);
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
    if (!normalizedKey && !pixPayload && !pixQrCodeImage) {
      setMessage('Informe uma chave PIX, um PIX Copia e Cola ou uma imagem do QR Code.');
      return;
    }
    if (normalizedKey && pixKeyType === 'cpf' && normalizedKey.length !== 11) {
      setMessage('A chave PIX do tipo CPF deve possuir 11 dígitos.');
      return;
    }
    if (normalizedKey && pixKeyType === 'cnpj' && normalizedKey.length !== 14) {
      setMessage('A chave PIX do tipo CNPJ deve possuir 14 dígitos.');
      return;
    }

    updateSettings({
      pixKeyType,
      pixKey: normalizedKey,
      pixHolderName: pixHolderName.trim() || name.trim(),
      pixInstitution: pixInstitution.trim(),
      pixCity: pixCity.trim() || 'Salvador',
      pixPayload: pixPayload.trim(),
      pixQrCodeImage,
      showPixInThirdPartyReports: showPixInReports,
      includePixQrCode,
    });
    setPixKey(normalizedKey);
    setPixCopyPaste(pixPayload.trim());
    setMessage('Dados PIX e QR Code salvos com sucesso para uso nos relatórios.');
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
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
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
              <p>Configure o PIX e o QR Code que poderão aparecer nos relatórios para terceiros.</p>
            </div>
          </div>

          <label>
            PIX Copia e Cola
            <textarea
              rows={3}
              value={pixCopyPaste}
              onChange={(event) => {
                setPixCopyPaste(event.target.value);
                setPixPayload('');
              }}
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
            <select
              value={pixKeyType}
              onChange={(event) => {
                setPixKeyType(event.target.value as PixKeyType);
                setPixPayload('');
              }}
            >
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
              onChange={(event) => {
                setPixKey(event.target.value);
                setPixPayload('');
              }}
              placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : 'Informe sua chave PIX'}
              autoComplete="off"
            />
          </label>
          <label>
            Titular
            <input
              value={pixHolderName}
              onChange={(event) => setPixHolderName(event.target.value)}
              required
            />
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

          <div className="profile-section-title">
            <QrCode />
            <div>
              <h2>QR Code do PIX</h2>
              <p>Você pode anexar o QR Code do banco para ele aparecer diretamente no relatório.</p>
            </div>
          </div>
          {pixQrCodeImage && (
            <div className="profile-avatar-editor">
              <div className="profile-avatar-large">
                <img src={pixQrCodeImage} alt="QR Code PIX cadastrado" />
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setPixQrCodeImage('');
                  setMessage('QR Code removido. Clique em Salvar dados PIX para confirmar.');
                }}
              >
                <Trash2 size={16} /> Remover QR Code
              </button>
            </div>
          )}
          <label className="button button-secondary">
            <QrCode size={16} /> {pixQrCodeImage ? 'Trocar QR Code' : 'Adicionar QR Code'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => void readPixQrCode(event.target.files?.[0])}
            />
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
