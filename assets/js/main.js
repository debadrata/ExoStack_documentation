/* ExoStack website — interaction (no external dependencies) */
(function () {
  "use strict";
  var root = document.documentElement;

  /* ---------- looping videos: respect "reduce motion" ---------- */
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll("video[autoplay]").forEach(function (v) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; });
  }

  /* ---------- theme ---------- */
  function setTheme(t, save) {
    root.setAttribute("data-theme", t);
    if (save) { try { localStorage.setItem("exostack-theme", t); } catch (e) {} }
  }
  document.querySelectorAll(".theme-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  });

  /* ---------- mobile menu ---------- */
  document.querySelectorAll(".menu-btn").forEach(function (b) {
    b.addEventListener("click", function () { document.body.classList.toggle("menu-open"); });
  });

  /* ---------- copy buttons ---------- */
  function addCopy(container, pre) {
    var btn = document.createElement("button");
    btn.className = "copy-btn"; btn.type = "button"; btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      var text = pre.innerText.replace(/\u00a0/g, " ")
        .split("\n").map(function (l) { return l.replace(/^\$ /, ""); }).join("\n").trim();
      var done = function () { btn.textContent = "Copied"; btn.classList.add("done");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    });
    container.appendChild(btn);
  }
  document.querySelectorAll(".cb").forEach(function (cb) { var p = cb.querySelector("pre"); if (p) addCopy(cb, p); });
  document.querySelectorAll(".term").forEach(function (t) { var p = t.querySelector("pre"); if (p) { t.style.position = "relative"; addCopy(t, p); } });

  /* ---------- on this page + heading anchors ---------- */
  var toc = document.querySelector(".toc .toc-links");
  var heads = Array.prototype.slice.call(document.querySelectorAll(".article h2[id], .article h3[id]"));
  heads.forEach(function (h) {
    var a = document.createElement("a"); a.className = "anchor"; a.href = "#" + h.id; a.textContent = "#";
    a.setAttribute("aria-label", "Link to this section"); h.appendChild(a);
  });
  if (toc && heads.length) {
    heads.forEach(function (h) {
      var a = document.createElement("a"); a.href = "#" + h.id;
      a.textContent = h.firstChild ? h.firstChild.textContent : h.textContent;
      if (h.tagName === "H3") a.className = "l3";
      toc.appendChild(a);
    });
    var links = toc.querySelectorAll("a");
    var spy = function () {
      var y = window.scrollY + 120, cur = 0;
      heads.forEach(function (h, i) { if (h.getBoundingClientRect().top + window.scrollY <= y) cur = i; });
      links.forEach(function (l, i) { l.classList.toggle("active", i === cur); });
    };
    window.addEventListener("scroll", spy, { passive: true }); spy();
  } else if (toc) { toc.parentNode.style.visibility = "hidden"; }

  /* ---------- search ---------- */
  var overlay = document.querySelector(".search-overlay");
  if (!overlay || !window.EXOSTACK_INDEX) return;
  var input = overlay.querySelector("input"), results = overlay.querySelector(".search-results");
  var base = document.body.getAttribute("data-base") || "";
  var sel = -1;
  function open() { overlay.classList.add("open"); input.value = ""; render(""); setTimeout(function () { input.focus(); }, 10); }
  function close() { overlay.classList.remove("open"); }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render(q) {
    q = q.trim().toLowerCase(); sel = -1;
    if (!q) { results.innerHTML = '<div class="empty">Type to search the documentation — e.g. <i>sensors.yaml</i>, <i>REGISTER_I2C_SENSOR</i>, <i>CMA-ES</i>.</div>'; return; }
    var terms = q.split(/\s+/), hits = [];
    window.EXOSTACK_INDEX.forEach(function (d) {
      var t = d.t.toLowerCase(), x = d.x.toLowerCase(), score = 0, ok = true;
      terms.forEach(function (w) { var a = t.indexOf(w), b = x.indexOf(w); if (a < 0 && b < 0) ok = false; score += (a >= 0 ? 10 : 0) + (b >= 0 ? 1 : 0); });
      if (ok) hits.push({ d: d, s: score, at: x.indexOf(terms[0]) });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    if (!hits.length) { results.innerHTML = '<div class="empty">No results.</div>'; return; }
    results.innerHTML = hits.slice(0, 12).map(function (h) {
      var i = Math.max(0, h.at - 50), snip = (i > 0 ? "…" : "") + h.d.x.substr(i, 140) + "…";
      return '<a href="' + base + h.d.u + '"><b>' + esc(h.d.t) + '</b><small>' + esc(h.d.p) + " · " + esc(snip) + "</small></a>";
    }).join("");
  }
  document.querySelectorAll(".search-btn").forEach(function (b) { b.addEventListener("click", open); });
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  input.addEventListener("input", function () { render(input.value); });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    if (!overlay.classList.contains("open")) return;
    var items = results.querySelectorAll("a");
    if (e.key === "Escape") close();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
      items.forEach(function (a, i) { a.classList.toggle("sel", i === sel); });
    }
    if (e.key === "Enter" && items.length) { (items[sel >= 0 ? sel : 0]).click(); }
  });
})();


/* ---------- image lightbox: click a figure or screenshot to enlarge; × , Esc or a click outside closes ---------- */
(function () {
  "use strict";
  var SEL = ".article img, .figure-card img, .shotfig img, .sfig svg";
  var box = document.createElement("div");
  box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Enlarged figure");
  box.innerHTML = '<button class="lb-close" type="button" aria-label="Close">&times;</button><div class="lb-stage"></div><div class="lb-cap"></div>';
  document.body.appendChild(box);
  var stage = box.querySelector(".lb-stage"), cap = box.querySelector(".lb-cap"), closeBtn = box.querySelector(".lb-close"), last = null;
  function captionFor(el) {
    var fig = el.closest("figure"), fc = fig && fig.querySelector("figcaption");
    if (fc) return fc.innerHTML;
    var host = el.closest(".shotfig"); if (host && host.querySelector(".cap")) return host.querySelector(".cap").innerHTML;
    var next = (el.closest(".sfig") || el).nextElementSibling;
    if (next && next.classList.contains("cap")) return next.innerHTML;
    return el.getAttribute("alt") || "";
  }
  function avail() {                       // height left for the figure once the caption is laid out
    var cs = getComputedStyle(box);
    return Math.max(200, window.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.rowGap || 14) - cap.offsetHeight - 6);
  }
  function layout() {
    var m = stage.querySelector(".lb-media"); if (!m) return;
    var zoomed = stage.classList.contains("zoomed"), h = avail();
    stage.style.maxHeight = h + "px";
    if (m.tagName.toLowerCase() === "svg") {
      var vb = m.viewBox && m.viewBox.baseVal, aspect = vb && vb.height ? vb.width / vb.height : 1.5;
      var w = Math.min(window.innerWidth * 0.94, (h - 4) * aspect);
      m.style.width = (zoomed ? w * 2 : w) + "px"; m.style.height = "auto";
    } else {
      m.style.maxHeight = zoomed ? "none" : (h - 4) + "px";
      m.style.maxWidth = zoomed ? "none" : "94vw";
    }
  }
  function open(el) {
    last = el; stage.innerHTML = ""; stage.classList.remove("zoomed"); stage.scrollTop = 0; stage.scrollLeft = 0;
    var node;
    if (el.tagName.toLowerCase() === "svg") { node = el.cloneNode(true); node.removeAttribute("style"); node.removeAttribute("width"); node.removeAttribute("height"); }
    else { node = document.createElement("img"); node.src = el.currentSrc || el.src; node.alt = el.alt || ""; node.addEventListener("load", layout); }
    node.classList.add("lb-media"); node.classList.remove("zoomable"); node.removeAttribute("tabindex"); node.removeAttribute("role");
    stage.appendChild(node); cap.innerHTML = captionFor(el);
    box.classList.add("open"); document.body.classList.add("lb-open"); layout(); closeBtn.focus();
  }
  function close() {
    box.classList.remove("open"); document.body.classList.remove("lb-open"); stage.innerHTML = "";
    if (last && last.focus) last.focus();
  }
  document.querySelectorAll(SEL).forEach(function (el) {
    if (el.closest("a")) return;                                   // linked images keep their link
    el.classList.add("zoomable"); el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
    el.setAttribute("aria-label", (el.getAttribute("alt") || "Figure") + " (open enlarged)");
    el.addEventListener("click", function () { open(el); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(el); } });
  });
  closeBtn.addEventListener("click", close);
  box.addEventListener("click", function (e) { if (e.target === box || e.target === stage) close(); });
  stage.addEventListener("click", function (e) {                    // click the enlarged figure: full resolution and back
    if (!e.target.closest(".lb-media")) return;
    e.stopPropagation(); stage.classList.toggle("zoomed"); layout();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("open")) close(); });
  window.addEventListener("resize", function () { if (box.classList.contains("open")) layout(); });
})();
