"use client";

import { useEffect, useRef, useState } from "react";
import Image from "./CspImage.js";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  ["Platform", "/ai-website-intelligence"],
  ["Reports", "/reports"],
  ["Developers", "/docs"],
  ["Pricing", "/pricing"],
];

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef(null);
  const navigation = useRef(null);
  useEffect(() => {
    const dismiss = (event) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const outside = (event) => {
      if (!navigation.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <header className="chrome-header" ref={navigation}>
      <nav className="chrome-nav" aria-label="Primary navigation">
        <a
          className="chrome-brand"
          href="/"
          aria-label="Santos Intelligence home"
        >
          <Image
            src="/assets/santos-eagle.svg"
            alt=""
            width={40}
            height={40}
            priority
          />
          <span>
            SANTOS<span className="chrome-brand-sub">INTELLIGENCE</span>
          </span>
        </a>
        <div className="chrome-desktop-links">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="chrome-nav-actions">
          <a className="chrome-contact" href="/integrations">
            Connect your agent
          </a>
          <a
            className="s-button s-button-gold chrome-cta"
            href="/agent-readiness/buy"
          >
            Get a report <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <button
            className="chrome-menu-toggle"
            type="button"
            ref={menuButton}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>
      <div
        id="mobile-navigation"
        className="chrome-mobile-links"
        hidden={!open}
      >
        {links.map(([label, href]) => (
          <a
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ))}
        <a href="/integrations">
          Connect your agent <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
