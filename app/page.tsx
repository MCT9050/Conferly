"use client";

import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to auth - this makes the home page show the sign-in/sign-up form
  redirect("/auth");
}