import { PageHeader } from '../components/PageHeader';
import { DocumentImporterV2 } from '../components/documents/DocumentImporterV2';

export function DocumentsPage() {
  return (
    <div className="page">
      <PageHeader
        title="Central de documentos"
        description="Leia PDFs, imagens e prints financeiros, extraia dados e confirme lançamentos individuais."
      />
      <DocumentImporterV2 />
    </div>
  );
}
