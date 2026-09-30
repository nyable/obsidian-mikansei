import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** 拖动取色时的提交防抖时间（毫秒）。 */
const COMMIT_DELAY = 250;

/** 把任意合法的 hex 归一化为 8 位 #rrggbbaa。 */
function normalizeHex(value: string): string {
	if (!HEX_RE.test(value)) return "#000000ff";
	let hex = value.slice(1).toLowerCase();
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (hex.length === 6) hex += "ff";
	return "#" + hex;
}

interface ColorInputProps {
	name: string;
	desc: string;
	value: string;
	onChange: (value: string) => void;
	ariaLabel: string;
}

export function ColorInput({
	name,
	desc,
	value,
	onChange,
	ariaLabel,
}: ColorInputProps) {
	const [open, setOpen] = useState(false);
	// 本地草稿：拖动期间只更新这里，避免每帧都写回设置/落盘
	const [draft, setDraft] = useState(value);

	const draftRef = useRef(draft);
	const committedRef = useRef(value);
	const onChangeRef = useRef(onChange);
	const timerRef = useRef<number | null>(null);

	draftRef.current = draft;
	onChangeRef.current = onChange;

	// 面板关闭时与外部值同步（例如「恢复默认」）
	useEffect(() => {
		if (!open) {
			setDraft(value);
			committedRef.current = value;
		}
	}, [value, open]);

	// 卸载时把未提交的草稿提交掉
	useEffect(() => {
		return () => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
				if (draftRef.current !== committedRef.current) {
					committedRef.current = draftRef.current;
					onChangeRef.current(draftRef.current);
				}
			}
		};
	}, []);

	/** 立即提交当前草稿（如有变化）。 */
	const commit = () => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (draftRef.current !== committedRef.current) {
			committedRef.current = draftRef.current;
			onChangeRef.current(draftRef.current);
		}
	};

	const handleChange = (next: string) => {
		setDraft(next);
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
		}
		timerRef.current = window.setTimeout(commit, COMMIT_DELAY);
	};

	const toggleOpen = () => {
		if (open) {
			// 关闭前提交，保证不丢最后一次修改
			commit();
		}
		setOpen(!open);
	};

	const color = normalizeHex(draft);

	return (
		<div
			className={
				"setting-item mikansei-color-item" + (open ? " is-open" : "")
			}
			onPointerUp={commit}
		>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				{desc && <div className="setting-item-description">{desc}</div>}
			</div>
			<div className="setting-item-control">
				<button
					type="button"
					className="mikansei-color-swatch"
					style={{ "--swatch-color": color } as CSSProperties}
					aria-label={ariaLabel}
					title={color}
					onClick={toggleOpen}
				/>
			</div>
			{open && (
				<div className="mikansei-color-panel">
					<HexAlphaColorPicker color={color} onChange={handleChange} />
					<HexColorInput
						className="mikansei-color-hex"
						color={color}
						alpha
						prefixed
						onChange={handleChange}
					/>
				</div>
			)}
		</div>
	);
}
