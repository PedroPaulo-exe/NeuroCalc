"use strict";
(() => {
    const Q = 10;
    const LIMIT = 40000;
    const $ = (s) => document.querySelector(s);
    const SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
    const SAY = { add: 'mais', sub: 'menos', mul: 'vezes', div: 'dividido por' };
    const ICON = {
        play: '<svg viewBox="0 0 24 24"><path d="M6 4l15 8-15 8z"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    };
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem('soroban:' + k);
                return v ? JSON.parse(v) : d;
            }
            catch {
                return d;
            }
        },
        set(k, v) { try {
            localStorage.setItem('soroban:' + k, JSON.stringify(v));
        }
        catch { } },
    };
    const cfg = { ops: ['add', 'sub', 'mul', 'div'], level: '2x1', addLen: 2, speak: true, listen: false, ...store.get('sessao-cfg', {}) };
    if (cfg.addLen !== 2 && cfg.addLen !== 3)
        cfg.addLen = 2;
    if (!cfg.ops.length)
        cfg.ops = ['add', 'sub', 'mul', 'div'];
    const saveCfg = () => store.set('sessao-cfg', cfg);
    const history = store.get('sessoes', []);
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const num = (n) => ri(10 ** (n - 1), 10 ** n - 1);
    function make(op) {
        if (op === 'add') {
            const n = cfg.addLen;
            const a = num(n), b = num(n);
            return { op, terms: [a, b], answer: a + b };
        }
        if (op === 'sub') {
            const n = cfg.addLen;
            let a = num(n), b = num(n);
            while (a === b)
                b = num(n);
            if (b > a)
                [a, b] = [b, a];
            return { op, terms: [a, b], answer: a - b };
        }
        if (op === 'mul') {
            const a = num(2);
            const b = cfg.level === '2x1' ? ri(2, 9) : ri(11, 99);
            return { op, terms: [a, b], answer: a * b };
        }
        const q = num(2);
        const d = cfg.level === '2x1' ? ri(2, 9) : ri(11, 99);
        return { op, terms: [q * d, d], answer: q };
    }
    function makeSet() {
        const out = [];
        const ops = Array.from({ length: Q }, (_, i) => cfg.ops[i % cfg.ops.length]);
        for (let i = ops.length - 1; i > 0; i--) {
            const j = ri(0, i);
            [ops[i], ops[j]] = [ops[j], ops[i]];
        }
        for (const op of ops) {
            let p = make(op);
            for (let k = 0; k < 10 && out.some(o => o.terms.join() === p.terms.join() && o.op === p.op); k++)
                p = make(op);
            out.push(p);
        }
        return out;
    }
    const fmt = (p) => p.terms.join(` ${SYM[p.op]} `);
    const fmtHTML = (p) => p.terms.join(` <span class="op">${SYM[p.op]}</span> `);
    const sayP = (p) => p.terms.join(` ${SAY[p.op]} `);
    function par(p) {
        const big = p.terms[1] >= 10;
        if (p.op === 'add' || p.op === 'sub')
            return String(p.terms[0]).length >= 3 ? 3 : 2;
        if (p.op === 'mul')
            return big ? 5 : 2.5;
        return big ? 6 : 3;
    }
    const GRADES = [
        { g: 'SS', x: 1, acc: 100, what: 'nível de mestre' },
        { g: 'S', x: 2, acc: 90, what: 'avançado (dan)' },
        { g: 'A', x: 3.5, acc: 80, what: 'muito bom' },
        { g: 'B', x: 6, acc: 70, what: 'bom' },
        { g: 'C', x: 10, acc: 50, what: 'em progresso' },
    ];
    function grade(rs, avgMs) {
        const base = rs.reduce((t, r) => t + par(r.p), 0) / rs.length;
        const acc = (rs.filter(r => r.ok).length / rs.length) * 100;
        const sec = avgMs / 1000;
        const scale = GRADES.map(t => ({ ...t, max: Math.round(base * t.x * 10) / 10 }));
        const hit = scale.find(t => sec <= t.max && acc >= t.acc);
        return { g: hit ? hit.g : 'D', what: hit ? hit.what : 'continue treinando', scale };
    }
    function cfgPar() {
        const one = (op) => op === 'add' || op === 'sub' ? (cfg.addLen === 3 ? 3 : 2)
            : op === 'mul' ? (cfg.level === '2x2' ? 5 : 2.5) : (cfg.level === '2x2' ? 6 : 3);
        return cfg.ops.reduce((t, o) => t + one(o), 0) / cfg.ops.length;
    }
    const scaleHTML = (base, cur) => GRADES.map(t => `<span class="${t.g === cur ? 'on' : ''}"><b class="gl g-${t.g}">${t.g}</b> até ${(Math.round(base * t.x * 10) / 10).toFixed(1)}s · ${t.acc}%+</span>`).join('')
        + `<span class="${cur === 'D' ? 'on' : ''}"><b class="gl g-D">D</b> acima disso</span>`;
    const idleEl = $('#idle'), runEl = $('#run'), resEl = $('#res'), histEl = $('#historico'), nav = $('#cfg'), idleScale = $('#idleScale');
    const qnEl = $('#qn'), dotsEl = $('#dots'), secsEl = $('#secs'), barEl = $('#bar'), barI = barEl.firstElementChild;
    const stage = $('#stage'), probEl = $('#prob'), ansEl = $('#ans'), msgEl = $('#msg'), inp = $('#inp');
    const ppBtn = $('#pp'), avgEl = $('#avg'), descEl = $('#desc'), micEl = $('#mic'), micTxt = $('#micTxt'), toastEl = $('#toast');
    let phase = 'idle';
    let set = [];
    let results = [];
    let qi = 0;
    let left = LIMIT;
    let last = performance.now();
    let feedbackT = 0;
    let primed = false;
    const cur = () => set[qi];
    const RODS = 7;
    const abEl = $('#abaco');
    const heaven = [];
    const earth = [];
    (() => {
        const W = RODS * 40 + 16;
        let s = `<svg viewBox="0 0 ${W} 156" xmlns="http://www.w3.org/2000/svg">`;
        s += `<rect x="2" y="4" width="${W - 4}" height="148" rx="7" fill="#2c2e31" stroke="#646669" stroke-width="3"/>`;
        for (let i = 0; i < RODS; i++)
            s += `<line x1="${28 + i * 40}" y1="6" x2="${28 + i * 40}" y2="150" stroke="#646669" stroke-width="2.5"/>`;
        s += `<rect x="2" y="50" width="${W - 4}" height="6" fill="#646669"/>`;
        for (let i = 0; i < RODS; i++) {
            const x = 28 + i * 40;
            if ((RODS - 1 - i) % 3 === 0)
                s += `<circle cx="${x}" cy="53" r="2" fill="#323437"/>`;
            s += `<ellipse class="bd" data-h="${i}" cx="${x}" cy="22" rx="16" ry="9"/>`;
            for (let j = 0; j < 4; j++)
                s += `<ellipse class="bd" data-e="${i}-${j}" cx="${x}" cy="${85 + j * 18}" rx="16" ry="8.5"/>`;
        }
        abEl.innerHTML = s + '</svg>';
        for (let i = 0; i < RODS; i++) {
            heaven.push(abEl.querySelector(`[data-h="${i}"]`));
            earth.push([0, 1, 2, 3].map(j => abEl.querySelector(`[data-e="${i}-${j}"]`)));
        }
    })();
    function abacus(v) {
        const ds = v.slice(-RODS).padStart(RODS, '0');
        for (let i = 0; i < RODS; i++) {
            const d = Number(ds[i]);
            heaven[i].classList.toggle('on', d >= 5);
            heaven[i].style.transform = d >= 5 ? 'translateY(18px)' : '';
            earth[i].forEach((b, j) => {
                const on = j < d % 5;
                b.classList.toggle('on', on);
                b.style.transform = on ? 'translateY(-20px)' : '';
            });
        }
    }
    const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    let ptVoice;
    const pickVoice = () => {
        if (!synth)
            return;
        const vs = synth.getVoices();
        ptVoice = vs.find(v => v.lang.toLowerCase().startsWith('pt-br')) || vs.find(v => v.lang.toLowerCase().startsWith('pt'));
    };
    if (synth) {
        pickVoice();
        synth.onvoiceschanged = pickVoice;
    }
    const keep = [];
    let speaking = false, speakT = 0, checkT = 0, warned = false;
    function warn(msg) { if (!warned) {
        warned = true;
        toast(msg);
    } }
    let actx = null;
    function keepAwake() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC)
            return;
        if (!actx) {
            try {
                actx = new AC();
                const osc = actx.createOscillator(), g = actx.createGain();
                osc.frequency.value = 30;
                g.gain.value = 0.0005;
                osc.connect(g).connect(actx.destination);
                osc.start();
            }
            catch {
                actx = null;
                return;
            }
        }
        if (actx.state === 'suspended')
            actx.resume().catch(() => { });
    }
    function errorBeep() {
        keepAwake();
        if (!actx)
            return;
        const t0 = actx.currentTime + 0.01;
        [[220, 0], [165, 0.12]].forEach(([f, dt]) => {
            const o = actx.createOscillator(), g = actx.createGain();
            o.type = 'triangle';
            o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t0 + dt);
            g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.11);
            o.connect(g).connect(actx.destination);
            o.start(t0 + dt);
            o.stop(t0 + dt + 0.13);
        });
    }
    function speak(text, force = false) {
        if ((!cfg.speak && !force) || !primed)
            return;
        keepAwake();
        if (!synth) {
            warn('Este navegador não tem leitura em voz. Use o Chrome, o Edge ou o Safari.');
            return;
        }
        clearTimeout(speakT);
        clearTimeout(checkT);
        if (synth.speaking || synth.pending)
            synth.cancel();
        speakT = window.setTimeout(() => {
            if (!ptVoice)
                pickVoice();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'pt-BR';
            u.rate = 1.1;
            u.volume = 1;
            if (ptVoice)
                u.voice = ptVoice;
            let started = false;
            const done = () => { const i = keep.indexOf(u); if (i >= 0)
                keep.splice(i, 1); setTimeout(() => { speaking = false; }, 150); };
            u.onstart = () => { started = true; speaking = true; };
            u.onend = done;
            u.onerror = (e) => {
                done();
                if (e.error === 'not-allowed')
                    warn('O navegador bloqueou a leitura em voz. Clique na página e tente de novo.');
                else if (e.error === 'language-unavailable' || e.error === 'voice-unavailable')
                    warn('Não há voz em português instalada neste aparelho.');
            };
            keep.push(u);
            if (keep.length > 6)
                keep.shift();
            synth.resume();
            synth.speak(u);
            checkT = window.setTimeout(() => {
                if (!started && !synth.speaking)
                    warn('A leitura não tocou. Confira o volume e se o navegador permite som nesta página.');
            }, 3000);
            window.setTimeout(() => { if (speaking && !synth.speaking)
                speaking = false; }, 10000);
        }, 60);
    }
    const hush = () => { clearTimeout(speakT); synth?.cancel(); };
    const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const WORDS = {
        zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
        dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
        dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cincoenta: 50,
        sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200,
        trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
    };
    function parseNum(raw) {
        const t = strip(raw);
        const m = t.replace(/(\d)[.\s](?=\d{3}\b)/g, '$1').match(/\d+/);
        if (m)
            return Number(m[0]);
        let total = 0, part = 0, hit = false;
        for (const w of t.split(/[\s-]+/)) {
            if (w === 'e' || !w)
                continue;
            if (w === 'mil') {
                part = (part || 1) * 1000;
                total += part;
                part = 0;
                hit = true;
                continue;
            }
            if (w in WORDS) {
                part += WORDS[w];
                hit = true;
            }
            else if (hit)
                break;
        }
        return hit ? total + part : null;
    }
    function command(raw) {
        const t = strip(raw);
        if (/desligar (o )?microfone/.test(t)) {
            stopListen();
            toast('microfone desligado');
            return true;
        }
        if (/\b(play|comecar|comeca|iniciar|inicia|jogar|vamos)\b/.test(t)) {
            if (phase === 'idle' || phase === 'done')
                play();
            else if (phase === 'pause')
                resume();
            return true;
        }
        if (/\bpaus/.test(t)) {
            pause();
            return true;
        }
        if (/continu|retom|voltar/.test(t)) {
            resume();
            return true;
        }
        if (/pular|proxim|passa/.test(t)) {
            skip();
            return true;
        }
        if (/repet|de novo|outra vez/.test(t)) {
            if (phase === 'run')
                speak(sayP(cur()), true);
            return true;
        }
        if (/\b(parar|pare|encerrar|sair)\b/.test(t)) {
            stopSession();
            return true;
        }
        return false;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null;
    let consumed = false;
    function startListen() {
        if (!SR) {
            toast('Reconhecimento de voz não disponível neste navegador. Use o Chrome ou o Edge.');
            cfg.listen = false;
            syncCfg();
            return;
        }
        if (!rec) {
            rec = new SR();
            rec.lang = 'pt-BR';
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++)
                onVoice(String(e.results[i][0].transcript), Boolean(e.results[i].isFinal)); };
            rec.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
                    cfg.listen = false;
                    saveCfg();
                    syncCfg();
                    micEl.hidden = true;
                    toast('O microfone foi bloqueado aqui. Permita o microfone ou abra o arquivo sessao.html no Chrome/Edge.');
                }
            };
            rec.onend = () => { if (cfg.listen)
                setTimeout(() => { try {
                    rec.start();
                }
                catch { } }, 250);
            else
                micEl.hidden = true; };
        }
        cfg.listen = true;
        saveCfg();
        syncCfg();
        micEl.hidden = false;
        micTxt.textContent = '';
        try {
            rec.start();
        }
        catch { }
    }
    function stopListen() {
        cfg.listen = false;
        saveCfg();
        syncCfg();
        micEl.hidden = true;
        try {
            rec?.stop();
        }
        catch { }
    }
    function onVoice(text, final) {
        micTxt.textContent = '“' + text.trim() + '”';
        if (consumed) {
            if (final)
                consumed = false;
            return;
        }
        if (speaking)
            return;
        if (final && command(text))
            return;
        if (phase !== 'run')
            return;
        const n = parseNum(text);
        if (n === null)
            return;
        if (n === cur().answer) {
            setTyped(String(n));
            resolve(String(n));
            if (!final)
                consumed = true;
        }
        else if (final)
            resolve(String(n));
    }
    function view(v) {
        histEl.hidden = v !== 'hist';
        document.body.classList.toggle('in-hist', v === 'hist');
        idleEl.hidden = v !== 'idle';
        runEl.hidden = v !== 'run';
        resEl.hidden = v !== 'res';
        document.body.classList.toggle('running', phase === 'run' || phase === 'feedback');
    }
    function renderDots() {
        dotsEl.innerHTML = Array.from({ length: Q }, (_, i) => {
            const r = results[i];
            const c = r ? (r.ok ? 'ok' : 'x') : i === qi ? 'cur' : '';
            return `<i class="${c}"></i>`;
        }).join('');
    }
    function renderClock() {
        const s = Math.max(0, left / 1000);
        const low = s <= 5;
        secsEl.innerHTML = `${Math.ceil(s)}<small>s</small>`;
        secsEl.classList.toggle('low', low);
        barEl.classList.toggle('low', low);
        barI.style.width = `${(left / LIMIT) * 100}%`;
    }
    function setTyped(v) {
        inp.value = v;
        const want = String(cur().answer);
        ansEl.className = v.length >= want.length && v !== want ? 'bad' : '';
        ansEl.innerHTML = `<span class="eq">=</span>${v}<span class="caret"></span>`;
        abacus(v);
    }
    function setPP() {
        const paused = phase === 'pause';
        ppBtn.innerHTML = paused ? `${ICON.play}<span>continuar</span>` : `${ICON.pause}<span>pausar</span>`;
        ppBtn.title = paused ? 'Continuar (esc)' : 'Pausar (esc)';
    }
    function renderAvg() {
        if (!history.length) {
            avgEl.innerHTML = 'nenhuma sessão ainda';
            return;
        }
        const pct = Math.round(history.reduce((s, h) => s + h.ok / h.n, 0) / history.length * 100);
        const contas = history.reduce((t, h) => t + h.n, 0);
        avgEl.innerHTML = `média geral <b>${pct}%</b> · <b>${history.length}</b> ${history.length === 1 ? 'sessão' : 'sessões'} · <b>${contas}</b> contas`;
    }
    const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
    const cfgLabel = (h) => {
        if (!h.ops)
            return '—';
        const parts = [];
        const as = h.ops.filter(o => o === 'add' || o === 'sub').map(o => SYM[o]).join(' ');
        const md = h.ops.filter(o => o === 'mul' || o === 'div').map(o => SYM[o]).join(' ');
        if (as)
            parts.push(`${as} ${h.a ?? 2} alg.`);
        if (md)
            parts.push(`${md} ${h.l === '2x2' ? '2×2' : '2×1'}`);
        return parts.join(' · ');
    };
    let histMore = 20, histFrom = 'idle';
    function openHist() {
        if (phase === 'run' || phase === 'feedback' || phase === 'pause')
            return;
        histFrom = phase === 'done' ? 'res' : 'idle';
        histMore = 20;
        renderHist();
        view('hist');
    }
    function closeHist() { view(histFrom); }
    function renderHist() {
        if (!history.length) {
            histEl.innerHTML = `<div class="hhead"><h2>histórico</h2><button class="lnk" data-h="back">voltar</button></div><p class="empty">Nenhuma sessão ainda. Termine uma sessão de 10 questões e ela aparece aqui.</p>`;
            return;
        }
        const now = new Date(), todayK = dayKey(now);
        const byDay = new Map();
        for (const h of history) {
            const k = dayKey(new Date(h.d));
            (byDay.get(k) ?? byDay.set(k, []).get(k)).push(h);
        }
        const sum = (a, f) => a.reduce((t, h) => t + f(h), 0);
        const contas = sum(history, h => h.n), acertos = sum(history, h => h.ok);
        const tempo = sum(history, h => h.ms * h.n) / 1000;
        const todays = byDay.get(todayK) ?? [];
        const start7 = new Date(now);
        start7.setHours(0, 0, 0, 0);
        start7.setDate(start7.getDate() - 6);
        const week = history.filter(h => new Date(h.d) >= start7);
        let streak = 0;
        const c = new Date(now);
        c.setHours(12);
        if (!byDay.has(todayK))
            c.setDate(c.getDate() - 1);
        while (byDay.has(dayKey(c))) {
            streak++;
            c.setDate(c.getDate() - 1);
        }
        let best = 0, run = 0;
        const keys = [...byDay.keys()].sort();
        for (let i = 0; i < keys.length; i++) {
            const prev = i ? new Date(keys[i - 1] + 'T12:00') : null, curD = new Date(keys[i] + 'T12:00');
            run = prev && Math.round((curD.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1;
            best = Math.max(best, run);
        }
        const fmtT = (s) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round(s % 3600 / 60)}min` : s >= 60 ? `${Math.round(s / 60)}min` : `${Math.round(s)}s`;
        const WEEKS = 15, end = new Date(now);
        end.setHours(12, 0, 0, 0);
        const first = new Date(end);
        first.setDate(first.getDate() - first.getDay() - (WEEKS - 1) * 7);
        let cells = '';
        for (let w = 0; w < WEEKS; w++)
            for (let d = 0; d < 7; d++) {
                const day = new Date(first);
                day.setDate(first.getDate() + w * 7 + d);
                if (day > end) {
                    cells += '<i class="fut"></i>';
                    continue;
                }
                const n = byDay.get(dayKey(day))?.length ?? 0;
                const lv = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
                cells += `<i class="l${lv}" title="${day.toLocaleDateString('pt-BR')}: ${plural(n, 'sessão', 'sessões')}"></i>`;
            }
        const graded = history.filter(h => h.g);
        const gc = ['SS', 'S', 'A', 'B', 'C', 'D'].map(g => ({ g, n: graded.filter(h => h.g === g).length }));
        const gmax = Math.max(1, ...gc.map(x => x.n));
        const order = ['D', 'C', 'B', 'A', 'S', 'SS'];
        const bestG = graded.length ? graded.reduce((b, h) => order.indexOf(h.g) > order.indexOf(b) ? h.g : b, 'D') : '—';
        const rows = history.slice().reverse().slice(0, histMore).map(h => {
            const d = new Date(h.d);
            return `<tr><td>${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span class="dim">${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></td>
        <td>${cfgLabel(h)}</td><td class="r">${h.ok}/${h.n}</td><td class="r">${(h.ms / 1000).toFixed(1)}s</td><td class="r">${h.g ? `<b class="gl g-${h.g}">${h.g}</b>` : '<span class="dim">—</span>'}</td></tr>`;
        }).join('');
        histEl.innerHTML = `
      <div class="hhead"><h2>histórico</h2><button class="lnk" data-h="back">voltar <kbd>esc</kbd></button></div>
      <div class="kpis">
        <div>sessões feitas<b>${history.length}</b></div>
        <div>contas feitas<b>${contas}</b><span>${acertos} certas · ${Math.round(acertos / contas * 100)}%</span></div>
        <div>sessões hoje<b>${todays.length}</b><span>${sum(todays, h => h.n)} contas</span></div>
        <div>sessões em 7 dias<b>${week.length}</b><span>${sum(week, h => h.n)} contas</span></div>
        <div>dias seguidos<b>${streak}</b><span>recorde ${best}</span></div>
        <div>tempo treinado<b>${fmtT(tempo)}</b><span>melhor nota ${bestG}</span></div>
      </div>
      <div class="hgrid">
        <div class="card"><h3>atividade · últimas ${WEEKS} semanas</h3><div class="heat">${cells}</div>
          <div class="legend">menos <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> mais</div></div>
        <div class="card"><h3>notas</h3>${graded.length ? `<div class="gbars">${gc.map(x => `<div><b class="gl g-${x.g}">${x.g}</b><span class="track"><i style="width:${x.n / gmax * 100}%"></i></span><em>${x.n}</em></div>`).join('')}</div>` : '<p class="empty">As notas aparecem nas próximas sessões.</p>'}</div>
      </div>
      <div class="card"><h3>sessões</h3>
        <div class="tbl"><table><thead><tr><th>quando</th><th>contas</th><th class="r">acertos</th><th class="r">tempo médio</th><th class="r">nota</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="tacts">${history.length > histMore ? `<button class="lnk" data-h="more">mostrar mais (${history.length - histMore})</button>` : ''}<button class="lnk danger" data-h="clear">apagar histórico</button></div>
      </div>`;
    }
    histEl.addEventListener('click', e => {
        const b = e.target.closest('[data-h]');
        if (!b)
            return;
        if (b.dataset.h === 'back')
            closeHist();
        else if (b.dataset.h === 'more') {
            histMore += 30;
            renderHist();
        }
        else if (b.dataset.h === 'clear') {
            if (!confirm(`Apagar as ${history.length} sessões do histórico? Isso não pode ser desfeito.`))
                return;
            history.splice(0);
            store.set('sessoes', history);
            renderAvg();
            renderHist();
            toast('histórico apagado');
        }
    });
    avgEl.addEventListener('click', openHist);
    function renderDesc() {
        const parts = [];
        if (cfg.ops.includes('add') || cfg.ops.includes('sub')) {
            parts.push([cfg.ops.includes('add') ? 'soma' : '', cfg.ops.includes('sub') ? 'subtração' : ''].filter(Boolean).join(' e ') + ` com ${cfg.addLen} algarismos`);
        }
        const md = [cfg.ops.includes('mul') ? 'multiplicação' : '', cfg.ops.includes('div') ? 'divisão' : ''].filter(Boolean).join(' e ');
        if (md)
            parts.push(`${md} ${cfg.level === '2x1' ? 'com 2 algarismos × 1' : 'com 2 algarismos × 2'}`);
        descEl.textContent = 'Contas aleatórias: ' + parts.join(' · ') + '. No final, a sua média de acertos e uma nota.';
        idleScale.innerHTML = scaleHTML(cfgPar());
    }
    function play() {
        primed = true;
        clearTimeout(feedbackT);
        set = makeSet();
        results = [];
        qi = 0;
        startQuestion();
    }
    function startQuestion() {
        phase = 'run';
        left = LIMIT;
        last = performance.now();
        view('run');
        qnEl.innerHTML = `questão <b>${qi + 1}</b>/${Q}`;
        probEl.innerHTML = fmtHTML(cur());
        msgEl.textContent = '';
        msgEl.className = '';
        stage.classList.remove('paused');
        setTyped('');
        renderDots();
        renderClock();
        setPP();
        focus();
        speak(sayP(cur()));
    }
    function resolve(given, timeout = false) {
        if (phase !== 'run')
            return;
        const p = cur();
        const ok = !timeout && given !== '' && Number(given) === p.answer;
        results.push({ p, given: given || '—', ok, ms: Math.min(LIMIT, LIMIT - left), timeout });
        phase = 'feedback';
        renderDots();
        inp.value = '';
        if (ok) {
            msgEl.textContent = 'certo!';
            msgEl.className = 'good';
            void ansEl.offsetWidth;
            ansEl.classList.add('ok');
        }
        else {
            ansEl.className = '';
            ansEl.innerHTML = `<span class="eq">=</span>${given ? `<s>${given}</s>` : ''}<span class="fix">${p.answer}</span>`;
            abacus(String(p.answer));
            msgEl.textContent = timeout ? 'tempo esgotado' : given ? 'errado' : 'pulada';
            msgEl.className = '';
            if (given || timeout)
                errorBeep();
            if (timeout)
                window.setTimeout(() => speak(`tempo. ${p.answer}`), 250);
        }
        feedbackT = window.setTimeout(next, ok ? 550 : 1500);
    }
    function next() {
        qi++;
        if (qi >= Q)
            finish();
        else
            startQuestion();
    }
    function pause() {
        if (phase !== 'run')
            return;
        phase = 'pause';
        stage.classList.add('paused');
        document.body.classList.remove('running');
        hush();
        setPP();
        inp.blur();
    }
    function resume() {
        if (phase !== 'pause')
            return;
        phase = 'run';
        last = performance.now();
        stage.classList.remove('paused');
        document.body.classList.add('running');
        setPP();
        focus();
        speak(sayP(cur()));
    }
    const skip = () => { if (phase === 'run')
        resolve(''); };
    function stopSession() {
        if (phase === 'idle')
            return;
        clearTimeout(feedbackT);
        hush();
        phase = 'idle';
        view('idle');
        toast('sessão encerrada');
    }
    function finish() {
        phase = 'done';
        hush();
        const ok = results.filter(r => r.ok).length;
        const ms = results.reduce((s, r) => s + r.ms, 0) / results.length;
        const nota = grade(results, ms);
        history.push({ d: new Date().toISOString(), ok, n: Q, ms, g: nota.g, ops: [...cfg.ops], a: cfg.addLen, l: cfg.level, to: results.filter(r => r.timeout).length });
        if (history.length > 500)
            history.splice(0, history.length - 500);
        store.set('sessoes', history);
        renderAvg();
        renderResults(ok, ms, nota);
        view('res');
        speak(`Fim da sessão. ${ok} de ${Q}. Média de ${Math.round(ok / Q * 100)} por cento. Nota ${nota.g.split('').join(' ')}.`);
    }
    function renderResults(ok, avgMs, nota) {
        const pct = Math.round((ok / Q) * 100);
        const okRes = results.filter(r => r.ok);
        const fastest = okRes.length ? Math.min(...okRes.map(r => r.ms)) / 1000 : 0;
        const timeouts = results.filter(r => r.timeout).length;
        const allPct = Math.round(history.reduce((s, h) => s + h.ok / h.n, 0) / history.length * 100);
        const today = new Date().toDateString();
        const todays = history.filter(h => new Date(h.d).toDateString() === today);
        const todayPct = Math.round(todays.reduce((s, h) => s + h.ok / h.n, 0) / todays.length * 100);
        const prevBest = Math.max(0, ...history.slice(0, -1).map(h => h.ok));
        const recent = history.slice(-14);
        const list = results.map((r, i) => `<div class="${r.ok ? 'ok' : 'x'}"><span class="n">${i + 1}</span><span class="c">${fmt(r.p)} = <b>${r.p.answer}</b>${r.ok ? '' : ` <em>(${r.timeout ? 'tempo' : r.given})</em>`}</span><span class="t">${(r.ms / 1000).toFixed(1)}s</span></div>`).join('');
        resEl.innerHTML = `
      <div class="rtop">
        <div class="big">média de acertos<b>${pct}%</b><span>${ok} de ${Q} questões</span></div>
        <div class="grade g-${nota.g}" title="${nota.what}">nota<b>${nota.g}</b><span>${nota.what}</span></div>
        <div class="row">
          <div>tempo médio<b>${(avgMs / 1000).toFixed(1)}s</b></div>
          <div>mais rápida<b>${okRes.length ? fastest.toFixed(1) + 's' : '—'}</b></div>
          <div>tempo esgotado<b>${timeouts}</b></div>
          <div>melhor sessão<b>${Math.max(prevBest, ok)}/${Q}${ok > prevBest && history.length > 1 ? ' novo!' : ''}</b></div>
        </div>
      </div>
      <div class="scale" aria-label="escala de notas desta sessão">${scaleHTML(results.reduce((t, r) => t + par(r.p), 0) / results.length, nota.g)}</div>
      <div class="list">${list}</div>
      <div class="hist">
        <div>
          <h2>média geral: ${allPct}% em ${history.length} ${history.length === 1 ? 'sessão' : 'sessões'}</h2>
          <p>hoje: ${todays.length} ${todays.length === 1 ? 'sessão' : 'sessões'}, média de ${todayPct}%</p>
        </div>
        <div class="spark" title="últimas sessões">${recent.map((h, i) => `<i class="${i === recent.length - 1 ? 'last' : ''}" style="height:${Math.max(4, (h.ok / h.n) * 66)}px" title="${h.ok}/${h.n}"></i>`).join('')}</div>
      </div>
      <div class="acts"><button id="again">${ICON.play}jogar de novo</button><button id="seeHist">ver histórico</button></div>`;
        $('#again').addEventListener('click', play);
        $('#seeHist').addEventListener('click', openHist);
    }
    window.setInterval(() => {
        const now = performance.now();
        if (phase === 'run') {
            left -= now - last;
            renderClock();
            if (left <= 0) {
                left = 0;
                renderClock();
                resolve(inp.value.replace(/\D/g, ''), true);
            }
        }
        last = now;
    }, 100);
    function syncCfg() {
        nav.querySelectorAll('[data-op]').forEach(b => { const on = cfg.ops.includes(b.dataset.op); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        nav.querySelectorAll('[data-v]').forEach(b => { const on = cfg.level === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        nav.querySelectorAll('[data-a]').forEach(b => { const on = String(cfg.addLen) === b.dataset.a; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        nav.querySelectorAll('[data-t]').forEach(b => { const on = Boolean(cfg[b.dataset.t]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        renderDesc();
    }
    nav.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b)
            return;
        primed = true;
        if (b.dataset.op) {
            const op = b.dataset.op;
            if (cfg.ops.includes(op)) {
                if (cfg.ops.length > 1)
                    cfg.ops = cfg.ops.filter(o => o !== op);
                else
                    toast('deixe pelo menos uma operação');
            }
            else
                cfg.ops = [...cfg.ops, op];
        }
        else if (b.dataset.v)
            cfg.level = b.dataset.v;
        else if (b.dataset.a)
            cfg.addLen = Number(b.dataset.a);
        else if (b.dataset.t === 'listen') {
            if (cfg.listen)
                stopListen();
            else
                startListen();
            return;
        }
        else if (b.dataset.t === 'speak') {
            warned = false;
            cfg.speak = !cfg.speak;
            toast(cfg.speak ? 'leitura ligada' : 'leitura desligada');
            if (cfg.speak)
                speak('leitura ligada');
            else
                hush();
        }
        saveCfg();
        syncCfg();
    });
    function focus() { if (phase === 'run')
        inp.focus({ preventScroll: true }); }
    $('#playBig').addEventListener('click', play);
    ppBtn.addEventListener('click', () => (phase === 'pause' ? resume() : pause()));
    $('#skip').addEventListener('click', skip);
    $('#stop').addEventListener('click', stopSession);
    stage.addEventListener('click', () => { if (phase === 'pause')
        resume();
    else
        focus(); });
    inp.addEventListener('focus', () => stage.classList.remove('blur'));
    inp.addEventListener('blur', () => { if (phase === 'run')
        stage.classList.add('blur'); });
    for (const ev of ['pointerdown', 'keydown'])
        document.addEventListener(ev, () => { primed = true; if (cfg.speak)
            keepAwake(); });
    inp.addEventListener('input', () => {
        if (phase !== 'run') {
            inp.value = '';
            return;
        }
        const v = inp.value.replace(/\D/g, '').slice(0, 9);
        setTyped(v);
        if (v === String(cur().answer))
            resolve(v);
    });
    document.addEventListener('keydown', e => {
        const k = e.key;
        if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'm') {
            e.preventDefault();
            if (cfg.listen)
                stopListen();
            else
                startListen();
            return;
        }
        if (!histEl.hidden) {
            if (k === 'Escape' || k.toLowerCase() === 'h') {
                e.preventDefault();
                closeHist();
            }
            return;
        }
        if (k.toLowerCase() === 'h' && (phase === 'idle' || phase === 'done') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            openHist();
            return;
        }
        if (k === 'Tab') {
            e.preventDefault();
            play();
            return;
        }
        if (phase === 'idle' || phase === 'done') {
            if (k === 'Enter' || k === ' ') {
                e.preventDefault();
                play();
            }
            return;
        }
        if (k === 'Escape') {
            e.preventDefault();
            if (phase === 'run')
                pause();
            else
                resume();
            return;
        }
        if (phase === 'pause') {
            if (k === 'Enter' || k === ' ') {
                e.preventDefault();
                resume();
            }
            return;
        }
        if (phase !== 'run')
            return;
        if (document.activeElement !== inp && /^\d$/.test(k))
            focus();
        if (k === 'Enter' || k === ' ') {
            e.preventDefault();
            const v = inp.value.replace(/\D/g, '');
            if (v)
                resolve(v);
        }
    });
    document.addEventListener('mousemove', () => { if (phase === 'run')
        document.body.classList.remove('running'); });
    inp.addEventListener('keydown', () => { if (phase === 'run')
        document.body.classList.add('running'); });
    let toastT = 0;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastT);
        toastT = window.setTimeout(() => toastEl.classList.remove('show'), 3800);
    }
    syncCfg();
    renderAvg();
    setPP();
    view('idle');
    if (cfg.listen)
        startListen();
})();
