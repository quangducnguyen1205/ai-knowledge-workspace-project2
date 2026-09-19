import type { TranscriptRow } from './api';

export type TranscriptDisplayRow = {
  row: TranscriptRow;
  displayText: string;
  overlapHidden: boolean;
};

const MIN_SENTENCE_WORDS = 4;
const MIN_SENTENCE_CHARS = 24;

function createSentencePattern(): RegExp {
  return /[\s\S]*?[.!?](?:["')\]]*)?(?=\s+|$)/g;
}

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isMeaningfulSentenceBoundary(text: string): boolean {
  const normalized = normalizeSentence(text);

  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= MIN_SENTENCE_WORDS || normalized.length >= MIN_SENTENCE_CHARS;
}

function getSentenceMatches(text: string): RegExpMatchArray[] {
  return Array.from(text.trim().matchAll(createSentencePattern())).filter((match) => match[0].trim());
}

function getTrailingSentence(text: string): string | null {
  const matches = getSentenceMatches(text);
  return matches.length ? matches[matches.length - 1][0].trim() : null;
}

function getLeadingSentenceWithRemainder(text: string): { sentence: string; remainder: string } | null {
  const trimmed = text.trim();
  const matches = getSentenceMatches(trimmed);

  if (!matches.length) {
    return null;
  }

  const firstMatch = matches[0][0];
  const sentence = firstMatch.trim();
  const remainder = trimmed.slice(firstMatch.length).trimStart();

  if (!remainder) {
    return null;
  }

  return { sentence, remainder };
}

export function buildTranscriptDisplayRows(rows: TranscriptRow[]): TranscriptDisplayRow[] {
  let previousDisplayedText: string | null = null;

  return rows.map((row) => {
    const previousTrailingSentence = previousDisplayedText ? getTrailingSentence(previousDisplayedText) : null;
    const leadingSentence = getLeadingSentenceWithRemainder(row.text);

    let displayText = row.text;
    let overlapHidden = false;

    if (
      previousTrailingSentence &&
      leadingSentence &&
      isMeaningfulSentenceBoundary(previousTrailingSentence) &&
      isMeaningfulSentenceBoundary(leadingSentence.sentence) &&
      normalizeSentence(previousTrailingSentence) === normalizeSentence(leadingSentence.sentence)
    ) {
      displayText = `... ${leadingSentence.remainder}`;
      overlapHidden = true;
    }

    previousDisplayedText = displayText;

    return {
      row,
      displayText,
      overlapHidden,
    };
  });
}
