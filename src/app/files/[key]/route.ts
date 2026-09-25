import { getFile } from "@/server/files";

// Keys are never reused, so a file at a key never changes.
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const file = await getFile((await params).key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
