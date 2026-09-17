import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(sessionToken);

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'FARMER') {
    redirect('/admin');
  } else if (session.role === 'CUSTOMER') {
    redirect('/customer');
  } else {
    redirect('/superadmin');
  }
}
