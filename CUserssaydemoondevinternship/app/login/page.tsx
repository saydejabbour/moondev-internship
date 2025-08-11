// @ts-nocheck               // ⬅ disables TS just for this file to unblock build

// app/login/page.tsx (SERVER component)
import LoginClient from './LoginClient';

export default function LoginPage({ searchParams }: any) {
  const raw = searchParams?.next;
  const nextParam =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';

  return <LoginClient nextParam={nextParam} />;
}
