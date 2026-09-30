import {
	requestUrl,
	type RequestUrlParam,
	type RequestUrlResponse,
} from "obsidian";
import * as cheerio from "cheerio";

/**
 * 获取给定 URL 的网页标题，支持超时设置。
 * @param {string} url 要获取标题的 URL。
 * @param {number} [timeoutMs=5000] 超时时间（毫秒）。默认为 5000 毫秒。
 * @returns {Promise<string>} 网页标题，如果获取失败或超时则返回空字符串。
 */
export async function getUrlTitle(
	url: string,
	timeoutMs = 10
): Promise<string> {
	let timeoutHandle: NodeJS.Timeout | undefined;

	const requestOptions: RequestUrlParam = { url: url, method: "GET" };

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(
				new Error(`Request for ${url} timed out after ${timeoutMs}ms`)
			);
		}, timeoutMs);
	});

	try {
		// 使用 Promise.race 来竞争请求和超时
		// requestUrl 返回的是 RequestUrlResponse 类型，我们需要它的 .text 属性
		const response = (await Promise.race([
			requestUrl(requestOptions),
			timeoutPromise,
		])) as RequestUrlResponse; // 断言为 RequestUrlResponse 类型，因为如果超时，timeoutPromise 会 reject

		// 如果请求成功（没有超时），清除超时定时器
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}

		const html = response.text;
		if (!html) {
			console.warn(`No HTML content received from ${url}`);
			return "";
		}

		const $ = cheerio.load(html);
		const title = $("title")?.text()?.trim();
		return title || ""; // 如果 title 是 undefined 或空字符串，也返回 ''
	} catch (error: any) {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle); // 确保在任何错误情况下都清除定时器
		}
		// 检查错误是否由超时引起
		if (error.message.includes("timed out")) {
			console.warn(`Timeout fetching title for ${url}:`, error.message);
		} else {
			console.error(`Error fetching title for ${url}:`, error);
		}
		return ""; // Fallback
	}
}
