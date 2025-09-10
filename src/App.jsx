import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MatchupCard from './components/MatchupCard';
import TeamStatsTable from './components/TeamStatsTable';
import LeadersChart from './components/LeadersChart';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function App(){
  const [week, setWeek] = useState(1);
  const [games, setGames] = useState([]);
  const season = '2025';

  useEffect(()=> {
    async function load(){
      try {
        const resp = await axios.get(`${API_BASE}/schedule`, { params:{ season, week }});
        setGames(resp.data || []);
      } catch (err) {
        console.error(err);
        setGames([]);
      }
    }
    load();
  }, [week]);

  return (
    <div className="container">
      <header>
        <h1>NFL Stats & Projections — 2025 Season</h1>
        <div className="controls">
          Week:
          <select value={week} onChange={e => setWeek(Number(e.target.value))}>
            {Array.from({length:18}, (_,i)=>i+1).map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </header>

      <main>
        <section className="left">
          <h2>Matchups</h2>
          {games.length === 0 && <p>No games found for this week.</p>}
          {games.map((g,i)=> <MatchupCard key={i} game={g} />)}
        </section>

        <aside className="right">
          <TeamStatsTable />
          <LeadersChart />
        </aside>
      </main>
    </div>
  );
}
