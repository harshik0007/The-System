import { Navigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/public/PublicLayout.jsx';
import { legalDocuments } from '../../data/legalDocuments.js';
import '../../styles/public-pages.css';

export default function LegalPage() {
  const { slug } = useParams();
  const document = legalDocuments[slug];
  if (!document) return <Navigate to="/rules" replace />;
  return <PublicLayout title={document.title} description={`${document.title} — draft pending legal review.`} eyebrow="Policy documents" heading={document.title} intro="Draft — pending legal review. This page is not final legal advice or an approved legal policy.">
    <div className="legal-layout"><aside className="legal-meta"><span className="legal-draft-label">Draft pending legal review</span><p>Last updated</p><strong>{document.updated}</strong><nav aria-label="On this page"><span>Contents</span>{document.sections.map(([id, title]) => <a href={`#${id}`} key={id}>{title}</a>)}</nav></aside><article className="legal-document"><div className="legal-document__warning"><strong>Draft for discussion only</strong><p>Professional legal review and approved operator details are required before this document can be treated as final. This product is not ready to make a public legal-compliance claim.</p></div>{document.sections.map(([id, title, body]) => <section id={id} key={id}><h2>{title}</h2><p>{body}</p></section>)}</article></div>
  </PublicLayout>;
}
