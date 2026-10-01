import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wranglerBin=fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js",import.meta.url));
if(!existsSync(wranglerBin)){
  console.error("Local Wrangler is not installed. Run npm.cmd install first, then retry.");
  process.exit(1);
}

const secret=randomBytes(48).toString("base64url");
const result=spawnSync(process.execPath,[wranglerBin,"secret","put","VYNDI_AUTH_SECRET"],{
  input:secret+"\n",
  stdio:["pipe","inherit","inherit"],
  shell:false
});
if(result.error){
  console.error("Unable to start local Wrangler:",result.error.message);
  process.exit(1);
}
if(result.status!==0){
  console.error("Wrangler did not store the authenticity secret.");
  process.exit(result.status||1);
}
console.log("VYNDI authenticity signing secret generated locally and stored in Cloudflare. The secret was not printed or written to disk.");
