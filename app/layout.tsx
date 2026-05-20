export const metadata = {
  title: "Mini Kibana Log Debugger",
  description: "Parse logs like Kibana"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
