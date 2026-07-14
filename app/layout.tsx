import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import config from "@/config";
import { PostHogProvider } from "@/components/common/PostHogProvider";
import { DemoBanner } from "@/components/common/DemoBanner";

const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: config.business.name,
  description: config.business.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body
        style={
          {
            "--font-display": `var(--font-display-loaded), Georgia, serif`,
            "--font-body": `var(--font-body-loaded), system-ui, sans-serif`,
            "--color-primary": config.brand.colorPrimary,
            "--color-accent": config.brand.colorAccent,
            "--color-bg": config.brand.colorBg,
          } as React.CSSProperties
        }
      >
        <PostHogProvider>
          <DemoBanner />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
