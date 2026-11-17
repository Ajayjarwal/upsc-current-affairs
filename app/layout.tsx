import type { Metadata } from "next";
import "./globals.css";
import "./warm-theme.css";
import "./cards.css";
import "./compact-examples.css";
import { ThemeProvider } from './theme-provider';
export const metadata: Metadata = { title: "Current Affairs | UPSC Desk", description: "Your personal current affairs reading and revision workspace.", icons:{icon:"/favicon.svg"} };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" data-reading-palette="warm" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;}
