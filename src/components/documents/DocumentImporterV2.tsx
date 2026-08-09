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
import {
  PdfPasswordError,
  readFinancialDocumentRefined,
  readFinancialImageRefined,
} from '../../lib/document-reader-refined';
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
const imageNamePattern = /\.(?:jpe?g|png|webp|bmp)$/i;

interface PasswordRequest {
  file: File;
  documentId: string;
  incorrect: boolean;
}

function isImageInput(file: File) {
  return file.type.startsWith('image/') || imageNamePattern.test(file.name);
}

function isStoredImage(name: string, mimeType: string) {
  return mimeType.startsWith('image/') || imageNamePattern.test(name);
}

export function DocumentImporterV2() {
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
  const [thirdParty, setThirdParty] = useState('');
  const [thirdPartiesByItem, setThirdPartiesByItem] = useState<Record<number, string>>({});

  const selected = documents.find((item) => item.id === selectedId) || documents[0];
  const isInvoice = selected?.extracted?.documentType === 'invoice';
  const invoiceItems = isInvoice ? selected?.extracted?.items || [] : [];
  const futureInvoiceItems = isInvoice ? selected?.extracted?.futureItems || [] : [];
  const selectedIsImage = selected ? isStoredImage(selected.name, selected.mimeType) : false;
  const isImageTransactionList = selectedIsImage && isInvoice && invoiceItems.length >= 2;
  const displayedValue = isInvoice
    ? selected?.extracted?.itemsTotal
    : selected?.extracted?.value;
  const projectedFutureCount = invoiceItems.reduce((total, item) => {
    if (!item.installment || item.installment.current >= item.installment.total) return total;
    return total + (item.installment.total - item.installment.current);
  }, 0);

  function resetThirdPartyFields() {
    setThirdParty('');
    setThirdPartiesByItem({});
  }

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
      const onProgress = (progress: number, current: string) => {
        updateDocument(id, { progress });
        setMessage(current);
      };

      const result = isImageInput(file)
        ? await readFinancialImageRefined(file, onProgress)
        : await readFinancialDocumentRefined(file, onProgress, password);

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
      resetThirdPartyFields();
      const itemCount = result.extracted.items?.length || 0;
      setMessage(
        duplicate
          ? 'Documento possivelmente duplicado.'
          : result.extracted.documentType === 'invoice' && itemCount > 0
            ? `Fatura pronta para revisão: ${itemCount} despesa(s) individual(is). Pagamentos e créditos foram ignorados.`
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
    resetThirdPartyFields();
    if (file) void processFile(file);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    setPasswordRequest(null);
    setPdfPassword('');
    resetThirdPartyFields();
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
            Faturas, extratos, boletos, comprovantes, imagens e prints com listas de movimentações.
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
                onClick={() => {
                  setSelectedId(item.id);
                  resetThirdPartyFields();
                }}
              >
                <span className="document-file-icon">
                  {isStoredImage(item.name, item.mimeType) ? <FileImage /> : <FileText />}
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
                <strong>
                  {isImageTransactionList
                    ? 'lista de despesas'
                    : selected.extracted?.documentType || 'Não identificado'}
                </strong>
              </label>
              <label>
                {isInvoice ? 'Total das despesas desta fatura' : 'Valor'}
                <strong>{displayedValue ? toCurrency(displayedValue) : 'Revisar'}</strong>
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
                    <small>Somente despesas</small>
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
                      <strong>Nenhuma despesa individual foi identificada com segurança.</strong>
                      <p>
                        Por proteção, o Conta Certa não lançará saldo anterior, pagamento, crédito, limite ou total isolado como despesa.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="invoice-items-list">
                      {invoiceItems.map((item, index) => {
                        const metadata = [
                          item.date
                            ? new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')
                            : 'Data não identificada',
                          item.time,
                          item.cardLastDigits ? `Final ${item.cardLastDigits}` : undefined,
                          item.installment
                            ? `Parcela ${item.installment.current}/${item.installment.total}`
                            : undefined,
                        ].filter(Boolean);

                        return (
                          <div
                            className="invoice-item-row"
                            key={`${item.description}-${item.amount}-${item.date || ''}-${item.time || ''}-${index}`}
                          >
                            <div className="invoice-item-details">
                              <strong>{item.description}</strong>
                              <span>{metadata.join(' · ')}</span>
                              <input
                                className="invoice-third-party-input"
                                value={thirdPartiesByItem[index] || ''}
                                onChange={(event) =>
                                  setThirdPartiesByItem((current) => ({
                                    ...current,
                                    [index]: event.target.value,
                                  }))
                                }
                                placeholder="Compra para terceiro (opcional)"
                                aria-label={`Terceiro da despesa ${item.description}`}
                              />
                            </div>
                            <b>{toCurrency(item.amount)}</b>
                          </div>
                        );
                      })}
                    </div>
                    <div className="invoice-items-total">
                      <span>Total das despesas reconhecidas</span>
                      <strong>{toCurrency(selected.extracted?.itemsTotal || 0)}</strong>
                    </div>
                    <p className="form-hint">
                      Pagamentos da fatura anterior, créditos, estornos, saldo anterior, limites, subtotais e totais informativos são ignorados. Cada compra será lançada separadamente.
                    </p>
                  </>
                )}

                {(futureInvoiceItems.length > 0 || projectedFutureCount > 0) && (
                  <div className="processing-message">
                    <FileText size={18} />
                    {projectedFutureCount} parcela(s) futura(s) serão criadas na aba Lançamentos futuros.
                    {futureInvoiceItems.length > 0
                      ? ` A própria fatura informou ${futureInvoiceItems.length} parcela(s) da próxima fatura e esses valores serão usados quando houver correspondência.`
                      : ''}
                  </div>
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
              {isInvoice && (
                <input
                  value={thirdParty}
                  onChange={(event) => setThirdParty(event.target.value)}
                  placeholder="Terceiro padrão para todas (opcional)"
                  aria-label="Terceiro padrão para todas as despesas"
                />
              )}
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
                    thirdParty,
                    thirdPartiesByItem,
                  );
                  if (!approved) {
                    setMessage(
                      isInvoice
                        ? 'O documento não foi lançado. É necessário identificar despesas individuais antes da confirmação.'
                        : 'Não foi possível confirmar. Verifique a conta e a categoria.',
                    );
                  } else if (isInvoice) {
                    setMessage(
                      `${invoiceItems.length} despesa(s) atual(is) criada(s) e ${projectedFutureCount} parcela(s) futura(s) projetada(s).`,
                    );
                  } else {
                    setMessage('Lançamento confirmado.');
                  }
                }}
              >
                {selected.status === 'approved'
                  ? 'Lançamento confirmado'
                  : isInvoice && invoiceItems.length
                    ? `Confirmar ${invoiceItems.length} despesas`
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
