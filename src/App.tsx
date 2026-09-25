import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, CloudUpload, FileText, FlaskConical, History, House, LogOut, MapPin, Menu, Search, Settings, X } from 'lucide-react';
import AuthGate from './components/AuthGate';
import OverviewView from './components/OverviewView';
import LabPortalView from './components/LabPortalView';
import SupervisorCasesView from './components/SupervisorCasesView';
import ReportsView from './components/ReportsView';
import { labLandscape, riverLandscape, logo } from './brandAssets';
import { api, ApiError, type Profile, type Workspace } from './supervisor';
import './supervisor.css';
import './reference.css';

type Screen = 'overview' | 'sources' | 'cases' | 'alerts' | 'labs' | 'samples' | 'results' | 'reports' | 'audit' | 'settings';
const supervisorNav = [
  { id: 'overview', label: 'Overview', icon: House }, { id: 'sources', label: 'Sources', icon: MapPin },
  { id: 'cases', label: 'Cases', icon: FileText }, { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'labs', label: 'Labs', icon: FlaskConical }, { id: 'reports', label: 'Reports', icon: ChartNoAxesColumnIncreasing },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
const labNav = [
  { id: 'overview', label: 'Overview', icon: House }, { id: 'labs', label: 'Queue', icon: FlaskConical },
  { id: 'samples', label: 'Samples', icon: FileText }, { id: 'results', label: 'Results', icon: ChartNoAxesColumnIncreasing },
  { id: 'reports', label: 'Reports', icon: FileText }, { id: 'audit', label: 'Audit Trail', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

function Dashboard({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('overview');
  const [data, setData] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [labMode, setLabMode] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const load = useCallback(async () => {
    try { setData(await api<Workspace>('workspace')); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the workspace.'); }
    finally { setLoading(false); }
  }, []);
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function mutate(path: string, body: unknown, method = 'POST') {
    setNotice('');
    try { await api(path, body, method); await load(); setNotice('Saved. The case history has been updated.'); }
    catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await load(); setError('Another supervisor changed this record. Review the refreshed evidence before trying again.');
      }
      throw reason;
    }
  }
  function navigate(next: Screen) {
    if (['labs', 'samples', 'results', 'audit'].includes(next)) setLabMode(true);
    if (['overview', 'sources', 'cases', 'alerts'].includes(next)) setLabMode(false);
    setScreen(next); setMenuOpen(false); setQuery('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openCase(id: string) { setSelected(id); navigate('cases'); }
  const nav = labMode ? labNav : supervisorNav;
  const newAlerts = data ? data.cases.filter(record => record.status === 'under_review' && record.priority !== 'normal').length + data.ivr_complaints.filter(record => record.status === 'new').length : 0;
  const matches = data && query.trim() ? [
    ...data.water_sources.filter(source => `${source.name} ${source.locality} ${source.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map(source => ({ id: source.id, name: source.name, detail: source.locality, kind: 'source' })),
    ...data.cases.filter(record => record.id.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map(record => ({ id: record.id, name: record.id, detail: record.priority, kind: 'case' })),
  ] : [];
  const inPeriod = (value: string) => value.slice(0, 10) >= startDate && value.slice(0, 10) <= endDate;
  const periodData = data && startDate && endDate ? {
    ...data,
    cases: data.cases.filter(record => inPeriod(record.created_at)),
    screening_records: data.screening_records.filter(record => inPeriod(record.captured_at)),
    ivr_complaints: data.ivr_complaints.filter(record => inPeriod(record.received_at)),
    retests: data.retests.filter(record => inPeriod(record.requested_at)),
  } : data;
  return <div className={`reference-workspace ${labMode ? 'is-lab' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className={`reference-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <button className="reference-sidebar__brand" onClick={() => navigate('overview')} aria-label="JalSakshi overview"><img src={logo} alt="" /><span>JalSakshi<small>Water quality workspace</small></span></button>
      <nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={screen === id ? 'selected' : ''} aria-current={screen === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={26} strokeWidth={1.8} /><span>{label}</span>{id === 'alerts' && newAlerts > 0 && <em>{newAlerts}</em>}</button>)}</nav>
      <div className="reference-sidebar__scene" style={{ backgroundImage: `url(${labMode ? labLandscape : riverLandscape})` }} aria-hidden="true" />
      <p className="reference-sidebar__motto">Clean Water<br />Stronger Communities<span /><small>A Safer, Healthier<br />Tomorrow</small></p>
      <button className="reference-sidebar__logout" onClick={onLogout}><LogOut size={17} /> Sign out</button>
    </aside>
    {menuOpen && <button className="reference-menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <div className="reference-main-column">
      <header className="reference-topbar">
        <button className="reference-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X /> : <Menu />}</button>
        <div className="reference-search"><Search size={22} /><input type="search" aria-label="Search sources and cases" placeholder={labMode ? 'Search samples' : 'Search sources'} value={query} onChange={event => setQuery(event.target.value)} /><kbd>⌘ K</kbd>{query && <div className="reference-search__results">{matches.length ? matches.map(match => <button key={`${match.kind}-${match.id}`} onClick={() => { if (match.kind === 'case') openCase(match.id); else navigate('sources'); }}><strong>{match.name}</strong><small>{match.kind} · {match.detail}</small></button>) : <p>No matching sources or cases.</p>}</div>}</div>
        <button className="reference-topbar__district" onClick={() => navigate('sources')}><MapPin size={23} /><span>{labMode ? `${profile.team_name} Lab` : profile.team_name}</span><ChevronDown size={17} /></button>
        <div className="reference-date-wrap"><button className="reference-topbar__date" onClick={() => setDateOpen(!dateOpen)} aria-label={startDate && endDate ? `${startDate} – ${endDate}` : 'All dates'} aria-expanded={dateOpen}><CalendarDays size={23} /><span>{startDate && endDate ? `${startDate} – ${endDate}` : 'All dates'}</span><ChevronDown size={17} /></button>{dateOpen && <div className="reference-date-popover"><p>Filters the overview and lab queue.</p><label>From<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label>To<input type="date" min={startDate} value={endDate} onChange={event => setEndDate(event.target.value)} /></label><button onClick={() => { setStartDate(''); setEndDate(''); setDateOpen(false); }}>Clear dates</button><button onClick={() => setDateOpen(false)} disabled={!startDate || !endDate}>Apply</button></div>}</div>
        <button className="reference-topbar__sync" disabled={loading} onClick={() => { setLoading(true); void load(); }} title="Refresh workspace"><CloudUpload size={25} fill="currentColor" /><span>{loading ? 'Syncing…' : 'Synced just now'}</span></button>
        <button className="reference-topbar__bell" onClick={() => navigate('alerts')} aria-label={`${newAlerts} alerts`}><Bell size={23} />{newAlerts > 0 && <i />}</button>
        <button className="reference-topbar__profile" onClick={() => navigate('settings')}><span className="reference-avatar">{profile.email[0].toUpperCase()}</span><span><strong>{profile.email.split('@')[0]}</strong><small>Supervisor</small></span><ChevronDown size={16} /></button>
      </header>
      <main className="reference-main" id="main-content">
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="save-notice" role="status">{notice}</p>}
        {!data && !error && <p className="workspace-loading" role="status">Loading your team’s cases…</p>}
        {periodData && screen === 'overview' && <OverviewView data={periodData} onNavigate={navigate} onOpenCase={openCase} />}
        {periodData && ['labs', 'samples', 'results', 'audit'].includes(screen) && <LabPortalView data={periodData} section={screen} onOpenCase={openCase} />}
        {data && screen === 'cases' && <><div className="reference-subheading"><h1>Cases</h1><p>Review evidence, record action, and track each case to resolution.</p></div><SupervisorCasesView data={data} selectedId={selected} onSelect={setSelected} onMutate={mutate} /></>}
        {data && screen === 'reports' && <><div className="reference-subheading"><h1>Reports</h1><p>Current activity and safe aggregate exports from your team.</p></div><ReportsView data={data} /></>}
        {data && screen === 'sources' && <><div className="reference-subheading"><h1>Water Sources</h1><p>Monitored sources across {profile.team_name}.</p></div><div className="reference-simple-grid">{data.water_sources.map(source => { const related = data.cases.filter(record => record.source_id === source.id); return <button className="reference-source-card" key={source.id} onClick={() => related.length ? openCase(related[0].id) : undefined}><MapPin size={22} /><span><strong>{source.name}</strong><small>{source.locality} · {related.length} {related.length === 1 ? 'case' : 'cases'}</small></span><ChevronDown size={16} /></button>; })}{!data.water_sources.length && <p className="empty-state">No water sources have been added to this team.</p>}</div></>}
        {data && screen === 'alerts' && <><div className="reference-subheading"><h1>Alerts &amp; Updates</h1><p>Cases and phone reports that need attention.</p></div><div className="reference-simple-grid">{data.cases.filter(record => record.status === 'under_review' && record.priority !== 'normal').map(record => <button className="reference-source-card" key={record.id} onClick={() => openCase(record.id)}><Bell size={22} /><span><strong>{record.priority} case · {data.water_sources.find(source => source.id === record.source_id)?.name || 'Water source'}</strong><small>{record.id}</small></span></button>)}{data.ivr_complaints.filter(record => record.status === 'new').map(record => <button className="reference-source-card" key={record.id} onClick={() => navigate('cases')}><FileText size={22} /><span><strong>Phone report awaiting linkage</strong><small>{record.summary}</small></span></button>)}{newAlerts === 0 && <p className="empty-state">No alerts need attention right now.</p>}</div></>}
        {data && screen === 'settings' && <><div className="reference-subheading"><h1>Settings</h1><p>Your team workspace and account.</p></div><section className="reference-settings"><h2>Account</h2><dl><div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Team</dt><dd>{profile.team_name}</dd></div><div><dt>Data</dt><dd>{profile.dataMode === 'synthetic' ? 'Synthetic demonstration records' : 'Live team records'}</dd></div></dl><button onClick={onLogout}><LogOut size={17} /> Sign out</button></section></>}
      </main>
    </div>
  </div>;
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
        else if (response.status === 401 || response.status === 403) { setProfile(null); if (response.status === 403) setError((await response.json()).error); }
      } catch { if (!cancelled) setError('Unable to reach the server. Check your connection and refresh.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void check(); const timer = window.setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const logout = async () => {
    try { const response = await fetch('/api/auth/logout', { method: 'POST' }); if (!response.ok) throw new Error(); setProfile(null); setError(''); }
    catch { setError('Could not sign out. Please try again.'); }
  };
  if (loading) return <div className="auth-loading" role="status">Loading your workspace…</div>;
  return <>{error && <div className="session-error" role="alert">{error}</div>}{profile ? <Dashboard profile={profile} onLogout={logout} /> : <AuthGate onAuthenticated={setProfile} />}</>;
}
