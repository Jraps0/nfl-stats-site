import React, { useState } from 'react';
import axios from 'axios';
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function MatchupCard({ game }){
  const homeTeam = game.homeTeam?.abbreviation || game.home?.abbreviation || game.home_team?.abbreviation || (game.home && game.home.team && game.home.team.abbreviation) || "HOME";
  const awayTeam = game.awayTeam?.abbreviation || game.away?.abbreviation || game.away_team?.abbreviation || (game.away && game.away.team && game.away.team.abbreviation) || "AWAY";
  const date = game.date || game.scheduled || game.time || '';

  const [analysis, setAnalysis] = useState(null);

  async function analyze(){
    try {
      const resp = await axios.get(`${API_BASE}/predict`, { params: { home: homeTeam, away: awayTeam, season: '2025' }});
      setAnalysis(resp.data);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="matchup">
      <div className="teams">
        <div>{awayTeam}</div>
        <span>@</span>
        <div>{homeTeam}</div>
      </div>
      <div className="meta">{date && new Date(date).toLocaleString()}</div>
      <button onClick={analyze}>Analyze</button>
      {analysis && (
        <div className="analysis">
          <p><b>{analysis.home}</b>: {(analysis.homeProb*100).toFixed(1)}%</p>
          <p><b>{analysis.away}</b>: {(analysis.awayProb*100).toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
