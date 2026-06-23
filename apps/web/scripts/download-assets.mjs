// Download manus.im global assets: fonts, favicons, OG image
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ASSETS = [
  {
    url: "https://files.manuscdn.com/webapp/_next/static/media/LibreBaskerville-Regular.ea362fb5.ttf",
    out: "src/app/fonts/LibreBaskerville-Regular.ttf",
  },
  {
    url: "https://files.manuscdn.com/webapp/_next/static/media/LibreBaskerville-Bold.2bcf28b7.ttf",
    out: "src/app/fonts/LibreBaskerville-Bold.ttf",
  },
  { url: "https://manus.im/favicon.ico", out: "public/seo/favicon.ico" },
  { url: "https://manus.im/icon.png?22b3100142bdeab9", out: "public/seo/icon.png" },
  { url: "https://manus.im/apple-icon.png?af9a97f1433085ee", out: "public/seo/apple-icon.png" },
  { url: "https://files.manuscdn.com/webapp/media/ogBanner.png", out: "public/seo/og-banner.png" },
];

async function download({ url, out }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.resolve(process.cwd(), out);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`OK ${out} (${buf.length} bytes)`);
}

const BATCH = 4;
for (let i = 0; i < ASSETS.length; i += BATCH) {
  await Promise.all(
    ASSETS.slice(i, i + BATCH).map((a) =>
      download(a).catch((e) => console.error(`FAIL ${a.url}: ${e.message}`))
    )
  );
}
