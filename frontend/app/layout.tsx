import type { Metadata } from "next";
import "./globals.css";
import { DisplayLanguageProvider } from "@/components/DisplayLanguageProvider";

export const metadata: Metadata = {
  title: "CalorieApp",
  description: "Non-financial food and nutrition tracking MVP",
};

const configuredBuildId = process.env.NEXT_PUBLIC_CALORIEAPP_BUILD_ID?.trim();
if (
  configuredBuildId &&
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(configuredBuildId)
) {
  throw new Error(
    "NEXT_PUBLIC_CALORIEAPP_BUILD_ID must be 1-64 letters, digits, dots, underscores or hyphens"
  );
}
// Render exposes the deployed Git SHA without additional dashboard setup.
// Explicit release identifiers keep priority; never expose arbitrary env text.
const renderCommit = process.env.RENDER_GIT_COMMIT?.trim();
const buildId = configuredBuildId || (renderCommit && /^[a-f0-9]{40}$/i.test(renderCommit) ? renderCommit : "development");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-calorieapp-build-id={buildId}>
      <body><DisplayLanguageProvider>{children}</DisplayLanguageProvider></body>
    </html>
  );
}
