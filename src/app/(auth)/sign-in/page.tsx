import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata = {
  title: "Sign In — GameJam Organizer",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
