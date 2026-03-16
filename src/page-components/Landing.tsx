'use client'
import { useState } from "react";
import Link from "next/link";
import {
  Package,
  ArrowRight,
  CheckCircle2,
  Shield,
  Bell,
  QrCode,
  BarChart3,
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
  Scan,
  Menu,
  X,
  Star,
  ArrowUpRight,
  Sparkles,
  Building2,
  ClipboardList,
  LayoutDashboard,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Monitor,
  FileText,
  Check,
  LogOut,
  LogIn,
  Info,
  Zap,
} from "lucide-react";

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              Recurso<span className="text-emerald-600">Track</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              Get Started Free
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-6 pt-2 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-4 px-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 text-center py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white bg-gray-900 text-center py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 via-white to-white" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-emerald-100/40 rounded-full blur-3xl" />
      <div className="absolute top-10 left-1/4 w-[300px] h-[300px] bg-emerald-200/20 rounded-full blur-3xl" />
      <div className="absolute top-10 right-1/4 w-[300px] h-[300px] bg-teal-100/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              Gestión de recursos, simplificada
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
            Sabe qué tienes,{" "}
            <span className="text-emerald-600">quién lo tiene</span>
            {" "}y{" "}
            <span className="text-emerald-600">dónde está</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            The complete resource tracking platform for schools and institutions.
            Manage inventory, track loans, and never lose a resource again.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-200 hover:-translate-y-0.5"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-8 py-4 rounded-2xl text-base border border-gray-200 transition-all hover:border-gray-300"
            >
              See How It Works
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
            <div className="flex -space-x-2">
              {[
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
              ].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span>Trusted by <strong className="text-gray-700">500+</strong> institutions</span>
          </div>
        </div>

        <div className="relative mt-16 lg:mt-24 max-w-5xl mx-auto">
          <div className="relative bg-white rounded-2xl lg:rounded-3xl shadow-2xl shadow-gray-200/60 border border-gray-200/80 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white rounded-lg px-4 py-1 text-xs text-gray-400 border border-gray-200 w-64 text-center">
                  app.recursotrack.com/dashboard
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8 bg-gray-50/50">
              <div className="flex gap-4 lg:gap-6">
                <div className="hidden lg:flex flex-col w-48 bg-white rounded-xl border border-gray-100 p-3 gap-1">
                  {[
                    { icon: LayoutDashboard, label: "Dashboard", active: true },
                    { icon: Package, label: "Resources", active: false },
                    { icon: RefreshCw, label: "Loans", active: false },
                    { icon: ClipboardList, label: "Requests", active: false },
                    { icon: Calendar, label: "Calendar", active: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                        item.active
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-gray-500"
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Total Resources", value: "1,247", change: "+12%", color: "emerald" },
                      { label: "Active Loans", value: "89", change: "+5%", color: "blue" },
                      { label: "Overdue", value: "7", change: "-2", color: "red" },
                      { label: "Pending", value: "13", change: "New", color: "amber" },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="bg-white rounded-xl border border-gray-100 p-4"
                      >
                        <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                        <div className="flex items-end gap-2">
                          <span className="text-xl font-bold text-gray-900">{metric.value}</span>
                          <span
                            className={`text-xs font-medium ${
                              metric.color === "red" ? "text-red-500" : "text-emerald-500"
                            }`}
                          >
                            {metric.change}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 p-4 h-40">
                      <p className="text-sm font-semibold text-gray-800 mb-3">Weekly Activity</p>
                      <div className="flex items-end gap-2 h-20">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-emerald-100 rounded-t-md hover:bg-emerald-200 transition-colors"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-2">
                        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                          <span key={i} className="text-[10px] text-gray-400 flex-1 text-center">{d}</span>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 h-40">
                      <p className="text-sm font-semibold text-gray-800 mb-3">Recent Activity</p>
                      <div className="space-y-2.5">
                        {[
                          { text: "iPad Pro returned", time: "2m ago", dot: "bg-emerald-400" },
                          { text: "New request pending", time: "15m ago", dot: "bg-amber-400" },
                          { text: "Projector checked out", time: "1h ago", dot: "bg-blue-400" },
                        ].map((item) => (
                          <div key={item.text} className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                            <span className="text-xs text-gray-700 flex-1 truncate">{item.text}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block absolute -left-12 top-1/3 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 w-56 -rotate-3 hover:rotate-0 transition-transform">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <QrCode className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">QR Scan</p>
                <p className="text-xs text-gray-500">Instant check-in</p>
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2 flex items-center gap-1.5 justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-700">iPad Pro returned</p>
            </div>
          </div>

          <div className="hidden lg:block absolute -right-8 top-1/4 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 w-52 rotate-2 hover:rotate-0 transition-transform">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Alerts</p>
                <p className="text-xs text-gray-500">Stay informed</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="bg-red-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                <p className="text-[11px] font-medium text-red-700">3 overdue loans</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3 text-amber-600 shrink-0" />
                <p className="text-[11px] font-medium text-amber-700">5 pending requests</p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-3 px-5">
            <div className="flex items-center gap-6">
              {[
                { label: "Resources Tracked", value: "2.4M+" },
                { label: "Loans Processed", value: "890K+" },
                { label: "Institutions", value: "500+" },
              ].map((stat, i) => (
                <div key={stat.label} className={`text-center ${i !== 0 ? "border-l border-gray-100 pl-6" : ""}`}>
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  <p className="text-[11px] text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "99.9%", label: "Uptime reliability" },
    { value: "2.4M+", label: "Resources tracked" },
    { value: "500+", label: "Institutions" },
    { value: "<2s", label: "Average response" },
  ];

  return (
    <section className="py-16 lg:py-20 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-10">
          Trusted by leading educational institutions
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Package,
      title: "Complete Inventory",
      description:
        "Track every resource with photos, categories, QR codes, and real-time availability across departments and areas.",
      color: "emerald",
    },
    {
      icon: ClipboardList,
      title: "Smart Loan System",
      description:
        "Configurable approval workflows — some resources auto-approve, others require manager sign-off. You decide.",
      color: "blue",
    },
    {
      icon: Building2,
      title: "Departments & Areas",
      description:
        "Organize by departments and sub-areas. Staff can add resources to their area. Share across departments when needed.",
      color: "violet",
    },
    {
      icon: Scan,
      title: "QR Code Tracking",
      description:
        "Generate and print QR codes for every resource. Scan to check-in, check-out, or audit in seconds.",
      color: "amber",
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description:
        "Automatic alerts for due dates, overdue items, low stock, and pending approvals. Never miss anything.",
      color: "rose",
    },
    {
      icon: BarChart3,
      title: "Reports & Analytics",
      description:
        "Dashboard with real-time metrics, usage trends, department comparisons, and exportable reports.",
      color: "cyan",
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-100" },
    violet: { bg: "bg-violet-50", icon: "text-violet-600", border: "border-violet-100" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-100" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-100" },
    cyan: { bg: "bg-cyan-50", icon: "text-cyan-600", border: "border-cyan-100" },
  };

  return (
    <section id="features" className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            Everything you need to{" "}
            <span className="text-emerald-600">track resources</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            Powerful tools designed for real institutional needs. From iPads to scissors,
            from labs to classrooms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {features.map((feature) => {
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className="group bg-white border border-gray-100 rounded-2xl p-6 lg:p-8 hover:shadow-lg hover:shadow-gray-100/80 hover:border-gray-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center mb-5`}
                >
                  <feature.icon className={`w-6 h-6 ${colors.icon}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Set Up Your Inventory",
      description:
        "Add your departments, areas, and resources. Upload photos, assign categories, set loan policies. Staff can also add resources to their own areas.",
      icon: Package,
    },
    {
      number: "02",
      title: "Configure & Share",
      description:
        "Choose which resources need approval and which don't. Decide what's visible to who, and enable cross-department sharing.",
      icon: Shield,
    },
    {
      number: "03",
      title: "Track Everything",
      description:
        "Staff requests resources, managers approve (or not), QR codes handle check-in/out. You always know what you have, who has it, and where it is.",
      icon: MapPin,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-32 bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            Up and running in{" "}
            <span className="text-emerald-600">minutes</span>
          </h2>
          <p className="text-lg text-gray-500">
            Three simple steps to transform how your institution manages resources.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[calc(100%+1rem)] w-[calc(100%-2rem)] h-[2px] border-t-2 border-dashed border-gray-200 z-0" />
              )}
              <div className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <span className="text-lg font-bold text-white">{step.number}</span>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DifferentiatorsSection() {
  const items = [
    {
      title: "Approval? Optional.",
      description:
        "Scissors don't need a manager's approval. Projectors might. Configure each resource individually — auto-approve or require sign-off.",
      icon: CheckCircle2,
      highlight: "Per-resource approval settings",
    },
    {
      title: "See Who Has It",
      description:
        "Toggle visibility per resource. Should everyone see who currently has the projector? Or keep it private? Your call.",
      icon: Users,
      highlight: "Configurable holder visibility",
    },
    {
      title: "Staff Can Add Resources",
      description:
        "Area leads and staff (when permitted) can add resources to their own areas. No bottlenecks. The lab assistant knows what's in the lab.",
      icon: Package,
      highlight: "Decentralized resource management",
    },
    {
      title: "Cross-Department Sharing",
      description:
        "The Art department needs a microscope from Science? Enable sharing per resource. The owning department approves.",
      icon: Building2,
      highlight: "Inter-department loan tracking",
    },
  ];

  return (
    <section className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 mb-6">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">What makes us different</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-5">
              Built for how institutions{" "}
              <span className="text-emerald-600">actually work</span>
            </h2>
            <p className="text-lg text-gray-500 mb-10">
              Not every resource is the same. Not every department works the same way.
              RecursoTrack adapts to you, not the other way around.
            </p>

            <div className="space-y-6">
              {items.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                    <span className="inline-block mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                      {item.highlight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-gray-50 rounded-3xl p-6 lg:p-8 border border-gray-100">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Epson Projector #1</h4>
                    <p className="text-xs text-gray-500">GEN-0012 • Audio/Video</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Requires approval", value: true },
                    { label: "Show current holder", value: true },
                    { label: "Shared across departments", value: true },
                    { label: "Staff can add to area", value: false },
                  ].map((toggle) => (
                    <div key={toggle.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{toggle.label}</span>
                      <div
                        className={`w-10 h-6 rounded-full relative transition-colors ${
                          toggle.value ? "bg-emerald-500" : "bg-gray-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${
                            toggle.value ? "right-1" : "left-1"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Loan Flow Preview
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "Request", icon: FileText, active: true },
                    { label: "Approve", icon: Check, active: true },
                    { label: "Check-out", icon: LogOut, active: false },
                    { label: "Return", icon: LogIn, active: false },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          step.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        <step.icon className="w-3.5 h-3.5" />
                        <span>{step.label}</span>
                      </div>
                      {i < 3 && (
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <Info className="w-3 h-3 text-gray-400 shrink-0" />
                  <p className="text-[11px] text-gray-400">Without approval, Request + Approve happen automatically</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: "Dr. Carmen Rodríguez",
      role: "Principal, Colegio San José",
      avatar:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face",
      text: "We finally know where every iPad, projector, and lab equipment is. RecursoTrack saved us hours of searching and thousands in lost resources.",
      rating: 5,
    },
    {
      name: "Prof. Miguel Santos",
      role: "IT Director, Instituto Técnico",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
      text: "The QR scanning is a game changer. Teachers scan, pick up, and go. No paperwork, no waiting. The approval system is perfectly flexible.",
      rating: 5,
    },
    {
      name: "Ana María Flores",
      role: "Lab Manager, Universidad Central",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
      text: "Being able to add resources directly to my area without going through admin every time? That alone made this worth it. Plus the cross-department sharing is brilliant.",
      rating: 5,
    },
  ];

  return (
    <section className="py-20 lg:py-32 bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-medium text-gray-600">Wall of Love</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-5">
            Loved by <span className="text-emerald-600">institutions</span> everywhere
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl border border-gray-100 p-6 lg:p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [yearly, setYearly] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "For small departments or teams",
      priceMonthly: 0,
      priceYearly: 0,
      cta: "Start Free",
      popular: false,
      features: [
        "Up to 100 resources",
        "5 users",
        "1 department",
        "Basic loan tracking",
        "QR code generation",
        "Email support",
      ],
    },
    {
      name: "Professional",
      description: "For growing institutions",
      priceMonthly: 29,
      priceYearly: 24,
      cta: "Start Free Trial",
      popular: true,
      features: [
        "Unlimited resources",
        "50 users",
        "10 departments",
        "Advanced approval workflows",
        "Cross-department sharing",
        "Analytics & reports",
        "Push notifications",
        "Priority support",
      ],
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      priceMonthly: 79,
      priceYearly: 66,
      cta: "Contact Sales",
      popular: false,
      features: [
        "Everything in Professional",
        "Unlimited users",
        "Unlimited departments",
        "SSO / LDAP integration",
        "API access",
        "Custom branding",
        "Dedicated account manager",
        "SLA guarantee",
      ],
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 mb-6">
            <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            Simple, transparent{" "}
            <span className="text-emerald-600">pricing</span>
          </h2>
          <p className="text-lg text-gray-500">
            Start free. Upgrade when you need more.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-medium ${!yearly ? "text-gray-900" : "text-gray-500"}`}>
              Monthly
            </span>
            <button
              onClick={() => setYearly(!yearly)}
              className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${
                yearly ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${
                  yearly ? "right-1" : "left-1"
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${yearly ? "text-gray-900" : "text-gray-500"}`}>
              Yearly
            </span>
            {yearly && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                SAVE 20%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 lg:p-8 border transition-all ${
                plan.popular
                  ? "bg-gray-900 border-gray-900 text-white shadow-2xl shadow-gray-400/20 scale-[1.02] lg:scale-105"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <h3
                className={`text-lg font-semibold mb-1 ${
                  plan.popular ? "text-white" : "text-gray-900"
                }`}
              >
                {plan.name}
              </h3>
              <p
                className={`text-sm mb-6 ${
                  plan.popular ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {plan.description}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span
                  className={`text-4xl font-bold ${
                    plan.popular ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${yearly ? plan.priceYearly : plan.priceMonthly}
                </span>
                <span
                  className={`text-sm ${plan.popular ? "text-gray-400" : "text-gray-500"}`}
                >
                  /month
                </span>
              </div>

              <button
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all mb-8 cursor-pointer ${
                  plan.popular
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                }`}
              >
                {plan.cta}
              </button>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        plan.popular ? "text-emerald-400" : "text-emerald-500"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.popular ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How long does it take to set up RecursoTrack?",
      answer:
        "Most institutions are up and running within a day. Create your account, add departments, upload your resources (you can import from spreadsheets), and invite your team. It's that simple.",
    },
    {
      question: "Can different resources have different approval rules?",
      answer:
        "Absolutely! Each resource has its own configuration. Scissors can be grabbed without approval while a projector requires a manager's sign-off. You configure this per resource, per department, or set organization-wide defaults.",
    },
    {
      question: "Can staff see who currently has a resource?",
      answer:
        "This is configurable per resource. You can enable 'Show current holder' for specific items so anyone can see who has the projector, or disable it for privacy. It's completely up to you.",
    },
    {
      question: "Can staff add resources to their own area?",
      answer:
        "Yes! When enabled, Area Leads and even Staff members can add resources to their own areas. The lab assistant knows best what's in the lab. Department Managers and Admins always have full control.",
    },
    {
      question: "How does cross-department sharing work?",
      answer:
        "Mark a resource as 'shared' and specify which departments can request it. When someone from another department requests it, the owning department's manager approves. Everything is tracked — who borrowed what, from which department, and when.",
    },
    {
      question: "Is there a free plan?",
      answer:
        "Yes! Our Starter plan is free forever — up to 100 resources, 5 users, and 1 department. Perfect for trying out the platform or for small teams. Upgrade anytime as you grow.",
    },
    {
      question: "Can I use it on mobile?",
      answer:
        "RecursoTrack is a Progressive Web App (PWA) — it works beautifully on any device and can be installed on your phone's home screen like a native app. QR scanning works directly from your phone's camera.",
    },
    {
      question: "How secure is our data?",
      answer:
        "We use Supabase (built on PostgreSQL) with Row Level Security, ensuring each institution's data is completely isolated. All data is encrypted in transit and at rest. We support SSO/LDAP on Enterprise plans.",
    },
  ];

  return (
    <section id="faq" className="py-20 lg:py-32 bg-gray-50/80">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6">
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-5">
            Frequently asked{" "}
            <span className="text-emerald-600">questions</span>
          </h2>
          <p className="text-lg text-gray-500">
            Everything you need to know about RecursoTrack.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 lg:p-6 text-left cursor-pointer"
              >
                <span className="text-sm lg:text-base font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-5 lg:px-6 pb-5 lg:pb-6 -mt-1">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gray-900 rounded-3xl p-10 lg:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                Ready to get started?
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
              Stop losing resources.{" "}
              <br className="hidden sm:block" />
              Start <span className="text-emerald-400">tracking</span> them.
            </h2>
            <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
              Join 500+ institutions already using RecursoTrack. Free to start,
              ready to scale.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-8 py-4 rounded-2xl text-base backdrop-blur transition-all border border-white/10"
              >
                Log In
              </Link>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              No credit card required • Free forever on Starter plan • Setup in minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">
                Recurso<span className="text-emerald-600">Track</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              The complete resource tracking platform for schools and institutions.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {["Features", "Pricing", "Integrations", "Changelog", "Roadmap"].map(
                (link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              {["Documentation", "API Reference", "Help Center", "Community", "Blog"].map(
                (link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {["About", "Contact", "Privacy Policy", "Terms of Service", "Security"].map(
                (link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} RecursoTrack. All rights reserved.
          </p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {["Twitter", "GitHub", "LinkedIn"].map((social) => (
              <a
                key={social}
                href="#"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DifferentiatorsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}
