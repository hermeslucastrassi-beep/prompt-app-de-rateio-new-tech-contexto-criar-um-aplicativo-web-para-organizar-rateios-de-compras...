import { createFileRoute } from "@tanstack/react-router";

const SAFE_PATH = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

export const Route = createFileRoute("/api/public/store-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || !SAFE_PATH.test(path) || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }
        const { db } = await import("@/lib/rateio.server");
        const { data, error } = await db.storage.from("store-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const ext = path.split(".").pop()?.toLowerCase();
        const type =
          ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        return new Response(data, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
