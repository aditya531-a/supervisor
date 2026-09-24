import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Droplets, FolderKanban, LayoutDashboard, LogOut, PhoneIncoming, RefreshCw } from 'lucide-react';
import AuthGate from './components/AuthGate';
import SupervisorCasesView from './components/SupervisorCasesView';
import ReportsView from './components/ReportsView';
import WaterScene from './components/WaterScene';
import { api, ApiError, date, shortId, type Profile, type Workspace } from './supervisor';
import './dashboard.css';
import './supervisor.css';

type Screen = 'overview' | 'cases' | 'reports';

const navigation = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'cases' as const, label: 'Cases', icon: FolderKanban },
  { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
];

function Dashboard({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('overview');
  const [data, setData] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api<Workspace>('workspace');
      setData(result);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, body: unknown, method = 'POST') {
    setNotice('');
    try {
      await api(path, body, method);
      await load();
      setNotice('Saved. The case history has been updated.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await load();
        setError('Another supervisor changed this record. Review the refreshed evidence before trying again.');
      }
      throw reason;
    }
  }

  const open = data?.cases.filter(caseRecord => caseRecord.status === 'under_review') || [];
  const closed = data?.cases.filter(caseRecord => caseRecord.status === 'closed') || [];
  const complaints = data?.ivr_complaints.filter(complaint => complaint.status === 'new') || [];
  const priority = open.filter(caseRecord => caseRecord.priority !== 'normal');
  const queue = [...open].sort((a, b) => ({ critical: 0, urgent: 1, normal: 2 })[a.priority] - ({ critical: 0, urgent: 1, normal: 2 })[b.priority]);

  function openCase(id: string) {
    setSelected(id);
    setScreen('cases');
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <button className="identity sidebar-identity" onClick={() => setScreen('overview')} aria-label="JalSakshi overview">
          <span className="identity-icon"><Droplets size={25} strokeWidth={1.8} /></span>
          <span>JalSakshi<small>Water quality workspace</small></span>
        </button>
        <p className="nav-caption">Workspace</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} aria-current={screen === id ? 'page' : undefined} className={screen === id ? 'selected' : ''} onClick={() => setScreen(id)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>{id === 'cases' && open.length > 0 && <span className="nav-count">{open.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footnote">Evidence to action.<br />Source by source.</div>
        <div className="sidebar-bottom">
          <span className="avatar" aria-hidden="true">{profile.email.slice(0, 1).toUpperCase()}</span>
          <div><strong>Supervisor</strong><small>{profile.email}</small></div>
          <button className="logout" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={19} /></button>
        </div>
      </aside>

      <main className="dashboard-main" id="main-content">
        <header className="workspace-header">
          <div><strong>{profile.team_name}</strong><span className="breadcrumb">/ {navigation.find(item => item.id === screen)?.label}</span></div>
          <div className="workspace-tools"><span className="sample-label"><span aria-hidden="true" />{profile.dataMode === 'synthetic' ? 'Synthetic data' : 'Team data'}</span><button className="refresh-button" aria-label="Refresh workspace" title="Refresh workspace" disabled={loading} onClick={() => { setLoading(true); void load(); }}><RefreshCw size={17} className={loading ? 'is-refreshing' : undefined} /></button></div>
        </header>

        {screen === 'overview' ? (
          <section className="overview-hero" aria-labelledby="overview-heading">
            <div className="overview-hero__copy">
              <p className="overview-hero__district">{profile.team_name}</p>
              <h1 id="overview-heading">Your district,<br /><em>in focus.</em></h1>
              <p>Follow the evidence. Prioritize the cases that need review. Keep every decision accountable.</p>
            </div>
            <WaterScene compact />
            <span className="overview-hero__line" aria-hidden="true" />
          </section>
        ) : (
          <div className="page-intro">
            <div><h1>{screen === 'cases' ? 'Case workspace' : 'Reports & summaries'}</h1><p>{screen === 'cases' ? 'Review evidence, record action, and track each case to resolution.' : 'Current activity from your assigned team records.'}</p></div>
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="save-notice" role="status">{notice}</div>}
        {!data && !error && <p className="workspace-loading" role="status">Loading your team’s cases…</p>}

        {data && screen === 'overview' && <>
          <section className="overview-stats" aria-label="Team activity">
            {[
              { label: 'Open cases', value: open.length, hint: 'Awaiting review' },
              { label: 'Urgent / critical', value: priority.length, hint: 'Need attention' },
              { label: 'Verified closures', value: closed.length, hint: 'Evidence supported' },
              { label: 'New IVR complaints', value: complaints.length, hint: 'Awaiting linkage' },
            ].map(stat => <article key={stat.label}><strong>{stat.value}</strong><div><p>{stat.label}</p><small>{stat.hint}</small></div></article>)}
          </section>

          <div className="overview-grid">
            <section className="overview-panel priority-overview" aria-labelledby="queue-heading">
              <div className="panel-heading"><div><h2 id="queue-heading">Case review queue</h2><p>Open cases in priority order</p></div><button className="text-button" onClick={() => setScreen('cases')}>View all cases <ArrowRight size={17} /></button></div>
              <div className="attention-list">
                {queue.slice(0, 6).map(caseRecord => (
                  <button key={caseRecord.id} onClick={() => openCase(caseRecord.id)}>
                    <span className={`priority-dot ${caseRecord.priority}`} aria-hidden="true" />
                    <span className="attention-name"><strong>{data.water_sources.find(source => source.id === caseRecord.source_id)?.name || 'Water source'}</strong><small>{shortId(caseRecord.id)} <span aria-hidden="true">·</span> {date(caseRecord.created_at)}</small></span>
                    <span className={`state-badge ${caseRecord.priority}`}>{caseRecord.priority}</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                ))}
                {!queue.length && <p className="empty-state">No open cases in your team.</p>}
              </div>
            </section>

            <aside className="overview-side" aria-label="Attention and guidance">
              <div className="overview-side__top"><h2>Needs attention</h2><p>From current team records</p></div>
              <button className="attention-signal" onClick={() => setScreen('cases')}><PhoneIncoming size={21} /><span><strong>{complaints.length}</strong><small>New phone-in complaints</small></span><ArrowRight size={18} /></button>
              <div className="overview-side__guidance"><span className="overview-side__rule" /><h3>Evidence first.<br />Resolution next.</h3><p>A case can close only with a verified lab report or a completed linked retest, plus a recorded rationale.</p></div>
            </aside>
          </div>
        </>}

        {data && screen === 'cases' && <SupervisorCasesView data={data} selectedId={selected} onSelect={setSelected} onMutate={mutate} />}
        {data && screen === 'reports' && <ReportsView data={data} />}
      </main>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (cancelled) return;
        if (response.ok) { setProfile(await response.json()); setError(''); }
        else if (response.status === 401 || response.status === 403) {
          setProfile(null);
          if (response.status === 403) setError((await response.json()).error);
        }
      } catch {
        if (!cancelled) setError('Unable to reach the server. Check your connection and refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setProfile(null);
      setError('');
    } catch {
      setError('Could not sign out. Please try again.');
    }
  };

  if (loading) return <div className="auth-loading" role="status">Loading your workspace…</div>;
  return <>{error && <div className="session-error" role="alert">{error}</div>}{profile ? <Dashboard profile={profile} onLogout={logout} /> : <AuthGate onAuthenticated={setProfile} />}</>;
}
