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

  var box, state = null, joined = false, picked = -1, lastIdx = -1, timer = null;
  try { joined = localStorage.getItem("quiz-joined") === "1"; } catch (e) {}

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
      ".qzmsg{margin-top:8px;font-size:13px;color:var(--muted,#646b73)}"
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

  function answer(i) {
    if (picked >= 0 || !state || state.phase !== "ask") return;
    picked = i;
    draw();
    post({ act: "answer", idx: state.idx, choice: i });
  }

  function joinForm() {
    return '<div class="qzjoin">' +
      '<input id="qzSid" inputmode="numeric" maxlength="10" placeholder="학번">' +
      '<input id="qzNick" maxlength="12" placeholder="닉네임 (화면에 보일 이름)">' +
      '<button id="qzGo">참여</button></div>' +
      '<div class="qzmsg" id="qzMsg">학번은 채점에만 씁니다. 다른 사람에게는 닉네임만 보입니다.</div>';
  }

  function draw() {
    var s = state;
    if (!s || s.phase === "none" || s.phase === "idle") { box.hidden = true; return; }
    box.hidden = false;

    var head = '<div class="qz"><span class="tag">오늘의 퀴즈</span>' +
      '<span class="ttl">' + esc(s.title || "") + '</span>' +
      '<span class="meta">' + (s.phase === "done" ? "끝났습니다" :
        (s.idx + 1) + " / " + s.n + " 문제") +
      (s.players ? " · " + s.players + "명 참여" : "") + '</span>' +
      (s.phase === "ask" ? '<span class="sec">' + s.left + '</span>' : "") + "</div>";

    if (!joined && s.phase !== "done") { box.innerHTML = head + joinForm(); bindJoin(); return; }

    var body = "";
    if (s.phase === "ask") {
      body += '<div class="qzbar"><i style="width:' +
        (100 * s.left / s.secs).toFixed(1) + '%"></i></div>' +
        '<div class="qzq">' + esc(s.q.q) + "</div>" +
        '<div class="qzopts">' + s.q.a.map(function (a, i) {
          return '<button class="qzo c' + i + (i === picked ? " mine" : "") + '" data-i="' + i + '"' +
            (picked >= 0 ? " disabled" : "") + '><span class="n">' + (i + 1) + "</span>" + esc(a) + "</button>";
        }).join("") + "</div>" +
        (picked >= 0 ? '<div class="qzmsg">답을 보냈습니다. 정답 공개를 기다려 주십시오.</div>' : "");
    } else {
      var d = (s.dist && s.dist.d) || [0, 0, 0, 0];
      body += '<div class="qzq">' + esc(s.q.q) + "</div>" +
        '<div class="qzopts">' + s.q.a.map(function (a, i) {
          return '<button class="qzo c' + i + (i === s.q.c ? " right" : "") +
            (i === picked ? " mine" : "") + '" disabled><span class="n">' + (i + 1) + "</span>" +
            esc(a) + '<span class="cnt">' + (d[i] || 0) + "명</span></button>";
        }).join("") + "</div>";
      if (s.me) body += '<div class="qzmsg">내 점수 <b>' + s.me.s + "</b>점 · " + s.me.r + "등</div>";
      if (s.board && s.board.length) {
        body += '<div class="qzbd">' + s.board.slice(0, 5).map(function (x) {
          return '<div class="row' + (x.r <= 3 ? " top" : "") + '"><span class="r">' +
            (x.r <= 3 ? ["🥇", "🥈", "🥉"][x.r - 1] : x.r) + "</span><span>" + esc(x.nick) +
            "</span><span class=\"s\">" + x.s + "점</span></div>";
        }).join("") + "</div>";
      }
    }
    box.innerHTML = head + body;
    Array.prototype.forEach.call(box.querySelectorAll(".qzo:not([disabled])"), function (b) {
      b.onclick = function () { answer(+b.dataset.i); };
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
      post({ act: "join", sid: sid, nick: nick }).then(function (r) {
        go.disabled = false;
        if (r && r.ok) {
          joined = true;
          try { localStorage.setItem("quiz-joined", "1"); } catch (e) {}
          draw();
        } else if (msg) msg.textContent = (r && r.detail) || "참여하지 못했습니다.";
      });
    };
  }

  function tick() {
    fetch(API + "/api/quiz?vid=" + encodeURIComponent(vid), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.idx !== undefined && s.idx !== lastIdx) { picked = -1; lastIdx = s.idx; }
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
