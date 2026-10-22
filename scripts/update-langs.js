const fs = require("fs");
const path = require("path");

const USERNAME = "Antara-Parab";
// Repositories to exclude from stats (e.g. unrelated third-party forks)
const EXCLUDE_REPOS = ["timetrap"];

// Language color mapping
const LANG_COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  CSS: "#663399",
  HTML: "#e34c26",
  Python: "#3572A5",
  Java: "#b07219",
  Ruby: "#701516",
  Dockerfile: "#384d54",
  Default: "#586069"
};

async function fetchJson(url, token) {
  const headers = { "User-Agent": "Antara-Lang-Stats" };
  if (token) headers["Authorization"] = `token ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function run() {
  const token = process.env.GITHUB_TOKEN;
  const repos = await fetchJson(`https://api.github.com/users/${USERNAME}/repos?per_page=100`, token);

  const totals = {};
  for (const repo of repos) {
    if (EXCLUDE_REPOS.includes(repo.name)) continue;
    try {
      const langs = await fetchJson(repo.languages_url, token);
      for (const [lang, bytes] of Object.entries(langs)) {
        totals[lang] = (totals[lang] || 0) + bytes;
      }
    } catch (err) {
      console.warn(`Failed to fetch languages for ${repo.name}:`, err.message);
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  if (grandTotal === 0) {
    console.log("No languages found.");
    return;
  }

  // Sort and take top 4
  const sorted = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const BAR_WIDTH = 250;
  let currentX = 0;
  let barRects = "";

  const segments = sorted.map(([lang, bytes], i) => {
    const pct = (bytes / grandTotal) * 100;
    const width = (bytes / grandTotal) * BAR_WIDTH;
    const color = LANG_COLORS[lang] || LANG_COLORS.Default;
    const x = currentX;
    currentX += width;
    return { lang, pct: pct.toFixed(2), width: width.toFixed(2), x: x.toFixed(2), color, index: i };
  });

  for (const seg of segments) {
    barRects += `\n      <rect mask="url(#rect-mask)" class="lang-progress" x="${seg.x}" y="0" width="${seg.width}" height="8" fill="${seg.color}" />`;
  }

  // Legend grid
  const legendPositions = [
    { x: 0, y: 0, delay: 450 },
    { x: 135, y: 0, delay: 600 },
    { x: 0, y: 25, delay: 750 },
    { x: 135, y: 25, delay: 900 }
  ];

  let legendItems = "";
  segments.forEach((seg, i) => {
    const pos = legendPositions[i];
    legendItems += `
        <g transform="translate(${pos.x}, ${pos.y})">
          <g class="stagger" style="animation-delay: ${pos.delay}ms">
            <circle cx="5" cy="6" r="5" fill="${seg.color}" />
            <text x="15" y="10" class="lang-name">${seg.lang} ${seg.pct}%</text>
          </g>
        </g>`;
  });

  const svg = `<svg
  width="300"
  height="165"
  viewBox="0 0 300 165"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="titleId"
>
  <title id="titleId">Most Used Languages</title>
  <style>
    .header {
      font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #6366F1;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    @supports(-moz-appearance: auto) {
      .header { font-size: 15.5px; }
    }
    @keyframes slideInAnimation {
      from { width: 0; }
      to { width: calc(100% - 100px); }
    }
    @keyframes growWidthAnimation {
      from { width: 0; }
      to { width: 100%; }
    }
    .lang-name {
      font: 400 11px "Segoe UI", Ubuntu, Sans-Serif;
      fill: #a9fef7;
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    #rect-mask rect {
      animation: slideInAnimation 1s ease-in-out forwards;
    }
    .lang-progress {
      animation: growWidthAnimation 0.6s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>

  <rect
    data-testid="card-bg"
    x="0.5"
    y="0.5"
    rx="4.5"
    height="99%"
    stroke="#e4e2e2"
    width="299"
    fill="#0d1117"
    stroke-opacity="0"
  />

  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header" data-testid="header">Most Used Languages</text>
  </g>

  <g data-testid="main-card-body" transform="translate(0, 55)">
    <svg data-testid="lang-items" x="25">
      <mask id="rect-mask">
        <rect x="0" y="0" width="250" height="8" fill="white" rx="5"/>
      </mask>
      ${barRects}

      <!-- Language Legend Grid -->
      <g transform="translate(0, 25)">${legendItems}
      </g>
    </svg>
  </g>
</svg>
`;

  const outputPath = path.join(__dirname, "..", "top-langs.svg");
  fs.writeFileSync(outputPath, svg, "utf8");
  console.log("Successfully generated top-langs.svg!");
}

run().catch(console.error);
