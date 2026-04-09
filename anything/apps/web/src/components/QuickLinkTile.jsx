import React from "react";

export default function QuickLinkTile({ href, children }) {
  return (
    <a
      href={href}
      className="px-3 py-3 bg-[#0E1D33] hover:bg-[#1a2d4d] text-white text-center flex items-center justify-center border border-[#0E1D33] shadow-sm font-semibold rounded-lg"
      style={{ fontSize: "1.05rem" }}
    >
      {children}
    </a>
  );
}
