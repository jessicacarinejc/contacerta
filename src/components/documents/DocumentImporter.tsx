import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  CheckCircle2,
  FileImage,
  FileText,
  LoaderCircle,
  ScanLine,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { readFinancialDocument } from '../../lib/document-reader';
import { toCurrency } from '../../lib/currency';
import { useFinanceStore } from '../../store/useFinanceStore';
import { Badge, Button, Card, EmptyState, Progress } from '../ui';

const accepted = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const maxFileSizeMb = Number(import.meta.env.VITE_MAX_DOCUMENT_MB || 100);
const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

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

  const selected = documents.find((item) => item.id === selectedId) || documents[0];

  async function processFile(file: File) {
    if (file.size > maxFileSizeBytes) {
      setMessage(`O arquivo excede ${maxFileSizeMb} MB.`);
      return;
    }

    const id = addDocument({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      hash: '',
      status: 'processing',
      progress: 1,
    });
    setSelectedId(id);

    try {
      const result = await readFinancialDocument(file, (progress, current) => {
        updateDocument(id, { progress });
        setMessage(current);
      });
      const duplicate = useFinanceStore
        .getState()
        .documents.find((item) => item.id !== id && item.hash === result.hash);
      updateDocument(id, {
        hash: result.hash,
        rawText: result.text,
        extracted: result.extracted,
        progress: 100,
        status: duplicate ? 'duplicate' : 'review',
      });
      setMessage(
        duplicate ? 'Documento possivelmente duplicado.' : 'Documento pronto para revisão.',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao processar.';
      updateDocument(id, { status: 'error', progress: 100, error: errorMessage });
      setMessage(errorMessage);
    }
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
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
          <p>PDF com texto, PDF digitalizado, foto de boleto, extrato, fatura ou comprovante.</p>
          <Button type="button">Selecionar arquivo</Button>
          <small>PDF, JPG, JPEG, PNG ou WebP • até {maxFileSizeMb} MB</small>
          <input ref={inputRef} hidden type="file" accept={accepted} onChange={onFiles} />
        </div>

        {message && (
          <div className="processing-message">
            <ScanLine size={18} />
            {message}
          </div>
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
                  {item.mimeType.includes('pdf') ? <FileText /> : <FileImage />}
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
                Valor
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
              {selected.extracted?.barcode && (
                <label className="span-2">
                  Linha digitável
                  <strong className="monospace">{selected.extracted.barcode}</strong>
                </label>
              )}
            </div>

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
              <select id="doc-account" defaultValue={accounts[0]?.id} disabled={accounts.length === 0}>
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
                  accounts.length === 0 || !selected.extracted?.value || selected.status === 'approved'
                }
                onClick={() => {
                  const approved = approveDocument(
                    selected.id,
                    (document.getElementById('doc-account') as HTMLSelectElement)?.value,
                    (document.getElementById('doc-category') as HTMLSelectElement)?.value,
                  );
                  if (!approved) setMessage('Não foi possível confirmar. Verifique a conta e a categoria.');
                }}
              >
                {selected.status === 'approved' ? 'Lançamento confirmado' : 'Confirmar lançamento'}
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
