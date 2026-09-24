import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export default function WaterScene({ compact = false }: { compact?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = scene.current!;
    let visible = true;
    const sync = () => element.style.setProperty('--motion-play-state', !paused && visible && !document.hidden ? 'running' : 'paused');
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [paused]);

  return (
    <div ref={scene} className={`water-scene${compact ? ' water-scene--compact' : ''}`}>
      <span className="water-scene__glow" aria-hidden="true" />
      <span className="water-scene__orbit water-scene__orbit--outer" aria-hidden="true" />
      <span className="water-scene__orbit water-scene__orbit--inner" aria-hidden="true" />
      <span className="water-scene__orb" aria-hidden="true">
        <img src="/water-orb.webp" alt="" width="1254" height="1254" decoding="async" />
      </span>
      <span className="water-scene__light" aria-hidden="true" />
      <button className="motion-toggle" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play water animation' : 'Pause water animation'} title={paused ? 'Play water animation' : 'Pause water animation'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
    </div>
  );
}
