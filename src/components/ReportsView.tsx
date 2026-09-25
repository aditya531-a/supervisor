import { useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { download, type Workspace } from '../supervisor';

export default function ReportsView({ data }: { data: Workspace }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = data.cases.filter(record => record.status === 'under_review').length;
  const closed = data.cases.filter(record => record.status === 'closed').length;
  const verified = data.lab_reports.filter(report => report.verification_status === 'verified').length;
  const priorities = ['critical', 'urgent', 'normal'] as const;

  async function exportSummary() {
    setBusy(true);
    setError('');
    try { await download('export', 'jalsakshi-safe-summary.csv'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed. Try again.'); }
    finally { setBusy(false); }
  }

  return <div className="reports-layout">
    <section className="reports-summary">
      <h2>Current team activity</h2>
      <p>Counts from the loaded {data.profile.team_name} workspace{data.profile.dataMode === 'synthetic' ? ' · synthetic demonstration data' : ''}.</p>
      <table><tbody>
        <tr><th scope="row">Field screenings</th><td>{data.screening_records.length}</td></tr>
        <tr><th scope="row">Open cases</th><td>{open}</td></tr>
        <tr><th scope="row">Closed cases</th><td>{closed}</td></tr>
        <tr><th scope="row">Verified lab reports</th><td>{verified}</td></tr>
      </tbody></table>
      <h3>Cases by priority</h3>
      <table><tbody>{priorities.map(priority => <tr key={priority}><th scope="row">{priority[0].toUpperCase() + priority.slice(1)}</th><td>{data.cases.filter(record => record.priority === priority).length}</td></tr>)}</tbody></table>
    </section>
    <aside className="export-panel">
      <div className="export-panel__content">
        <h2>Share team totals.<br />Keep records private.</h2>
        <p>Download case counts by status and priority. The CSV includes the data mode so the figures stay in context.</p>
        <button className="primary-button" disabled={busy} onClick={() => void exportSummary()}><Download size={17} />{busy ? 'Preparing…' : 'Export aggregate CSV'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="export-panel__privacy"><ShieldCheck size={17} />Aggregate counts only. Case IDs, locations, contact details, evidence, and audit notes are excluded.</p>
      </div>
    </aside>
  </div>;
}
