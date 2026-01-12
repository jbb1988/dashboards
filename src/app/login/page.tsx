'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Check for magic link invitation or existing session
  useEffect(() => {
    const checkSession = async () => {
      // Check if this is a magic link callback
      const isInvited = searchParams.get('invited') === 'true';

      // Check for hash tokens (magic link/invite tokens come in URL hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashError = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      // Check for errors in hash (expired link, etc.)
      if (hashError) {
        const message = errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          : 'The invitation link is invalid or has expired.';
        setError(message + ' Please request a new invitation from your administrator.');
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        setCheckingSession(false);
        return;
      }

      // If we have tokens in the hash, set the session manually
      if (accessToken && refreshToken) {
        setSuccess('Processing your invitation...');

        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Failed to process invitation. Please try again or contact support.');
          setCheckingSession(false);
          return;
        }

        if (data.session) {
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search);

          setSuccess('Welcome! Your account is ready. Redirecting...');
          // Use full page reload to ensure cookies are sent with next request
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
          return;
        }
      }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is already logged in
        if (isInvited) {
          setSuccess('Welcome! Your account is ready. Redirecting...');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          window.location.href = '/';
        }
        return;
      }

      // No session and no tokens - show login form
      setCheckingSession(false);
    };

    checkSession();
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.user) {
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetEmailSent(true);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0F1722] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
          <span className="text-[#8FA3BF]">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1722] text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center mb-4">
            <img
              src="/mars-logo-horizontal.png"
              alt="MARS"
              className="h-14 object-contain"
            />
          </div>
          <p className="text-[#8FA3BF]">Business Intelligence Platform</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1A2332] rounded-xl p-8 shadow-xl"
        >
          {showForgotPassword ? (
            // Forgot Password Form
            resetEmailSent ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
                <p className="text-[#8FA3BF] text-sm mb-6">
                  We sent a password reset link to<br />
                  <span className="text-white font-medium">{email}</span>
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmailSent(false);
                    setEmail('');
                  }}
                  className="text-[#38BDF8] hover:text-[#38BDF8]/80 text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <h2 className="text-xl font-semibold mb-2 text-center">Forgot Password</h2>
                <p className="text-[#8FA3BF] text-sm text-center mb-6">
                  Enter your email and we'll send you a reset link
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0F1722] border border-[#2A3A50] rounded-lg text-white placeholder-[#5A6A7A] focus:outline-none focus:border-[#0189CB] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-6 px-8 py-4 rounded-xl bg-gradient-to-r from-[#0189CB] to-[#38BDF8] text-white font-semibold text-lg shadow-lg shadow-[#0189CB]/25 hover:shadow-[#0189CB]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                  }}
                  className="w-full mt-4 text-[#8FA3BF] hover:text-white text-sm transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )
          ) : (
            // Login Form
            <form onSubmit={handleLogin}>
              <h2 className="text-xl font-semibold mb-6 text-center">Sign In</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {success}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0F1722] border border-[#2A3A50] rounded-lg text-white placeholder-[#5A6A7A] focus:outline-none focus:border-[#0189CB] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0F1722] border border-[#2A3A50] rounded-lg text-white placeholder-[#5A6A7A] focus:outline-none focus:border-[#0189CB] transition-colors"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-6 px-8 py-4 rounded-xl bg-gradient-to-r from-[#0189CB] to-[#38BDF8] text-white font-semibold text-lg shadow-lg shadow-[#0189CB]/25 hover:shadow-[#0189CB]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </motion.button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError('');
                }}
                className="w-full mt-4 text-[#8FA3BF] hover:text-[#38BDF8] text-sm transition-colors"
              >
                Forgot your password?
              </button>
            </form>
          )}
        </motion.div>

        <p className="mt-6 text-center text-[#5A6A7A] text-sm">
          Contact your administrator for access
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F1722] text-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
            <span className="text-[#8FA3BF]">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
