import type { Metadata } from "next";
import ForgotForm from "./ForgotForm";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Forgotten password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell
      heading="Forgotten password"
      intro="Enter the email address of your officer account and we will send you a link to set a new password."
    >
      <ForgotForm />
    </AuthShell>
  );
}