import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Urban Thermal Environment Digital Twin Platform",
  description: "UAV-based Intelligent Monitoring System for Urban Thermal Environment Analysis",
  keywords: ["Digital Twin", "UAV", "Thermal Monitoring", "Urban Heat Island", "LLM-RAG"],
  authors: [{ name: "Research Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
