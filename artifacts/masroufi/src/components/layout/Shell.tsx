import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowDownToLine, 
  Briefcase, 
  FileText, 
  Settings,
  ShieldCheck
} from "lucide-react";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [location] = useLocation();

  const navItems = [
    { name: "الرئيسية", path: "/", icon: LayoutDashboard },
    { name: "المصروفات", path: "/expenses", icon: Wallet },
    { name: "الدخل", path: "/income", icon: ArrowDownToLine },
    { name: "المشاريع", path: "/projects", icon: Briefcase },
    { name: "التقارير", path: "/reports", icon: FileText },
    { name: "الإعدادات", path: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-l border-border bg-card shadow-sm z-10 sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Wallet className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-xl text-foreground">مصروفي</h1>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold" 
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : ""}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mx-4 mb-4 mt-auto bg-secondary/50 rounded-2xl border border-secondary">
          <div className="flex items-center gap-2 text-primary mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm font-bold">خصوصيتك أولاً</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            جميع بياناتك المالية تُحفظ محلياً على جهازك. لا يوجد اتصال بخوادم خارجية.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-[100dvh] md:min-h-screen pb-20 md:pb-0 relative overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Wallet className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-lg text-foreground">مصروفي</h1>
          </div>
        </header>

        <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 px-2 py-2 pb-safe">
        <div className="flex items-center justify-around">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-primary/10 rounded-xl animate-in zoom-in-95 duration-200" />
                )}
                <item.icon className={`w-5 h-5 mb-1 ${isActive ? "fill-primary/10" : ""}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 relative ${
              location.startsWith("/settings") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {location.startsWith("/settings") && (
              <span className="absolute inset-0 bg-primary/10 rounded-xl animate-in zoom-in-95 duration-200" />
            )}
            <Settings className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">إعدادات</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
