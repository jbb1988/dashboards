'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Animated background grid
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1722] via-[#0F1722]/95 to-[#0F1722]" />

      {/* Animated grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(56, 189, 248, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(56, 189, 248, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#0189CB]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#38BDF8]/5 rounded-full blur-[100px]" />
    </div>
  );
}

// Floating particles - more prominent effect with slow, ambient movement
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(35)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${i % 3 === 0 ? 'w-2 h-2 bg-[#38BDF8]/40' : 'w-1.5 h-1.5 bg-[#38BDF8]/50'}`}
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, -20, 20],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

// Department data
interface DashboardItem {
  name: string;
  href: string;
  description: string;
  badge?: string;
}

interface Department {
  name: string;
  icon: React.ReactNode;
  color: string;
  dashboards: DashboardItem[];
}

const departments: Department[] = [
  {
    name: 'Contracts',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'from-[#0189CB] to-[#38BDF8]',
    dashboards: [
      { name: 'Contracts Pipeline', href: '/contracts-dashboard', description: 'Track contract status and pipeline', badge: 'Salesforce' },
      { name: 'Contract Review', href: '/contracts/review', description: 'AI-powered contract analysis', badge: 'Claude' },
    ],
  },
  {
    name: 'Project Management',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: 'from-[#E16259] to-[#F87171]',
    dashboards: [
      { name: 'Project Tracker', href: '/pm-dashboard', description: 'Monitor milestones and tasks', badge: 'Asana' },
    ],
  },
  {
    name: 'Finance',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'from-[#22C55E] to-[#4ADE80]',
    dashboards: [
      { name: 'MCC Profitability', href: '/mcc-dashboard', description: 'Master cost center analysis', badge: 'Excel' },
      { name: 'Project Profitability', href: '/closeout-dashboard', description: 'Project closeout metrics', badge: 'Excel' },
    ],
  },
  {
    name: 'Management',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: 'from-[#A855F7] to-[#C084FC]',
    dashboards: [],
  },
  {
    name: 'Operations',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'from-[#F59E0B] to-[#FBBF24]',
    dashboards: [],
  },
  {
    name: 'Sales',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'from-[#EC4899] to-[#F472B6]',
    dashboards: [
      { name: 'Diversified Products', href: '/diversified-dashboard', description: 'Product class sales by customer', badge: 'NetSuite' },
    ],
  },
];

// Badge color mapping
function getBadgeColor(badge: string): string {
  switch (badge) {
    case 'Salesforce': return 'bg-[#38BDF8]';
    case 'Asana': return 'bg-[#E16259]';
    case 'Excel': return 'bg-[#22C55E]';
    case 'Claude': return 'bg-[#D97706]';
    case 'NetSuite': return 'bg-[#F97316]';
    default: return 'bg-[#64748B]';
  }
}

// Department card component
function DepartmentCard({ department, delay }: { department: Department; delay: number }) {
  const hasDashboards = department.dashboards.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="group relative bg-[#151E2C]/80 backdrop-blur-sm border border-[#1E293B] rounded-2xl overflow-hidden"
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${department.color} opacity-60`} />

      {/* Department Header */}
      <div className="p-5 border-b border-[#1E293B]/50">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${department.color} shadow-lg`}>
            <span className="text-white">{department.icon}</span>
          </div>
          <h3 className="text-lg font-semibold text-white">{department.name}</h3>
        </div>
      </div>

      {/* Dashboards List */}
      <div className="p-3">
        {hasDashboards ? (
          <div className="space-y-1">
            {department.dashboards.map((dashboard, idx) => (
              <Link key={idx} href={dashboard.href}>
                <motion.div
                  whileHover={{ x: 4, backgroundColor: 'rgba(56, 189, 248, 0.1)' }}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group/item"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#EAF2FF] group-hover/item:text-[#38BDF8] transition-colors">
                        {dashboard.name}
                      </span>
                      {dashboard.badge && (
                        <span className={`w-1.5 h-1.5 rounded-full ${getBadgeColor(dashboard.badge)}`} title={dashboard.badge} />
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-0.5">{dashboard.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-[#475569] group-hover/item:text-[#38BDF8] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1E293B]/50 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
              <span className="text-[12px] text-[#64748B]">Coming Soon</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Data source badge
function DataSourceBadge({ name, color, delay }: { name: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-2 px-4 py-2 bg-[#151E2C]/60 backdrop-blur-sm border border-[#1E293B] rounded-full"
    >
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-sm text-[#8FA3BF]">{name}</span>
      <span className="text-xs text-[#22C55E] font-medium">Connected</span>
    </motion.div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1722] text-white relative overflow-hidden">
      <GridBackground />
      {mounted && <FloatingParticles />}

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center justify-between px-8 py-6"
      >
        <img
          src="/mars-logo-horizontal.png"
          alt="MARS"
          className="h-10 object-contain"
        />
        <Link href="/login">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-2.5 text-sm font-medium text-white bg-[#1E293B] hover:bg-[#2D3B4F] rounded-lg transition-colors"
          >
            Sign In
          </motion.button>
        </Link>
      </motion.header>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-8 pb-20">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0189CB]/10 border border-[#0189CB]/20 rounded-full mb-6"
          >
            <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse" />
            <span className="text-sm text-[#38BDF8]">All Systems Operational</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
          >
            <span className="text-white">Executive </span>
            <span className="bg-gradient-to-r from-[#0189CB] to-[#38BDF8] bg-clip-text text-transparent">
              Intelligence
            </span>
            <span className="text-white"> Platform</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg text-[#8FA3BF] max-w-2xl mx-auto mb-8"
          >
            Real-time insights across MARS Company Business Units.
          </motion.p>

          {/* Data Sources */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <DataSourceBadge name="Salesforce" color="bg-[#38BDF8]" delay={0.5} />
            <DataSourceBadge name="Asana" color="bg-[#E16259]" delay={0.6} />
            <DataSourceBadge name="DocuSign" color="bg-[#FFD700]" delay={0.7} />
            <DataSourceBadge name="NetSuite" color="bg-[#F97316]" delay={0.8} />
          </motion.div>
        </div>

        {/* Departments Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.15em] text-center mb-6">
            Departments
          </h2>
        </motion.div>

        {/* Department Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {departments.map((dept, idx) => (
            <DepartmentCard key={dept.name} department={dept} delay={0.5 + idx * 0.1} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="relative z-10 border-t border-[#1E293B] py-6"
      >
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <p className="text-sm text-[#64748B]">
            MARS Company - Executive Intelligence Platform
          </p>
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-sm text-[#64748B] hover:text-white transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
