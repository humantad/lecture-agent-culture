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
  var order = [], myText = "", myNick = "", lastPhase = "", sound = true;
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
      "@media(prefers-reduced-motion:reduce){.qzwait .dots i{animation:none;opacity:.7}}"
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

  function joinForm() {
    return '<div class="qzjoin">' +
      '<input id="qzPin" inputmode="numeric" maxlength="4" placeholder="PIN" style="max-width:88px">' +
      '<input id="qzSid" inputmode="numeric" maxlength="10" placeholder="학번" autocomplete="off">' +
      '<input id="qzNick" maxlength="12" placeholder="닉네임 (화면에 보일 이름)">' +
      '<button id="qzGo">참여</button></div>' +
      '<div class="qzmsg" id="qzMsg">학번은 채점에만 씁니다. 다른 사람에게는 닉네임만 보입니다.</div>';
  }

  function draw() {
    var s = state;
    if (!s || s.phase === "none") { box.hidden = true; return; }
    box.hidden = false;

    // 대기실 — 퀴즈가 올라와 있고 아직 시작 전
    if (s.phase === "idle") {
      var h0 = '<div class="qz"><span class="tag">오늘의 퀴즈</span>' +
        '<span class="ttl">' + esc(s.title || "") + '</span>' +
        '<span class="meta">' + (s.players || 0) + '명 들어왔습니다</span></div>';
      if (!joined) {
        box.innerHTML = h0 + joinForm();
        bindJoin();
      } else {
        box.innerHTML = h0 +
          '<div class="qzwait"><div class="dots"><i></i><i></i><i></i></div>' +
          '<div><b>' + esc(myNick || "") + '</b> 님, 들어왔습니다</div>' +
          '<div class="qzmsg">교수님이 시작하면 첫 문제가 바로 나옵니다. 화면을 두고 기다려 주십시오.</div></div>';
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

    if (!joined && s.phase !== "done") { box.innerHTML = head + joinForm(); bindJoin(); return; }

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
      var q = s.q, tt = q.t || "choice";
      if (tt === "short" || tt === "initial") {
        body += '<div class="qzq">' + esc(q.q) + '</div>' +
          '<div class="qzans">\uc815\ub2f5 \u00b7 <b>' + esc((q.ans || []).join(" / ")) + '</b></div>' +
          (myText ? '<div class="qzmsg">\ub0b4 \ub2f5 \u00b7 ' + esc(myText) + '</div>' : '');
      } else if (tt === "order") {
        body += '<div class="qzq">' + esc(q.q) + '</div>' +
          '<div class="qzord show">' + (q.c || []).map(function (ci, n) {
            return '<div class="qzoi done"><span class="n">' + (n + 1) + '</span>' + esc(q.a[ci]) + '</div>';
          }).join('') + '</div>';
      } else {
        var d = (s.dist && s.dist.d) || [0, 0, 0, 0];
        var o2 = (tt === "ox") ? ["O", "X"] : q.a;
        body += '<div class="qzq">' + esc(q.q) + '</div>' +
          '<div class="qzopts' + (tt === "ox" ? " ox" : "") + '">' + o2.map(function (a, i) {
            return '<button class="qzo c' + i + (i === q.c ? " right" : "") + (i === picked ? " mine" : "") +
              '" disabled><span class="n">' + (i + 1) + '</span>' + esc(a) +
              '<span class="cnt">' + (d[i] || 0) + '\uba85</span></button>';
          }).join('') + '</div>';
      }
      if (s.me) body += '<div class="qzmsg">\ub0b4 \uc810\uc218 <b>' + s.me.s + '</b>\uc810 \u00b7 ' + s.me.r + '\ub4f1</div>';
      if (s.board && s.board.length) {
        body += '<div class="qzbd">' + s.board.slice(0, 5).map(function (x) {
          return '<div class="row' + (x.r <= 3 ? " top" : "") + '"><span class="r">' +
            (x.r <= 3 ? ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"][x.r - 1] : x.r) + '</span><span>' +
            esc(x.nick) + '</span><span class="s">' + x.s + '\uc810</span></div>';
        }).join('') + '</div>';
      }
    }
    box.innerHTML = head + body;
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
      var sid = (document.getElementById("qzSid").value || "").replace(/\D/g, "");
      var nick = (document.getElementById("qzNick").value || "").trim();
      var msg = document.getElementById("qzMsg");
      go.disabled = true;
      var pin = (document.getElementById("qzPin").value || "").replace(/\D/g, "");
      post({ act: "join", sid: sid, nick: nick, pin: pin }).then(function (r) {
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
        if (s && s.idx !== undefined && s.idx !== lastIdx) {
          picked = -1; lastIdx = s.idx; order = []; myText = "";
        }
        if (s && s.phase === "reveal" && lastPhase !== "reveal" && picked >= 0) {
          var q = s.q || {}, tt = q.t || "choice", nm = function (x) {
            return String(x || "").replace(/\s+/g, "").toLowerCase();
          };
          var good = (tt === "short" || tt === "initial")
            ? (q.ans || []).some(function (a) { return nm(a) === nm(myText); })
            : (tt === "order") ? order.join("-") === (q.c || []).join("-") : picked === q.c;
          beep(good ? "ok" : "bad");
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
