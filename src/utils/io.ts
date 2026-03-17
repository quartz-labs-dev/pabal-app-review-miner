import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function readJsonFileIfExists<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function listJsonFilesInDir(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.resolve(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

