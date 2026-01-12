'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Check for hash tokens (password reset tokens come in URL hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const hashError = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      // Check for errors
      if (hashError) {
        const message = errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          : 'The reset link is invalid or has expired.';
        setError(message + ' Please request a new password reset.');
        setCheckingSession(false);
        return;
      }

      // If we have tokens, set the session
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError('Failed to verify reset link. Please try again.');
          setCheckingSession(false);
          return;
        }

        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
      }

      setCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0F1722] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
          <span className="text-[#8FA3BF]">Verifying...</span>
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
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Password Updated</h2>
              <p className="text-[#8FA3BF] text-sm">
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword}>
              <h2 className="text-xl font-semibold mb-2 text-center">Set New Password</h2>
              <p className="text-[#8FA3BF] text-sm text-center mb-6">
                Enter your new password below
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0F1722] border border-[#2A3A50] rounded-lg text-white placeholder-[#5A6A7A] focus:outline-none focus:border-[#0189CB] transition-colors"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0F1722] border border-[#2A3A50] rounded-lg text-white placeholder-[#5A6A7A] focus:outline-none focus:border-[#0189CB] transition-colors"
                    placeholder="Confirm your password"
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
                {loading ? 'Updating...' : 'Update Password'}
              </motion.button>

              <a
                href="/login"
                className="block w-full mt-4 text-center text-[#8FA3BF] hover:text-white text-sm transition-colors"
              >
                Back to Sign In
              </a>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
