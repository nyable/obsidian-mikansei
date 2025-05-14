<script lang="ts">
	import {
		base64ToString,
		type AesGcmDecryptResult,
	} from "src/utils/crypto-util";
	interface CryptoCodeBlockProps {
		source: string;
	}
	const props: CryptoCodeBlockProps = $props();
	let message = $derived.by(() => {
		try {
			const decodedStr = base64ToString(props.source);
			try {
				const data = JSON.parse(decodedStr);
				if (data) {
					const { iterations, iv, remark, salt, text, timestamp } =
						data as AesGcmDecryptResult;
					const isValidObj =
						iterations && iv && remark && salt && text && timestamp;
					if (isValidObj) {
						return remark;
					} else {
						return "解析信息失败：无效的加密对象";
					}
				}
				return "解析信息失败：加密对象不存在";
			} catch (error) {
				if (error instanceof Error) {
					return "解析信息失败：" + error.message;
				}
				return "解析加密对象时发生未知错误";
			}
		} catch (error) {
			console.error("Base64解码失败:", error);
			if (error instanceof DOMException) {
				// 通常是 atob() 抛出的错误
				return "解码失败：无效的Base64字符串";
			} else if (error instanceof Error) {
				return `解码失败： ${error.message}`;
			}
			return "Base64解码时发生未知错误";
		}
	});
</script>

<div class="crypto-code-block">
	{message}
</div>

<style lang="scss">
	.crypto-code-block {
		padding: 32px;
		border: 1px solid #ccc;
		border-radius: 12px;
	}
</style>
