"use client";

import { resetConsent } from "./CookieConsent";

export default function ConsentReset() {
  return (
    <button className="consent-btn" onClick={resetConsent}>Change cookie settings</button>
  );
}
