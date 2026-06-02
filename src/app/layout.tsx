import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuizCorp - Plataforma Corporativa de Quiz",
  description: "Plataforma corporativa de quiz interativo para treinamentos e avaliações. Crie quizzes, convide participantes e acompanhe resultados em tempo real.",
  keywords: ["QuizCorp", "quiz", "corporativo", "treinamento", "avaliação", "Kahoot"],
  authors: [{ name: "QuizCorp" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "QuizCorp - Plataforma Corporativa de Quiz",
    description: "Plataforma corporativa de quiz interativo para treinamentos e avaliações",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
