import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const montserrat = localFont({
  src: "./fonts/Montserrat-Variable.ttf",
  variable: "--font-ui",
  display: "swap",
  weight: "100 900",
});

const sourceSerif = localFont({
  src: [
    {
      path: "./fonts/SourceSerif4-Variable.ttf",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "./fonts/SourceSerif4-Italic-Variable.ttf",
      weight: "200 900",
      style: "italic",
    },
  ],
  variable: "--font-editorial",
  display: "swap",
});

const publicBody = localFont({
  src: "./fonts/Inter-Variable.ttf",
  variable: "--font-public-body",
  display: "swap",
  weight: "100 900",
});

const publicDisplay = localFont({
  src: "./fonts/DMSerifDisplay-Regular.ttf",
  variable: "--font-public-display",
  display: "swap",
  weight: "400",
});

const titanOne = localFont({
  src: "./fonts/TitanOne-Regular.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Ganesh Admin",
  description: "Visual content workspace for Ganesh Garments",
  icons: { icon: "/brand/ganesh-mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} ${sourceSerif.variable} ${titanOne.variable} ${publicBody.variable} ${publicDisplay.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
