import { useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { download, type Workspace } from '../supervisor';

export default function ReportsView({ data }: { data: Workspace }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = [
    ['All cases', data.cases.length],
    ['Under review', data.cases.filter(record => record.status === 'under_review').length],
    ['Closed', data.cases.filter(record => record.status === 'closed').length],
    ['Verified lab reports', data.lab_reports.filter(record => record.verification_status === 'verified').length],
    ['Completed retests', data.retests.filter(record => record.status === 'completed').length],
    ['Delivered resident updates', data.resident_communications.filter(record => record.delivery_status === 'delivered').length],
  ];

  async function exportSummary() {
    setBusy(true);
    setError('');
    try { await download('export', 'jalsakshi-safe-summary.csv'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed. Try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="reports-layout">
      <section className="reports-summary">
        <h2>Current team activity</h2>
        <p>Counts from stored records in {data.profile.team_name}.</p>
        {data.profile.dataMode === 'synthetic' && <p>These are synthetic demonstration records, not real district outcomes.</p>}
        <table>
          <thead><tr><th scope="col">Recorded metric</th><th scope="col">Count</th></tr></thead>
          <tbody>{rows.map(([label, count]) => <tr key={label}><th scope="row">{label}</th><td>{count}</td></tr>)}</tbody>
        </table>
      </section>
      <aside className="export-panel">
        <div className="export-panel__content">
          <p className="eyebrow">DATA EXPORT / CSV</p>
          <h2>Share the counts.<br />Keep records private.</h2>
          <p>Download totals by case status and priority. The file includes the data mode so the figures stay in context.</p>
          <button className="primary-button" disabled={busy} onClick={() => void exportSummary()}><Download size={17} />{busy ? 'Preparing…' : 'Export aggregate CSV'}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="export-panel__privacy"><ShieldCheck size={17} />Aggregate counts only. Case IDs, locations, contact details, evidence, and audit notes are excluded.</p>
        </div>
      </aside>
    </div>
  );
}
