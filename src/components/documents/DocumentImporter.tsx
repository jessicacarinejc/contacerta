import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  CheckCircle2,
  FileImage,
  FileText,
  LoaderCircle,
  LockKeyhole,
  ScanLine,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { PdfPasswordError, readFinancialDocument } from '../../lib/document-reader';
import { toCurrency } from '../../lib/currency';
import { useFinanceStore } from '../../store/useFinanceStore';
import { Badge, Button, Card, EmptyState, Progress } from '../ui';

const accepted = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.txt',
  '.csv',
  '.ofx',
  '.qfx',
  '.ofc',
  '.xml',
  '.json',
  '.ret',
  '.rem',
  '.xls',
  '.xlsx',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

const maxFileSizeMb = Number(import.meta.env.VITE_MAX_DOCUMENT_MB || 200);
const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

interface PasswordRequest {
  file: File;
  documentId: string;
  incorrect: boolean;
}

export function DocumentImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const documents = useFinanceStore((state) => state.documents);
  const addDocument = useFinanceStore((state) => state.addDocument);
  const updateDocument = useFinanceStore((state) => state.updateDocument);
  const approveDocument = useFinanceStore((state) => state.approveDocument);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);

  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id || null);
  const [message, setMessage] = useState('');
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [retryingPassword, setRetryingPassword] = useState(false);

  const selected = documents.find((item) => item.id === selectedId) || documents[0];
  const isInvoice = selected?.extracted?.documentType === 'invoice';
  const invoiceItems = isInvoice ? selected?.extracted?.items || [] : [];

  async function processFile(file: File, password?: string, existingId?: string) {
    if (file.size > maxFileSizeBytes) {
      setMessage(`O arquivo excede ${maxFileSizeMb} MB.`);
      return false;
    }

    const id =
      existingId ||
      addDocument({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        hash: '',
        status: 'processing',
        progress: 1,
      });

    if (existingId) {
      updateDocument(id, { status: 'processing', progress: 1, error: undefined });
    }

    setSelectedId(id);

    try {
      const result = await readFinancialDocument(
        file,
        (progress, current) => {
          updateDocument(id, { progress });
          setMessage(current);
        },
        password,
      );

      const duplicate = useFinanceStore
        .getState()
        .documents.find((item) => item.id !== id && item.hash === result.hash);

      updateDocument(id, {
        hash: result.hash,
        rawText: result.text,
        extracted: result.extracted,
        progress: 100,
        status: duplicate ? 'duplicate' : 'review',
        error: undefined,
      });

      setPasswordRequest(null);
      setPdfPassword('');
      const itemCount = result.extracted.items?.length || 0;
      setMessage(
        duplicate
          ? 'Documento possivelmente duplicado.'
          : result.extracted.documentType === 'invoice' && itemCount > 0
            ? `Fatura pronta para revisão: ${itemCount} compra(s) individual(is) detectada(s).`
            : 'Documento pronto para revisão.',
      );
      return true;
    } catch (error) {
      if (error instanceof PdfPasswordError) {
        const passwordMessage =
          error.reason === 'incorrect'
            ? 'Senha incorreta. Confira a senha do PDF e tente novamente.'
            : 'PDF protegido por senha. Informe a senha para continuar a leitura.';

        updateDocument(id, { status: 'error', progress: 100, error: passwordMessage });
        setPasswordRequest({ file, documentId: id, incorrect: error.reason === 'incorrect' });
        setMessage(passwordMessage);
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : 'Falha ao processar.';
      updateDocument(id, { status: 'error', progress: 100, error: errorMessage });
      setMessage(errorMessage);
      return false;
    }
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPasswordRequest(null);
    setPdfPassword('');
    if (file) void processFile(file);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    setPasswordRequest(null);
    setPdfPassword('');
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordRequest || !pdfPassword) return;

    setRetryingPassword(true);
    try {
      await processFile(passwordRequest.file, pdfPassword, passwordRequest.documentId);
    } finally {
      setRetryingPassword(false);
    }
  }

  return (
    <div className="documents-layout">
      <Card className="upload-panel">
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={42} />
          <h3>Envie um documento financeiro</h3>
          <p>
            Faturas, extratos, boletos, comprovantes, imagens, OFX/CSV e planilhas financeiras.
          </p>
          <Button type="button">Selecionar arquivo</Button>
          <small>
            PDF, imagens, TXT, CSV, OFX/QFX/OFC, XML, JSON, XLS/XLSX • até {maxFileSizeMb} MB
          </small>
          <input ref={inputRef} hidden type="file" accept={accepted} onChange={onFiles} />
        </div>

        {message && (
          <div className="processing-message">
            <ScanLine size={18} />
            {message}
          </div>
        )}

        {passwordRequest && (
          <form className="pdf-password-panel" onSubmit={submitPassword}>
            <div className="pdf-password-title">
              <LockKeyhole size={19} />
              <div>
                <strong>PDF protegido por senha</strong>
                <span>
                  {passwordRequest.incorrect
                    ? 'A senha anterior não abriu o arquivo.'
                    : 'Algumas faturas bancárias são entregues com proteção por senha.'}
                </span>
              </div>
            </div>
            <label>
              Senha do PDF
              <input
                type="password"
                value={pdfPassword}
                onChange={(event) => setPdfPassword(event.target.value)}
                autoComplete="off"
                placeholder="Digite a senha usada para abrir a fatura"
                autoFocus
              />
            </label>
            <small>A senha é usada somente nesta leitura e não é salva no Conta Certa.</small>
            <Button type="submit" disabled={!pdfPassword || retryingPassword}>
              {retryingPassword ? 'Abrindo PDF...' : 'Ler PDF protegido'}
            </Button>
          </form>
        )}

        <div className="document-history">
          <h3>Histórico de importações</h3>
          {documents.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="Nenhum documento"
              description="Os documentos processados aparecerão aqui."
            />
          ) : (
            documents.map((item) => (
              <button
                key={item.id}
                className={`document-row ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="document-file-icon">
                  {item.mimeType.startsWith('image/') ? <FileImage /> : <FileText />}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{(item.size / 1024).toLocaleString('pt-BR')} KB</small>
                </span>
                {item.status === 'processing' && <LoaderCircle className="spin" />}
                {item.status === 'approved' && <CheckCircle2 className="text-positive" />}
                {item.status === 'error' && <XCircle className="text-danger" />}
                {item.status === 'review' && <Badge tone="warning">Revisar</Badge>}
                {item.status === 'duplicate' && <Badge tone="danger">Duplicado</Badge>}
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="review-panel">
        {!selected ? (
          <EmptyState
            icon={<ScanLine />}
            title="Aguardando documento"
            description="Selecione ou envie um documento."
          />
        ) : selected.status === 'processing' ? (
          <div className="processing-state">
            <LoaderCircle className="spin" />
            <h2>Processando {selected.name}</h2>
            <Progress value={selected.progress} label={`${selected.progress}%`} />
          </div>
        ) : selected.status === 'error' ? (
          <div className="processing-state error">
            <XCircle />
            <h2>Erro na leitura</h2>
            <p>{selected.error}</p>
          </div>
        ) : (
          <>
            <header className="review-header">
              <div>
                <small>Documento detectado</small>
                <h2>{selected.name}</h2>
              </div>
              <Badge
                tone={
                  selected.status === 'duplicate'
                    ? 'danger'
                    : selected.status === 'approved'
                      ? 'positive'
                      : 'warning'
                }
              >
                {selected.status === 'duplicate'
                  ? 'Possível duplicidade'
                  : selected.status === 'approved'
                    ? 'Aprovado'
                    : 'Pendente de revisão'}
              </Badge>
            </header>

            <div className="confidence">
              <span>Confiança geral</span>
              <strong>{Math.round((selected.extracted?.confidence || 0) * 100)}%</strong>
              <Progress value={(selected.extracted?.confidence || 0) * 100} />
            </div>

            <div className="extracted-grid">
              <label>
                Tipo
                <strong>{selected.extracted?.documentType || 'Não identificado'}</strong>
              </label>
              <label>
                {isInvoice ? 'Total da fatura (referência)' : 'Valor'}
                <strong>
                  {selected.extracted?.value ? toCurrency(selected.extracted.value) : 'Revisar'}
                </strong>
              </label>
              <label>
                Vencimento
                <strong>
                  {selected.extracted?.dueDate
                    ? new Date(`${selected.extracted.dueDate}T12:00:00`).toLocaleDateString('pt-BR')
                    : 'Não encontrado'}
                </strong>
              </label>
              <label>
                Beneficiário
                <strong>{selected.extracted?.beneficiary || 'Não encontrado'}</strong>
              </label>
              <label className="span-2">
                Descrição
                <strong>{selected.extracted?.description || selected.name}</strong>
              </label>
              {selected.extracted?.barcode && !isInvoice && (
                <label className="span-2">
                  Linha digitável
                  <strong className="monospace">{selected.extracted.barcode}</strong>
                </label>
              )}
            </div>

            {isInvoice && (
              <section className="invoice-items-review">
                <div className="invoice-items-heading">
                  <div>
                    <small>Importação de fatura</small>
                    <h3>Compras individuais detectadas</h3>
                  </div>
                  <Badge tone={invoiceItems.length ? 'positive' : 'danger'}>
                    {invoiceItems.length} item(ns)
                  </Badge>
                </div>

                {invoiceItems.length === 0 ? (
                  <div className="invoice-items-warning">
                    <AlertDocument />
                    <div>
                      <strong>Nenhuma compra individual foi identificada com segurança.</strong>
                      <p>
                        Por proteção, o Conta Certa não lançará o valor total da fatura como uma única despesa.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="invoice-items-list">
                      {invoiceItems.map((item, index) => (
                        <div className="invoice-item-row" key={`${item.description}-${item.amount}-${index}`}>
                          <div>
                            <strong>{item.description}</strong>
                            <span>
                              {item.date
                                ? new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')
                                : 'Data não identificada'}
                              {item.installment
                                ? ` · Parcela ${item.installment.current}/${item.installment.total}`
                                : ''}
                            </span>
                          </div>
                          <b>{toCurrency(item.amount)}</b>
                        </div>
                      ))}
                    </div>
                    <div className="invoice-items-total">
                      <span>Soma dos itens reconhecidos</span>
                      <strong>{toCurrency(selected.extracted?.itemsTotal || 0)}</strong>
                    </div>
                    <p className="form-hint">
                      Cada item será criado como uma despesa separada. O total da fatura fica apenas como referência e não é lançado novamente.
                    </p>
                  </>
                )}
              </section>
            )}

            <details className="raw-text">
              <summary>Texto reconhecido</summary>
              <pre>{selected.rawText}</pre>
            </details>

            {accounts.length === 0 && (
              <div className="processing-message">
                <LandmarkMessage />
                Cadastre uma conta na aba Contas antes de confirmar o lançamento.
              </div>
            )}

            <div className="review-actions">
              <select
                id="doc-account"
                defaultValue={accounts[0]?.id}
                disabled={accounts.length === 0}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <select id="doc-category" defaultValue="cat_other">
                {categories
                  .filter((category) => category.type !== 'income')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
              <Button
                disabled={
                  accounts.length === 0 ||
                  (!selected.extracted?.value && !invoiceItems.length) ||
                  (isInvoice && invoiceItems.length === 0) ||
                  selected.status === 'approved'
                }
                onClick={() => {
                  const approved = approveDocument(
                    selected.id,
                    (document.getElementById('doc-account') as HTMLSelectElement)?.value,
                    (document.getElementById('doc-category') as HTMLSelectElement)?.value,
                  );
                  if (!approved) {
                    setMessage(
                      isInvoice
                        ? 'A fatura não foi lançada. É necessário identificar compras individuais antes da confirmação.'
                        : 'Não foi possível confirmar. Verifique a conta e a categoria.',
                    );
                  } else if (isInvoice) {
                    setMessage(`${invoiceItems.length} despesa(s) individual(is) criada(s) a partir da fatura.`);
                  } else {
                    setMessage('Lançamento confirmado.');
                  }
                }}
              >
                {selected.status === 'approved'
                  ? 'Lançamento confirmado'
                  : isInvoice && invoiceItems.length
                    ? `Confirmar ${invoiceItems.length} lançamentos`
                    : 'Confirmar lançamento'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function LandmarkMessage() {
  return <FileText size={18} />;
}

function AlertDocument() {
  return <XCircle size={20} />;
}
