// Renders icons/jira-helper.svg into the PNG sizes Chrome needs (16/32/48/128) using headless Chrome.
// Usage: node tools/generate-icons.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SIZES = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, "..", "icons");
const svg = fs.readFileSync(path.join(iconsDir, "jira-helper.svg"), "utf8");

const browser = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && fs.existsSync(p));
if (!browser) throw new Error("Chrome/Edge not found. Set the CHROME_PATH environment variable.");

// Temporary page: draws the SVG onto a canvas at each size and writes the data URLs into the DOM
const html = `<!doctype html><body><script>
  const img = new Image();
  img.onload = () => {
    for (const size of ${JSON.stringify(SIZES)}) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, size, size);
      const pre = document.createElement("pre");
      pre.textContent = "ICON " + size + " " + canvas.toDataURL("image/png");
      document.body.append(pre);
    }
  };
  img.src = "data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}";
</script></body>`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jira-icons-"));
const htmlPath = path.join(tmpDir, "render.html");
fs.writeFileSync(htmlPath, html);

try {
  const dom = execFileSync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      `--user-data-dir=${path.join(tmpDir, "profile")}`,
      "--virtual-time-budget=5000",
      "--dump-dom",
      "file:///" + htmlPath.replace(/\\/g, "/"),
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );

  const matches = [...dom.matchAll(/ICON (\d+) data:image\/png;base64,([A-Za-z0-9+/=]+)/g)];
  if (matches.length !== SIZES.length) throw new Error("Render failed, output:\n" + dom.slice(0, 500));

  for (const [, size, data] of matches) {
    const out = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log("Created", path.relative(process.cwd(), out));
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
