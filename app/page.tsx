import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    return (
      <main>
        <h1>Fleex 3PL Platform</h1>
        <p>You&apos;re signed in. Continue to your shell:</p>
        <ul>
          <li>
            <Link href="/warehouse">Warehouse Dashboard</Link> (staff)
          </li>
          <li>
            <Link href="/portal">Client Portal</Link>
          </li>
        </ul>
      </main>
    );
  }

  return (
    <main>
      <h1>Fleex 3PL Platform</h1>
      <p>Multi-tenant 3PL warehouse and shipping platform.</p>
      <p>
        <Link href="/sign-in">Sign in</Link> · <Link href="/sign-up">Sign up</Link>
      </p>
    </main>
  );
}
