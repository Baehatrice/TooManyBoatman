let socket = null;
let currentName = "";
let isGM = false;
let gameState = null;

// Game rounds constant data for presentation
const roundData = {
  0: { // Intro
    narrative: "당신들은 배에 타 있습니다..\n옮겨야 할 중요한 짐이 있고,\n강은 너무 크고 복잡하며,\n함께 탄 이들의 속내는 모릅니다.\n수상한 사람도 속해있는 것 같네요.\n\n이 배는 어디로 갈까요?\n\n배의 분위기는 좋지 않습니다...\n위험한 길이란 것을 모두가 알아서 긴장하고 있습니다.\n까딱 말을 잘못하다가는 누군가를 버리고 갈 분위기군요.\n\n그래도 기억하세요. 배는 혼자서는 움직이지 않습니다."
  },
  1: {
    title: "라운드 1: 앞길을 가로막은 바위",
    narrative: "앞에 커다란 바위가 보입니다.\n어떻게 할까요?",
    choices: [
      { id: "B", label: "왼쪽 노 (B)", text: "서쪽으로 우회.\n별로 돌아가지 않지만\n어떤 위험이 도사리는지 모릅니다.", type: "left-paddle" },
      { id: "C", label: "가운데 배 (C)", text: "그대로 전진", type: "center-boat" },
      { id: "A", label: "오른쪽 노 (A)", text: "동쪽으로 우회.\n목적지까지 걸리는 시간이\n굉장히 늦춰지지만\n안전이 보장된 길입니다.", type: "right-paddle" }
    ]
  },
  2: {
    title: "라운드 2: 급격히 소모되는 연료",
    narrative: "운항을 하던 중, 등잔기름이 생각보다 훨씬 빠른 속도로 닳고 있다는 것을 발견했습니다. 이대로라면 얼마 안가 기름을 다 소진해버릴 것 같습니다. 어떻게 해야할까요?",
    choices: [
      { id: "A", label: "왼쪽 노 (A)", text: "기름을 아끼는 것이 우선입니다. 모든 등불을 끄고 방법을 강구해봅니다.", type: "left-paddle" },
      { id: "C", label: "가운데 배 (C)", text: "앞쪽 등불만 남기고 나머지는 끕니다. 기름을 아끼면서도 최소한의 시야는 확보합니다.", type: "center-boat" },
      { id: "B", label: "오른쪽 노 (B)", text: "아직 기름이 완전히 떨어진것도 아닌데, 등불을 유지합니다.", type: "right-paddle" }
    ]
  },
  3: {
    title: "라운드 3: 위험한 폭풍 속으로",
    narrative: "여러 위기를 피하며 항해하다가, 위험한 지역에 다다랐습니다. 날씨가 궂어, 범죄자들을 호송할때만 쓰이는 뱃길입니다. 역시나 폭풍이 다가옵니다. 갑판의 안전줄 두 종류 중 하나를 잡아야 합니다.",
    choices: [
      { id: "A", label: "왼쪽 노 (A)", text: "파란 줄. 안전이 보장된 튼튼한 줄이지만, 잡을 수 있는 공간이 넉넉치 않습니다. 여러명이 달려들 시, 아수라장이 되어 다들 넘어질 것 같군요...", type: "left-paddle" },
      { id: "B", label: "오른쪽 노 (B)", text: "빨간 줄. 안전점검을 한지 오래됐고, 낡아보입니다. 폭풍이 거세지면 위험할 것 같습니다. 하지만 잡을 수 있는 자리는 넉넉하네요.", type: "right-paddle" }
    ]
  },
  4: {
    title: "라운드 4: 메말라가는 비축 식량",
    narrative: "식량이 바닥나기 시작합니다. 각자의 식량을 모아서 균등하게 배분할까요?",
    choices: [
      { id: "A", label: "왼쪽 노 (A)", text: "공동 창고에 낸다.", type: "left-paddle" },
      { id: "B", label: "오른쪽 노 (B)", text: "개인 가방에 몰래 숨긴다.", type: "right-paddle" }
    ]
  },
  5: {
    title: "라운드 5: 침수되는 선실",
    narrative: "폭풍으로 배에 물이 차기 시작했습니다. 무게를 줄여야 합니다.",
    choices: [
      { id: "A", label: "왼쪽 노 (A)", text: "옮겨야 하는 화물을 버린다.", type: "left-paddle" },
      { id: "C", label: "가운데 배 (C)", text: "일부 인원을 버리고 간다.", type: "center-boat" },
      { id: "B", label: "오른쪽 노 (B)", text: "수리공은 배에 없지만, 수리를 시도해볼 수 있습니다. 만약 실패하면 더 큰일이 있을지도...", type: "right-paddle" }
    ]
  },
  6: {
    title: "라운드 6: 침몰하는 구명보트",
    narrative: "배가 기울기 시작합니다. 구명보트에는 7명밖에 탈 수 없어보입니다. 누구를 버리고 가야할까요?"
  }
};

// Canvas Autoscaling (Locks to 1920x1080 at 16:9 ratio)
function resizeCanvas() {
  const canvas = document.querySelector('.retro-canvas');
  if (!canvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(w / 1920, h / 1080);
  canvas.style.transform = `scale(${scale})`;
  canvas.style.left = `${(w - 1920 * scale) / 2}px`;
  canvas.style.top = `${(h - 1080 * scale) / 2}px`;
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);

// Establish WebSocket Connection
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${protocol}//${window.location.host}`;
  socket = new WebSocket(socketUrl);

  socket.onopen = () => {
    console.log("Connected to server");
    if (currentName) {
      socket.send(JSON.stringify({ type: 'join', name: currentName }));
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'error') {
      showLoginError(data.message);
      return;
    }

    if (data.type === 'state') {
      gameState = data;
      isGM = data.isGM;
      updateUI();
    }
  };

  socket.onclose = () => {
    console.log("Disconnected from server, retrying in 2 seconds...");
    setTimeout(connect, 2000);
  };
}

// Show validation errors on name submission
function showLoginError(msg) {
  const errBox = document.getElementById('login-error');
  errBox.textContent = msg;
  setTimeout(() => { errBox.textContent = ""; }, 5000);
}

// Join Game Action
document.getElementById('join-btn').addEventListener('click', () => {
  const username = document.getElementById('username-input').value.trim();
  if (!username) {
    showLoginError("이름을 입력해 주세요.");
    return;
  }
  currentName = username;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect();
  } else {
    socket.send(JSON.stringify({ type: 'join', name: currentName }));
  }
});

document.getElementById('username-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('join-btn').click();
  }
});

// GM Controls Action
document.getElementById('start-game-btn').addEventListener('click', () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'gm_next', sender: '하영' }));
  }
});

document.getElementById('gm-next-btn').addEventListener('click', () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'gm_next', sender: '하영' }));
  }
});

document.getElementById('gm-reset-in-game').addEventListener('click', () => {
  if (confirm("정말로 방을 폭파하고 처음으로 돌아가시겠습니까? 모든 플레이어가 퇴장됩니다.")) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'reset', sender: '하영' }));
    }
  }
});

// GM Explode Room ("방 폭파하기")
document.getElementById('reset-game-btn').addEventListener('click', () => {
  if (confirm("정말로 방을 폭파하고 처음으로 돌아가시겠습니까? 모든 플레이어가 퇴장됩니다.")) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'reset', sender: '하영' }));
    }
  }
});

// Player Leave Lobby ("대기실 나가기")
document.getElementById('leave-lobby-btn').addEventListener('click', () => {
  if (socket) {
    socket.close();
  }
  currentName = "";
  gameState = null;
  isGM = false;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('login-screen').classList.add('active');
});

// Restart Game (Ending screen)
document.getElementById('restart-game-btn').addEventListener('click', () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'reset', sender: '하영' }));
  }
});

// Update the entire game UI based on state
function updateUI() {
  // Trigger scaling recalculation
  resizeCanvas();

  // Check if player has been kicked/reset (room exploded)
  if (currentName && currentName !== '하영' && gameState) {
    const meExists = gameState.playersList && gameState.playersList.some(p => p.name === currentName);
    if (!meExists && gameState.phase === 'lobby') {
      if (socket) {
        socket.close();
      }
      currentName = "";
      gameState = null;
      isGM = false;
      alert("방이 해체되었거나 게임이 초기화되었습니다.");
      document.querySelectorAll('.canvas-screen').forEach(s => s.classList.remove('active'));
      document.getElementById('login-screen').classList.add('active');
      return;
    }
  }

  // Hide all screens first
  document.querySelectorAll('.canvas-screen').forEach(s => s.classList.remove('active'));

  // Route to the appropriate screen
  if (gameState.phase === 'lobby') {
    document.getElementById('lobby-screen').classList.add('active');
    renderLobby();
  } else if (gameState.phase === 'intro' || gameState.phase === 'round' || gameState.phase === 'round_result') {
    document.getElementById('game-screen').classList.add('active');
    renderGame();
  } else if (gameState.phase === 'ending') {
    document.getElementById('ending-screen').classList.add('active');
    renderEnding();
  }
}

// 1. Lobby View Rendering
function renderLobby() {
  const pCount = gameState.playersList.length;
  document.getElementById('lobby-player-count').textContent = pCount;
  document.getElementById('gm-player-count').textContent = pCount;

  // Render player names on left
  const listUl = document.getElementById('lobby-players-list');
  listUl.innerHTML = "";
  gameState.playersList.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(p.name)}</span>
      <span class="role-badge">${escapeHtml(p.disguisedRole)}</span>
    `;
    listUl.appendChild(li);
  });

  // Render role card on right
  const cardDiv = document.getElementById('lobby-role-card');
  cardDiv.innerHTML = "";

  if (isGM) {
    // Show GM Screen Control
    document.getElementById('gm-controls').classList.remove('hidden');
    document.getElementById('player-status').classList.add('hidden');
    
    // Enable start game when players are between 3 and 11
    const startBtn = document.getElementById('start-game-btn');
    if (pCount >= 3 && pCount <= 11) {
      startBtn.disabled = false;
    } else {
      startBtn.disabled = true;
    }

    cardDiv.innerHTML = `
      <div class="role-card">
        <div class="role-card-header">
          <div class="label">GAME MASTER</div>
          <h2>하영 (게임 마스터)</h2>
        </div>
        <div class="role-card-info">
          <div class="info-item">
            <div class="info-title">역할 안내</div>
            <div class="info-val">당신은 게임 진행자(GM)입니다. 플레이어들이 역할을 파악하고 의사소통할 수 있도록 중재해 주세요. 모든 사공이 대기방에 입장하면 '게임 시작'을 눌러 게임을 진행할 수 있습니다.</div>
          </div>
          <div class="info-item">
            <div class="info-title">안내 조건</div>
            <div class="info-val">GM 제외 최소 3명부터 최대 11명의 사공이 참여할 수 있습니다.</div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Show Player Screen Waiting State
    document.getElementById('gm-controls').classList.add('hidden');
    document.getElementById('player-status').classList.remove('hidden');

    if (gameState.playerDetails && gameState.playerDetails.role) {
      const details = gameState.playerDetails;
      const role = details.role;
      
      let secretHTML = "";
      if (role.realRole !== role.disguisedRole) {
        secretHTML = `
          <div class="info-item secret">
            <div class="info-title">비밀 진짜 신분</div>
            <div class="info-val" style="background-color: #ffffff; color: #000000; font-weight: bold; padding: 0.1rem 0.4rem; display: inline-block;">${escapeHtml(role.realRole)}</div>
          </div>
        `;
      }

      cardDiv.innerHTML = `
        <div class="role-card">
          <div class="role-card-header">
            <div class="label">부여받은 대외적 신분</div>
            <h2>${escapeHtml(role.disguisedRole)}</h2>
          </div>
          <div class="role-card-info">
            <div class="info-item">
              <div class="info-title">표출 메시지</div>
              <div class="info-val">${escapeHtml(role.prompt).replace(/\n/g, '<br>')}</div>
            </div>
            ${secretHTML}
          </div>
        </div>
      `;
    }
  }
}

// Map choices to Left, Center, Right layouts based on options
function mapChoicesForRound(round, choices) {
  if (!choices) return { left: null, center: null, right: null };
  
  if (choices.length === 3) {
    if (round === 1) {
      // Left = B (서쪽), Center = C (직진), Right = A (동쪽)
      return {
        left: choices.find(c => c.id === 'B'),
        center: choices.find(c => c.id === 'C'),
        right: choices.find(c => c.id === 'A')
      };
    } else {
      // General 3-choice fallback: Left=A, Center=C, Right=B
      return {
        left: choices.find(c => c.id === 'A') || choices[0],
        center: choices.find(c => c.id === 'C') || choices[2],
        right: choices.find(c => c.id === 'B') || choices[1]
      };
    }
  } else if (choices.length === 2) {
    // 2 choices: Left = A, Right = B, Center = null
    return {
      left: choices.find(c => c.id === 'A') || choices[0],
      center: null,
      right: choices.find(c => c.id === 'B') || choices[1]
    };
  }
  return { left: null, center: null, right: null };
}

// 2. Play View Rendering
function renderGame() {
  const round = gameState.currentRound;
  const phase = gameState.phase;
  const subphase = gameState.roundSubphase;
  
  // Set up background images based on round
  const bgImg = document.getElementById('bg-layer');
  const narrativeImg = document.getElementById('narrative-image');
  const gameScreenDiv = document.getElementById('game-screen');
  
  if (phase === 'intro') {
    bgImg.src = "/Resources/Intro-Img.jpg";
    gameScreenDiv.classList.add('intro-mode');
  } else {
    bgImg.src = "/Resources/Background.jpg";
    gameScreenDiv.classList.remove('intro-mode');
    
    // Narrative image fallback using HTML onerror
    narrativeImg.src = `/Resources/R${round}-Img.png`;
  }

  // Populate player list in ParticipantBox: formatted as (이름) : 신분
  const listUl = document.getElementById('game-players-list');
  listUl.innerHTML = "";
  gameState.playersList.forEach(p => {
    const li = document.createElement('li');
    li.className = p.alive ? 'alive' : 'dead';
    if (!p.isOnline) li.classList.add('offline');
    
    const formattedRole = p.alive ? escapeHtml(p.disguisedRole) : "사망";
    li.textContent = `(${escapeHtml(p.name)}) : ${formattedRole}`;
    
    listUl.appendChild(li);
  });

  // Render secret role trigger details for alive players on left panel
  const secretTrigger = document.getElementById('secret-trigger-wrapper');
  if (!isGM && gameState.playerDetails && phase !== 'intro') {
    const details = gameState.playerDetails;
    secretTrigger.classList.remove('hidden');
    
    const detailsContent = document.getElementById('secret-details-content');
    detailsContent.innerHTML = `
      <p><strong>대외 신분:</strong> ${escapeHtml(details.role.disguisedRole)}</p>
      <p><strong>진짜 신분:</strong> <span class="highlight">${escapeHtml(details.role.realRole)}</span></p>
      ${details.role.secretInfo ? `<p><strong>비밀 정보:</strong> ${escapeHtml(details.role.secretInfo)}</p>` : ''}
      ${details.role.reason ? `<p><strong>숨기는 이유:</strong> ${escapeHtml(details.role.reason)}</p>` : ''}
    `;

    // Hook up trigger event
    const triggerBtn = document.getElementById('toggle-secret-btn');
    const newTriggerBtn = triggerBtn.cloneNode(true);
    triggerBtn.parentNode.replaceChild(newTriggerBtn, triggerBtn);
    newTriggerBtn.addEventListener('click', () => {
      detailsContent.classList.toggle('hidden');
    });
  } else {
    secretTrigger.classList.add('hidden');
  }

  // Render narrative story content box (Right panel)
  const narrativeText = document.getElementById('narrative-text');
  if (phase === 'intro') {
    narrativeText.innerHTML = roundData[0].narrative;
  } else if (phase === 'round') {
    if (roundData[round]) {
      // If we are in question subphase, show only the question.
      narrativeText.innerHTML = `[ ${roundData[round].title} ]\n\n${roundData[round].narrative}`;
    } else {
      narrativeText.innerHTML = "라운드 진행 중...";
    }
  } else if (phase === 'round_result') {
    narrativeText.innerHTML = `[ 투표 결과 안내 ]\n\n${gameState.roundResultText}`;
  }

  // Render Bottom panel UI ChoiceBox and paddles
  const choiceBox = document.getElementById('choicebox-layer');
  const boat = document.getElementById('boat-layer');
  const paddleL = document.getElementById('paddle-l-layer');
  const paddleR = document.getElementById('paddle-r-layer');
  const playerStatusBar = document.getElementById('player-status-bar');
  
  // Hide all bottom elements by default
  choiceBox.classList.add('hidden');
  boat.classList.add('hidden');
  paddleL.classList.add('hidden');
  paddleR.classList.add('hidden');
  playerStatusBar.classList.add('hidden');
  
  const textCenter = document.getElementById('choice-text-center');
  const textLeft = document.getElementById('choice-text-left');
  const textRight = document.getElementById('choice-text-right');
  const hotspotCenter = document.getElementById('hotspot-center');
  const hotspotLeft = document.getElementById('hotspot-left');
  const hotspotRight = document.getElementById('hotspot-right');
  const r6GridContainer = document.getElementById('list-choices-container');

  textCenter.classList.add('hidden');
  textLeft.classList.add('hidden');
  textRight.classList.add('hidden');
  hotspotCenter.classList.add('hidden');
  hotspotLeft.classList.add('hidden');
  hotspotRight.classList.add('hidden');
  r6GridContainer.classList.add('hidden');

  // Death eliminations
  const deathOverlay = document.getElementById('death-overlay');
  deathOverlay.classList.add('hidden');
  if (!isGM && gameState.playerDetails && !gameState.playerDetails.alive) {
    deathOverlay.classList.remove('hidden');
  }

  // Show boat/paddles in rounds 1-5
  if ((phase === 'round' || phase === 'round_result') && round >= 1 && round <= 5) {
    boat.classList.remove('hidden');
    paddleL.classList.remove('hidden');
    paddleR.classList.remove('hidden');
  }

  // State subphase checks
  if (phase === 'round' && subphase === 'voting') {
    // Show choices box
    choiceBox.classList.remove('hidden');

    if (round === 6) {
      // R6 name grid voting
      r6GridContainer.classList.remove('hidden');
      renderR6Grid();
    } else {
      // Normal rounds 1-5 (boat and paddles already rendered above)

      const roundConf = roundData[round];
      if (roundConf && roundConf.choices) {
        const mapped = mapChoicesForRound(round, roundConf.choices);
        const me = gameState.playerDetails;
        
        let activeNudge = null;
        if (me && me.role && me.role.nudges) {
          activeNudge = me.role.nudges.find(n => n.round === round);
        }

        const nudgeTip = document.getElementById('nudge-tip-container');
        nudgeTip.classList.add('hidden');

        // Render Left Choice
        if (mapped.left) {
          textLeft.classList.remove('hidden');
          hotspotLeft.classList.remove('hidden');
          textLeft.querySelector('.choice-desc').textContent = mapped.left.text;
          
          if (activeNudge && activeNudge.choice === mapped.left.id) {
            textLeft.classList.add('nudged');
            nudgeTip.innerHTML = `<strong>★ 미션 팁:</strong> ${escapeHtml(activeNudge.text)}`;
            nudgeTip.classList.remove('hidden');
          } else {
            textLeft.classList.remove('nudged');
          }

          setupChoiceEvents('left', 'paddle-l-layer', mapped.left.id);
        }

        // Render Center Choice
        if (mapped.center) {
          textCenter.classList.remove('hidden');
          hotspotCenter.classList.remove('hidden');
          textCenter.querySelector('.choice-desc').textContent = mapped.center.text;
          
          if (activeNudge && activeNudge.choice === mapped.center.id) {
            textCenter.classList.add('nudged');
            nudgeTip.innerHTML = `<strong>★ 미션 팁:</strong> ${escapeHtml(activeNudge.text)}`;
            nudgeTip.classList.remove('hidden');
          } else {
            textCenter.classList.remove('nudged');
          }

          setupChoiceEvents('center', 'boat-layer', mapped.center.id);
        } else {
          // If no center choice, boat layer is still visible but unclickable/unhighlighted
          const boatLayer = document.getElementById('boat-layer');
          boatLayer.classList.remove('glow-white');
        }

        // Render Right Choice
        if (mapped.right) {
          textRight.classList.remove('hidden');
          hotspotRight.classList.remove('hidden');
          textRight.querySelector('.choice-desc').textContent = mapped.right.text;
          
          if (activeNudge && activeNudge.choice === mapped.right.id) {
            textRight.classList.add('nudged');
            nudgeTip.innerHTML = `<strong>★ 미션 팁:</strong> ${escapeHtml(activeNudge.text)}`;
            nudgeTip.classList.remove('hidden');
          } else {
            textRight.classList.remove('nudged');
          }

          setupChoiceEvents('right', 'paddle-r-layer', mapped.right.id);
        }

        if (!isGM && me && me.alive) {
          playerStatusBar.classList.remove('hidden');
          
          const completeBadge = document.getElementById('selection-complete-badge');
          if (me.choice !== null) {
            completeBadge.classList.remove('hidden');
          } else {
            completeBadge.classList.add('hidden');
          }
        }
      }
    }
  }

  // Render GM specific controllers
  const gmGameControls = document.getElementById('gm-game-controls');
  gmGameControls.classList.add('hidden');

  if (isGM) {
    gmGameControls.classList.remove('hidden');
    
    // Tally values
    document.getElementById('gm-play-voted-count').textContent = gameState.votedCount;
    document.getElementById('gm-play-alive-count').textContent = gameState.alivePlayersCount;
    
    const progressPercent = gameState.alivePlayersCount > 0 ? (gameState.votedCount / gameState.alivePlayersCount) * 100 : 0;
    document.getElementById('vote-progress').style.width = `${progressPercent}%`;

    const gmNextBtn = document.getElementById('gm-next-btn');
    if (phase === 'intro') {
      gmNextBtn.textContent = "첫 투표로 진행";
      gmNextBtn.disabled = false;
    } else if (phase === 'round') {
      if (subphase === 'question') {
        gmNextBtn.textContent = "선택지 공개하기";
        gmNextBtn.disabled = false;
      } else {
        gmNextBtn.textContent = "투표 완료 및 집계";
        // Allow GM to proceed even if not fully voted (e.g. bypass disconnected)
        gmNextBtn.disabled = false; 
      }
    } else if (phase === 'round_result') {
      gmNextBtn.textContent = "다음 단계로";
      gmNextBtn.disabled = false;
    }
  }
}

// Render player names grid in round 6
function renderR6Grid() {
  const me = gameState.playerDetails;
  if (!me) return;
  
  const grid = document.getElementById('list-choices');
  grid.innerHTML = "";

  // "아무도 버리지 않는다" option
  const noneCard = document.createElement('div');
  noneCard.className = `grid-choice-card ${me.votedFor === 'none' ? 'selected' : ''}`;
  noneCard.textContent = "아무도 버리지 않는다";
  noneCard.addEventListener('click', () => {
    selectR6Vote('none');
  });
  grid.appendChild(noneCard);

  // Surviving players list options
  gameState.playersList.forEach(p => {
    if (p.alive) {
      const card = document.createElement('div');
      card.className = `grid-choice-card ${me.votedFor === p.name ? 'selected' : ''}`;
      card.textContent = p.name;
      card.addEventListener('click', () => {
        selectR6Vote(p.name);
      });
      grid.appendChild(card);
    }
  });

  if (me.alive) {
    const playerStatusBar = document.getElementById('player-status-bar');
    playerStatusBar.classList.remove('hidden');
    const completeBadge = document.getElementById('selection-complete-badge');
    if (me.votedFor !== null) {
      completeBadge.classList.remove('hidden');
    } else {
      completeBadge.classList.add('hidden');
    }
  }
}

// Bind choice hover synchronization and clicks
function setupChoiceEvents(pos, layerId, choiceId) {
  const textContainer = document.getElementById(`choice-text-${pos}`);
  const hotspot = document.getElementById(`hotspot-${pos}`);
  const layerImg = document.getElementById(layerId);
  const me = gameState.playerDetails;
  
  // Clone nodes to sweep away old event listeners
  const newTextContainer = textContainer.cloneNode(true);
  textContainer.parentNode.replaceChild(newTextContainer, textContainer);
  
  const newHotspot = hotspot.cloneNode(true);
  hotspot.parentNode.replaceChild(newHotspot, hotspot);
  
  if (isGM) {
    newTextContainer.style.pointerEvents = 'none';
    newHotspot.style.pointerEvents = 'none';
    newTextContainer.classList.remove('selected');
    layerImg.classList.remove('glow-white');
    return;
  }
  
  // Set selected highlight
  if (me && me.choice === choiceId) {
    newTextContainer.classList.add('selected');
    layerImg.classList.add('glow-white');
  } else {
    newTextContainer.classList.remove('selected');
    layerImg.classList.remove('glow-white');
  }

  // Hover animations
  const handleEnter = () => {
    newTextContainer.classList.add('hover-inverted');
    layerImg.classList.add('glow-white');
  };
  const handleLeave = () => {
    newTextContainer.classList.remove('hover-inverted');
    if (!me || me.choice !== choiceId) {
      layerImg.classList.remove('glow-white');
    }
  };

  newTextContainer.addEventListener('mouseenter', handleEnter);
  newTextContainer.addEventListener('mouseleave', handleLeave);
  newHotspot.addEventListener('mouseenter', handleEnter);
  newHotspot.addEventListener('mouseleave', handleLeave);

  // Click trigger
  const handleClick = () => {
    selectChoice(choiceId);
  };
  newTextContainer.addEventListener('click', handleClick);
  newHotspot.addEventListener('click', handleClick);
}

// 3. Ending View Rendering
function renderEnding() {
  const textEl = document.getElementById('ending-text');
  const arrivalEl = document.getElementById('end-score-arrival');
  const mountainEl = document.getElementById('end-score-mountain');
  const restartBtn = document.getElementById('restart-game-btn');
  const playerRestartMsg = document.getElementById('player-restart-msg');

  textEl.innerHTML = gameState.endingText.replace(/\n/g, '<br>');
  arrivalEl.textContent = gameState.score_arrival;
  mountainEl.textContent = gameState.score_mountain;

  if (isGM) {
    restartBtn.classList.remove('hidden');
    playerRestartMsg.classList.add('hidden');
  } else {
    restartBtn.classList.add('hidden');
    playerRestartMsg.classList.remove('hidden');
  }
}

// Vote Actions
function selectChoice(choiceId) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'player_vote',
      sender: currentName,
      choice: choiceId
    }));
  }
}

function selectR6Vote(targetPlayerName) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'player_vote_r6',
      sender: currentName,
      targetPlayer: targetPlayerName
    }));
  }
}

// Escape HTML utility to prevent XSS injection
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initial Connection
connect();
