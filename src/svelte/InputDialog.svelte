<script>
	let { open, title = "对话框", onConfirm, onClose } = $props();

	let dialogRef = $state();

	$effect(() => {
		const dialog = dialogRef;
		if (dialog) {
			if (open && !dialog.open) {
				dialog.showModal();
				const inputElement = dialog.querySelector('input[type="text"]');
				if (inputElement) {
					inputElement.focus();
				}
			} else if (!open && dialog.open) {
				dialog.close();
			}
		}
	});

	function confirmAction() {
		if (onConfirm) {
			onConfirm();
		}
	}

	function cancelAction() {
		if (onClose) {
			onClose();
		}
	}

	function handleNativeDialogClose() {
		if (open) {
			if (onClose) {
				onClose();
			}
		}
	}
</script>

<dialog bind:this={dialogRef} onclose={handleNativeDialogClose}>
	<h3>{title}</h3>
	<!-- svelte-ignore slot_element_deprecated -->
	<div>
		<slot />
	</div>
	<menu>
		<button type="button" onclick={cancelAction}>取消</button>
		<button type="button" onclick={confirmAction}>确定</button>
	</menu>
</dialog>

<style>
	dialog {
		padding: 20px;
		min-width: 300px;
		outline: unset;
		border: 1px solid #ccc;
		border-radius: 12px;
	}
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}
	dialog[open] {
		display: flex;
		flex-direction: column;
	}
	h3 {
		margin-top: 0;
		margin-bottom: 15px;
	}
	div {
		width: 100%;
		margin: 20px 0;
	}
	div :global(> *) {
		width: 100%;
		box-sizing: border-box;
	}
	menu {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding-inline-start: 0;
		margin-top: 10px;
	}
	button {
		padding: 8px 15px;
		border: none;
		cursor: pointer;
	}
</style>
