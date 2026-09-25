import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  // Two images of up to 2 MB each (MAX_IMAGE_BYTES) plus the text fields.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
