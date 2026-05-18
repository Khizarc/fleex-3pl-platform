import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <SignIn signUpUrl="/sign-up" />
    </div>
  );
}
