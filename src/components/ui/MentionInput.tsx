'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';

interface User {
  email: string;
  role?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Add a comment... Use @ to mention',
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for users when mention text changes
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.users || []);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!mentionSearch) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchUsers(mentionSearch);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [mentionSearch, searchUsers]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    onChange(newValue);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStartIndex(lastAtIndex);
        setMentionSearch(textAfterAt);
        setShowSuggestions(true);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionSearch('');
    setMentionStartIndex(-1);
  };

  // Handle selecting a suggestion
  const selectSuggestion = (user: User) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const afterMention = value.slice(mentionStartIndex + 1 + mentionSearch.length);
    const newValue = `${beforeMention}@${user.email} ${afterMention}`;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionSearch('');
    setMentionStartIndex(-1);
    setSuggestions([]);

    // Focus textarea and place cursor after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = mentionStartIndex + user.email.length + 2; // @email + space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSubmit(value.trim());
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 resize-none disabled:opacity-50"
          rows={2}
        />
      </div>

      {/* User suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || isSearching) && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-[#151F2E] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
        >
          {isSearching ? (
            <div className="px-3 py-2 text-xs text-[#64748B]">Searching...</div>
          ) : (
            suggestions.map((user, idx) => (
              <button
                key={user.email}
                onClick={() => selectSuggestion(user)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[#38BDF8]/20 text-white'
                    : 'text-[#8FA3BF] hover:bg-white/5'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[#38BDF8]/20 flex items-center justify-center">
                  <span className="text-[10px] text-[#38BDF8] font-medium">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{user.email}</p>
                  {user.role && (
                    <p className="text-[10px] text-[#64748B]">{user.role}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-[#64748B]">
          Press Enter to send • Use @ to mention
        </span>
        <button
          onClick={() => {
            if (value.trim()) {
              onSubmit(value.trim());
            }
          }}
          disabled={!value.trim() || disabled}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#38BDF8] text-white text-xs font-medium rounded hover:bg-[#38BDF8]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-3 h-3" />
          Send
        </button>
      </div>
    </div>
  );
}

// Helper function to highlight mentions in text
export function highlightMentions(text: string): React.ReactNode {
  const mentionPattern = /@([\w.+-]+@[\w.-]+\.\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add highlighted mention
    parts.push(
      <span key={match.index} className="text-blue-400 font-medium">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
