import { Prefix } from "./Prefix";
import { Utils } from "./Utils";
let File = Java.type("java.io.File");
let Desktop = Java.type("java.awt.Desktop");

function computeTotals(sessions) {
  const now = Date.now();
  const msInHour = 60 * 60 * 1000;
  const msInDay = 24 * msInHour;

  const currentHourStart = now - (now % msInHour);
  const currentDayStart = now - (now % msInDay);

  let hour = 0;
  let day = 0;
  let total = 0;

  for (const s of sessions) {
    const start = typeof s.start === "number" ? s.start : 0;
    const end = typeof s.end === "number" ? s.end : now; // count ongoing
    if (end <= start) continue;
    const dur = end - start;
    total += dur;

    // overlap with hour
    const hourOverlap = Math.max(0, Math.min(end, currentHourStart + msInHour) - Math.max(start, currentHourStart));
    hour += hourOverlap;

    // overlap with day
    const dayOverlap = Math.max(0, Math.min(end, currentDayStart + msInDay) - Math.max(start, currentDayStart));
    day += dayOverlap;
  }

  return { hour, day, total };
}

function openTodayPage(totals) {
  try {
    // Create a html file to avoid the file:// issues
    const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Aurelia Client - Today</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { background: linear-gradient(135deg, #2c0b49, #0d243a); font-family: Inter, sans-serif; overflow: hidden; }
  .glass { background: rgba(255,255,255,0.06); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); isolation: isolate; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; }
  .glow { box-shadow: 0 0 24px rgba(139,92,246,0.25); }
  .toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 50; }
</style>
</head>
<body class="text-slate-200 min-h-screen flex items-center justify-center p-6">
  <div class="max-w-3xl w-full">
    <header class="glass rounded-xl px-6 py-4 mb-6 flex items-center justify-center">
      <div class="flex flex-col items-center">
        <h1 class="text-xl font-semibold">Aurelia Client</h1>
      </div>
    </header>

    <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="glass rounded-2xl p-6 glow">
        <div class="text-sm text-slate-300 mb-2">This Hour</div>
        <div id="hour" class="text-3xl font-bold">...</div>
      </div>
      <div class="glass rounded-2xl p-6 glow">
        <div class="text-sm text-slate-300 mb-2">Today</div>
        <div id="day" class="text-3xl font-bold">...</div>
      </div>
      <div class="glass rounded-2xl p-6 glow">
        <div class="text-sm text-slate-300 mb-2">Total</div>
        <div id="total" class="text-3xl font-bold">...</div>
      </div>
    </section>
  </div>

  <script>
    const __TOTALS__ = { hour: ${totals.hour}, day: ${totals.day}, total: ${totals.total} };
    function formatDuration(ms) {
      if (!ms || ms < 0) ms = 0;
      const seconds = Math.floor(ms / 1000);
      const s = seconds % 60;
      const minutes = Math.floor(seconds / 60);
      const m = minutes % 60;
      const h = Math.floor(minutes / 60);
      if (h > 0) return h + "h " + m + "m " + s + "s";
      if (m > 0) return m + "m " + s + "s";
      return s + "s";
    }
    function showToast() {
      const toast = document.createElement('div');
      toast.className = 'toast glass rounded-lg px-4 py-3 text-sm text-slate-200';
      toast.innerHTML = '<span class="font-semibold">IMPORTANT:</span> Reloading this page will not refresh times. Run <span class="font-mono">/today</span> again to update.';
      const close = document.createElement('button');
      close.className = 'ml-3 text-slate-300 hover:text-white';
      close.textContent = 'Dismiss';
      close.onclick = () => toast.remove();
      toast.appendChild(close);
      document.body.appendChild(toast);
    }

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('hour').textContent = formatDuration(__TOTALS__.hour);
      document.getElementById('day').textContent = formatDuration(__TOTALS__.day);
      document.getElementById('total').textContent = formatDuration(__TOTALS__.total);
      showToast();
    });
  </script>
</body>
</html>`;

    FileLib.write("ClientConfig", "today_view.html", htmlContent);

    const viewPath = "./config/ChatTriggers/modules/ClientConfig/today_view.html";
    const htmlFile = new File(viewPath).getAbsoluteFile();

    if (!htmlFile.exists()) {
      Prefix.message("&cToday page not found at " + htmlFile.getAbsolutePath());
      return;
    }

    let opened = false;
    try {
      Desktop.getDesktop().open(htmlFile);
      opened = true;
    } catch (openErr) {
      try {
        Desktop.getDesktop().browse(htmlFile.toURI());
        opened = true;
      } catch (browseErr) {
        Prefix.message("&cFailed to open today page: &7" + htmlFile.getAbsolutePath());
        return;
      }
    }

    if (opened) {
      Prefix.message("&aOpening today page in your browser...");
    }
  } catch (e) {
    Prefix.message("&cFailed to open today page: " + e);
  }
}

register("command", () => {
  try {
    const data = Utils.getConfigFile("today.json");
    const sessions = (data && Array.isArray(data.sessions)) ? data.sessions : [];
    const totals = computeTotals(sessions);
    openTodayPage(totals);
  } catch (e) {
    Prefix.message("&c/today error: " + e);
  }
}).setName("today");


