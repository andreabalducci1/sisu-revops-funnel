"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";

export function BookingCta({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();

  function handleClick() {
    track(FUNNEL_EVENTS.BOOKING_CLICK);
    router.push("/book");
  }

  return (
    <button
      type="button"
      className={variant === "outline" ? "btn-outline" : "btn-primary"}
      onClick={handleClick}
    >
      {label}
      <ArrowRight size={18} />
    </button>
  );
}
