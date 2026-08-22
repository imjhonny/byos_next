import { z } from "zod";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { RecipeDefinition } from "@/lib/recipes/types";
import {
	createScreenProfile,
	type ScreenProfile,
} from "@/lib/trmnl/screen-profile";
import { PreSatori } from "@/utils/pre-satori";
import getHomelabData, { type HomelabStatsData } from "./getData";

export const paramsSchema = z.object({});
export const dataSchema = z.object({
	cpu: z.number().nullable().default(null),
	ram: z.number().nullable().default(null),
	disk: z.number().nullable().default(null),
	podsRunning: z.number().nullable().default(null),
	podsTotal: z.number().nullable().default(null),
	uptime: z.string().nullable().default(null),
	updatedAt: z.string().default(""),
});

function fmt(val: number | null): string {
	return val != null ? `${Math.round(val)}%` : "—";
}

function Bar({ pct }: { pct: number | null }) {
	const filled = pct != null ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				height: 10,
				backgroundColor: "#e0e0e0",
				borderRadius: 4,
				overflow: "hidden",
				marginTop: 6,
			}}
		>
			<div
				style={{
					width: `${filled}%`,
					height: "100%",
					backgroundColor: "#000",
					borderRadius: 4,
				}}
			/>
		</div>
	);
}

function StatTile({
	label,
	value,
	pct,
	border,
}: {
	label: string;
	value: string;
	pct?: number | null;
	border?: boolean;
}) {
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "16px 8px",
				borderRight: border ? "2px solid #000" : "none",
			}}
		>
			<div
				style={{
					fontSize: 13,
					fontWeight: 700,
					letterSpacing: "0.12em",
					color: "#000",
					marginBottom: 6,
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontSize: 48,
					fontWeight: 700,
					lineHeight: 1,
					color: "#000",
				}}
			>
				{value}
			</div>
			{pct != null && (
				<div style={{ width: "80%", marginTop: 4 }}>
					<Bar pct={pct} />
				</div>
			)}
		</div>
	);
}

export default function HomelabStats({
	cpu = null,
	ram = null,
	disk = null,
	podsRunning = null,
	podsTotal = null,
	uptime = null,
	updatedAt = "",
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
	screen,
}: HomelabStatsData & {
	width?: number;
	height?: number;
	screen?: ScreenProfile;
}) {
	const screenProfile = screen ?? createScreenProfile({ width, height });
	const w = screenProfile.logicalWidth;
	const h = screenProfile.logicalHeight;

	const podsLabel =
		podsRunning != null && podsTotal != null
			? `${Math.round(podsRunning)} / ${Math.round(podsTotal)}`
			: "—";

	return (
		<PreSatori width={w} height={h}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: w,
					height: h,
					backgroundColor: "#fff",
					color: "#000",
					fontFamily: "sans-serif",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "10px 24px",
						borderBottom: "2px solid #000",
					}}
				>
					<div
						style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.1em" }}
					>
						BURAINDO
					</div>
					<div style={{ fontSize: 14, color: "#444" }}>{updatedAt}</div>
				</div>

				{/* Top row — CPU · RAM · Disk */}
				<div
					style={{
						display: "flex",
						flex: 1,
						borderBottom: "2px solid #000",
					}}
				>
					<StatTile label="CPU" value={fmt(cpu)} pct={cpu} border />
					<StatTile label="RAM" value={fmt(ram)} pct={ram} border />
					<StatTile label="DISK" value={fmt(disk)} pct={disk} />
				</div>

				{/* Bottom row — Pods · Uptime */}
				<div
					style={{
						display: "flex",
						height: "38%",
					}}
				>
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							borderRight: "2px solid #000",
						}}
					>
						<div
							style={{
								fontSize: 13,
								fontWeight: 700,
								letterSpacing: "0.12em",
								marginBottom: 6,
							}}
						>
							PODS
						</div>
						<div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
							{podsLabel}
						</div>
						<div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
							running / total
						</div>
					</div>

					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								fontSize: 13,
								fontWeight: 700,
								letterSpacing: "0.12em",
								marginBottom: 6,
							}}
						>
							UPTIME
						</div>
						<div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
							{uptime ?? "—"}
						</div>
					</div>
				</div>
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "homelab-stats",
		title: "Homelab Stats",
		description: "Live CPU, RAM, disk, pod count and uptime from Prometheus.",
		published: true,
		tags: ["homelab", "prometheus", "live-data", "infrastructure"],
		category: "display-components",
		version: "0.1.0",
		createdAt: "2026-08-21T00:00:00Z",
		updatedAt: "2026-08-21T00:00:00Z",
		renderSettings: {
			supersample: true,
		},
	},
	paramsSchema,
	dataSchema,
	getData: async () => {
		const data = await getHomelabData();
		return data as z.infer<typeof dataSchema>;
	},
	Component: ({ width, height, screen, data }) => (
		<HomelabStats
			{...(data as HomelabStatsData)}
			width={width}
			height={height}
			screen={screen}
		/>
	),
};
