import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalorieApp",
  description: "Non-financial food and nutrition tracking MVP",
};

const configuredBuildId = process.env.NEXT_PUBLIC_CALORIEAPP_BUILD_ID?.trim();
const buildId =
  configuredBuildId && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(configuredBuildId)
    ? configuredBuildId
    : "development";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-calorieapp-build-id={buildId}>
      <body>{children}</body>
    </html>
  );
}
