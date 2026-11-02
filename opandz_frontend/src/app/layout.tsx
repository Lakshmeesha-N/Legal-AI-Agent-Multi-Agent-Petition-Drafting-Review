import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Opandz AI — Professional Legal AI Workspace",
  description: "Accelerate your litigation workflows with sandboxed blueprint compilation, conversational intakes, and generative document workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[#0a0b0d] text-slate-100 antialiased overflow-hidden select-none" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
