import type { ReactNode } from "react";

export interface SettingItemProps {
	name: string;
	desc?: string;
	children?: ReactNode;
}

export function SettingItem({ name, desc, children }: SettingItemProps) {
	return (
		<div className="setting-item">
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				{desc && <div className="setting-item-description">{desc}</div>}
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
}

export function SettingHeading({ name, desc, children }: SettingItemProps) {
	return (
		<div className="setting-item setting-item-heading">
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				{desc && <div className="setting-item-description">{desc}</div>}
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
}

export function Toggle({
	value,
	onChange,
}: {
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<div
			className={"checkbox-container" + (value ? " is-enabled" : "")}
			onClick={() => onChange(!value)}
		>
			<input
				type="checkbox"
				checked={value}
				onChange={() => {}}
				tabIndex={-1}
				style={{ pointerEvents: "none" }}
			/>
		</div>
	);
}

export function ResetDefaultsItem({
	name,
	desc,
	buttonText,
	onReset,
}: {
	name: string;
	desc: string;
	buttonText: string;
	onReset: () => void;
}) {
	return (
		<SettingItem name={name} desc={desc}>
			<button className="mod-warning" onClick={onReset}>
				{buttonText}
			</button>
		</SettingItem>
	);
}
