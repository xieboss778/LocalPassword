import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const root = new URL("../skills/", import.meta.url);
const entries = await readdir(root, { withFileTypes: true });
const names = new Map();
const problems = [];
let modelInvocable = 0;
let catalogCharacters = 0;

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const skillDir = join(root.pathname, entry.name);
  const skillFile = join(skillDir, "SKILL.md");
  try {
    await access(skillFile);
  } catch {
    continue;
  }

  const text = await readFile(skillFile, "utf8");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) {
    problems.push(`${entry.name}: missing YAML frontmatter`);
    continue;
  }

  let data;
  try {
    data = parse(match[1]);
  } catch (error) {
    problems.push(`${entry.name}: invalid YAML: ${error.message}`);
    continue;
  }

  const { name, description } = data;
  if (typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    problems.push(`${entry.name}: invalid name ${JSON.stringify(name)}`);
  } else if (names.has(name)) {
    problems.push(`${entry.name}: duplicate name ${name} (also ${names.get(name)})`);
  } else {
    names.set(name, entry.name);
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    problems.push(`${entry.name}: description must be a non-empty string`);
  } else if (description.length > 500) {
    problems.push(`${entry.name}: description exceeds DSH's 500-character catalog limit`);
  }

  for (const key of ["disable-model-invocation", "user-invocable"]) {
    if (key in data && typeof data[key] !== "boolean") {
      problems.push(`${entry.name}: ${key} must be a YAML boolean`);
    }
  }

  if (data["disable-model-invocation"] !== true) {
    modelInvocable += 1;
    catalogCharacters += description?.length ?? 0;
  }

  for (const ref of text.matchAll(/`((?:scripts|references)\/[^`]+)`/g)) {
    try {
      await access(join(skillDir, ref[1]));
    } catch {
      problems.push(`${entry.name}: missing resource ${ref[1]}`);
    }
  }
}

console.log(
  `DSH skills: ${names.size} total, ${modelInvocable} model-invocable, ` +
    `${catalogCharacters} catalog characters (~${Math.ceil(catalogCharacters / 4)} tokens)`,
);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("All DSH skill frontmatter and resource pointers are valid.");
