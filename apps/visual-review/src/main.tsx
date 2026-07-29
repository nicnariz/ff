import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { downloadExport, loadPortal, promote, saveReview, setToken } from './api';
import type { Capture, PortalData, ReviewerRole, ReviewStatus } from './types';
import './styles.css';

type Filters = {
  search: string;
  screen: string;
  device: string;
  theme: string;
  orientation: string;
  version: string;
  status: string;
};

const emptyFilters: Filters = {
  search: '', screen: '', device: '', theme: '', orientation: '', version: '', status: '',
};

function options(captures: Capture[], key: keyof Capture) {
  return [...new Set(captures.map((capture) => String(capture[key])))].sort();
}

function App() {
  const [data, setData] = useState<PortalData | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [identity, setIdentity] = useState({ name: '', role: 'QA' as ReviewerRole, token: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setData(await loadPortal());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar o portal.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => (data?.captures ?? []).filter((capture) => {
    const query = filters.search.toLowerCase();
    return (!query || capture.key.toLowerCase().includes(query))
      && (!filters.screen || capture.screen === filters.screen)
      && (!filters.device || capture.device === filters.device)
      && (!filters.theme || capture.theme === filters.theme)
      && (!filters.orientation || capture.orientation === filters.orientation)
      && (!filters.version || capture.version === filters.version)
      && (!filters.status || capture.review.status === filters.status);
  }), [data, filters]);

  const counts = useMemo(() => {
    const captures = data?.captures ?? [];
    return {
      total: captures.length,
      approved: captures.filter(({ review }) => review.status === 'APPROVED').length,
      notes: captures.filter(({ review }) => review.status === 'APPROVED_WITH_NOTES').length,
      rejected: captures.filter(({ review }) => review.status === 'REJECTED').length,
      pending: captures.filter(({ review }) => review.status === 'PENDING').length,
    };
  }, [data]);

  const authorize = () => {
    if (!identity.name.trim() || !identity.token.trim()) {
      setError('Informe nome e token de revisão.');
      return false;
    }
    setToken(identity.token.trim());
    return true;
  };

  const decide = async (capture: Capture, decision: Exclude<ReviewStatus, 'PENDING'>, comment: string) => {
    if (!authorize()) return;
    setBusy(true);
    try {
      const next = await saveReview({
        key: capture.key,
        decision,
        comment,
        reviewer: { name: identity.name.trim(), role: identity.role },
      });
      setData(next);
      setSelected(next.captures.find(({ key }) => key === capture.key) ?? null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registrar revisão.');
    } finally {
      setBusy(false);
    }
  };

  const requestPromotion = async () => {
    if (identity.role !== 'PRODUCT_OWNER' || !authorize()) {
      setError('A promoção exige identidade de Product Owner.');
      return;
    }
    if (!confirm('Promover as 168 capturas aprovadas para a baseline imutável 1.0.0?')) return;
    setBusy(true);
    try {
      const result = await promote({ reviewer: { name: identity.name.trim(), role: 'PRODUCT_OWNER' } });
      alert(result.message);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Promoção bloqueada.');
    } finally {
      setBusy(false);
    }
  };

  const requestReview = (capture: Capture) => {
    const title = encodeURIComponent(`[Visual Review] ${capture.key}`);
    const body = encodeURIComponent([
      `## Captura`,
      `- Chave: \`${capture.key}\``,
      `- SHA-256: \`${capture.hash}\``,
      `- Versão: ${capture.version}`,
      '',
      '## Decisão solicitada',
      '- [ ] APPROVED',
      '- [ ] APPROVED_WITH_NOTES',
      '- [ ] REJECTED',
      '',
      '## Comentário',
      '',
      '> A decisão deve seguir QA → Product Owner. A promoção da baseline não ocorre pelo portal público.',
    ].join('\n'));
    window.open(`https://github.com/nicnariz/ff/issues/new?title=${title}&body=${body}`, '_blank', 'noopener,noreferrer');
  };

  if (!data) return <main className="loading">{error || 'Carregando revisão visual…'}</main>;

  return <div className="app-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">FAMÍLIA FELIZ · QUALITY ENGINEERING</p>
        <h1>Visual Review Portal</h1>
      </div>
      <div className="release-meta">
        <span>Versão <b>{data.version}</b></span><span>Build <b>{data.build}</b></span>
        <span>Baseline <b>{data.baseline ?? 'não promovida'}</b></span>
      </div>
    </header>

    <section className="metrics" aria-label="Resumo da revisão">
      {[
        ['Capturas', counts.total], ['Aprovadas', counts.approved], ['Com notas', counts.notes],
        ['Rejeitadas', counts.rejected], ['Pendentes', counts.pending],
      ].map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>

    <section className="control-band">
      <div className="filters">
        <input aria-label="Pesquisar por nome" placeholder="Pesquisar por nome" value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        {([
          ['screen', 'Tela', options(data.captures, 'screen')],
          ['device', 'Dispositivo', options(data.captures, 'device')],
          ['theme', 'Tema', options(data.captures, 'theme')],
          ['orientation', 'Orientação', options(data.captures, 'orientation')],
          ['version', 'Versão', options(data.captures, 'version')],
          ['status', 'Status', ['PENDING', 'APPROVED', 'APPROVED_WITH_NOTES', 'REJECTED']],
        ] as const).map(([key, label, values]) => <select aria-label={label} key={key}
          value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}>
          <option value="">{label}: todos</option>{values.map((value) => <option key={value}>{value}</option>)}
        </select>)}
      </div>
      {!data.readOnly && <div className="identity">
        <input aria-label="Nome do revisor" placeholder="Nome do revisor" value={identity.name}
          onChange={(event) => setIdentity({ ...identity, name: event.target.value })} />
        <select aria-label="Papel do revisor" value={identity.role}
          onChange={(event) => setIdentity({ ...identity, role: event.target.value as ReviewerRole })}>
          <option value="QA">QA</option><option value="PRODUCT_OWNER">Product Owner</option>
        </select>
        <input aria-label="Token de revisão" type="password" placeholder="Token de revisão" value={identity.token}
          onChange={(event) => setIdentity({ ...identity, token: event.target.value })} />
      </div>}
      <div className="exports">
        {(['pdf', 'html', 'json', 'md'] as const).map((format) =>
          <button className="secondary" key={format} onClick={() => void downloadExport(format)}>
            Exportar {format.toUpperCase()}
          </button>)}
        <button disabled={busy || counts.approved !== counts.total || data.readOnly} onClick={() => void requestPromotion()}>
          Promover baseline
        </button>
      </div>
      {data.readOnly && <p className="security-note">
        Publicação remota em modo somente leitura. Aprovações exigem autenticação no GitHub e a promoção permanece bloqueada.
      </p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>

    <main className="capture-grid">
      {filtered.map((capture) => <button className="capture-card" key={capture.key} onClick={() => setSelected(capture)}>
        <img src={capture.candidateUrl} alt={`${capture.screen} em ${capture.device}`} loading="lazy" />
        <div className="card-copy"><div><strong>{capture.screen}</strong><span>{capture.device}</span></div>
          <Status value={capture.review.status} /></div>
        <dl><div><dt>Tema</dt><dd>{capture.theme}</dd></div><div><dt>Resolução</dt>
          <dd>{capture.resolution.width}×{capture.resolution.height}</dd></div></dl>
        <code title={capture.hash}>{capture.hash}</code>
        <time>{new Date(capture.capturedAt).toLocaleString('pt-BR')}</time>
      </button>)}
      {!filtered.length && <div className="empty">Nenhuma captura corresponde aos filtros.</div>}
    </main>

    {selected && <ReviewDialog capture={selected} busy={busy} role={identity.role} readOnly={data.readOnly}
      onClose={() => setSelected(null)} onDecision={decide} onRequestReview={requestReview} />}
  </div>;
}

function Status({ value }: { value: ReviewStatus }) {
  return <span className={`status status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>;
}

function ReviewDialog({ capture, busy, role, readOnly, onClose, onDecision, onRequestReview }: {
  capture: Capture;
  busy: boolean;
  role: ReviewerRole;
  readOnly: boolean;
  onClose: () => void;
  onDecision: (capture: Capture, decision: Exclude<ReviewStatus, 'PENDING'>, comment: string) => Promise<void>;
  onRequestReview: (capture: Capture) => void;
}) {
  const [mode, setMode] = useState<'candidate' | 'mockup' | 'overlay'>('overlay');
  const [opacity, setOpacity] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [comment, setComment] = useState(capture.review.comment ?? '');
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const move = (event: React.PointerEvent) => {
    if (!drag) return;
    setOffset({ x: offset.x + event.clientX - drag.x, y: offset.y + event.clientY - drag.y });
    setDrag({ x: event.clientX, y: event.clientY });
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="review-dialog" role="dialog" aria-modal="true" aria-label={`Revisão de ${capture.key}`}>
      <header><div><p>{capture.device} · {capture.theme} · {capture.resolution.width}×{capture.resolution.height}</p>
        <h2>{capture.screen}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}>×</button></header>
      <div className="viewer-toolbar">
        {(['candidate', 'mockup', 'overlay'] as const).map((value) =>
          <button className={mode === value ? 'active' : 'secondary'} key={value} onClick={() => setMode(value)}>{value}</button>)}
        <label>Overlay <input type="range" min="0" max="100" value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))} /></label>
        <button className="secondary" onClick={() => setZoom(Math.max(.5, zoom - .25))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="secondary" onClick={() => setZoom(Math.min(4, zoom + .25))}>+</button>
        <button className="secondary" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Redefinir</button>
      </div>
      <div className="review-body">
        <div className="viewer" onPointerDown={(event) => setDrag({ x: event.clientX, y: event.clientY })}
          onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
          <div className="canvas" style={{ transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}>
            {mode !== 'candidate' && <img src={capture.mockupUrl} alt="Mockup correspondente" />}
            {mode !== 'mockup' && <img className={mode === 'overlay' ? 'overlay-image' : ''}
              style={{ opacity: mode === 'overlay' ? opacity / 100 : 1 }} src={capture.candidateUrl} alt="Imagem candidata" />}
          </div>
        </div>
        <aside>
          <Status value={capture.review.status} />
          <dl className="technical">
            <div><dt>Hash SHA-256</dt><dd><code>{capture.hash}</code></dd></div>
            <div><dt>Captura</dt><dd>{new Date(capture.capturedAt).toLocaleString('pt-BR')}</dd></div>
            <div><dt>Versão</dt><dd>{capture.version}</dd></div>
            <div><dt>QA</dt><dd>{capture.review.qa?.name ?? 'Pendente'}</dd></div>
            <div><dt>Product Owner</dt><dd>{capture.review.productOwner?.name ?? 'Pendente'}</dd></div>
          </dl>
          <h3>Comentários</h3>
          <div className="comments">{capture.review.comments?.map((item) =>
            <div key={item.id}><b>{item.author}</b><span>{item.role}</span><p>{item.message}</p></div>)}
            {!capture.review.comments?.length && <p>Nenhum comentário registrado.</p>}</div>
          <textarea aria-label="Comentário da revisão" placeholder="Descreva diferenças ou justificativas"
            value={comment} onChange={(event) => setComment(event.target.value)} />
          {readOnly
            ? <div className="decision-actions">
                <button onClick={() => onRequestReview(capture)}>Solicitar revisão no GitHub</button>
              </div>
            : <div className="decision-actions">
                <button disabled={busy} onClick={() => void onDecision(capture, 'APPROVED', comment)}>Aprovar</button>
                {role === 'PRODUCT_OWNER' && <button className="warning" disabled={busy || !comment.trim()}
                  onClick={() => void onDecision(capture, 'APPROVED_WITH_NOTES', comment)}>Aprovar com notas</button>}
                <button className="danger" disabled={busy || !comment.trim()}
                  onClick={() => void onDecision(capture, 'REJECTED', comment)}>Rejeitar</button>
              </div>}
        </aside>
      </div>
    </section>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
