const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/widget.ts"],
  bundle: true,
  outfile: "dist/widget.js",
  format: "iife",
  target: ["es2018"],
  minify: !watch,
  sourcemap: watch,
  logLevel: "info",
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("Watching widget for changes...");
  } else {
    await esbuild.build(options);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
