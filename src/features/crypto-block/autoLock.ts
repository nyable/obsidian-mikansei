export function autoLockDecision(minutes: number, lastActivity: number, now: number, busy: boolean, dirty: boolean): "wait" | "pause" | "lock" {
	if (!minutes || busy || now - lastActivity < minutes * 60_000) return "wait";
	return dirty ? "pause" : "lock";
}
