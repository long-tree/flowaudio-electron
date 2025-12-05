(() => {
  const dom = {
    hosts: document.getElementById('hosts'),
    danmaku: document.getElementById('danmaku'),
    trackTitle: document.getElementById('track-title'),
    trackArtist: document.getElementById('track-artist'),
    trackStyle: document.getElementById('track-style'),
    trackAudio: document.getElementById('track-audio'),
    llmStatus: document.getElementById('llm-status'),
    eventLabel: document.getElementById('event-label'),
    modeLabel: document.getElementById('mode-label'),
    screenshotLabel: document.getElementById('screenshot-label'),
    streamStatus: document.getElementById('stream-status'),
    lastEvent: document.getElementById('last-event'),
    userState: document.getElementById('user-state'),
    runIdLabel: document.getElementById('run-id-label'),
    textInput: document.getElementById('text-input'),
    processInput: document.getElementById('process-input'),
    screenshotInput: document.getElementById('screenshot-input'),
    startText: document.getElementById('start-text'),
    startProcess: document.getElementById('start-process'),
    stopRun: document.getElementById('stop-run'),
    themeButtons: Array.from(document.querySelectorAll('.theme-btn')),
  };

  const state = {
    runId: null,
    hosts: [],
    audience: [],
    track: { title: '—', artist: '—', style: '—', url: '' },
    userState: 'unknown',
    theme: 'synth',
  };

  function applyTheme(theme) {
    state.theme = theme;
    document.body.classList.remove('theme-synth', 'theme-classical', 'theme-y2k');
    document.body.classList.add(`theme-${theme}`);
    dom.themeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.theme === theme));
  }

  function renderHosts() {
    dom.hosts.innerHTML = '';
    state.hosts.slice(-12).forEach((item) => {
      const el = document.createElement('div');
      el.className = `bubble ${item.role}`;
      el.innerHTML = `
        <div class="meta">
          <span class="name">${item.name}</span>
          <span>${item.time}</span>
        </div>
        <div class="text">${item.text}</div>
      `;
      dom.hosts.appendChild(el);
    });
    dom.hosts.scrollTop = dom.hosts.scrollHeight;
  }

  function pushHost(role, text) {
    const name = role === 'host1' ? '主持人 1' : '主持人 2';
    state.hosts.push({ role, name, text, time: new Date().toLocaleTimeString() });
    renderHosts();
  }

  function pushAudience(text) {
    const lane = Math.floor(Math.random() * 5);
    const tone = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
    const el = document.createElement('div');
    el.className = `danmaku-item ${tone}`;
    el.style.top = `${lane * 18 + 8}%`;
    el.textContent = text;
    dom.danmaku.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  function updateTrack(info = {}) {
    state.track = { ...state.track, ...info };
    dom.trackTitle.textContent = state.track.title || '—';
    dom.trackArtist.textContent = state.track.artist || '—';
    dom.trackStyle.textContent = state.track.style || '—';
    if (state.track.url) {
      dom.trackAudio.src = state.track.url;
      dom.trackAudio.style.opacity = 1;
    } else {
      dom.trackAudio.removeAttribute('src');
      dom.trackAudio.style.opacity = 0.4;
    }
  }

  function setStatus(key, value) {
    if (key === 'stream') dom.streamStatus.textContent = value;
    if (key === 'lastEvent') dom.lastEvent.textContent = value;
    if (key === 'runId') dom.runIdLabel.textContent = value || 'no run';
    if (key === 'userState') dom.userState.textContent = value;
  }

  function parseContent(content) {
    if (!content) return null;
    if (typeof content === 'object') return content;
    if (typeof content === 'string') {
      const normalized = content.replace(/[“”]/g, '"');
      try {
        return JSON.parse(normalized);
      } catch (_) {
        // try extract embedded JSON
        const match = normalized.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch (_) {
            return { raw: normalized };
          }
        }
        return { raw: normalized };
      }
    }
    return null;
  }

  function applyParsedPayload(payload) {
    if (!payload) return;
    if (payload.host1 || payload.host1_comment) pushHost('host1', payload.host1 || payload.host1_comment);
    if (payload.host2 || payload.host2_comment) pushHost('host2', payload.host2 || payload.host2_comment);
    // 评论节点 s1/s2/s3/l1 归为主持人1
    ['s1', 's2', 's3', 'l1'].forEach((k) => payload[k] && pushHost('host1', payload[k]));
    // reply 节点 r1-r4 归为主持人2
    ['r1', 'r2', 'r3', 'r4'].forEach((k) => payload[k] && pushHost('host2', payload[k]));
    if (payload.audience) {
      const arr = Array.isArray(payload.audience) ? payload.audience : [payload.audience];
      arr.forEach((line) => line && pushAudience(line));
    }
    if (payload.music_url || payload.audio_url || payload.track_url) {
      updateTrack({
        url: payload.music_url || payload.audio_url || payload.track_url,
        title: payload.title || payload.track || 'New track',
        artist: payload.artist || 'AI DJ',
        style: payload.style || payload.genre || 'Flow mix',
      });
    }
    // 主持人语音/回复的音频链接
    if (payload.tts) pushHost('host1', `语音: ${payload.tts}`);
    ['link1', 'link2', 'link3', 'link4'].forEach((k) => {
      if (payload[k]) pushHost('host2', `语音: ${payload[k]}`);
    });
    if (payload.raw && typeof payload.raw === 'string') {
      pushHost('host1', payload.raw);
    }
  }

  const partials = new Map();

  function handlePacket(packet = {}) {
    const event = packet.event || packet.type || 'Message';
    dom.eventLabel.textContent = event;
    setStatus('lastEvent', `${event} #${packet.id ?? ''}`);
    if (event === 'Error') {
      pushHost('host1', `Error: ${packet.error_message || packet.msg || 'unknown'}`);
      setStatus('stream', 'error');
      return;
    }
    if (event === 'Done') {
      setStatus('stream', 'completed');
      return;
    }
    const contentPiece = packet.data?.content ?? packet.content;
    const key = packet.data?.node_execute_uuid || packet.data?.node_id || `pkt-${packet.id}`;
    const isFinish = packet.data?.node_is_finish;
    const current = partials.get(key) || '';
    const merged = contentPiece ? current + contentPiece : current;
    if (contentPiece) partials.set(key, merged);
    if (isFinish || packet.data?.node_type === 'End') {
      const payload = parseContent(merged);
      applyParsedPayload(payload);
      partials.delete(key);
    }
  }

  // Mock stream if preload bridge is unavailable.
  function startMockRun(mode) {
    const text = dom.textInput.value.trim();
    const process = dom.processInput.value.trim();
    const shot = dom.screenshotInput.value.trim();
    const id = `mock-${Date.now()}`;
    state.runId = id;
    setStatus('runId', id);
    setStatus('stream', 'mock live');
    dom.llmStatus.textContent = 'mocking';
    pushHost('host1', `收到${mode === 'process' ? '状态数据' : '文本'}：${text || process || '...'}，正在衔接音乐。`);
    setTimeout(() => updateTrack({
      title: 'Nebula Drift',
      artist: 'DJ Flow (AI)',
      style: mode === 'process' ? 'focus / synth' : 'user vibe',
      url: '',
    }), 600);
    const scripts = [
      { t: 800, fn: () => pushHost('host2', '观众来得真快，保持节奏！') },
      { t: 1600, fn: () => pushAudience('这段太炸了！') },
      { t: 2400, fn: () => pushAudience('主持人2：还想听古典混音！') },
      { t: 3200, fn: () => pushHost('host1', '切入更柔和的垫底，让注意力集中。') },
      { t: 4200, fn: () => { setStatus('stream', 'mock done'); dom.eventLabel.textContent = 'Done'; } },
    ];
    scripts.forEach(({ t, fn }) => setTimeout(fn, t));
  }

  let abortRun = null;
  async function startRun(mode) {
    const hasBridge = window.flowBridge && typeof window.flowBridge.startStream === 'function';
    dom.modeLabel.textContent = mode === 'process' ? 'Process + Shot' : 'Text';
    const payload = {
      text_input: mode === 'text' ? dom.textInput.value.trim() : '',
      process_input: mode === 'process' ? dom.processInput.value.trim() : '',
      pic_input: mode === 'process' ? dom.screenshotInput.value.trim() : '',
    };
    if (hasBridge) {
      try {
        const runId = await window.flowBridge.startStream(payload, (packet) => {
          handlePacket(packet);
          if (packet.event === 'Done' || packet.event === 'Error' || packet.event === 'Interrupt') {
            abortRun = null;
          }
        });
        state.runId = runId;
        setStatus('runId', runId);
        setStatus('stream', 'live');
        dom.llmStatus.textContent = 'connected';
        abortRun = () => window.flowBridge.stopStream(runId);
      } catch (err) {
        setStatus('stream', 'error');
        pushHost('host1', `启动失败: ${err.message}`);
      }
    } else {
      startMockRun(mode);
    }
  }

  function stopRun() {
    if (abortRun) abortRun();
    abortRun = null;
    setStatus('stream', 'stopped');
    dom.eventLabel.textContent = 'stopped';
  }

  dom.startText.addEventListener('click', () => startRun('text'));
  dom.startProcess.addEventListener('click', () => startRun('process'));
  dom.stopRun.addEventListener('click', stopRun);

  dom.themeButtons.forEach((btn) =>
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme))
  );

  // initial values
  applyTheme('synth');
  dom.screenshotLabel.textContent = 'auto / 2 min cadence';
  updateTrack({
    title: 'Waiting for DJ',
    artist: 'AI DJ (hidden)',
    style: 'flow ready',
  });
  pushHost('host1', '主播 1 等待指令…');
  pushHost('host2', '主播 2 保持气氛…');
  pushAudience('弹幕系统已启动！');

  // Basic user state heuristic based on process text.
  dom.processInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    if (val.includes('vscode') || val.includes('idea')) setStatus('userState', 'working');
    else if (val.includes('chrome') || val.includes('steam')) setStatus('userState', 'entertainment');
    else setStatus('userState', 'unknown');
  });
})();
