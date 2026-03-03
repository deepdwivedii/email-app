 "use client";

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Inbox, CreditCard, ListTodo } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export function MobileNav() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading || !user) {
    return null
  }

  const links = [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/subscriptions", label: "Subs", icon: Inbox },
    { href: "/accounts", label: "Accounts", icon: CreditCard },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t pb-safe shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-around h-16 px-2">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href)
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 min-h-[44px] transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                size={20}
                className={isActive ? "stroke-[2.5px]" : "stroke-2"}
              />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
