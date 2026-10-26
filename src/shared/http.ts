import { requestUrl } from "obsidian";
import * as cheerio from "cheerio";

/** Zero skips fetching; requestUrl cannot cancel an already-started request. */
export async function getUrlTitle(url: string, timeoutMs = 1000): Promise<string> {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return "";
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const response = await Promise.race([
			requestUrl({ url, method: "GET" }),
			new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
		]);
		if (!response?.text) return "";
		return cheerio.load(response.text)("title").text().trim();
	} catch (error: unknown) {
		console.warn("Mikansei: could not fetch page title", error);
		return "";
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
