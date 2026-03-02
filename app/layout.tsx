import './globals.css'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jira Joker',
  description: 'WebRTC 기반 실시간 Planning Poker — Jira 티켓 스토리 포인트 추정 서비스',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
