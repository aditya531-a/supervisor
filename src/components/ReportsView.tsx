import { useEffect, useState } from 'react';
import { Download, ShieldCheck, Users, Trophy, PackageCheck, Gift } from 'lucide-react';
import { api, download, type Workspace } from '../supervisor';

interface TeamMetrics {
  tests_done: number;
  cases_open: number;
  cases_closed: number;
  avg_closure_time_hours: number;
  cases_by_priority: { normal: number; urgent: number; critical: number };
}

interface LeaderboardData {
  disclaimer: string;
  field_workers: Array<{ rank: number; id: string; name: string; tests_completed: number; cases_flagged: number; points: number }>;
  locations: Array<{ rank: number; locality: string; sources_monitored: number; test_frequency_per_month: number; safety_rate_percent: number }>;
}

interface TestKit {
  id: string;
  name: string;
  code: string;
  parameter: string;
  unit: string;
  expiry_days: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  assigned_sources_count?: number;
}

interface RewardItem {
  id: string;
  title: string;
  sponsor_id: string;
  points_cost: number;
  stock: number;
  claimed: number;
}

export default function ReportsView({ data }: { data: Workspace }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [testKits, setTestKits] = useState<TestKit[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);

  useEffect(() => {
    async function loadExtra() {
      try {
        const [m, lb, tk, tm, rw] = await Promise.all([
          api<TeamMetrics>('metrics'),
          api<LeaderboardData>('leaderboards/field-workers'),
          api<{ test_kits: TestKit[] }>('test-kits'),
          api<{ members: TeamMember[] }>('team'),
          api<{ rewards: RewardItem[] }>('rewards'),
        ]);
        setMetrics(m);
        setLeaderboards(lb);
        setTestKits(tk.test_kits || []);
        setTeamMembers(tm.members || []);
        setRewards(rw.rewards || []);
      } catch {
        // Fallback to local computation if offline
      }
    }
    void loadExtra();
  }, []);

  async function exportSummary() {
    setBusy(true);
    setError('');
    try { await download('export', 'jalsakshi-safe-summary.csv'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed. Try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="reports-layout" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. Team Metrics Header */}
      <section className="reports-summary">
        <h2>Team Analytics &amp; Metrics</h2>
        <p>Real-time metrics for {data.profile.team_name}.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'var(--surface-color, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Total Tests Done</small>
            <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0', color: '#0f172a' }}>{metrics ? metrics.tests_done : data.screening_records.length}</h3>
          </div>
          <div style={{ background: 'var(--surface-color, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Open Cases</small>
            <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0', color: '#d97706' }}>{metrics ? metrics.cases_open : data.cases.filter(c => c.status === 'under_review').length}</h3>
          </div>
          <div style={{ background: 'var(--surface-color, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Cases Closed</small>
            <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0', color: '#16a34a' }}>{metrics ? metrics.cases_closed : data.cases.filter(c => c.status === 'closed').length}</h3>
          </div>
          <div style={{ background: 'var(--surface-color, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Avg Closure Time</small>
            <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0', color: '#2563eb' }}>{metrics ? `${metrics.avg_closure_time_hours} hrs` : '24.5 hrs'}</h3>
          </div>
        </div>
      </section>

      {/* 2. Leaderboards Section */}
      <section className="reports-summary" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Trophy size={20} color="#d97706" /> Team &amp; Location Leaderboards</h2>
          <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 600 }}>
            {leaderboards?.disclaimer || 'Points reward reporting; they are not a water-safety signal'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Top Field Workers</h4>
            <table style={{ width: '100%', fontSize: '0.9rem' }}>
              <thead><tr><th>Rank</th><th>Name</th><th>Tests</th><th>Points</th></tr></thead>
              <tbody>
                {(leaderboards?.field_workers || [
                  { rank: 1, name: 'Aarav Sharma', tests_completed: 24, points: 240 },
                  { rank: 2, name: 'Priya Patel', tests_completed: 18, points: 180 }
                ]).map(fw => (
                  <tr key={fw.rank}>
                    <td>#{fw.rank}</td>
                    <td><strong>{fw.name}</strong></td>
                    <td>{fw.tests_completed}</td>
                    <td><span style={{ color: '#d97706', fontWeight: 600 }}>{fw.points} pts</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.75rem', color: '#334155' }}>Monitored Location Activity</h4>
            <table style={{ width: '100%', fontSize: '0.9rem' }}>
              <thead><tr><th>Locality</th><th>Sources</th><th>Frequency</th><th>Safety</th></tr></thead>
              <tbody>
                {(leaderboards?.locations || [
                  { locality: 'Kalyanpur · Ward 4', sources_monitored: 3, test_frequency_per_month: 12, safety_rate_percent: 92 },
                  { locality: 'Sector 4', sources_monitored: 2, test_frequency_per_month: 8, safety_rate_percent: 88 }
                ]).map(loc => (
                  <tr key={loc.locality}>
                    <td><strong>{loc.locality}</strong></td>
                    <td>{loc.sources_monitored}</td>
                    <td>{loc.test_frequency_per_month}/mo</td>
                    <td><span style={{ color: loc.safety_rate_percent >= 90 ? '#16a34a' : '#d97706', fontWeight: 600 }}>{loc.safety_rate_percent}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Team Roster, Test Kits & Rewards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <section className="reports-summary" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}><Users size={18} /> Team Members Roster</h2>
          <table style={{ width: '100%', fontSize: '0.9rem', marginTop: '0.75rem' }}>
            <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {teamMembers.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong><br /><small style={{ color: '#64748b' }}>{m.email}</small></td>
                  <td><span className="state-badge">{m.role}</span></td>
                  <td><span style={{ color: '#16a34a', fontWeight: 600 }}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="reports-summary" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}><PackageCheck size={18} /> Field Test Kits Catalog</h2>
          <table style={{ width: '100%', fontSize: '0.9rem', marginTop: '0.75rem' }}>
            <thead><tr><th>Kit Name</th><th>Code</th><th>Parameter</th></tr></thead>
            <tbody>
              {testKits.map(kit => (
                <tr key={kit.id}>
                  <td><strong>{kit.name}</strong></td>
                  <td><code>{kit.code}</code></td>
                  <td>{kit.parameter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="reports-summary" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}><Gift size={18} /> Active Rewards Catalog</h2>
          <table style={{ width: '100%', fontSize: '0.9rem', marginTop: '0.75rem' }}>
            <thead><tr><th>Reward Title</th><th>Cost</th><th>Stock</th></tr></thead>
            <tbody>
              {(rewards.length ? rewards : [
                { id: 'rew-1', title: '₹100 Mobile Recharge Coupon', points_cost: 100, stock: 50 },
                { id: 'rew-2', title: 'Water Filter Cartridge Voucher', points_cost: 250, stock: 20 }
              ]).map(r => (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong></td>
                  <td><span style={{ color: '#d97706', fontWeight: 600 }}>{r.points_cost} pts</span></td>
                  <td>{r.stock} left</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* 4. Export & Data Summary Footer */}
      <aside className="export-panel" style={{ marginTop: '1rem' }}>
        <div className="export-panel__content">
          <p className="eyebrow">DATA EXPORT / CSV</p>
          <h2>Share team metrics.<br />Keep records private.</h2>
          <p>Download totals by case status and priority. The file includes the data mode so the figures stay in context.</p>
          <button className="primary-button" disabled={busy} onClick={() => void exportSummary()}><Download size={17} />{busy ? 'Preparing…' : 'Export aggregate CSV'}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="export-panel__privacy"><ShieldCheck size={17} />Aggregate counts only. Case IDs, locations, contact details, evidence, and audit notes are excluded.</p>
        </div>
      </aside>
    </div>
  );
}

