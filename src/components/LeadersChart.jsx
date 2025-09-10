import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function LeadersChart(){
  const [players, setPlayers] = useState([]);

  useEffect(()=> {
    async function load(){
      try {
        const resp = await axios.get(`${API_BASE}/player-stats`, { params:{ season:'2025', playerId:'all' }});
        const data = resp.data || [];
        const leaders = (Array.isArray(data) ? data : []).filter(p => p.stats?.rushing?.rushYards).sort((a,b)=> b.stats.rushing.rushYards - a.stats.rushing.rushYards).slice(0,10);
        setPlayers(leaders);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  const chartData = {
    labels: players.map(p=> p.player?.lastName || p.player?.firstName || 'Player'),
    datasets: [{ label:'Rushing Yards', data: players.map(p=> p.stats.rushing.rushYards ?? 0) }]
  };

  return (
    <div className="leaders-chart">
      <h2>Top Rushers</h2>
      <Bar data={chartData} />
    </div>
  );
}
