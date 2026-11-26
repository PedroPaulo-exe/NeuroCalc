"use strict";
(() => {
    const $ = (s) => document.querySelector(s);
    const SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
    const SAY = { add: 'mais', sub: 'menos', mul: 'vezes', div: 'dividido por' };
    const NAME = { add: 'soma', sub: 'subtração', mul: 'multiplicação', div: 'divisão', mix: 'aleatório' };
    const OPS = ['add', 'sub', 'mul', 'div'];
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
    const defaults = { mode: 'add', digits: 2, terms: 2, lenType: 'time', time: 60, count: 25, speak: true, listen: false, goal: 50 };
    const cfg = { ...defaults, ...store.get('cfg', {}) };
    const saveCfg = () => store.set('cfg', cfg);
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const lo = (n) => (n === 1 ? 1 : 10 ** (n - 1));
    const hi = (n) => 10 ** n - 1;
    const num = (n) => ri(lo(n), hi(n));
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    function make(op) {
        const n = cfg.digits;
        if (op === 'add') {
            const t = Array.from({ length: cfg.terms }, () => num(n));
            return { op, terms: t, answer: sum(t) };
        }
        if (op === 'sub') {
            if (cfg.terms === 2) {
                let a = num(n), b = num(n);
                for (let i = 0; a === b && i < 20; i++)
                    b = num(n);
                if (b > a)
                    [a, b] = [b, a];
                return { op, terms: [a, b], answer: a - b };
            }
            const rest = Array.from({ length: cfg.terms - 1 }, () => num(n));
            const r = num(n);
            return { op, terms: [r + sum(rest), ...rest], answer: r };
        }
        if (op === 'mul') {
            const a = n === 1 ? ri(2, 9) : num(n);
            const b = n <= 2 ? ri(2, 9) : ri(11, 99);
            return { op, terms: [a, b], answer: a * b };
        }
        for (let i = 0; i < 200; i++) {
            const d = n <= 2 ? ri(2, 9) : ri(11, 99);
            const qmin = Math.max(2, Math.ceil(lo(n) / d));
            const qmax = Math.floor(hi(n) / d);
            if (qmax < qmin)
                continue;
            const q = ri(qmin, qmax);
            return { op, terms: [d * q, d], answer: q };
        }
        return { op, terms: [8, 2], answer: 4 };
    }
    const pickOp = () => (cfg.mode === 'mix' ? OPS[ri(0, 3)] : cfg.mode);
    const fresh = () => make(pickOp());
    const fmtHTML = (p) => p.terms.join(` <span class="op">${SYM[p.op]}</span> `);
    const fmt = (p) => p.terms.join(` ${SYM[p.op]} `);
    const sayP = (p) => p.terms.join(` ${SAY[p.op]} `);
    const probEl = $('#prob'), ansEl = $('#ans'), nextEl = $('#next'), liveEl = $('#live');
    const inp = $('#inp'), stage = $('#stage'), testEl = $('#test'), resEl = $('#res');
    const todayEl = $('#today'), micEl = $('#mic'), micTxt = $('#micTxt'), toastEl = $('#toast'), nav = $('#cfg');
    let queue = [];
    let cur = fresh();
    let entries = [];
    let running = false, finished = false, locked = false, primed = false;
    let t0 = 0, tEnd = 0, pStart = 0, timer = 0, lockTimer = 0;
    const RODS = 7;
    const abEl = $('#abaco');
    const heaven = [];
    const earth = [];
    (() => {
        const W = RODS * 40 + 16;
        let s = `<svg viewBox="0 0 ${W} 156" xmlns="http://www.w3.org/2000/svg">`;
        s += `<rect x="2" y="4" width="${W - 4}" height="148" rx="7" fill="#2c2e31" stroke="#646669" stroke-width="3"/>`;
        for (let i = 0; i < RODS; i++) {
            const x = 28 + i * 40;
            s += `<line x1="${x}" y1="6" x2="${x}" y2="150" stroke="#646669" stroke-width="2.5"/>`;
        }
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
            const h = heaven[i];
            h.classList.toggle('on', d >= 5);
            h.style.transform = d >= 5 ? 'translateY(18px)' : '';
            earth[i].forEach((b, j) => {
                const on = j < d % 5;
                b.classList.toggle('on', on);
                b.style.transform = on ? 'translateY(-20px)' : '';
            });
        }
    }
    const pad = (n) => String(n).padStart(2, '0');
    const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const days = store.get('days', {});
    const todayDay = () => days[dkey(new Date())] || { n: 0, ok: 0 };
    function tally(ok) {
        const k = dkey(new Date());
        const d = days[k] || { n: 0, ok: 0 };
        d.n++;
        if (ok)
            d.ok++;
        days[k] = d;
        store.set('days', days);
        renderToday();
    }
    function streak() {
        const d = new Date();
        if (!days[dkey(d)]?.n)
            d.setDate(d.getDate() - 1);
        let s = 0;
        while (days[dkey(d)]?.n) {
            s++;
            d.setDate(d.getDate() - 1);
        }
        return s;
    }
    function renderToday() {
        const t = todayDay(), s = streak();
        const pct = Math.min(100, (t.ok / cfg.goal) * 100);
        todayEl.innerHTML = `hoje <b>${t.ok}</b>/${cfg.goal} <span class="meter"><i style="width:${pct}%"></i></span> sequência <b>${s}</b> ${s === 1 ? 'dia' : 'dias'}`;
    }
    todayEl.addEventListener('click', () => {
        const goals = [25, 50, 100, 200];
        cfg.goal = goals[(goals.indexOf(cfg.goal) + 1) % goals.length];
        saveCfg();
        renderToday();
        toast(`meta diária: ${cfg.goal} acertos`);
        focus();
    });
    let speaking = false;
    let ptVoice;
    const pickVoice = () => { ptVoice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('pt-br')) || speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('pt')); };
    if ('speechSynthesis' in window) {
        pickVoice();
        speechSynthesis.onvoiceschanged = pickVoice;
    }
    const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    const keep = [];
    let speakT = 0, checkT = 0, warned = false;
    function warn(msg) { if (!warned) {
        warned = true;
        toast(msg);
    } }
    function speak(text, force = false) {
        if ((!cfg.speak && !force) || !primed)
            return;
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
            const done = () => {
                const i = keep.indexOf(u);
                if (i >= 0)
                    keep.splice(i, 1);
                setTimeout(() => { speaking = false; }, 150);
            };
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
                    warn('A leitura não tocou. Confira o volume e se o navegador permite som nesta página (ou abra o soroban.html no Chrome).');
            }, 3000);
            window.setTimeout(() => { if (speaking && !synth.speaking)
                speaking = false; }, 10000);
        }, 60);
    }
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
        const joined = t.replace(/(\d)[.\s](?=\d{3}\b)/g, '$1');
        const m = joined.match(/\d+/);
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
        const setMode = (m) => { cfg.mode = m; saveCfg(); syncCfg(); restart(); toast(`modo: ${NAME[m]}`); };
        if (/\b(parar|desligar|pare)\b/.test(t)) {
            stopListen();
            toast('microfone desligado');
            return true;
        }
        if (/proxim|pular|passa/.test(t)) {
            if (!finished)
                skip();
            else
                restart();
            return true;
        }
        if (/repet|de novo|outra vez/.test(t)) {
            speak(sayP(cur), true);
            return true;
        }
        if (/reinici|recomec|novo teste|comecar/.test(t)) {
            restart();
            return true;
        }
        if (/\b(soma|somar|adicao)\b/.test(t)) {
            setMode('add');
            return true;
        }
        if (/subtra/.test(t)) {
            setMode('sub');
            return true;
        }
        if (/multiplica/.test(t)) {
            setMode('mul');
            return true;
        }
        if (/divis|dividir/.test(t)) {
            setMode('div');
            return true;
        }
        if (/aleat|mistur/.test(t)) {
            setMode('mix');
            return true;
        }
        const dg = t.match(/\b(um|1|dois|2|tres|3) algarismos?\b/);
        if (dg) {
            cfg.digits = { um: 1, dois: 2, tres: 3 }[dg[1]] || Number(dg[1]);
            saveCfg();
            syncCfg();
            restart();
            toast(`${cfg.digits} algarismo${cfg.digits > 1 ? 's' : ''}`);
            return true;
        }
        if (/\btempo\b/.test(t)) {
            cfg.lenType = 'time';
            saveCfg();
            syncCfg();
            restart();
            return true;
        }
        if (/\bcontas\b/.test(t)) {
            cfg.lenType = 'count';
            saveCfg();
            syncCfg();
            restart();
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
            rec.maxAlternatives = 1;
            rec.onresult = (e) => {
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i];
                    onVoice(String(r[0].transcript), Boolean(r.isFinal));
                }
            };
            rec.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
                    cfg.listen = false;
                    saveCfg();
                    syncCfg();
                    toast('O microfone foi bloqueado aqui. Permita o microfone ou abra o arquivo soroban.html no Chrome/Edge para usar a voz.');
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
    const toggleListen = () => (cfg.listen ? stopListen() : startListen());
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
        if (finished || locked)
            return;
        const n = parseNum(text);
        if (n === null)
            return;
        if (n === cur.answer) {
            if (!running)
                start();
            setTyped(String(n));
            answer(String(n));
            if (!final)
                consumed = true;
        }
        else if (final) {
            if (!running)
                start();
            answer(String(n));
        }
    }
    const elapsed = () => (running ? performance.now() - t0 : finished ? tEnd - t0 : 0);
    function updateLive() {
        const ok = entries.filter(e => e.ok).length, bad = entries.length - ok;
        const main = cfg.lenType === 'time'
            ? String(Math.max(0, Math.ceil(cfg.time - elapsed() / 1000)))
            : `${entries.length}/${cfg.count}`;
        liveEl.innerHTML = `<b>${main}</b>` + (running ? `<span>acertos ${ok} · erros ${bad}</span>` : `<span>${NAME[cfg.mode]} · ${cfg.digits} alg.${showTerms() ? ' · ' + cfg.terms + ' parcelas' : ''} — comece a digitar</span>`);
    }
    function setTyped(v) {
        inp.value = v;
        const want = String(cur.answer);
        ansEl.className = v.length >= want.length && v !== want ? 'bad' : '';
        ansEl.innerHTML = `<span class="eq">=</span>${v}<span class="caret"></span>`;
        abacus(v);
    }
    function show() {
        probEl.innerHTML = fmtHTML(cur);
        nextEl.textContent = queue.slice(0, 2).map(fmt).join('     ');
        setTyped('');
        pStart = performance.now();
    }
    function advance() {
        if (finished)
            return;
        cur = queue.shift() || fresh();
        queue.push(fresh());
        show();
        speak(sayP(cur));
    }
    function start() {
        running = true;
        t0 = performance.now();
        pStart = t0;
        document.body.classList.add('typing');
        clearInterval(timer);
        timer = window.setInterval(() => {
            updateLive();
            if (cfg.lenType === 'time' && elapsed() >= cfg.time * 1000)
                finish();
        }, 100);
    }
    function answer(given) {
        if (finished || locked)
            return;
        if (!running)
            start();
        const ok = given !== '' && Number(given) === cur.answer;
        entries.push({ p: cur, ok, ms: performance.now() - pStart, given: given || '—' });
        tally(ok);
        if (ok) {
            advance();
            void ansEl.offsetWidth;
            ansEl.classList.add('ok');
        }
        else {
            locked = true;
            ansEl.className = '';
            ansEl.innerHTML = `<span class="eq">=</span>${given ? `<s>${given}</s>` : ''}<span class="fix">${cur.answer}</span>`;
            abacus(String(cur.answer));
            inp.value = '';
            lockTimer = window.setTimeout(() => { locked = false; advance(); }, 900);
        }
        updateLive();
        if (cfg.lenType === 'count' && entries.length >= cfg.count)
            finish();
    }
    const skip = () => { if (!finished && !locked)
        answer(''); };
    function restart() {
        clearInterval(timer);
        clearTimeout(lockTimer);
        running = false;
        finished = false;
        locked = false;
        consumed = false;
        entries = [];
        queue = [fresh(), fresh(), fresh()];
        cur = fresh();
        resEl.hidden = true;
        testEl.hidden = false;
        document.body.classList.remove('typing');
        show();
        updateLive();
        focus();
        speak(sayP(cur));
    }
    function finish() {
        if (finished)
            return;
        finished = true;
        running = false;
        tEnd = performance.now();
        clearInterval(timer);
        clearTimeout(lockTimer);
        locked = false;
        document.body.classList.remove('typing');
        inp.blur();
        renderResults();
    }
    function renderResults() {
        const n = entries.length;
        const good = entries.filter(e => e.ok);
        const ok = good.length;
        const secs = cfg.lenType === 'time' ? cfg.time : Math.max(1, (tEnd - t0) / 1000);
        const cpm = ok / (secs / 60);
        const acc = n ? Math.round((ok / n) * 100) : 0;
        const avg = ok ? sum(good.map(e => e.ms)) / ok / 1000 : 0;
        const fastest = ok ? Math.min(...good.map(e => e.ms)) / 1000 : 0;
        const len = cfg.lenType === 'time' ? `${cfg.time}s` : `${cfg.count} contas`;
        const key = `${cfg.mode}|${cfg.digits}|${showTerms() ? cfg.terms : 0}|${len}`;
        const bests = store.get('best', {});
        const prev = bests[key] || 0;
        const isBest = ok > 0 && cpm > prev;
        if (isBest) {
            bests[key] = cpm;
            store.set('best', bests);
        }
        const maxMs = Math.max(1, ...entries.map(e => e.ms));
        const bars = entries.map(e => `<i class="${e.ok ? '' : 'x'}" style="height:${Math.max(2, (e.ms / maxMs) * 100)}%" title="${fmt(e.p)} = ${e.p.answer} · ${(e.ms / 1000).toFixed(1)}s"></i>`).join('');
        const misses = entries.filter(e => !e.ok);
        const t = todayDay(), s = streak();
        const week = [];
        const ref = new Date();
        const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const wkDays = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(ref);
            d.setDate(ref.getDate() - i);
            wkDays.push({ k: dkey(d), label: wd[d.getDay()], v: days[dkey(d)]?.ok || 0, today: i === 0 });
        }
        const wmax = Math.max(cfg.goal, ...wkDays.map(d => d.v));
        for (const d of wkDays)
            week.push(`<div class="${d.today ? 't' : ''}" title="${d.v} acertos"><i style="height:${Math.max(4, (d.v / wmax) * 52)}px"></i>${d.label}</div>`);
        resEl.innerHTML = `
      <div class="rtop">
        <div class="big">
          <div>cpm<b>${cpm.toFixed(1)}</b></div>
          <div>prec<b>${acc}%</b></div>
        </div>
        <div>
          <div class="chart" aria-label="tempo por conta">${bars || ''}</div>
          <div class="cap"><span>tempo por conta (amarelo = certa, vermelho = errada)</span><span>${(maxMs / 1000).toFixed(1)}s máx.</span></div>
        </div>
      </div>
      <div class="row">
        <div>teste<b>${NAME[cfg.mode]} ${cfg.digits} alg.${showTerms() ? ` ${cfg.terms}p` : ''}</b></div>
        <div>duração<b>${len}</b></div>
        <div>acertos/erros<b>${ok}/${n - ok}</b></div>
        <div>média<b>${avg.toFixed(2)}s</b></div>
        <div>mais rápida<b>${fastest.toFixed(2)}s</b></div>
        <div>recorde<b>${Math.max(prev, cpm).toFixed(1)}${isBest ? '<span class="new">novo!</span>' : ''}</b></div>
      </div>
      ${misses.length ? `<div class="miss">revise:<ul>${misses.slice(0, 12).map(e => `<li>${fmt(e.p)} = ${e.p.answer} <em>(${e.given})</em></li>`).join('')}</ul></div>` : ''}
      <div class="day">
        <div>
          <h2>hoje: ${t.ok} de ${cfg.goal} acertos${t.ok >= cfg.goal ? ' — meta cumprida' : ''}</h2>
          <p>sequência de ${s} ${s === 1 ? 'dia' : 'dias'} · ${t.n} contas feitas hoje</p>
          <div class="meter"><i style="width:${Math.min(100, (t.ok / cfg.goal) * 100)}%"></i></div>
        </div>
        <div class="week">${week.join('')}</div>
      </div>
      <div class="acts"><button id="again">próximo teste <kbd>tab</kbd></button></div>`;
        testEl.hidden = true;
        resEl.hidden = false;
        $('#again').addEventListener('click', restart);
        speak(`Fim. ${ok} acertos, ${acc} por cento de precisão.`);
    }
    const showTerms = () => cfg.mode === 'add' || cfg.mode === 'sub' || cfg.mode === 'mix';
    function syncCfg() {
        nav.querySelectorAll('.g').forEach(g => {
            const k = g.dataset.k;
            g.querySelectorAll('button').forEach(b => {
                const on = k === 'toggles' ? Boolean(cfg[b.dataset.t]) : String(cfg[k]) === b.dataset.v;
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', String(on));
            });
        });
        $('#termsG').hidden = $('#termsSep').hidden = !showTerms();
        $('#timeG').hidden = cfg.lenType !== 'time';
        $('#countG').hidden = cfg.lenType !== 'count';
    }
    nav.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b)
            return;
        const g = b.closest('.g');
        const k = g?.dataset.k;
        if (!k)
            return;
        if (k === 'toggles') {
            if (b.dataset.t === 'listen')
                toggleListen();
            else {
                primed = true;
                warned = false;
                cfg.speak = !cfg.speak;
                saveCfg();
                syncCfg();
                if (cfg.speak) {
                    toast('leitura ligada');
                    speak(sayP(cur));
                }
                else {
                    synth?.cancel();
                    toast('leitura desligada');
                }
            }
            focus();
            return;
        }
        const v = b.dataset.v;
        const c = cfg;
        c[k] = /^\d+$/.test(v) ? Number(v) : v;
        saveCfg();
        syncCfg();
        restart();
    });
    function focus() { if (!finished)
        inp.focus({ preventScroll: true }); }
    function prime() {
        if (primed)
            return;
        primed = true;
        if (!finished && !running)
            speak(sayP(cur));
    }
    inp.addEventListener('focus', () => stage.classList.remove('blur'));
    inp.addEventListener('blur', () => { if (!finished)
        stage.classList.add('blur'); });
    stage.addEventListener('click', focus);
    for (const ev of ['pointerdown', 'click', 'touchend'])
        document.addEventListener(ev, prime);
    inp.addEventListener('input', () => {
        if (finished || locked) {
            inp.value = '';
            return;
        }
        const v = inp.value.replace(/\D/g, '').slice(0, 9);
        if (v && !running)
            start();
        setTyped(v);
        if (v === String(cur.answer))
            answer(v);
    });
    document.addEventListener('keydown', e => {
        prime();
        if (e.key === 'Tab') {
            e.preventDefault();
            restart();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleListen();
            return;
        }
        if (finished) {
            if (e.key === 'Enter') {
                e.preventDefault();
                restart();
            }
            return;
        }
        if (document.activeElement !== inp && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            const tag = document.activeElement?.tagName;
            if (tag !== 'BUTTON' || /\d/.test(e.key))
                focus();
        }
        if (document.activeElement === inp) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (inp.value)
                    answer(inp.value.replace(/\D/g, ''));
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                skip();
            }
        }
    });
    document.addEventListener('mousemove', () => {
        if (running)
            document.body.classList.remove('typing');
    });
    inp.addEventListener('keydown', () => { if (running)
        document.body.classList.add('typing'); });
    let toastT = 0;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastT);
        toastT = window.setTimeout(() => toastEl.classList.remove('show'), 3800);
    }
    syncCfg();
    renderToday();
    restart();
    if (cfg.listen)
        startListen();
})();
