/**
 * @fileoverview What a parse noticed and could not honour.
 *
 * HTML an author writes in markdown is not content — components decide how
 * content renders — so it is kept as the text it is and shows as written. The
 * one exception is `<br>`, a line break a heading has no other way to spell.
 * Saying so is the caller's job, with the file in hand; this collects the
 * notices for the parse in progress. Parsing is synchronous, so one sink at a
 * time is enough, and a nested parse restores the outer one.
 */

let sink = null;

/**
 * Note something the parse could not honour.
 *
 * @param {string} message
 */
export function warn(message) {
    if (sink && !sink.includes(message)) sink.push(message);
}

/**
 * Run a parse and return what it noticed.
 *
 * @template T
 * @param {() => T} run
 * @returns {{ result: T, warnings: string[] }}
 */
export function collectWarnings(run) {
    const previous = sink;
    const warnings = [];
    sink = warnings;
    try {
        return { result: run(), warnings };
    } finally {
        sink = previous;
    }
}
