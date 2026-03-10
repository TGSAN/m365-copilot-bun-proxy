const command = process.argv[2]?.toLowerCase();

if (command === "proxy") {
  process.argv.splice(2, 1);
  await import("./proxy/index");
} else if (command === "cli") {
  process.argv.splice(2, 1);
  await import("./cli/index");
} else {
  showUsage();
}

function showUsage(): void {
  console.log("M365 Copilot Bun Proxy (Bun)");
  console.log("       bun src/index.ts proxy");
  console.log("       bun src/index.ts cli [options]");
}
