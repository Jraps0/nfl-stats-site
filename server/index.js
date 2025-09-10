\
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const provider = (process.env.DATA_PROVIDER || 'mysportsfeeds').toLowerCase();
const PORT = process.env.PORT || 3000;
const MSF_BASE = process.env.MSF_BASE_URL || 'https://api.mysportsfeeds.com/v2.1';

const cache = {};
function setCache(key, data, ttl = Number(process.env.CACHE_TTL_SECS || 120)) {
  cache[key] = { data, expires: Date.now() + ttl * 1000 };
}
function getCache(key) {
  const item = cache[key];
  if (!item) return null;
  if (Date.now() > item.expires) { delete cache[key]; return null; }
  return item.data;
}

function msfAuthConfig() {
  return {
    auth: {
      username: process.env.MSF_API_KEY || '',
      password: 'MYSPORTSFEEDS'
    },
    headers: { 'Accept': 'application/json' }
  };
}

async function fetchScheduleFromMSF(season='2025', week) {
  const cacheKey = `msf:schedule:${season}:${week||'all'}`;
  const cached = getCache(cacheKey); if (cached) return cached;
  const seasonLabel = `${season}-regular`;
  const url = `${MSF_BASE}/pull/nfl/${seasonLabel}/schedule.json`;
  const resp = await axios.get(url, { params: week?{week}:undefined, ...msfAuthConfig() });
  const games = resp.data && resp.data.schedule && resp.data.schedule.games ? resp.data.schedule.games : (resp.data.games||resp.data);
  setCache(cacheKey, games, 90);
  return games;
}

async function fetchTeamStatsFromMSF(season='2025') {
  const cacheKey = `msf:teamstats:${season}`;
  const cached = getCache(cacheKey); if (cached) return cached;
  const url = `${MSF_BASE}/pull/nfl/${season}-regular/team_stats_totals.json`;
  const resp = await axios.get(url, msfAuthConfig());
  const payload = resp.data || {};
  let teams = [];
  if (payload.teamStatsTotals) teams = payload.teamStatsTotals;
  else if (payload.teamStats) teams = payload.teamStats;
  else teams = payload;
  const mapped = (teams || []).map(t => {
    const teamInfo = t.team || t.Team || {};
    const abbr = teamInfo.abbreviation || teamInfo.abbrev || teamInfo.code || teamInfo.ShortName || null;
    const offenseYds = (t.offense && t.offense.totalYardsPerGame) || t.offenseYardsPerGame || t.yds || null;
    const defYdsAllowed = t.defenseYardsAllowedPerGame || (t.defense && t.defense.yardsAllowedPerGame) || null;
    const pointsFor = t.pointsForPerGame || t.pointsFor || null;
    const pointsAgainst = t.pointsAgainstPerGame || t.pointsAgainst || null;
    return {
      raw: t,
      team: { name: teamInfo.name || teamInfo.FullName || abbr, abbreviation: (abbr||'').toUpperCase() || null },
      offenseYdsPerGame: offenseYds,
      defenseYdsAllowedPerGame: defYdsAllowed,
      pointsForPerGame: pointsFor,
      pointsAgainstPerGame: pointsAgainst
    };
  });
  setCache(cacheKey, mapped, 120);
  return mapped;
}

async function fetchPlayerStatsFromMSF(season='2025', playerIdentifier) {
  const cacheKey = `msf:playerstats:${season}:${playerIdentifier||'all'}`;
  const cached = getCache(cacheKey); if (cached) return cached;
  const url = `${MSF_BASE}/pull/nfl/${season}-regular/player_stats_totals.json`;
  const params = playerIdentifier && playerIdentifier!=='all' ? { player: playerIdentifier } : {};
  const resp = await axios.get(url, { params, ...msfAuthConfig() });
  const payload = resp.data || {};
  const players = payload.playerStatsTotals || payload.players || payload;
  setCache(cacheKey, players, 120);
  return players;
}

app.get('/api/health', (req,res)=> res.json({ok:true, provider, time:new Date().toISOString()}));

app.get('/api/schedule', async (req,res)=> {
  try {
    const season = req.query.season || '2025';
    const week = req.query.week;
    const games = await fetchScheduleFromMSF(season, week);
    return res.json(games);
  } catch(err) {
    console.error('schedule err', err.message, err.response && err.response.data);
    return res.status(500).json({ error: 'Failed fetching schedule', details: err.message });
  }
});

app.get('/api/team-stats', async (req,res)=> {
  try {
    const season = req.query.season || '2025';
    const team = req.query.team;
    const teams = await fetchTeamStatsFromMSF(season);
    const filtered = team ? teams.filter(t => (t.team && String(t.team.abbreviation).toUpperCase()) === String(team).toUpperCase()) : teams;
    return res.json(filtered);
  } catch(err) {
    console.error('teamstats err', err.message, err.response && err.response.data);
    return res.status(500).json({ error: 'Failed fetching team stats', details: err.message });
  }
});

app.get('/api/player-stats', async (req,res)=> {
  try {
    const season = req.query.season || '2025';
    const playerId = req.query.playerId || 'all';
    const players = await fetchPlayerStatsFromMSF(season, playerId);
    return res.json(players);
  } catch(err) {
    console.error('playerstats err', err.message, err.response && err.response.data);
    return res.status(500).json({ error: 'Failed fetching player stats', details: err.message });
  }
});

app.get('/api/predict', async (req,res)=> {
  try {
    const home = (req.query.home||'').toString().toUpperCase();
    const away = (req.query.away||'').toString().toUpperCase();
    const season = req.query.season || '2025';
    if (!home || !away) return res.status(400).json({ error: 'home and away required' });

    const teams = await fetchTeamStatsFromMSF(season);
    const homeStats = teams.find(t => t.team && String(t.team.abbreviation).toUpperCase() === home) || null;
    const awayStats = teams.find(t => t.team && String(t.team.abbreviation).toUpperCase() === away) || null;

    if (!homeStats || !awayStats) {
      return res.json({
        home, away, homeProb:0.5, awayProb:0.5,
        modelDetails: { note: 'Missing team stats; check provider response', homeStats, awayStats }
      });
    }

    const h_off = Number(homeStats.offenseYdsPerGame) || 0;
    const a_off = Number(awayStats.offenseYdsPerGame) || 0;
    const h_defA = Number(homeStats.defenseYdsAllowedPerGame) || 0;
    const a_defA = Number(awayStats.defenseYdsAllowedPerGame) || 0;

    const homeExpectedNetYards = h_off - a_defA;
    const awayExpectedNetYards = a_off - h_defA;
    const yardsGap = (homeExpectedNetYards - awayExpectedNetYards);

    const scaleFactor = Number(process.env.MODEL_YARDS_TO_POINTS || 0.02);
    const expectedPointDiff = yardsGap * scaleFactor;
    const homeFieldAdv = Number(process.env.MODEL_HOME_FIELD_ADV || 3);
    const expectedNetPointsHome = expectedPointDiff + homeFieldAdv;
    const scaleStd = Number(process.env.MODEL_STD || 6.5);
    const homeProb = 1 / (1 + Math.exp(-expectedNetPointsHome / scaleStd));
    const awayProb = 1 - homeProb;

    return res.json({
      home, away, homeProb: Number(homeProb.toFixed(4)), awayProb: Number(awayProb.toFixed(4)),
      modelDetails: { homeOffYds:h_off, awayOffYds:a_off, homeDefYdsAllowed:h_defA, awayDefYdsAllowed:a_defA, homeExpectedNetYards, awayExpectedNetYards, yardsGap, scaleFactor, expectedPointDiff, homeFieldAdv, expectedNetPointsHome, scaleStd }
    });
  } catch(err) {
    console.error('predict err', err.message, err.response && err.response.data);
    return res.status(500).json({ error: 'Prediction failed', details: err.message });
  }
});

app.listen(PORT, ()=> console.log(`Server listening on ${PORT} (provider=${provider})`));
