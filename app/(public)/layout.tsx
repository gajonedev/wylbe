export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col flex-1 min-h-screen">{children}</div>;
}
