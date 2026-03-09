import { SignUpForm } from "./sign-up-form";

export const metadata = {
  title: "Sign Up — GameJam Organizer",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <SignUpForm />
    </div>
  );
}
