import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck, TriangleAlert } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const title = "Verify Your Email — Nexali";
const description = "Confirm your email address to finish setting up your Nexali account.";

export const Route = createFileRoute("/email-verification")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmailVerificationPage,
});

type ViewState = "pending" | "verified" | "error";
const MOCK_EMAIL = "jordan@nexali.app";
const RESEND_SECONDS = 30;

function EmailVerificationPage() {
  const [view, setView] = useState<ViewState>("pending");
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (view !== "pending") return;
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [view]);

  const handleResend = () => {
    setSeconds(RESEND_SECONDS);
  };

  const handleVerify = () => {
    if (code.length === 6) {
      setView("verified");
    } else {
      setView("error");
    }
  };

  return (
    <AuthLayout
      title="Verify Your Email Address"
      description={
        view === "pending"
          ? `We've sent a 6-digit confirmation code to ${MOCK_EMAIL}. Enter it below to activate your account.`
          : undefined
      }
      maxWidthClassName="max-w-lg"
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {/* Design-preview affordance: not part of the real product UI. */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant bg-surface p-1" role="group" aria-label="Design preview: switch verification state">
        {(
          [
            { key: "pending", label: "Pending" },
            { key: "verified", label: "Verified" },
            { key: "error", label: "Error" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setView(opt.key)}
            aria-pressed={view === opt.key}
            className={cn(
              "min-h-9 flex-1 rounded-md px-2 text-xs font-medium transition-colors",
              view === opt.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {view === "verified" ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-foreground">Email verified</h2>
            <p className="text-sm text-muted-foreground">
              Your account is active. You&apos;re ready to sign in to Nexali.
            </p>
          </div>
          <Button variant="brand" size="control" className="w-full" asChild>
            <Link to="/signin">Continue to sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {view === "error" ? (
            <div className="mb-5 flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-xs text-destructive">
                That code didn&apos;t match. Double-check your inbox and try again.
              </p>
            </div>
          ) : null}

          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="6-digit verification code">
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-12 rounded-lg text-lg" />
                <InputOTPSlot index={1} className="h-14 w-12 rounded-lg text-lg" />
                <InputOTPSlot index={2} className="h-14 w-12 rounded-lg text-lg" />
                <InputOTPSlot index={3} className="h-14 w-12 rounded-lg text-lg" />
                <InputOTPSlot index={4} className="h-14 w-12 rounded-lg text-lg" />
                <InputOTPSlot index={5} className="h-14 w-12 rounded-lg text-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="button"
            variant="brand"
            size="control"
            className="w-full"
            onClick={handleVerify}
            disabled={code.length < 6}
          >
            Verify &amp; Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>Didn&apos;t receive the email?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={seconds > 0}
              className="font-medium text-primary transition-colors disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {seconds > 0 ? `Resend code in ${seconds}s` : "Resend code now"}
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
