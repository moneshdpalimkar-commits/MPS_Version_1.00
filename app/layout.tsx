import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/components/shared/auth-provider";
import { PWARegister } from "@/components/shared/pwa-register";
import { PWAInstallBanner } from "@/components/shared/pwa-install-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "MPS Staff Portal",
  description: "School Staff Attendance, Biometrics & Payroll Portal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MPS Staff",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <Script id="console-suppress" strategy="beforeInteractive">
          {`
            (function() {
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                const origError = console.error;
                console.error = function(...args) {
                  if (typeof args[0] === 'string' && (
                    args[0].includes('Encountered a script tag') || 
                    args[0].includes('extra attributes from the server') ||
                    args[0].includes('did not match the server')
                  )) {
                    return;
                  }
                  origError.apply(console, args);
                };
              }
            })();
          `}
        </Script>
      </head>
      <body className="font-sans min-h-full flex flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <PWARegister />
          <PWAInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
