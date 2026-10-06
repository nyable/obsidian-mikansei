/** Pure fence parsing and optimistic replacement; never guess an ambiguous target. */
export interface FencedBlock {
	start: number;
	end: number;
	opening: string;
	closing: string;
	body: string;
	language: string;
	indent: string;
	marker: string;
}

export interface BlockSnapshot {
	document: string;
	block: FencedBlock;
}

export class BlockConflictError extends Error {}

export function parseFencedBlocks(document: string): FencedBlock[] {
	const lines = document.split("\n");
	const blocks: FencedBlock[] = [];
	let firstLine = 0;
	if (lines[0]?.replace(/^\uFEFF/, "").trim() === "---") {
		const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
		if (end === -1) return blocks;
		firstLine = end + 1;
	}
	for (let start = firstLine; start < lines.length; start++) {
		const opening = lines[start].replace(/\r$/, "");
		const match = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)[^\r]*$/.exec(opening);
		if (!match) continue;
		const [, indent, marker, language] = match;
		const closePattern = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
		let end = start + 1;
		while (end < lines.length && !closePattern.test(lines[end].replace(/\r$/, ""))) end++;
		if (end === lines.length) break;
		blocks.push({
			start, end, opening: lines[start], closing: lines[end],
			body: lines.slice(start + 1, end).join("\n"), language, indent, marker,
		});
		start = end;
	}
	return blocks;
}

export function captureBlock(document: string, start: number, language: string): BlockSnapshot {
	const block = parseFencedBlocks(document).find((item) => item.start === start && item.language === language);
	if (!block) throw new BlockConflictError();
	// Indented blocks need Markdown's indentation removal rules. Refuse rather than corrupt them.
	if (block.indent !== "") throw new BlockConflictError();
	return { document, block };
}

function rawBlock(document: string, block: FencedBlock): string {
	return document.split("\n").slice(block.start, block.end + 1).join("\n");
}

export function locateBlock(document: string, snapshot: BlockSnapshot): FencedBlock {
	const original = rawBlock(snapshot.document, snapshot.block);
	const candidates = parseFencedBlocks(document).filter((block) => rawBlock(document, block) === original);
	if (document === snapshot.document) {
		const exact = candidates.find((block) => block.start === snapshot.block.start);
		if (exact) return exact;
	} else {
		const originalCount = parseFencedBlocks(snapshot.document)
			.filter((block) => rawBlock(snapshot.document, block) === original).length;
		if (originalCount === 1 && candidates.length === 1) return candidates[0];
	}
	throw new BlockConflictError();
}

export function replacementLines(block: FencedBlock, body: string): string[] {
	const newline = block.opening.endsWith("\r") ? "\r\n" : "\n";
	// Grow the fence if the plaintext contains a closing fence of its own.
	const runs = body.match(new RegExp(`${block.marker[0]}{3,}`, "g")) ?? [];
	const length = runs.reduce((maximum, run) => Math.max(maximum, run.length + 1), block.marker.length);
	const marker = block.marker[0].repeat(length);
	const opening = block.opening.replace(block.marker, marker);
	const closing = block.closing.replace(new RegExp(`${block.marker[0]}{3,}`), marker);
	const normalized = body.replace(/\r\n/g, "\n");
	return [opening, ...normalized.split("\n").map((line) => line + (newline === "\r\n" ? "\r" : "")), closing];
}

export function replaceBlock(document: string, snapshot: BlockSnapshot, body: string): string {
	const block = locateBlock(document, snapshot);
	const lines = document.split("\n");
	lines.splice(block.start, block.end - block.start + 1, ...replacementLines(block, body));
	return lines.join("\n");
}
