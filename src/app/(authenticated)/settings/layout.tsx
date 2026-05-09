// Layout cho /settings/* — hiện chỉ có "Tài khoản" nhưng giữ structure
// để mở rộng sau (Profile, Thông báo, ...). Server component.

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-zinc-900 mb-6">Cài đặt</h2>
      {children}
    </div>
  );
}
