/**
 * Contract Section Parser
 * Breaks contracts into logical sections for parallel AI analysis
 */

export interface ContractSection {
  id: string;
  number: string;
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse a contract into sections based on common legal document patterns
 */
export function parseContractSections(text: string): ContractSection[] {
  const sections: ContractSection[] = [];

  // Patterns to detect section breaks (order matters - more specific first)
  const sectionPatterns = [
    // ARTICLE I, ARTICLE II, etc.
    /^(ARTICLE\s+[IVXLCDM]+\.?)\s*[-–—:]?\s*(.+?)$/gim,
    // Article 1, Article 2, etc.
    /^(Article\s+\d+\.?)\s*[-–—:]?\s*(.+?)$/gim,
    // SECTION 1, SECTION 2, etc.
    /^(SECTION\s+\d+\.?)\s*[-–—:]?\s*(.+?)$/gim,
    // Section 1.1, Section 2.3, etc.
    /^(Section\s+\d+(?:\.\d+)?\.?)\s*[-–—:]?\s*(.+?)$/gim,
    // 1. Title, 2. Title (numbered with period)
    /^(\d+\.)\s+([A-Z][A-Za-z\s]+?)(?:\.|$)/gm,
    // 1.1 Title, 2.3 Title (decimal numbered)
    /^(\d+\.\d+\.?)\s+([A-Z][A-Za-z\s]+?)(?:\.|$)/gm,
    // (a) Title, (b) Title - subsections
    /^(\([a-z]\))\s+([A-Z][A-Za-z\s]+?)(?:\.|$)/gm,
    // ALL CAPS HEADERS (at least 3 words, likely a section title)
    /^([A-Z][A-Z\s]{10,})$/gm,
  ];

  // Find all potential section headers
  interface SectionMatch {
    index: number;
    number: string;
    title: string;
    fullMatch: string;
  }

  const matches: SectionMatch[] = [];

  for (const pattern of sectionPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      // Avoid duplicates at same position
      const existingAtPos = matches.find(m => Math.abs(m.index - match!.index) < 5);
      if (!existingAtPos) {
        matches.push({
          index: match.index,
          number: match[1]?.trim() || '',
          title: match[2]?.trim() || match[1]?.trim() || '',
          fullMatch: match[0],
        });
      }
    }
  }

  // Sort by position in document
  matches.sort((a, b) => a.index - b.index);

  // If no sections found, treat entire document as one section
  if (matches.length === 0) {
    return [{
      id: 'full-document',
      number: '1',
      title: 'Full Document',
      content: text,
      startIndex: 0,
      endIndex: text.length,
    }];
  }

  // Filter out matches that are too close together (likely false positives)
  const filteredMatches: SectionMatch[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const prev = filteredMatches[filteredMatches.length - 1];

    // Keep if first match or at least 200 chars from previous
    if (!prev || current.index - prev.index > 200) {
      filteredMatches.push(current);
    }
  }

  // Build sections from matches
  for (let i = 0; i < filteredMatches.length; i++) {
    const current = filteredMatches[i];
    const next = filteredMatches[i + 1];

    const startIndex = current.index;
    const endIndex = next ? next.index : text.length;
    const content = text.substring(startIndex, endIndex).trim();

    // Skip very short sections (likely parsing errors)
    if (content.length < 50) continue;

    sections.push({
      id: `section-${i + 1}`,
      number: current.number || `${i + 1}`,
      title: current.title || `Section ${i + 1}`,
      content,
      startIndex,
      endIndex,
    });
  }

  // If we have content before the first section, add it as preamble
  if (filteredMatches.length > 0 && filteredMatches[0].index > 100) {
    const preambleContent = text.substring(0, filteredMatches[0].index).trim();
    if (preambleContent.length > 50) {
      sections.unshift({
        id: 'preamble',
        number: '0',
        title: 'Preamble / Recitals',
        content: preambleContent,
        startIndex: 0,
        endIndex: filteredMatches[0].index,
      });
    }
  }

  return sections;
}

/**
 * Estimate token count for a text (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Group small sections together to optimize API calls
 * Target: ~4000 tokens per group (leaving room for prompt + response)
 */
export function groupSectionsForAnalysis(
  sections: ContractSection[],
  maxTokensPerGroup: number = 4000
): ContractSection[][] {
  const groups: ContractSection[][] = [];
  let currentGroup: ContractSection[] = [];
  let currentTokens = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    // If single section exceeds max, it goes in its own group
    if (sectionTokens > maxTokensPerGroup) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        currentTokens = 0;
      }
      groups.push([section]);
      continue;
    }

    // If adding this section exceeds max, start new group
    if (currentTokens + sectionTokens > maxTokensPerGroup) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [section];
      currentTokens = sectionTokens;
    } else {
      currentGroup.push(section);
      currentTokens += sectionTokens;
    }
  }

  // Add remaining group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}
