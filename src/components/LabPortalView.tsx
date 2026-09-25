import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, FlaskConical, MapPin } from 'lucide-react';
import { pump } from '../brandAssets';
import { date, shortId, type Workspace } from '../supervisor';

type Section = string;
export default function LabPortalView({ data, section, onOpenCase }: { data: Workspace; section: Section; onOpenCase: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState(data.screening_records[0]?.id || '');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const status = (id: string) => {
    const related = data.lab_reports.filter(report => report.screening_id === id);
    return related.some(report => report.verification_status === 'verified') ? 'Verified' : related.length ? 'Report uploaded' : 'Pending';
  };
  const queue = data.screening_records.filter(record => filter === 'all' || status(record.id) === filter);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(queue.length / 9) - 1));
  const visible = queue.slice(currentPage * 9, currentPage * 9 + 9);
  const selected = visible.find(record => record.id === selectedId) || visible[0];
  const selectedCase = data.cases.find(record => record.screening_id === selected?.id);
  const source = data.water_sources.find(record => record.id === selected?.source_id);
  const reports = data.lab_reports.filter(record => record.screening_id === selected?.id);
  const index = queue.findIndex(record => record.id === selected?.id);
  const audit = selectedCase ? data.audit_log.filter(record => record.entity_id === selectedCase.id).sort((a, b) => a.sequence - b.sequence) : [];
  useEffect(() => {
    if (section === 'labs') return;
    const selector = section === 'samples' ? '.reference-sample-details' : section === 'results' ? '.reference-lab-results' : section === 'audit' ? '.reference-lab-audit' : '';
    if (selector) requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ block: 'start' }));
  }, [section]);
  function move(amount: number) {
    const nextIndex = (index + amount + queue.length) % queue.length;
    const next = queue[nextIndex];
    if (next) { setSelectedId(next.id); setPage(Math.floor(nextIndex / 9)); }
  }
  return <div className="reference-lab" data-section={section}>
    <div className="reference-page-heading reference-lab-heading"><div><h1>Lab Portal</h1><p>Review field samples, uploaded reports, and case history.</p></div><p className="reference-quote">“Accurate testing today. Safer communities tomorrow.”</p></div>
    <div className="reference-lab-grid">
      <section className="reference-lab-queue">
        <header><h2>Sample Queue <span>({queue.length})</span></h2><select aria-label="Filter sample status" value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}><option value="all">All statuses</option><option>Pending</option><option>Report uploaded</option><option>Verified</option></select></header>
        <div className="reference-lab-queue__list">{visible.map(record => {
          const itemSource = data.water_sources.find(item => item.id === record.source_id);
          const related = data.cases.find(item => item.screening_id === record.id);
          return <button key={record.id} className={selected?.id === record.id ? 'selected' : ''} onClick={() => setSelectedId(record.id)}>
            <span className="reference-lab-queue__check">{selected?.id === record.id && <Check size={16} />}</span><span className={`reference-lab-dot ${related?.priority || 'normal'}`} />
            <span className="reference-lab-queue__name"><strong>{record.sample_code || shortId(record.id)}</strong><small>{itemSource?.locality || itemSource?.name || 'Unknown source'}</small><time>{date(record.captured_at)}</time></span>
            <span className="reference-lab-queue__badges"><em className={related?.priority || 'normal'}>{related?.priority === 'critical' ? 'High' : related?.priority === 'urgent' ? 'Medium' : 'Low'}</em><small>{status(record.id)}</small></span>
          </button>;
        })}{!visible.length && <p className="empty-state">No samples match this status.</p>}</div>
        <footer><span>{queue.length ? `${currentPage * 9 + 1}–${Math.min(currentPage * 9 + 9, queue.length)}` : '0'} of {queue.length} samples</span><div><button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} aria-label="Previous queue page"><ChevronLeft size={17} /></button><span>{currentPage + 1}</span><button onClick={() => setPage(currentPage + 1)} disabled={(currentPage + 1) * 9 >= queue.length} aria-label="Next queue page"><ChevronRight size={17} /></button></div></footer>
      </section>
      <div className="reference-lab-center">
        <section className="reference-sample-details">
          <header><h2>Sample Details</h2><div><button onClick={() => move(-1)} disabled={!selected}><ChevronLeft size={17} /> Previous</button><button onClick={() => move(1)} disabled={!selected}>Next <ChevronRight size={17} /></button></div></header>
          {selected ? <><div className="reference-sample-title"><h3>{selected.sample_code || shortId(selected.id)}</h3><span className={`reference-risk ${selectedCase?.priority || 'normal'}`}>{selectedCase?.priority || 'Normal'} priority</span><span className="reference-sample-status">{status(selected.id)}</span><button onClick={() => selectedCase && onOpenCase(selectedCase.id)} disabled={!selectedCase}>Open case record <ExternalLink size={15} /></button></div><p className="reference-sample-meta">Collected {date(selected.captured_at)} · Field worker {shortId(selected.created_by)}</p>
          <div className="reference-sample-cards">
            <article><h4><MapPin size={21} />Source Information</h4><dl><div><dt>Source ID</dt><dd>{shortId(selected.source_id)}</dd></div><div><dt>Source name</dt><dd>{source?.name || '—'}</dd></div><div><dt>Locality</dt><dd>{source?.locality || '—'}</dd></div><div><dt>Team</dt><dd>{data.profile.team_name}</dd></div></dl></article>
            <article className="reference-sample-illustration"><h4><FileText size={21} />Source Illustration</h4><img src={pump} alt="Illustration of a community hand pump" /><small>Field capture: {selected.capture_name || 'No photo attached'}</small></article>
            <article><h4><FlaskConical size={21} />Field Screening (Indicative)</h4><div className="reference-screening-note"><AlertTriangle size={20} /><span><strong>{status(selected.id) === 'Verified' ? 'Lab report verified' : reports.length ? 'Report awaiting verification' : 'Awaiting lab report'}</strong><small>Field results are indicative; the case record holds verified laboratory evidence.</small></span></div><dl><div><dt>Screening flag</dt><dd>{selected.screening_flag}</dd></div><div><dt>Field observation</dt><dd>{selected.human_observation || '—'}</dd></div></dl></article>
          </div></> : <p className="empty-state">{data.screening_records.length ? 'No sample matches this status.' : 'No field samples have been submitted.'}</p>}
        </section>
        <section className="reference-lab-results"><header><h2>Laboratory Reports</h2><span>{selected ? status(selected.id) : 'No sample'}</span></header>{reports.length ? <div className="reference-lab-report-list">{reports.map(report => <article key={report.id}><div><strong>{report.report_number}</strong><span className={`state-badge ${report.verification_status}`}>{report.verification_status === 'verified' ? 'Verified' : 'Uploaded · unverified'}</span></div><p>{report.result}</p><small>{report.lab_name} · Uploaded {date(report.uploaded_at)}</small></article>)}</div> : <p className="empty-state">{selected ? 'No laboratory report has been uploaded for this sample.' : 'Select a sample to review laboratory reports.'}</p>}{selectedCase && <button className="reference-lab-open-case" onClick={() => onOpenCase(selectedCase.id)}>Open case to manage reports <ExternalLink size={15} /></button>}</section>
      </div>
      <aside className="reference-lab-audit"><header><h2>Audit Trail</h2></header><div className="reference-lab-audit__events">{audit.map((entry, entryIndex) => <article key={entry.id}><span className={`reference-audit-icon icon-${entryIndex % 4}`}>{entryIndex % 2 ? <FlaskConical size={18} /> : <MapPin size={18} />}</span><time>{date(entry.occurred_at)}</time><strong>{entry.event.replaceAll('_', ' ').replace('.', ' · ')}</strong><p>by {entry.actor_id ? shortId(entry.actor_id) : 'System'}</p></article>)}{!audit.length && <p className="empty-state">No audit events for this sample’s case.</p>}</div></aside>
    </div>
  </div>;
}
