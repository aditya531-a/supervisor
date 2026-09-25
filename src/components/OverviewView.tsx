import { AlertTriangle, ArrowRight, Bell, Clock3, Download, Droplets, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { date, shortId, type Workspace } from '../supervisor';

type Destination = 'sources' | 'cases' | 'alerts' | 'reports';

export default function OverviewView({ data, onNavigate, onOpenCase }: { data: Workspace; onNavigate: (screen: Destination) => void; onOpenCase: (id: string) => void }) {
  const open = data.cases.filter(record => record.status === 'under_review');
  const highRisk = open.filter(record => record.priority !== 'normal');
  const pendingRetests = data.retests.filter(record => record.status === 'requested');
  const today = new Date().toDateString();
  const testsToday = data.screening_records.filter(record => new Date(record.captured_at).toDateString() === today).length;
  const sorted = [...open].sort((a, b) => ({ critical: 0, urgent: 1, normal: 2 })[a.priority] - ({ critical: 0, urgent: 1, normal: 2 })[b.priority]);
  const alerts = [
    ...highRisk.map(record => ({ id: record.id, title: record.priority === 'critical' ? 'Critical case needs review' : 'Urgent case needs review', subtitle: `${shortId(record.id)} — ${data.water_sources.find(source => source.id === record.source_id)?.name || 'Water source'}`, detail: record.origin === 'ivr' ? 'Phone report escalation' : 'Field screening flagged', kind: record.priority, time: date(record.created_at) })),
    ...data.ivr_complaints.filter(record => record.status === 'new').map(record => ({ id: record.id, title: 'Phone report awaiting linkage', subtitle: record.summary, detail: `Complaint ${shortId(record.id)}`, kind: 'urgent', time: date(record.received_at) })),
  ].slice(0, 5);
  const recent = [...data.cases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return <div className="reference-overview">
    <div className="reference-page-heading"><div><h1>Good morning, {data.profile.email.split('@')[0].split(/[._-]/)[0].replace(/^./, letter => letter.toUpperCase()) || 'Supervisor'}.</h1><p>Here’s what’s happening with water quality in {data.profile.team_name}.</p></div><p className="reference-quote">“Every test counts. Healthier communities begin with transparency.”</p></div>
    <section className="reference-kpis" aria-label="Team activity">
      <button onClick={() => onNavigate('sources')} className="reference-kpi"><span className="reference-kpi__icon blue"><Droplets size={31} fill="currentColor" /></span><span><small>Total Sources</small><strong>{data.water_sources.length}</strong><em>Team water sources</em></span></button>
      <button onClick={() => onNavigate('cases')} className="reference-kpi"><span className="reference-kpi__icon mint"><FlaskConical size={31} /></span><span><small>Tests Today</small><strong>{testsToday}</strong><em>{data.screening_records.length} team screenings</em></span></button>
      <button onClick={() => onNavigate('alerts')} className="reference-kpi"><span className="reference-kpi__icon coral"><Bell size={31} fill="currentColor" /></span><span><small>High-Risk Alerts</small><strong>{highRisk.length}</strong><em>Needs attention</em></span></button>
      <button onClick={() => onNavigate('cases')} className="reference-kpi"><span className="reference-kpi__icon amber"><RotateCcw size={31} /></span><span><small>Pending Retests</small><strong>{pendingRetests.length}</strong><em>Follow-up requested</em></span></button>
    </section>

    <div className="reference-overview__grid">
      <div className="reference-overview__left">
        <section className="reference-map-panel"><header><div><h2>Water Sources – {data.profile.team_name}</h2><p>Open case counts from current team records</p></div><button onClick={() => onNavigate('sources')}>View all <ArrowRight size={15} /></button></header><ul className="reference-source-summary">{data.water_sources.slice(0, 6).map(source => { const openCount = open.filter(record => record.source_id === source.id).length; return <li key={source.id}><strong>{source.name}</strong><small>{source.locality}</small><span>{openCount} open {openCount === 1 ? 'case' : 'cases'}</span></li>; })}</ul>{!data.water_sources.length && <p className="empty-state">No water sources have been added to this team.</p>}</section>
        <section className="reference-recent"><header><h2>Recent Cases</h2><button onClick={() => onNavigate('cases')}>View All <ArrowRight size={15} /></button></header><div className="reference-table-wrap"><table><thead><tr><th>Case ID</th><th>Location</th><th>Origin</th><th>Risk</th><th>Opened</th><th>Status</th></tr></thead><tbody>{recent.map(record => <tr key={record.id}><td><button className="reference-case-link" onClick={() => onOpenCase(record.id)} aria-label={`Open case ${shortId(record.id)}`}>{shortId(record.id)}</button></td><td>{data.water_sources.find(source => source.id === record.source_id)?.locality || '—'}</td><td>{record.origin === 'ivr' ? 'Phone report' : 'Field screening'}</td><td><span className={`reference-risk ${record.priority}`}>{record.priority}</span></td><td>{date(record.created_at)}</td><td>{record.status === 'closed' ? 'Closed' : 'Open'}</td></tr>)}</tbody></table></div>{!recent.length && <p className="empty-state">No cases recorded for this team.</p>}</section>
      </div>
      <div className="reference-overview__right">
        <section className="reference-alerts"><header><h2>Live Alerts &amp; Updates</h2><span>{alerts.length} new</span><button onClick={() => onNavigate('alerts')}>View All</button></header><div>{alerts.map(alert => <button key={alert.id} className="reference-alert" onClick={() => data.cases.some(record => record.id === alert.id) ? onOpenCase(alert.id) : onNavigate('cases')}><span className={`reference-alert__icon ${alert.kind}`}>{alert.kind === 'critical' ? <AlertTriangle size={24} fill="currentColor" /> : <Clock3 size={24} />}</span><span><strong>{alert.title}</strong><small>{alert.subtitle}</small><em>{alert.detail}</em></span><time>{alert.time}</time></button>)}{!alerts.length && <p className="empty-state">No urgent case or phone alerts right now.</p>}</div></section>
        <section className="reference-tasks"><header><h2>Open Tasks &amp; Assignments</h2><button onClick={() => onNavigate('cases')}>View All</button></header><div>{sorted.slice(0, 4).map((record, index) => <button key={record.id} onClick={() => onOpenCase(record.id)}><span className={`reference-task__icon task-${index % 4}`}>{index % 2 ? <FlaskConical size={19} /> : <ShieldCheck size={19} />}</span><span><strong>{record.origin === 'ivr' ? 'Review phone report' : 'Review field screening'} — {shortId(record.id)}</strong><small>{data.water_sources.find(source => source.id === record.source_id)?.name || 'Water source'}</small></span><em className={record.priority}>{record.priority === 'critical' ? 'Priority' : record.priority === 'urgent' ? 'Soon' : 'Open'}</em></button>)}{!sorted.length && <p className="empty-state">No open case assignments.</p>}</div></section>
        <button className="reference-download" onClick={() => onNavigate('reports')}><Download size={18} /> Export team summary <ArrowRight size={16} /></button>
      </div>
    </div>
  </div>;
}
