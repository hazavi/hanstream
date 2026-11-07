"use client";

import Link from "next/link";
import { UserRound } from 'lucide-react';

export function AuthStatus() {
  return <Link href="/profile" className="glass-btn library-link" aria-label="My profile" title="Profile and library">
    <UserRound size={17} aria-hidden="true"/>
    <span className="library-label">Profile</span>
  </Link>;
}

export default AuthStatus;
