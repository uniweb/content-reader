function isValidUniwebMarkdown(text) {
    // Early return for empty or very short text
    if (!text || text.length < 8) return false;

    // More comprehensive and accurate patterns
    const patterns = [
        // Links and images
        /\!\[.*?\]\(.*?\)/, // Image syntax ![alt](src)
        /\[.*?\]\(.*?\)/, // Link syntax [text](href)

        // Headers
        /^#{1,6}\s+.+$/m, // Atx headers with proper spacing
        /^.+\n[=]{2,}$/m, // Setext header level 1
        /^.+\n[-]{2,}$/m, // Setext header level 2

        // Quotes and lists
        /^\s{0,3}>\s.+/m, // Blockquote with content
        /^\s{0,3}(\*|-|\+)\s+.+/m, // Unordered list items with content
        /^\s{0,3}\d+\.\s+.+/m, // Ordered list items with content

        // Code
        /^\s{0,3}`{3}[\s\S]*?`{3}/m, // Fenced code blocks
        /^\s{4}.+/m, // Indented code blocks
        /`[^`\n]+`/, // Inline code

        // Emphasis
        /(\*\*|__)[^\*\n_]+(\*\*|__)/, // Bold
        /(\*|_)[^\*\n_]+(\*|_)/, // Italic
        /(\*\*\*|___)[^\*\n_]+(\*\*\*|___)/, // Bold and italic

        // Other elements
        /^\s{0,3}([-*_]){3,}\s*$/m, // Horizontal rules
        /^\s{0,3}\|.+\|.+\|/m, // Tables
        /^\s{0,3}\|[-:| ]+\|/m, // Table formatting row
    ];

    // Check if the text contains any markdown patterns
    const hasMarkdown = patterns.some((pattern) => pattern.test(text));

    return hasMarkdown;
    // Add heuristics to reduce false positives
    // if (hasMarkdown) {
    //     // If it's just a very short text with asterisks or underscores, it might be regular emphasis
    //     if (text.length < 30 && /^[^*_`#\[\]\(\)\n\|\-]+$/.test(text)) {
    //         return false;
    //     }

    //     // Calculate a "markdown density" - if there are multiple patterns it's more likely to be markdown
    //     let matchCount = 0;
    //     patterns.forEach((pattern) => {
    //         const matches = text.match(pattern);
    //         if (matches) matchCount += matches.length;
    //     });

    //     // Higher threshold for very short texts to avoid false positives
    //     const minMatches = text.length < 48 ? 2 : 1;
    //     return matchCount >= minMatches;
    // }

    // return false;
}

export { isValidUniwebMarkdown };
