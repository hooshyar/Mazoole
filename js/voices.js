// "Our sounds": record your own voices for the game's sound effects.
// Recordings are kept in this browser only (localStorage).
(function () {
  const EVENTS = [
    ["key", "Picking up a key", "“Got the key!”"],
    ["star", "Grabbing a star", "“Ding!”"],
    ["button", "Pressing a button", "“Click!”"],
    ["unlock", "Opening a lock", "“Creeeak!”"],
    ["wings", "Getting wings", "“Wheee!”"],
    ["hurt", "Getting hurt", "“Ouch!”"],
    ["win", "Winning", "“Hooray!”"],
    ["lose", "Out of hearts", "“Oh no!”"],
  ];
  const KEY = (n) => "mazoole.voice." + n;
  const MAX_SECONDS = 3;
  const MAX_BYTES = 450000;
  const cache = {};
  const $ = (id) => document.getElementById(id);

  function get(name) {
    try { return localStorage.getItem(KEY(name)); } catch (_) { return null; }
  }
  function set(name, url) {
    try {
      if (url) localStorage.setItem(KEY(name), url); else localStorage.removeItem(KEY(name));
      delete cache[name];
      return true;
    } catch (_) {
      window.Mazoole.UI.toast("This browser couldn't save the sound. It may be full or in private mode.");
      return false;
    }
  }

  function play(name) {
    const url = get(name);
    if (!url) return false;
    try {
      const a = cache[name] || (cache[name] = new Audio(url));
      a.currentTime = 0;
      a.play().catch(() => {});
      return true;
    } catch (_) { return false; }
  }

  function blobToUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  let recording = null;
  async function record(name, btn) {
    if (recording) { recording.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      window.Mazoole.UI.toast("Recording isn't available here. Use “Upload” with a sound file instead.");
      return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (_) {
      window.Mazoole.UI.toast("The microphone isn't allowed here. Use “Upload” with a sound file instead.");
      return;
    }
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearTimeout(rec.timer);
      recording = null;
      const url = await blobToUrl(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      if (set(name, url)) { play(name); window.Mazoole.UI.toast("Saved!"); }
      build();
    };
    recording = rec;
    rec.start();
    rec.timer = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
    btn.textContent = "■ Stop";
    btn.classList.add("rec");
  }

  async function upload(name, file) {
    if (!file) return;
    if (file.size > MAX_BYTES) { window.Mazoole.UI.toast("That sound is too long. Try one shorter than 3 seconds."); return; }
    const url = await blobToUrl(file);
    if (set(name, url)) { play(name); build(); }
  }

  function build() {
    const list = $("voice-list");
    list.innerHTML = "";
    for (const [name, label, idea] of EVENTS) {
      const has = !!get(name);
      const row = document.createElement("div");
      row.className = "voice-row";
      row.innerHTML = `<div class="voice-label"><b>${label}</b><span>${has ? "Your recording" : "Idea: " + idea}</span></div>`;
      const rec = document.createElement("button");
      rec.textContent = has ? "● Record again" : "● Record";
      rec.onclick = () => record(name, rec);
      const up = document.createElement("label");
      up.className = "filebtn";
      up.innerHTML = `Upload<input type="file" accept="audio/*" id="voice-file-${name}">`;
      up.querySelector("input").onchange = (e) => upload(name, e.target.files[0]);
      row.append(rec, up);
      if (has) {
        const pl = document.createElement("button");
        pl.textContent = "▶";
        pl.title = "Listen";
        pl.onclick = () => play(name);
        const rm = document.createElement("button");
        rm.textContent = "✕";
        rm.title = "Go back to the beep";
        rm.onclick = () => { set(name, null); build(); };
        row.append(pl, rm);
      }
      list.appendChild(row);
    }
  }

  function open() {
    build();
    for (const el of document.querySelectorAll(".screen")) el.hidden = el.id !== "voices";
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("btn-voices").onclick = open;
  });

  window.MazooleVoices = { play, open };
})();
