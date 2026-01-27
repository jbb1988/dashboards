'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { departments, dataSources, getBadgeColor, type Department } from '@/lib/navigation';
import { getDepartmentIcon } from '@/lib/navigation-icons';

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

// Filter out Administration from home page display
const displayDepartments = departments.filter(dept => dept.name !== 'Administration');

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
            <span className="text-white">{getDepartmentIcon(department.icon)}</span>
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
        <div className="text-center mb-12 relative">
          {/* Background grid opacity reduction - soft radial mask */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#0F1722] opacity-25 blur-[60px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0189CB]/10 border border-[#0189CB]/20 rounded-full mb-6 relative z-10"
          >
            <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse" />
            <span className="text-sm text-[#38BDF8]">All Systems Operational</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, delay: 0.2 }}
            className="text-4xl md:text-5xl mb-3 relative z-10"
            style={{
              letterSpacing: '0.015em',
              lineHeight: '1.12'
            }}
          >
            <span className="text-white font-semibold">Executive </span>
            <span
              className="bg-gradient-to-r from-[#1A9FE0] to-[#4AC5F8] bg-clip-text text-transparent font-bold"
            >
              Intelligence
            </span>
            <span className="text-white font-semibold"> Platform</span>
          </motion.h1>

          {/* Accent underline */}
          <div className="flex justify-center mb-2 relative z-10">
            <div
              className="h-[1px] bg-[#1A9FE0] opacity-40"
              style={{ width: '45%' }}
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg text-[#8FA3BF] max-w-2xl mx-auto mb-12 relative z-10 font-light"
            style={{
              opacity: 0.72,
              lineHeight: '1.6'
            }}
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
            {dataSources.map((source, idx) => (
              <DataSourceBadge key={source.name} name={source.name} color={source.color} delay={0.5 + idx * 0.1} />
            ))}
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
          {displayDepartments.map((dept, idx) => (
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
