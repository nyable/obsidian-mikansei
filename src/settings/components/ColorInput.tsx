import { useState } from "react";
import type { CSSProperties } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import { useDebouncedDraft } from "./useDebouncedDraft";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

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
	const { draft, change: handleChange, flush: commit } = useDebouncedDraft(value,
		(next) => HEX_RE.test(next) ? next : null, onChange);

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
					onBlur={commit}
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
