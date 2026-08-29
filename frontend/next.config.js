const frameAncestors =
  process.env.NODE_ENV === "production"
    ? "frame-ancestors https://calorietoken.net https://www.calorietoken.net"
    : "frame-ancestors https://calorietoken.net https://www.calorietoken.net http://localhost:* http://127.0.0.1:*";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: frameAncestors,
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org",
      },
    ],
  },
};

module.exports = nextConfig;
