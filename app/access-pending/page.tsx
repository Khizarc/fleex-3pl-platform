import { SignOutButton } from '@clerk/nextjs';

export default function AccessPendingPage() {
  return (
    <main>
      <h1>Access pending</h1>
      <p>
        You&apos;re signed in, but haven&apos;t been added to a 3PL portal yet. Contact your 3PL
        administrator to be invited.
      </p>
      <p>
        If you meant to set up your <em>own</em> 3PL workspace, visit{' '}
        <a href="/warehouse">the warehouse dashboard</a> — we&apos;ll set one up for you
        automatically.
      </p>
      <p>
        <SignOutButton>
          <button type="button">Sign out</button>
        </SignOutButton>
      </p>
    </main>
  );
}
