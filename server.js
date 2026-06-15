const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/Resources', express.static(path.join(__dirname, 'Resources')));

// Load and parse Excel JSON data
let excelData = {};
try {
  const jsonPath = path.join(__dirname, 'Resources', 'excel_data.json');
  excelData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  console.error("Failed to load excel_data.json:", err);
}

// Parse player roles from excel data
const rawRoles = excelData["플레이어 설정"] || [];
const roles = [];
let currentRole = null;

for (let i = 1; i < rawRoles.length; i++) {
  const row = rawRoles[i];
  const id = row[0];
  if (id !== null) {
    if (currentRole) {
      roles.push(currentRole);
    }
    currentRole = {
      id: Math.round(id),
      disguisedRole: row[1],
      realRole: row[2] || row[1], // if realRole is null, use disguisedRole
      prompt: row[3] || "(표출 멘트 없음)",
      secretInfo: row[4] || null,
      reason: row[5] || null,
      nudges: []
    };
    if (row[6]) {
      currentRole.nudges.push(row[6]);
    }
  } else {
    if (currentRole && row[6]) {
      currentRole.nudges.push(row[6]);
    }
  }
}
if (currentRole) {
  roles.push(currentRole);
}

// Parse nudges inside roles
roles.forEach(role => {
  const parsedNudges = [];
  role.nudges.forEach(nudgeText => {
    if (!nudgeText) return;
    const match = nudgeText.match(/R(\d+)\s*·\s*([A-C]|아무도)/i);
    if (match) {
      const round = parseInt(match[1]);
      const choice = match[2];
      const textIndex = nudgeText.indexOf('\n\n');
      const text = textIndex !== -1 ? nudgeText.slice(textIndex + 2).trim() : nudgeText;
      parsedNudges.push({ round, choice, text });
    }
  });
  role.nudges = parsedNudges;
});

console.log(`Loaded ${roles.length} player roles from Excel.`);

// Shuffle helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Game state variables
let state = {
  phase: 'lobby',      // 'lobby', 'intro', 'round', 'round_result', 'ending'
  currentRound: 0,     // 0 for intro, 1 to 6 for rounds
  roundSubphase: 'question', // 'question' or 'voting' (only when phase is 'round')
  players: {},         // name -> player object
  playerOrder: [],     // list of player names in order of joining
  score_arrival: 0,    // 입항 점수
  score_mountain: 0,   // 망망산야 점수
  roundResultText: '',
  winningOption: '',   // winning option key ('A', 'B', 'C', 'none', or list of names)
  endingText: '',
  rolePool: []         // shuffled array of role indices
};

// Shuffled role pool for roles 1-7
let activeRoleIndices = shuffleArray([0, 1, 2, 3, 4, 5, 6]);
let extraRoleIndices = [7, 8, 9, 10]; // roles 8-11 (indices 7-10) are plain roles

// WebSocket connections mapping: name -> socket
let stateHistory = [];
const clients = new Map();
let gmSocket = null;

// Send system state to a specific client
function sendStateTo(ws, name) {
  if (ws.readyState !== WebSocket.OPEN) return;

  const response = {
    type: 'state',
    phase: state.phase,
    currentRound: state.currentRound,
    roundSubphase: state.roundSubphase,
    score_arrival: state.score_arrival,
    score_mountain: state.score_mountain,
    roundResultText: state.roundResultText,
    winningOption: state.winningOption,
    endingText: state.endingText,
    playersList: state.playerOrder.map(pName => {
      const p = state.players[pName];
      return {
        name: pName,
        disguisedRole: p.role.disguisedRole,
        alive: p.alive,
        isOnline: p.isOnline,
        voted: p.choice !== null || p.votedFor !== null
      };
    }),
    totalPlayers: state.playerOrder.length,
    votedCount: state.playerOrder.filter(pName => {
      const p = state.players[pName];
      return p.alive && (p.choice !== null || p.votedFor !== null);
    }).length,
    alivePlayersCount: state.playerOrder.filter(pName => state.players[pName].alive).length
  };

  if (name === '하영') {
    response.isGM = true;
  } else if (state.players[name]) {
    const p = state.players[name];
    response.isGM = false;
    response.playerDetails = {
      name: name,
      alive: p.alive,
      role: p.role,
      choice: p.choice,
      votedFor: p.votedFor
    };
  }

  ws.send(JSON.stringify(response));
}

// Broadcast system state to all clients
function broadcastState() {
  clients.forEach((ws, name) => {
    sendStateTo(ws, name);
  });
  if (gmSocket) {
    sendStateTo(gmSocket, '하영');
  }
}

// Handle WebSocket messages
wss.on('connection', (ws) => {
  let clientName = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${data.sender || 'unknown'}:`, data.type);

      switch (data.type) {
        case 'join':
          const name = data.name.trim();
          if (!name) {
            ws.send(JSON.stringify({ type: 'error', message: '이름을 입력해주세요.' }));
            return;
          }

          if (name === '하영') {
            if (gmSocket && gmSocket.readyState === WebSocket.OPEN) {
              console.log("GM (하영) re-entered. Closing old socket.");
              try {
                gmSocket.close();
              } catch (e) {
                console.error("Error closing old GM socket:", e);
              }
              gmSocket = null;
            }
            // GM enters
            gmSocket = ws;
            clientName = '하영';
            console.log("GM (하영) connected.");
            sendStateTo(ws, '하영');
            broadcastState();
            return;
          }

          // Player enters
          clientName = name;
          clients.set(name, ws);

          if (state.players[name]) {
            // Reconnect existing player
            state.players[name].isOnline = true;
            console.log(`Player ${name} reconnected.`);
          } else {
            // New player
            if (state.phase !== 'lobby') {
              ws.send(JSON.stringify({ type: 'error', message: '이미 게임이 진행 중입니다. 참여할 수 없습니다.' }));
              clients.delete(name);
              return;
            }

            if (state.playerOrder.length >= 11) {
              ws.send(JSON.stringify({ type: 'error', message: '최대 참가 인원(11명)을 초과했습니다.' }));
              clients.delete(name);
              return;
            }

            // Assign role
            const playerIndex = state.playerOrder.length;
            let roleIdx;
            if (playerIndex < 7) {
              roleIdx = activeRoleIndices[playerIndex];
            } else {
              roleIdx = extraRoleIndices[playerIndex - 7];
            }

            state.players[name] = {
              name: name,
              role: roles[roleIdx],
              alive: true,
              isOnline: true,
              choice: null,      // for normal choice rounds
              votedFor: null     // for R6 player voting
            };
            state.playerOrder.push(name);
            console.log(`Player ${name} joined. Assigned role: ${roles[roleIdx].disguisedRole}`);
          }
          broadcastState();
          break;

        case 'gm_next':
          if (clientName !== '하영') return;
          handleGMNext();
          break;

        case 'gm_back':
          if (clientName !== '하영') return;
          handleGMBack();
          break;

        case 'player_vote':
          if (!clientName || clientName === '하영') return;
          const player = state.players[clientName];
          if (!player || !player.alive) return;
          
          // Coward cannot select B in Round 3
          if (state.currentRound === 3 && player.role && player.role.realRole === '겁쟁이' && data.choice === 'B') {
            console.log(`Blocked Coward player ${clientName} from voting for B in Round 3.`);
            return;
          }

          player.choice = data.choice;
          console.log(`Player ${clientName} voted: ${data.choice}`);
          broadcastState();
          break;

        case 'player_vote_r6':
          if (!clientName || clientName === '하영') return;
          const playerR6 = state.players[clientName];
          if (!playerR6 || !playerR6.alive) return;
          playerR6.votedFor = data.targetPlayer; // can be player name or 'none' (아무도 버리지 않는다)
          console.log(`Player ${clientName} voted in R6 to abandon: ${data.targetPlayer}`);
          broadcastState();
          break;

        case 'reset':
          // Reset game state
          if (clientName === '하영') {
            resetGame();
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  ws.on('close', () => {
    if (clientName === '하영') {
      gmSocket = null;
      console.log("GM disconnected.");
    } else if (clientName) {
      if (state.players[clientName]) {
        state.players[clientName].isOnline = false;
        console.log(`Player ${clientName} disconnected.`);
        // In lobby phase, if they disconnect we could remove them, but in-game we keep them so they can reconnect.
        if (state.phase === 'lobby') {
          delete state.players[clientName];
          state.playerOrder = state.playerOrder.filter(n => n !== clientName);
          clients.delete(clientName);
          // Regenerate roles to ensure indices match player index
          activeRoleIndices = shuffleArray([0, 1, 2, 3, 4, 5, 6]);
          const currentPlayers = [...state.playerOrder];
          state.players = {};
          state.playerOrder = [];
          currentPlayers.forEach((pName) => {
            const idx = state.playerOrder.length;
            let rIdx = idx < 7 ? activeRoleIndices[idx] : extraRoleIndices[idx - 7];
            state.players[pName] = {
              name: pName,
              role: roles[rIdx],
              alive: true,
              isOnline: true,
              choice: null,
              votedFor: null
            };
            state.playerOrder.push(pName);
          });
        }
      }
      broadcastState();
    }
  });
});

function resetGame() {
  stateHistory = [];
  state = {
    phase: 'lobby',
    currentRound: 0,
    roundSubphase: 'question',
    players: {},
    playerOrder: [],
    score_arrival: 0,
    score_mountain: 0,
    roundResultText: '',
    winningOption: '',
    endingText: '',
    rolePool: []
  };
  activeRoleIndices = shuffleArray([0, 1, 2, 3, 4, 5, 6]);
  clients.clear();
  console.log("Game state has been reset.");
  broadcastState();
}

function handleGMNext() {
  // Save current state to history before transition
  stateHistory.push(JSON.parse(JSON.stringify(state)));

  if (state.phase === 'lobby') {
    if (state.playerOrder.length < 3) {
      console.log("Cannot start game: Need at least 3 players.");
      // Remove last history entry if failed to transition
      stateHistory.pop();
      return;
    }
    state.phase = 'intro';
    state.currentRound = 0;
    state.roundSubphase = 'question';
  } else if (state.phase === 'intro') {
    state.phase = 'round';
    state.currentRound = 1;
    state.roundSubphase = 'question';
    clearVotes();
  } else if (state.phase === 'round') {
    if (state.roundSubphase === 'question') {
      state.roundSubphase = 'voting';
    } else {
      // Process voting and move to round result
      processVotes();
      state.phase = 'round_result';
      state.roundSubphase = 'question';
    }
  } else if (state.phase === 'round_result') {
    // Check if ending condition met (e.g. everyone is dead, or finished round 6)
    if (checkEndings()) {
      state.phase = 'ending';
    } else {
      state.phase = 'round';
      state.currentRound += 1;
      state.roundSubphase = 'question';
      clearVotes();
    }
  } else if (state.phase === 'ending') {
    // Already at ending, reset or stay
  }
  broadcastState();
}

function handleGMBack() {
  if (stateHistory.length === 0) return;

  // Capture current online status of all players
  const currentOnlineStatus = {};
  state.playerOrder.forEach(name => {
    if (state.players[name]) {
      currentOnlineStatus[name] = state.players[name].isOnline;
    }
  });

  // Restore previous state
  state = stateHistory.pop();

  // Restore online status
  state.playerOrder.forEach(name => {
    if (state.players[name] && currentOnlineStatus[name] !== undefined) {
      state.players[name].isOnline = currentOnlineStatus[name];
    }
  });

  // If the restored state is in the voting subphase, clear votes so they can re-choose
  if (state.phase === 'round' && state.roundSubphase === 'voting') {
    clearVotes();
  }

  console.log(`GM reverted back to phase: ${state.phase}, round: ${state.currentRound}`);
  broadcastState();
}

function clearVotes() {
  state.winningOption = '';
  state.playerOrder.forEach(name => {
    const p = state.players[name];
    p.choice = null;
    p.votedFor = null;
  });
}

function processVotes() {
  const round = state.currentRound;
  const alivePlayers = state.playerOrder.filter(name => state.players[name].alive);
  const totalAlive = alivePlayers.length;

  if (totalAlive === 0) {
    state.roundResultText = "모든 생존자가 사라졌습니다.";
    state.winningOption = '';
    return;
  }

  if (round === 6) {
    // Process R6 voting:
    // Choices can be a player's name or 'none' (아무도 버리지 않는다)
    const votes = {};
    alivePlayers.forEach(name => {
      const p = state.players[name];
      const vote = p.votedFor || 'none';
      votes[vote] = (votes[vote] || 0) + 1;
    });

    console.log("R6 votes tally:", votes);

    const noneCount = votes['none'] || 0;

    if (noneCount === totalAlive) {
      // 1. 모두가 '아무도 버리지 않는다'를 선택한 경우
      state.score_arrival += 1;
      state.winningOption = 'none';
      state.roundResultText = "아무도 버리고 갈 수 없습니다. 천운으로, 구명보트는 모두를 태우고도 가라앉지 않을듯 합니다.\n(모두 생존)";
    } else {
      // Check if everyone got exactly 1 vote
      let everyoneGotOne = true;
      alivePlayers.forEach(name => {
        if ((votes[name] || 0) !== 1) {
          everyoneGotOne = false;
        }
      });

      if (everyoneGotOne && noneCount === 0) {
        // 2. 모두가 1표씩 얻은 경우
        state.score_mountain += 1;
        state.winningOption = 'none';
        state.roundResultText = "아무도 버리고 갈 수 없습니다. 천운으로, 구명보트는 모두를 태우고도 가라앉지 않을듯 합니다.\n(모두 생존)";
      } else {
        // 3. 0표를 받은 사람이 있음
        // Anyone who got >= 1 vote is abandoned (dies). The 0-vote players survive.
        const abandoned = [];
        alivePlayers.forEach(name => {
          const voteCount = votes[name] || 0;
          if (voteCount >= 1) {
            state.players[name].alive = false;
            abandoned.push(name);
          }
        });

        const survivorsCount = alivePlayers.filter(name => state.players[name].alive).length;
        state.winningOption = abandoned.join(', ');
        state.roundResultText = `인원들 중 일부만 구명보트를 타고 탈출합니다.\n(남은 인원만 구명보트에 오릅니다.)`;
      }
    }
    return;
  }

  // Normal choice rounds (R1 to R5)
  const votes = { A: 0, B: 0, C: 0 };
  alivePlayers.forEach(name => {
    const p = state.players[name];
    if (p.choice) {
      votes[p.choice] = (votes[p.choice] || 0) + 1;
    }
  });

  // Determine winning option by majority
  // R4 is special: "모두 다 A", "모두 다 B", "A랑 B 골고루"
  if (round === 4) {
    const aCount = votes['A'] || 0;
    const bCount = votes['B'] || 0;
    let resultNarrative = "";
    if (aCount === totalAlive) {
      state.winningOption = 'A';
      state.score_arrival += 1;
      resultNarrative = "공동 창고에 보관하니 모두가 매일 공평한 양으로 나눠먹을 수 있게 됐습니다.";
    } else if (bCount === totalAlive) {
      state.winningOption = 'B';
      // Kill all
      alivePlayers.forEach(name => state.players[name].alive = false);
      resultNarrative = "이런, 하늘에서 사나운 새가 와서 가방을 물고 가버렸습니다. 이제 배에 식량은 없습니다. (모든 플레이어 사망)";
    } else {
      state.winningOption = 'A+B';
      state.score_mountain += 1;
      resultNarrative = "몇몇 사람들은 공동 창고에 음식 전부를 냈습니다. 하지만 몇몇 개인 가방 안에 음식물을 그대로 두고 있는 것 같군요. 그날 밤, 하늘에서 사나운 새 떼가 몰려와 가방을 물고 가버렸습니다. 가방이 눈앞에서 사라지고 절규하는 사람들을 보며, 나머지 사람들은 가방에 식량을 숨겨뒀던 이들이 있음을 눈치챘습니다.";
    }
    state.roundResultText = `[공동 창고에 내기로 한 사람]: ${aCount}명 | [개인 가방에 몰래 숨기기로 한 사람]: ${bCount}명\n\n${resultNarrative}`;
    return;
  }

  // R1, R2, R3, R5: Standard majority vote with random tie-breaker
  let winningOption;
  if (round === 3) {
    // Override: A (Blue Line) only wins if votes are strictly greater than B (Red Line).
    winningOption = (votes['A'] > votes['B']) ? 'A' : 'B';
  } else {
    let options = ['A', 'B'];
    if (round === 1 || round === 2 || round === 5) {
      options.push('C');
    }

    let maxVotes = -1;
    let winningOptions = [];

    options.forEach(opt => {
      if (votes[opt] > maxVotes) {
        maxVotes = votes[opt];
        winningOptions = [opt];
      } else if (votes[opt] === maxVotes) {
        winningOptions.push(opt);
      }
    });

    // Tie breaker (randomly choose between the tied options)
    winningOption = winningOptions[Math.floor(Math.random() * winningOptions.length)];
  }
  state.winningOption = winningOption;
  console.log(`Round ${round} voting results:`, votes, `Winner: ${winningOption}`);

  if (round === 1) {
    if (winningOption === 'A') {
      state.score_arrival += 1;
      state.roundResultText = "다행히 아무 위험없이 넘어갔습니다.";
    } else if (winningOption === 'B') {
      state.score_mountain += 1;
      state.roundResultText = "서쪽에는 숨겨진 암초들이 더 많았습니다. 오히려 이걸 피해가느라 더 많은 시간과 노력을 쓰게 됐네요.";
    } else if (winningOption === 'C') {
      alivePlayers.forEach(name => state.players[name].alive = false);
      state.roundResultText = "배는 암초에 부딪히고 말았습니다. (모든 플레이어 사망)";
    }
  } else if (round === 2) {
    if (winningOption === 'A') {
      alivePlayers.forEach(name => state.players[name].alive = false);
      state.roundResultText = "등불이 꺼지자 강은 완전히 검은 물이 되었습니다. 아무도 앞을 볼 수 없게 되었습니다. 잠시 뒤 배 밑바닥이 무언가에 길게 긁혔고, 차가운 물이 밀려들어왔습니다. (모든 플레이어 사망)";
    } else if (winningOption === 'B') {
      state.score_arrival += 1;
      state.roundResultText = "등불은 밤새 꺼지지 않았습니다. 새벽녘, 선창 아래에서 기름병들이 발견되었습니다. 오히려 기름은 넉넉했고, 다들 안도합니다.";
    } else if (winningOption === 'C') {
      state.score_mountain += 1;
      state.roundResultText = "불을 조금이라도 킨 덕에, 위험한 상황들은 대처할 수 있었지만 어둠 속에서 모두가 서로를 의심하기 시작했습니다. 뒤늦게 숨겨진 기름병들이 발견되자, 배 안의 침묵은 더 무거워졌습니다.";
    }
  } else if (round === 3) {
    const aCount = alivePlayers.filter(name => state.players[name].choice === 'A').length;
    const bCount = alivePlayers.filter(name => state.players[name].choice === 'B').length;

    let resultNarrative = "";
    if (winningOption === 'A') {
      // Kill all who chose A
      alivePlayers.forEach(name => {
        if (state.players[name].choice === 'A') {
          state.players[name].alive = false;
        }
      });
      resultNarrative = "이런... 파란 줄 자리로 너무 많이 몰려든 탓에 중심을 잃고 쓰러졌습니다. 그 순간, 폭풍이 당신들을 데리고 가버렸습니다. (파란 줄을 선택한 사공 사망)";
    } else if (winningOption === 'B') {
      resultNarrative = "생각보다 폭풍은 거세지 않았고, 모든 이들이 살아남았습니다.";
    }
    state.roundResultText = `[파란 줄 선택]: ${aCount}명 | [빨간 줄 선택]: ${bCount}명\n\n${resultNarrative}`;
  } else if (round === 5) {
    if (winningOption === 'A') {
      state.score_arrival += 1;
      state.roundResultText = "돈 벌 창구가 없어진건 슬프지만, 그래도 사람이 죽는것보단 낫습니다.";
    } else if (winningOption === 'B') {
      // Check if Player 6 (탈옥자/수리공) is alive
      let repairmanAlive = false;
      let repairmanName = '';
      state.playerOrder.forEach(name => {
        const p = state.players[name];
        if (p.role && p.role.id === 6) {
          repairmanName = name;
          if (p.alive) {
            repairmanAlive = true;
          }
        }
      });

      if (repairmanAlive) {
        state.score_arrival += 1;
        state.roundResultText = `한명이 재능을 뽐내며 멋지게 수리를 성공했습니다. (${repairmanName}의 눈부신 활약!)`;
      } else {
        alivePlayers.forEach(name => state.players[name].alive = false);
        state.roundResultText = "함부로 도전하지 않는 편이 나았을 것 같습니다... (모든 플레이어 사망)";
      }
    } else if (winningOption === 'C') {
      // Check if unanimous C
      const cCount = alivePlayers.filter(name => state.players[name].choice === 'C').length;
      if (cCount === totalAlive) {
        alivePlayers.forEach(name => state.players[name].alive = false);
        state.roundResultText = "누굴 버리고 갈지 싸우다가 모두가 폭풍에 휩쓸려 사라졌습니다. (모든 플레이어 사망)";
      } else {
        state.score_mountain += 1;
        // Kill those who did NOT choose C
        const killed = [];
        alivePlayers.forEach(name => {
          if (state.players[name].choice !== 'C') {
            state.players[name].alive = false;
            killed.push(name);
          }
        });
        state.roundResultText = `일부 인원을 버리기로 했던 사람들에 의해, 나머지 인원들이 버려졌습니다. (버려진 사공: ${killed.join(', ')})`;
      }
    }
  }
}

function checkEndings() {
  const alivePlayers = state.playerOrder.filter(name => state.players[name].alive);
  const totalAlive = alivePlayers.length;

  // 1. All dead ending
  if (totalAlive === 0) {
    state.endingText = "[엔딩 4. 죽음]: GAME OVER. 여기까지입니다. 강은 그래도 계속 흐릅니다.";
    return true;
  }

  // 2. Only 1 survivor ending
  if (totalAlive === 1) {
    state.endingText = `[엔딩 1. 마지막 사공]: 당신(${alivePlayers[0]})은 결국 남들을 꺾고 원하던 곳에 도착했습니다. 하지만 이제 어떻게 돌아갈까요? 혼자서 노를 저어 이곳을 돌아가기란 쉽지 않을 것입니다.`;
    return true;
  }

  // 3. Round 6 ended - check score metrics
  if (state.currentRound === 6) {
    const originalCount = state.playerOrder.length;
    const deadCount = originalCount - totalAlive;

    if (deadCount === 0) {
      // No one died
      if (state.score_arrival > state.score_mountain) {
        state.endingText = "[엔딩 5. 동항]: 사공이 많으면 배가 산으로 간다고 했습니다. 하지만 그건 자신의 길만 고집했을때의 얘기입니다.";
      } else {
        state.endingText = "[엔딩 2. 망망산야]: 드디어 물 위에서의 생활이 끝나고, 땅에 닿았습니다. 하지만 여긴 어디일까요... 눈앞에 보이는건 거대한 산일 뿐입니다.";
      }
    } else {
      // Someone died
      if (state.score_arrival > state.score_mountain) {
        state.endingText = "[엔딩 3. 입항]: 드디어 목적지에 닿았습니다. 하지만 함께 떠났던 모든 사람이 여기 있지는 않습니다. 최선의 운항였는지는 각자가 판단해야 할 것입니다.";
      } else {
        state.endingText = "[엔딩 2. 망망산야]: 드디어 물 위에서의 생활이 끝나고, 땅에 닿았습니다. 하지만 여긴 어디일까요... 눈앞에 보이는건 거대한 산일 뿐입니다.";
      }
    }
    return true;
  }

  return false;
}

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
