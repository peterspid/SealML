// Copy compiled contract keys and ZKIR into frontend/dist so the browser
// wallet can load them without reaching back into contracts/build.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "contracts", "build");
const target = path.join(root, "frontend", "dist", "contract", "compiled");

mkdirSync(target, { recursive: true });
for (const name of [
  "EvaluatorRegistry",
  "ModelRegistry",
  "DatasetRegistry",
  "EvaluationRegistry",
  "CertificationRegistry",
  "RevocationRegistry",
]) {
  cpSync(path.join(source, name, "keys"), path.join(target, name, "keys"), { recursive: true });
  cpSync(path.join(source, name, "zkir"), path.join(target, name, "zkir"), { recursive: true });
}
