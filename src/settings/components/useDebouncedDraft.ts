import { useEffect, useRef, useState } from "react";

/** Input drafts never persist per keystroke. Invalid drafts are never committed. */
export function useDebouncedDraft(value: string, validate: (draft: string) => string | null, onCommit: (value: string) => void) {
	const [draft, setDraft] = useState(value);
	const draftRef = useRef(value);
	const committed = useRef(value);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const validation = useRef(validate);
	const commitHandler = useRef(onCommit);
	validation.current = validate;
	commitHandler.current = onCommit;

	function flush() {
		if (timer.current !== null) clearTimeout(timer.current);
		timer.current = null;
		const next = validation.current(draftRef.current);
		if (next !== null && next !== committed.current) {
			committed.current = next;
			commitHandler.current(next);
		}
	}

	useEffect(() => {
		// External reset wins over a pending draft.
		if (value !== committed.current) {
			if (timer.current !== null) clearTimeout(timer.current);
			timer.current = null;
			draftRef.current = value;
			committed.current = value;
			setDraft(value);
		}
	}, [value]);

	useEffect(() => () => {
		if (timer.current !== null) {
			clearTimeout(timer.current);
			const next = validation.current(draftRef.current);
			if (next !== null && next !== committed.current) commitHandler.current(next);
		}
	}, []);

	function change(next: string) {
		draftRef.current = next;
		setDraft(next);
		if (timer.current !== null) clearTimeout(timer.current);
		timer.current = setTimeout(flush, 250);
	}
	return { draft, change, flush, invalid: validate(draft) === null };
}
