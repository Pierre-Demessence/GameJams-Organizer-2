import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";

export const metadata = {
  title: "Sign Up — GameJam Organizer",
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
