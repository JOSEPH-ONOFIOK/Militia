import type { Metadata, Viewport } from "next";
import { Geist, Silkscreen, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import CookieConsent from "./_components/CookieConsent";

const pixel = Silkscreen({
  variable: "--font-pixel",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Militia War Room";
const DESCRIPTION =
  "Get drafted into the Militia. Sign in with X, receive one of 4,444 pixel art soldiers, complete missions, climb the ranks and secure your allowlist spot.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s | Militia" },
  description: DESCRIPTION,
  applicationName: "Militia",
  keywords: ["Militia", "Militia War Room", "NFT", "allowlist", "pixel art", "4444 soldiers", "war room", "digital collectibles"],
  authors: [{ name: "Militia", url: "https://x.com/militiaRH" }],
  creator: "Militia",
  publisher: "Militia",
  category: "games",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Militia",
    title: TITLE,
    description: "You don't pick your soldier. The Draft does. Sign in with X and report to the war room.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@militiaRH",
    creator: "@militiaRH",
    title: TITLE,
    description: "You don't pick your soldier. The Draft does. Sign in with X and report to the war room.",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#050704", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${pixel.variable} ${mono.variable}`}>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
