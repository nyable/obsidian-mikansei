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
	label,
}: {
	value: boolean;
	onChange: (value: boolean) => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={value}
			aria-label={label}
			className={"checkbox-container" + (value ? " is-enabled" : "")}
			onClick={() => onChange(!value)}
		/>
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
