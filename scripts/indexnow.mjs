#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, "..");
const origin = "https://thenorthpineoverlook.com";

function usage() {
  console.error("Usage: node scripts/indexnow.mjs [--submit] /changed-page.html [more URLs]");
  console.error("Without --submit, the command validates and prints the payload without sending it.");
}

const submit = process.argv.includes("--submit");
const inputs = process.argv.slice(2).filter((arg) => arg !== "--submit");

if (inputs.length === 0) {
  usage();
  process.exitCode = 2;
} else {
  const candidates = await readdir(siteRoot);
  const keyFile = candidates.find((name) => /^[a-f0-9]{32}\.txt$/i.test(name));
  if (!keyFile) throw new Error("No 32-character IndexNow key file was found in the site root.");

  const key = (await readFile(path.join(siteRoot, keyFile), "utf8")).trim();
  if (key.toLowerCase() !== path.basename(keyFile, ".txt").toLowerCase()) {
    throw new Error("The IndexNow key file name and file contents do not match.");
  }

  const urlList = [...new Set(inputs.map((input) => {
    const url = new URL(input, `${origin}/`);
    if (url.protocol !== "https:" || url.hostname !== "thenorthpineoverlook.com") {
      throw new Error(`Refusing a URL outside ${origin}: ${input}`);
    }
    if (url.pathname === "/index.html") url.pathname = "/";
    url.hash = "";
    return url.href;
  }))];

  const payload = {
    host: "thenorthpineoverlook.com",
    key,
    keyLocation: `${origin}/${keyFile}`,
    urlList,
  };

  if (!submit) {
    console.log("IndexNow dry run; no request sent.");
    console.log(JSON.stringify(payload, null, 2));
  } else {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`IndexNow returned ${response.status}${body ? `: ${body}` : ""}`);
    }
    console.log(`IndexNow accepted ${urlList.length} changed URL(s) with status ${response.status}.`);
  }
}
