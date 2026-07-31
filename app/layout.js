import './globals.css'

export const metadata = {
  title: 'Mobile Board — 팀 스케줄러',
  description: '점심, 근태, 팀 이벤트를 한 곳에서 공유하는 달력',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
