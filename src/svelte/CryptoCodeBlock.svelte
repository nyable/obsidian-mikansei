<script lang="ts">
	import {
		base64ToString,
		decryptAesGcm,
		type AesGcmDecryptResult,
	} from "src/utils/crypto-util";
	import DialogDemo from "./InputDialog.svelte";
	interface CryptoCodeBlockProps {
		source: string;
	}
	let visible = $state(false);
	let inputValue = $state("");
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
	function formConfirm() {
		if (inputValue) {
			visible = false;
			decryptAesGcm(props.source, inputValue).then((result) => {
				const { text } = result;
				window.navigator.clipboard.writeText(text);
				inputValue = "";
			});
		}
	}
</script>

<div class="crypto-code-block">
	<div class="crypto-action">
		<button onclick={() => (visible = true)}>复制</button>
	</div>
	<div>{message}</div>
	<DialogDemo
		onClose={() => (visible = false)}
		open={visible}
		title="请输入解密密码"
		onConfirm={formConfirm}
	>
		<div>
			<input
				type="password"
				placeholder="请输入解密密码"
				required
				bind:value={inputValue}
			/>
		</div>
	</DialogDemo>
</div>

<style lang="scss">
	.crypto-code-block {
		display: flex;
		flex-direction: column;
		padding: 16px;
		border: 1px solid #ccc;
		border-radius: 12px;
		.crypto-action {
			display: flex;
			justify-content: flex-end;
			padding: 4px;
			button {
				margin-left: 8px;
			}
		}
	}
</style>
