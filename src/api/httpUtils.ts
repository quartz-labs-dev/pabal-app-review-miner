import { IncomingMessage, ServerResponse } from "node:http";

export function sendNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not Found");
}

export function sendJson(res: ServerResponse, payload: unknown, statusCode = 200): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export function sendMethodNotAllowed(res: ServerResponse, allow: string[]): void {
  res.statusCode = 405;
  res.setHeader("Allow", allow.join(", "));
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Method Not Allowed");
}

export async function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`Request body too large (>${maxBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (error) => reject(error));
  });
}
