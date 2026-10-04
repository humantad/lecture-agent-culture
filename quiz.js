/* 오늘의 퀴즈 — 학습 도우미 위쪽 띠.
 *
 * 진행은 서버 시계 하나로 정해진다(`/api/quiz`). 이 파일은 1초마다 상태를 받아 그리기만 한다.
 * 정답은 공개 단계가 되어야 서버가 내려 주므로, 푸는 동안에는 화면에 없다.
 * 화면에 나오는 것은 닉네임뿐이고 학번은 입장할 때만 보낸다.
 */
(function () {
  var API = (window.PHILO_API_BASE || "").replace(/\/$/, "");
  if (!API) return;
  var vid = (window.philoVid && window.philoVid()) || (function () {
    var k = "philo-vid", v = "";
    try { v = localStorage.getItem(k) || ""; } catch (e) {}
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem(k, v); } catch (e) {} }
    return v;
  })();

  var box, state = null, joined = false, picked = -1, lastIdx = -1, timer = null, joinedQid = "";
  var order = [], myText = "", myNick = "", lastPhase = "", sound = true, sidDone = false;
  var MEDAL = ["🥇", "🥈", "🥉"];
  // 학번·닉네임은 기기에 남기지 않는다(2026-10-04 교수 결정) — 퀴즈마다 다시 적는다.
  // myNick 은 그 판이 도는 동안 대기 화면에 이름을 띄우는 데만 쓴다.
  try { sound = localStorage.getItem("quiz-sound") !== "0"; } catch (e) {}

  // 효과음 — 파일 없이 만든다. 학생이 화면을 한 번 누른 뒤부터 울린다.
  var AC = null;
  function beep(kind) {
    if (!sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var notes = kind === "ok" ? [523, 659, 784] : kind === "bad" ? [330, 247] : [660];
      notes.forEach(function (f, i) {
        var o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + i * 0.09;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g); g.connect(AC.destination);
        o.start(t0); o.stop(t0 + 0.25);
      });
    } catch (e) {}
  }
  var FACE = { ok: ["\ud83c\udf89", "\ud83e\udd73", "\u2728", "\ud83d\udc4f"], bad: ["\ud83d\udca7", "\ud83d\ude3f"] };
  function face(k) { var a = FACE[k] || FACE.ok; return a[Math.floor(Math.random() * a.length)]; }
  try { joinedQid = localStorage.getItem("quiz-joined") || ""; } catch (e) {}

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function css() {
    if (document.getElementById("quizCss")) return;
    var s = document.createElement("style");
    s.id = "quizCss";
    s.textContent = [
      "#quizBar{position:sticky;top:0;z-index:40;background:var(--panel,#fff);",
      "  border-bottom:1px solid var(--line,#e3e0da);padding:10px clamp(16px,4vw,48px)}",
      "#quizBar[hidden]{display:none}",
      ".qz{display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
      ".qz .ttl{font-weight:700;font-size:15px}",
      ".qz .tag{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;",
      "  background:var(--accent,#3d5a80);color:#fff}",
      ".qz .meta{font-size:12.5px;color:var(--muted,#646b73);margin-left:auto}",
      ".qz .sec{font-variant-numeric:tabular-nums;font-weight:700;font-size:18px}",
      ".qzbar{height:8px;border-radius:4px;background:var(--line,#e3e0da);overflow:hidden;margin-top:8px}",
      ".qzbar i{display:block;height:100%;background:linear-gradient(90deg,#ffd93d,#ff8a3d,#e4382c);transition:width .3s linear}",
      ".qzq{margin-top:10px;font-size:17px;font-weight:600;line-height:1.5}",
      ".qzopts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
      "@media(max-width:560px){.qzopts{grid-template-columns:1fr}}",
      ".qzo{position:relative;border:0;border-radius:10px;color:#fff;min-height:64px;padding:12px 12px 12px 40px;",
      "  text-align:left;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;line-height:1.35}",
      ".qzo .n{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:20px;height:20px;",
      "  border-radius:6px;background:rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:12px}",
      ".qzo.c0{background:#00a99d}.qzo.c1{background:#2f80ed}.qzo.c2{background:#f0a44a}.qzo.c3{background:#e4596a}",
      ".qzo[disabled]{cursor:default;opacity:.55}",
      ".qzo.right{outline:3px solid #15181f;opacity:1}",
      ".qzo.mine::after{content:'내 선택';position:absolute;right:10px;top:8px;font-size:11px;font-weight:700;opacity:.95}",
      ".qzo .cnt{position:absolute;right:10px;bottom:8px;font-size:12px;font-weight:700;opacity:.95}",
      ".qzjoin{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}",
      ".qzjoin input{font:inherit;padding:9px 11px;border:1px solid var(--line,#e3e0da);border-radius:9px;min-width:120px;flex:1}",
      ".qzjoin button{font:inherit;padding:9px 18px;border:0;border-radius:9px;background:var(--accent,#3d5a80);color:#fff;font-weight:600;cursor:pointer}",
      ".qzbd{margin-top:10px;display:flex;flex-direction:column;gap:4px;font-size:13px}",
      ".qzbd .row{display:flex;gap:10px;align-items:center;padding:5px 10px;border-radius:8px;background:var(--me,#e8eef6)}",
      ".qzbd .row.top{font-weight:700}",
      ".qzbd .r{width:22px;font-variant-numeric:tabular-nums}",
      ".qzbd .s{margin-left:auto;font-variant-numeric:tabular-nums}",
      ".qzmsg{margin-top:8px;font-size:13px;color:var(--muted,#646b73)}",
      ".qzhint{font-weight:800;letter-spacing:.2em;color:var(--accent,#3d5a80)}",
      ".qzans{margin-top:10px;font-size:16px}",
      ".qzopts.ox{grid-template-columns:1fr 1fr}",
      ".qzopts.ox .qzo{min-height:88px;font-size:30px;font-weight:800;justify-content:center;padding-left:12px;text-align:center}",
      ".qzord{display:flex;flex-direction:column;gap:6px;margin-top:10px}",
      ".qzoi{position:relative;text-align:left;font:inherit;font-size:14.5px;padding:10px 12px 10px 42px;",
      "  border:1px solid var(--line,#e3e0da);border-radius:9px;background:var(--panel,#fff);color:inherit;cursor:pointer}",
      ".qzoi .n{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:6px;",
      "  background:var(--line,#e3e0da);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}",
      ".qzoi.on{border-color:var(--accent,#3d5a80)}.qzoi.on .n{background:var(--accent,#3d5a80);color:#fff}",
      ".qzord.show .qzoi{cursor:default}.qzoi.done .n{background:#00a99d;color:#fff}",
      ".qzjoin button.ghost{background:transparent;color:var(--muted,#646b73);border:1px solid var(--line,#e3e0da)}",
      ".qzmute{border:0;background:transparent;font-size:16px;cursor:pointer;padding:0 4px}",
      ".qzwait{margin-top:14px;text-align:center;font-size:15px}",
      ".qzwait .dots{display:flex;gap:7px;justify-content:center;margin-bottom:10px}",
      ".qzwait .dots i{width:9px;height:9px;border-radius:50%;background:var(--accent,#3d5a80);",
      "  animation:qzb 1.1s infinite ease-in-out}",
      ".qzwait .dots i:nth-child(2){animation-delay:.16s}.qzwait .dots i:nth-child(3){animation-delay:.32s}",
      "@keyframes qzb{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-5px)}}",
      "@media(prefers-reduced-motion:reduce){.qzwait .dots i{animation:none;opacity:.7}}",
      ".qzres{margin-top:14px;padding:22px 16px;border-radius:12px;text-align:center;color:#fff}",
      ".qzres.ok{background:#00a99d}.qzres.bad{background:#e4596a}.qzres.none{background:#8a93a6}",
      ".qzres .face{font-size:46px;line-height:1}",
      ".qzres .word{font-size:21px;font-weight:700;margin-top:6px}",
      ".qzres .sub{font-size:14px;opacity:.95;margin-top:4px}",
      ".qzwin{margin-top:12px;padding:12px 14px;border-radius:10px;",
      "  border:1px solid var(--accent,#3d5a80);background:var(--me,#e8eef6);font-size:14px}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function mount() {
    css();
    box = document.getElementById("quizBar");
    if (box) return;
    box = document.createElement("div");
    box.id = "quizBar";
    box.hidden = true;
    var m = document.querySelector("main");
    if (m) m.insertBefore(box, m.firstChild);
    else document.body.insertBefore(box, document.body.firstChild);
  }

  function post(body) {
    return fetch(API + "/api/quiz", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ vid: vid }, body)),
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function answer(v) {
    if (picked >= 0 || !state || state.phase !== "ask") return;
    picked = (typeof v === "number") ? v : 0;
    beep("pick");
    draw();
    post({ act: "answer", idx: state.idx, choice: v });
  }

  // 주소 끝의 #quiz=0000 — QR 로 들어온 사람의 PIN
  function hashPin() {
    var m = /(?:^|[#&])quiz=(\d{4})/.exec(location.hash || "");
    return m ? m[1] : "";
  }

  function joinForm() {
    return '<div class="qzjoin">' +
      (hashPin() ? '' :
        '<input id="qzPin" inputmode="numeric" maxlength="4" placeholder="PIN" style="max-width:88px">') +

      '<input id="qzNick" maxlength="12" placeholder="닉네임 (화면에 보일 이름)">' +
      '<button id="qzGo">참여</button></div>' +
      '<div class="qzmsg" id="qzMsg">\ud654\uba74\uc5d0\ub294 \ub2c9\ub124\uc784\ub9cc \ubcf4\uc785\ub2c8\ub2e4.' +
      (hashPin() ? ' QR\ub85c \ub4e4\uc5b4\uc624\uc154\uc11c PIN\uc740 \ub123\uc9c0 \uc54a\uc73c\uc154\ub3c4 \ub429\ub2c8\ub2e4.' : '') + '</div>';
  }

  var lastHtml = "";

  // 글자를 치는 중에는 화면을 다시 그리지 않는다.
  // 1초마다 다시 그리면 입력칸이 새로 만들어져 포커스가 풀리고, 휴대폰에서는 키보드가 내려간다.
  function typing() {
    var a = document.activeElement;
    if (!a || !box || !box.contains(a)) return false;
    return a.tagName === "INPUT" || a.tagName === "TEXTAREA";
  }

  // 입력 중이라 다시 그리지 못할 때, 남은 초와 막대만 손본다
  function tickOnly() {
    var s = state;
    if (!s || s.phase !== "ask") return;
    var t = box.querySelector(".sec"), b = box.querySelector(".qzbar i");
    if (t) t.textContent = s.left;
    if (b) b.style.width = (100 * s.left / s.secs).toFixed(1) + "%";
  }

  function put(html) {
    if (html === lastHtml) return false;          // 바뀐 것이 없으면 그대로 둔다
    if (typing()) { tickOnly(); return false; }   // 입력 중이면 숫자만 고친다
    lastHtml = html;
    box.innerHTML = html;
    return true;
  }

  function draw() {
    var s = state;
    if (!s || s.phase === "none") { box.hidden = true; return; }
    box.hidden = false;

    if (s.phase !== "idle") box.removeAttribute("data-form");

    // 대기실 — 퀴즈가 올라와 있고 아직 시작 전
    if (s.phase === "idle") {
      var h0 = '<div class="qz"><span class="tag">오늘의 퀴즈</span>' +
        '<span class="ttl">' + esc(s.title || "") + '</span>' +
        '<span class="meta">' + (s.players || 0) + '명 들어왔습니다</span></div>';
      if (!joined) {
        // 입장 화면은 **한 번만** 만든다. 그 뒤로는 참여자 수만 고친다.
        // 다시 그리면 입력칸이 새로 생겨 휴대폰 키보드가 내려간다.
        if (box.getAttribute("data-form") !== "1") {
          box.setAttribute("data-form", "1");
          lastHtml = "";
          box.innerHTML = h0 + joinForm();
          bindJoin();
        } else {
          var mt = box.querySelector(".meta");
          if (mt) mt.textContent = (s.players || 0) + "명 들어왔습니다";
        }
      } else {
        box.removeAttribute("data-form");
        put(h0 +
          '<div class="qzwait"><div class="dots"><i></i><i></i><i></i></div>' +
          '<div><b>' + esc(myNick || "") + '</b> 님, 들어왔습니다</div>' +
          '<div class="qzmsg">교수님이 시작하면 첫 문제가 바로 나옵니다. 화면을 두고 기다려 주십시오.</div></div>');
      }
      return;
    }

    var head = '<div class="qz"><span class="tag">오늘의 퀴즈</span>' +
      '<span class="ttl">' + esc(s.title || "") + '</span>' +
      '<span class="meta">' + (s.phase === "done" ? "끝났습니다" :
        (s.idx + 1) + " / " + s.n + " 문제") +
      (s.players ? " · " + s.players + "명 참여" : "") + '</span>' +
      '<button class="qzmute" id="qzMute" title="\uc18c\ub9ac">' + (sound ? "\ud83d\udd0a" : "\ud83d\udd07") + '</button>' +
      (s.phase === "ask" ? '<span class="sec">' + s.left + '</span>' : "") + "</div>";

    if (!joined && s.phase !== "done") { if (put(head + joinForm())) bindJoin(); return; }

    var body = "";
    if (s.phase === "ask") {
      var t = s.q.t || "choice";
      body += '<div class="qzbar"><i style="width:' + (100 * s.left / s.secs).toFixed(1) + '%"></i></div>' +
        '<div class="qzq">' + esc(s.q.q) +
        (t === "initial" && s.q.hint ? ' <span class="qzhint">' + esc(s.q.hint) + '</span>' : '') + '</div>';
      if (t === "short" || t === "initial") {
        body += picked >= 0
          ? '<div class="qzmsg">보낸 답 \u00b7 <b>' + esc(myText) + '</b></div>'
          : '<div class="qzjoin"><input id="qzTxt" maxlength="40" autocomplete="off" placeholder="\uc815\ub2f5\uc744 \uc801\uc5b4 \uc8fc\uc2ed\uc2dc\uc624">' +
            '<button id="qzSend">\ubcf4\ub0b4\uae30</button></div>';
      } else if (t === "order") {
        body += '<div class="qzord">' + s.q.a.map(function (a, i) {
          return '<button class="qzoi" data-i="' + i + '"><span class="n">\u00b7</span>' + esc(a) + '</button>';
        }).join('') + '</div>' +
          (picked >= 0 ? '<div class="qzmsg">\ucc28\ub840\ub97c \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.</div>'
            : '<div class="qzjoin"><button id="qzSend">\uc774 \ucc28\ub840\ub85c \ubcf4\ub0b4\uae30</button>' +
              '<button id="qzClr" class="ghost">\ub2e4\uc2dc</button></div>');
      } else {
        var opts = (t === "ox") ? ["O", "X"] : s.q.a;
        body += '<div class="qzopts' + (t === "ox" ? " ox" : "") + '">' + opts.map(function (a, i) {
          return '<button class="qzo c' + i + (i === picked ? " mine" : "") + '" data-i="' + i + '"' +
            (picked >= 0 ? " disabled" : "") + '><span class="n">' + (i + 1) + '</span>' + esc(a) + '</button>';
        }).join('') + '</div>';
        if (picked >= 0) body += '<div class="qzmsg">\ub2f5\uc744 \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.</div>';
      }
      body += '<div class="qzmsg">' + (s.answered || 0) + ' / ' + (s.players || 0) + '\uba85 \ub2f5\ud588\uc2b5\ub2c8\ub2e4</div>';
    } else {
      // 정답이 공개된 뒤 — 학생에게는 본인이 맞았는지만 보인다.
      // 정답·보기별 분포·순위는 교수 화면에만 나간다.
      var okk = s.my ? s.my.ok : null;
      body += '<div class="qzres ' + (okk === null ? "none" : (okk ? "ok" : "bad")) + '">' +
        '<div class="face">' + (okk === null ? "·" : (okk ? face("ok") : face("bad"))) + '</div>' +
        '<div class="word">' + (okk === null ? '답을 내지 않으셨습니다'
          : (okk ? '맞았습니다!' : '아쉽습니다')) + '</div>' +
        (s.me ? '<div class="sub">내 점수 ' + s.me.s + '점</div>' : '') +
        '</div>' +
        '<div class="qzmsg">다음 문제를 기다려 주십시오.</div>';
    }
    if (!put(head + body)) return;
    var mu = document.getElementById("qzMute");
    if (mu) mu.onclick = function () {
      sound = !sound;
      try { localStorage.setItem("quiz-sound", sound ? "1" : "0"); } catch (e) {}
      draw();
    };
    Array.prototype.forEach.call(box.querySelectorAll(".qzo:not([disabled])"), function (b) {
      b.onclick = function () { answer(+b.dataset.i); };
    });
    var send = document.getElementById("qzSend");
    if (send) send.onclick = function () {
      var t = (state.q && state.q.t) || "choice";
      if (t === "order") { if (order.length === state.q.a.length) answer(order.slice()); return; }
      var inp = document.getElementById("qzTxt");
      var v = ((inp && inp.value) || "").trim();
      if (v) { myText = v; answer(v); }
    };
    var wg = document.getElementById("qzWinGo");
    if (wg) wg.onclick = function () {
      var v = (document.getElementById("qzWin").value || "").replace(/\D/g, "");
      var m = document.getElementById("qzWinMsg");
      if (v.length < 6) { m.textContent = "\ud559\ubc88\uc740 \uc22b\uc790 6\uc790\ub9ac \uc774\uc0c1\uc785\ub2c8\ub2e4."; return; }
      wg.disabled = true;
      post({ act: "sid", sid: v }).then(function (r) {
        wg.disabled = false;
        if (r && r.ok) { sidDone = true; draw(); }
        else m.textContent = (r && r.detail) || "\ubcf4\ub0b4\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.";
      });
    };
    var clr = document.getElementById("qzClr");
    if (clr) clr.onclick = function () { order = []; draw(); };
    Array.prototype.forEach.call(box.querySelectorAll(".qzoi[data-i]"), function (b) {
      var i = +b.dataset.i, at = order.indexOf(i);
      if (at >= 0) { b.classList.add("on"); b.querySelector(".n").textContent = at + 1; }
      b.onclick = function () {
        if (picked >= 0) return;
        var k = order.indexOf(i);
        if (k >= 0) order.splice(k, 1); else order.push(i);
        draw();
      };
    });
  }

  function bindJoin() {
    var go = document.getElementById("qzGo");
    if (!go) return;
    go.onclick = function () {
      var nick = (document.getElementById("qzNick").value || "").trim();
      var msg = document.getElementById("qzMsg");
      go.disabled = true;
      var pe = document.getElementById("qzPin");
      var pin = hashPin() || ((pe && pe.value) || "").replace(/\D/g, "");
      post({ act: "join", nick: nick, pin: pin }).then(function (r) {
        go.disabled = false;
        if (r && r.ok) {
          joined = true; myNick = r.nick || nick;

          joinedQid = (state && state.qid) || "";
          try { localStorage.setItem("quiz-joined", joinedQid); } catch (e) {}
          draw();
        } else if (msg) msg.textContent = (r && r.detail) || "참여하지 못했습니다.";
      });
    };
  }

  function tick() {
    fetch(API + "/api/quiz?vid=" + encodeURIComponent(vid), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.qid) joined = (joinedQid === s.qid);
        if (s && (s.phase === "idle" || s.phase === "none")) {
          picked = -1; order = []; myText = ""; lastIdx = -1; sidDone = false;   // 멈추면 비운다
        }
        if (s && s.idx !== undefined && s.idx !== lastIdx) {
          picked = -1; lastIdx = s.idx; order = []; myText = "";
        }
        if (s && s.phase === "reveal" && lastPhase !== "reveal" && s.my) {
          beep(s.my.ok ? "ok" : "bad");
        }
        if (s) lastPhase = s.phase;
        state = s;
        draw();
      })
      .catch(function () {});
  }

  mount();
  tick();
  timer = setInterval(tick, 1000);
  window.addEventListener("pagehide", function () { clearInterval(timer); });
})();
