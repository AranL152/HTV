import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Level - Dataset Bias Correction",
  description: "Visualize and rebalance your datasets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
