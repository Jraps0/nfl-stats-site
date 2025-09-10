import React, { useEffect, useState } from 'react';
import axios from 'axios';
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function TeamStatsTable(){
  const [teams, setTeams] = useState([]);

  useEffect(()=> {
    async function load(){
      try {
        const resp = await axios.get(`${API_BASE}/team-stats`, { params:{ season:'2025' }});
        setTeams(resp.data);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  return (
    <div className="stats-table">
      <h2>Team Stats</h2>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Off Yds/G</th>
            <th>Def Yds Allowed/G</th>
            <th>PF/G</th>
            <th>PA/G</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t,i)=> (
            <tr key={i}>
              <td>{t.team?.abbreviation || t.team?.name || '—'}</td>
              <td>{t.offenseYdsPerGame ?? '-'}</td>
              <td>{t.defenseYdsAllowedPerGame ?? '-'}</td>
              <td>{t.pointsForPerGame ?? '-'}</td>
              <td>{t.pointsAgainstPerGame ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
