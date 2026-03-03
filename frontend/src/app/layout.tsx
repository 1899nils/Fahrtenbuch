import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetPro | Fahrtenbuch Command",
  description: "Next-Gen Vehicle Fleet Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        {children}
      </body>
    </html>
  );
}
