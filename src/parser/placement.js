/**
 * @fileoverview A block's `placement` — where it sits in a flow.
 */

import { PLACEMENTS } from "../schema/index.js";
import { warn } from "./warnings.js";

/**
 * A `placement` as written: one of PLACEMENTS, or null when there is none. Any
 * other value is left out, and the author is told where the block sits instead
 * — the text column, which is what a page does with a value it does not know.
 *
 * @param {*} value - the value written, `{placement=…}`
 * @param {string} block - what holds it, for the message ("image", "table")
 * @returns {string|null}
 */
export function readPlacement(value, block) {
    if (value === undefined || value === null || value === "") return null;
    if (PLACEMENTS.includes(value)) return value;
    const written = value === true ? "placement" : `placement=${value}`;
    warn(
        `\`{${written}}\` is not a placement — they are ${PLACEMENTS.join(", ")} — so the ${block} sits in the text column`,
    );
    return null;
}
