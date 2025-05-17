export interface AesGcmEncryptResult {
	salt: string;
	iv: string;
	text: string;
	iterations: number;
	timestamp: number;
	remark: string;
}
export interface AesGcmDecryptResult {
	salt: string;
	iv: string;
	text: string;
	iterations: number;
	timestamp: number;
	remark: string;
}

/**
 *  将 ArrayBuffer 转换为 Base64
 * @param buffer ArrayBuffer
 * @returns Base64后的字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

/**
 *  将 Base64 转换为 ArrayBuffer
 * @param base64 Base64后的字符串
 * @returns ArrayBuffer
 */
function base64ToArrayBuffer(base64: string) {
	const binary_string = window.atob(base64);
	const bytes = new Uint8Array(binary_string.length);
	for (let i = 0; i < binary_string.length; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 *  将普通字符串 Base64 编码
 * @param str 普通字符串
 * @returns  Base64后的字符串
 */
export function stringToBase64(str: string) {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(str);
	return arrayBufferToBase64(dataBuffer);
}

/**
 *  将 Base64 编码的字符串解码回普通字符串
 * @param base64Str Base64后的字符串
 * @returns  普通字符串
 */
export function base64ToString(base64Str: string) {
	const dataBuffer = base64ToArrayBuffer(base64Str);
	const decoder = new TextDecoder();
	return decoder.decode(dataBuffer);
}

/**
 *  密钥派生 (PBKDF2)
 * @param passwordString 密码
 * @param saltUint8Array 盐
 * @param iterations 迭代次数
 * @returns
 */
async function deriveKeyPbkdf2(
	passwordString: string,
	saltUint8Array: Uint8Array,
	iterations: number
) {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(passwordString);

	const keyMaterial = await window.crypto.subtle.importKey(
		"raw",
		passwordBuffer,
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);

	const hashAlgorithm = "SHA-256";
	const keyAlgorithm = { name: "AES-GCM", length: 256 };

	return window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: saltUint8Array,
			iterations: iterations, // 使用传入的迭代次数
			hash: hashAlgorithm,
		},
		keyMaterial,
		keyAlgorithm,
		true,
		["encrypt", "decrypt"]
	);
}

/**
 *  AES-GCM 加密
 * @param text 待加密文本
 * @param password 加密密码
 * @returns 加密结果
 */
export async function encryptAesGcm(
	text: string,
	password: string,
	remark: string = ""
): Promise<AesGcmEncryptResult> {
	try {
		const salt = window.crypto.getRandomValues(new Uint8Array(16));
		const iv = window.crypto.getRandomValues(new Uint8Array(12));
		const iterationSize = 250000; // 当前加密使用的迭代次数

		const cryptoKey = await deriveKeyPbkdf2(password, salt, iterationSize);

		const encoder = new TextEncoder();
		const plaintextBuffer = encoder.encode(text);

		const ciphertextBuffer = await window.crypto.subtle.encrypt(
			{
				name: "AES-GCM",
				iv: iv,
				tagLength: 128,
			},
			cryptoKey,
			plaintextBuffer
		);
		const saltStr = arrayBufferToBase64(salt);
		const ivStr = arrayBufferToBase64(iv);
		// 打包结果
		const bundle: AesGcmEncryptResult = {
			salt: saltStr,
			iv: ivStr,
			text: arrayBufferToBase64(ciphertextBuffer),
			iterations: iterationSize,
			timestamp: Date.now(),
			remark: remark,
		};

		return bundle;
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function decryptAesGcm(
	bundleStr: string,
	password: string
): Promise<AesGcmDecryptResult> {
	try {
		const jsonBundle = base64ToString(bundleStr);

		const bundle: AesGcmEncryptResult = JSON.parse(jsonBundle);

		// 从包中提取数据
		const salt = base64ToArrayBuffer(bundle.salt);
		const iv = base64ToArrayBuffer(bundle.iv);
		const ciphertext = base64ToArrayBuffer(bundle.text);
		const iterations = bundle.iterations; // 使用包中存储的迭代次数

		if (!iterations || iterations < 1000) {
			// 基本的健全性检查
			Promise.reject("解密失败: 无效的迭代次数。");
		}

		const cryptoKey = await deriveKeyPbkdf2(
			password,
			new Uint8Array(salt),
			iterations
		);

		const decryptedBuffer = await window.crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: new Uint8Array(iv),
				tagLength: 128,
			},
			cryptoKey,
			ciphertext
		);

		const decoder = new TextDecoder();
		const result = decoder.decode(decryptedBuffer);

		return {
			text: result,
			iterations: iterations,
			timestamp: bundle.timestamp,
			remark: bundle.remark,
			iv: arrayBufferToBase64(iv),
			salt: arrayBufferToBase64(salt),
		};
	} catch (error) {
		// console.error(`解密失败: ${error.message}. (可能是密码错误、数据损坏或打包格式不正确)`);
		return Promise.reject(error);
	}
}
