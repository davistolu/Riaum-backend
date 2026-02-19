// Profanity filter utility for censoring inappropriate language

// List of common profane words (can be expanded)
const PROFANE_WORDS = [
  // English profanity
  'fuck', 'fucking', 'fucker', 'shit', 'shithead', 'bullshit', 'horseshit',
  'damn', 'dammit', 'ass', 'asshole', 'bastard', 'bitch', 'son of a bitch',
  'cunt', 'pussy', 'dick', 'dickhead', 'cock', 'cock sucker', 'motherfucker',
  'whore', 'slut', 'twat', 'wanker', 'prick', 'knob', 'bellend',
  // Common variations and misspellings
  'fck', 'fuk', 'f***', 'sh*t', 'a$$', 'a55', 'b1tch', 'b!tch',
  // Mild profanity
  'hell', 'crap', 'piss', 'pissed', 'piss off', 'screw', 'screw you',
  // Derogatory terms
  'idiot', 'moron', 'loser', 'jerk', 'stupid', 'dumbass', 'retard'
];

// Simple patterns for common variations
const PROFANITY_PATTERNS = [
  // Basic leet speak
  /f[uc]+k/gi,
  /sh[1i]+t/gi,
  /a[ss]+[ho0]+le/gi,
  /b[1i]+t[ch]+/gi,
  // Simple spaced variations
  /f\s*u\s*c\s*k/gi,
  /s\s*h\s*i\s*t/gi
];

/**
 * Censors profane words in text by replacing them with asterisks
 * @param text The text to censor
 * @returns The censored text
 */
export function censorProfanity(text: string): string {
  try {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let censoredText = text;

    // Simple word-by-word replacement first (most reliable)
    PROFANE_WORDS.forEach(word => {
      try {
        // Create a simple case-insensitive replacement
        const regex = new RegExp(word.replace(/\s+/g, '\\s*'), 'gi');
        censoredText = censoredText.replace(regex, (match) => {
          return '*'.repeat(match.length);
        });
      } catch (regexError) {
        console.error('Error processing word:', word, regexError);
        // Fallback: simple string replacement
        censoredText = censoredText.split(word).join('*'.repeat(word.length));
      }
    });

    // Apply simple patterns as backup
    try {
      PROFANITY_PATTERNS.forEach(pattern => {
        censoredText = censoredText.replace(pattern, (match) => {
          return '*'.repeat(match.length);
        });
      });
    } catch (patternError) {
      console.error('Error in patterns:', patternError);
    }

    return censoredText;
  } catch (error) {
    console.error('Error in censorProfanity:', error);
    return text; // Return original text if censoring fails
  }
}

/**
 * Checks if text contains profanity
 * @param text The text to check
 * @returns True if profanity is detected, false otherwise
 */
export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const censored = censorProfanity(text);
  return censored !== text;
}

/**
 * Moderates content by censoring profanity and flagging if necessary
 * @param content The content to moderate
 * @returns Object with censored content and moderation info
 */
export function moderateContent(content: string) {
  try {
    const originalContent = content;
    const censoredContent = censorProfanity(content);
    const hasProfanity = containsProfanity(content);

    return {
      originalContent,
      censoredContent,
      hasProfanity,
      wasCensored: hasProfanity,
      censorLevel: hasProfanity ? 'partial' : 'none'
    };
  } catch (error) {
    console.error('Error in moderateContent:', error);
    // Return safe defaults if moderation fails
    return {
      originalContent: content,
      censoredContent: content,
      hasProfanity: false,
      wasCensored: false,
      censorLevel: 'none'
    };
  }
}

/**
 * Creates a more aggressive censoring for stricter moderation
 * @param text The text to heavily censor
 * @returns Heavily censored text
 */
export function aggressiveCensor(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Replace any potential profanity patterns with full asterisks
  let censoredText = text;

  // More aggressive patterns
  const aggressivePatterns = [
    // Any word containing these character sequences
    /[fph][uoa][ckgt]/gi,
    /[sc][hi][t]/gi,
    /[a@][s$][s$]/gi,
    // Any combination that might be profanity
    /\b[a-z]*[fph][uoa][ckgt][a-z]*\b/gi,
    /\b[a-z]*[sc][hi][t][a-z]*\b/gi
  ];

  aggressivePatterns.forEach(pattern => {
    censoredText = censoredText.replace(pattern, '***');
  });

  return censoredText;
}

export default {
  censorProfanity,
  containsProfanity,
  moderateContent,
  aggressiveCensor
};
