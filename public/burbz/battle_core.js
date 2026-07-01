(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBattleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const BATTLE_FORMATIONS = {
    balanced: {
      id: 'balanced', label: 'Balanced 2-1-2', icon: '⚖️',
      summary: 'Two attackers, one midfield caller, two defenders. Safest all-round setup.',
      slots: [
        { id: 'a1', lane: 'attack', x: 30, y: 18, mod: { atk: 1.12, spd: 1.05 } },
        { id: 'a2', lane: 'attack', x: 70, y: 18, mod: { atk: 1.10, int: 1.04 } },
        { id: 'm1', lane: 'midfield', x: 50, y: 47, mod: { int: 1.12, stamina: 1.08 } },
        { id: 'd1', lane: 'defence', x: 30, y: 78, mod: { def: 1.14, hp: 1.05 } },
        { id: 'd2', lane: 'defence', x: 70, y: 78, mod: { def: 1.12, stamina: 1.06 } }
      ]
    },
    press: {
      id: 'press', label: 'High Press 3-1-1', icon: '⚡',
      summary: 'Three forward birds try to overwhelm the top line. Great for fast flocks.',
      slots: [
        { id: 'a1', lane: 'attack', x: 25, y: 16, mod: { atk: 1.18, spd: 1.08, def: 0.94 } },
        { id: 'a2', lane: 'attack', x: 50, y: 12, mod: { atk: 1.22, stamina: 0.96 } },
        { id: 'a3', lane: 'attack', x: 75, y: 16, mod: { atk: 1.16, spd: 1.10 } },
        { id: 'm1', lane: 'midfield', x: 50, y: 48, mod: { int: 1.08, stamina: 1.08 } },
        { id: 'd1', lane: 'defence', x: 50, y: 80, mod: { def: 1.18, hp: 1.06 } }
      ]
    },
    shield: {
      id: 'shield', label: 'Nest Shield 1-3-1', icon: '🛡️',
      summary: 'A defensive wall with one striker. Best when your sturdy birds are strongest.',
      slots: [
        { id: 'a1', lane: 'attack', x: 50, y: 15, mod: { atk: 1.12, spd: 1.04 } },
        { id: 'm1', lane: 'midfield', x: 50, y: 46, mod: { int: 1.10, stamina: 1.08 } },
        { id: 'd1', lane: 'defence', x: 25, y: 76, mod: { def: 1.22, hp: 1.08 } },
        { id: 'd2', lane: 'defence', x: 50, y: 82, mod: { def: 1.26, atk: 0.94 } },
        { id: 'd3', lane: 'defence', x: 75, y: 76, mod: { def: 1.20, stamina: 1.08 } }
      ]
    },
    wings: {
      id: 'wings', label: 'Wide Wings 2-2-1', icon: '🪽',
      summary: 'Wide lanes and quick counters. Rewards speed, stamina and clever birds.',
      slots: [
        { id: 'a1', lane: 'attack', x: 22, y: 18, mod: { spd: 1.14, atk: 1.08 } },
        { id: 'a2', lane: 'attack', x: 78, y: 18, mod: { spd: 1.14, atk: 1.08 } },
        { id: 'm1', lane: 'midfield', x: 34, y: 48, mod: { int: 1.12, stamina: 1.08 } },
        { id: 'm2', lane: 'midfield', x: 66, y: 48, mod: { int: 1.10, spd: 1.08 } },
        { id: 'd1', lane: 'defence', x: 50, y: 80, mod: { def: 1.18, hp: 1.08 } }
      ]
    }
  };

  function hashString(value) {
    let h = 2166136261;
    const s = String(value || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    let state = hashString(seed) || 1;
    return function() {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5; state >>>= 0;
      return (state >>> 0) / 4294967296;
    };
  }

  function n(v, fallback) {
    const num = Number(v);
    return Number.isFinite(num) ? num : fallback;
  }

  function birdName(bird) {
    return bird.commonName || bird.species || bird.name || 'Burb';
  }

  function deriveRole(bird) {
    const atk = n(bird.atk, n(bird.power, 80) * 0.35);
    const def = n(bird.def, n(bird.power, 80) * 0.28);
    const spd = n(bird.spd, 50);
    const int = n(bird.int, 50);
    const stamina = n(bird.stamina, 50);
    const scores = {
      striker: atk * 1.25 + spd * 0.8,
      defender: def * 1.25 + stamina * 0.65,
      playmaker: int * 1.2 + stamina * 0.55 + spd * 0.25,
      scout: spd * 1.25 + int * 0.55
    };
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  function memberScore(bird, slot) {
    const mod = slot.mod || {};
    const hp = n(bird.maxHp || bird.hp, 80) * n(mod.hp, 1);
    const atk = n(bird.atk, 40) * n(mod.atk, 1);
    const def = n(bird.def, 40) * n(mod.def, 1);
    const spd = n(bird.spd, 40) * n(mod.spd, 1);
    const int = n(bird.int, 45) * n(mod.int, 1);
    const stamina = n(bird.stamina, 45) * n(mod.stamina, 1);
    const level = n(bird.level, 1);
    const training = n(bird.training && bird.training.trainCount, 0);
    const laneWeights = {
      attack: atk * 1.35 + spd * 0.9 + int * 0.35 + stamina * 0.25,
      midfield: int * 1.2 + stamina * 0.85 + spd * 0.55 + atk * 0.35 + def * 0.35,
      defence: def * 1.35 + hp * 0.35 + stamina * 0.55 + int * 0.35
    };
    return Math.round((laneWeights[slot.lane] || n(bird.power, 80)) + level * 12 + training * 4);
  }

  function normaliseFormation(formationId) {
    return BATTLE_FORMATIONS[formationId] || BATTLE_FORMATIONS.balanced;
  }

  function buildSquad(flock, formationId, options) {
    const formation = normaliseFormation(formationId);
    const maxSize = Math.min(n(options && options.maxSize, 5), formation.slots.length);
    const picked = (Array.isArray(flock) ? flock : [])
      .filter(Boolean)
      .slice()
      .sort((a, b) => n(b.power, 0) - n(a.power, 0) || n(b.level, 1) - n(a.level, 1))
      .slice(0, maxSize);
    const members = picked.map((bird, index) => {
      const slot = formation.slots[index];
      return {
        bird,
        id: bird.id || `${birdName(bird)}_${index}`,
        name: birdName(bird),
        role: deriveRole(bird),
        slot,
        score: memberScore(bird, slot),
        artUrl: bird.artUrl || null
      };
    });
    const laneTotals = { attack: 0, midfield: 0, defence: 0 };
    members.forEach(member => { laneTotals[member.slot.lane] += member.score; });
    return {
      formation,
      members,
      laneTotals,
      totalPower: members.reduce((sum, m) => sum + m.score, 0)
    };
  }

  function generateOpponentBird(species, level, index) {
    const seed = hashString(`${species}_${level}_${index}`);
    const base = 48 + (seed % 38) + level * 8;
    return {
      id: `op_${index}_${seed}`,
      species,
      commonName: species,
      level,
      power: base * 2,
      maxHp: base + 30,
      hp: base + 30,
      atk: base + ((seed >>> 3) % 30),
      def: base + ((seed >>> 7) % 26),
      spd: base + ((seed >>> 11) % 34),
      int: base + ((seed >>> 15) % 28),
      stamina: base + ((seed >>> 19) % 32)
    };
  }

  function generateOpponentSquad(speciesPool, avgLevel, formationId) {
    const pool = Array.isArray(speciesPool) && speciesPool.length ? speciesPool : ['Carrion Crow','Blue Tit','Goldfinch','Robin','Wren'];
    const level = Math.max(1, Math.round(n(avgLevel, 1)));
    const birds = pool.slice(0, 5).map((species, index) => generateOpponentBird(species, Math.max(1, level + ((index % 3) - 1)), index));
    return buildSquad(birds, formationId || 'balanced');
  }

  function laneResult(player, opponent, lane, rng) {
    const p = n(player.laneTotals[lane], 0);
    const o = n(opponent.laneTotals[lane], 0);
    const swing = Math.round((rng() - 0.5) * 48);
    const margin = p - o + swing;
    if (margin > 28) return { lane, winner: 'player', margin };
    if (margin < -28) return { lane, winner: 'opponent', margin };
    return { lane, winner: 'draw', margin };
  }

  function eventText(side, lane, member) {
    const who = member ? member.name : (side === 'player' ? 'Your flock' : 'Rival flock');
    const laneCopy = lane === 'attack' ? 'front line' : lane === 'midfield' ? 'middle channel' : 'nest line';
    if (side === 'player') return `${who} wins space in the ${laneCopy}.`;
    if (side === 'opponent') return `Rival ${who} controls the ${laneCopy}.`;
    return `Both flocks cancel each other out in the ${laneCopy}.`;
  }

  function simulateSquadMatch(playerSquad, opponentSquad, seed) {
    const rng = seededRandom(seed || `${playerSquad.totalPower}_${opponentSquad.totalPower}`);
    const lanes = ['attack', 'midfield', 'defence'];
    const score = { player: 0, opponent: 0 };
    const events = [];
    lanes.forEach((lane, i) => {
      const result = laneResult(playerSquad, opponentSquad, lane, rng);
      const pMember = playerSquad.members.find(m => m.slot.lane === lane);
      const oMember = opponentSquad.members.find(m => m.slot.lane === lane);
      if (result.winner === 'player') score.player += lane === 'attack' ? 2 : 1;
      if (result.winner === 'opponent') score.opponent += lane === 'attack' ? 2 : 1;
      events.push({ turn: i + 1, lane, side: result.winner, text: eventText(result.winner, lane, result.winner === 'opponent' ? oMember : pMember) });
    });
    const extraTurns = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < extraTurns; i++) {
      const playerMomentum = playerSquad.totalPower * (0.9 + rng() * 0.25);
      const opponentMomentum = opponentSquad.totalPower * (0.9 + rng() * 0.25);
      if (Math.abs(playerMomentum - opponentMomentum) < 30) {
        events.push({ turn: lanes.length + i + 1, lane: 'midfield', side: 'draw', text: 'A glittering aerial rally keeps the match balanced.' });
      } else if (playerMomentum > opponentMomentum) {
        score.player += 1;
        const m = playerSquad.members[Math.floor(rng() * playerSquad.members.length)];
        events.push({ turn: lanes.length + i + 1, lane: m.slot.lane, side: 'player', text: `${m.name} links the flock together for a clean point.` });
      } else {
        score.opponent += 1;
        const m = opponentSquad.members[Math.floor(rng() * opponentSquad.members.length)];
        events.push({ turn: lanes.length + i + 1, lane: m.slot.lane, side: 'opponent', text: `Rival ${m.name} answers with a tidy counter-point.` });
      }
    }
    const winner = score.player > score.opponent ? 'player' : score.opponent > score.player ? 'opponent' : 'draw';
    return { winner, score, events, playerSquad, opponentSquad };
  }

  return {
    BATTLE_FORMATIONS,
    buildSquad,
    deriveRole,
    generateOpponentSquad,
    simulateSquadMatch,
    seededRandom
  };
});
