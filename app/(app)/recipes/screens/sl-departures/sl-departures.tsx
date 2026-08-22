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
import getSlData, { type SlDeparturesData, type Trip } from "./getData";

export const paramsSchema = z.object({
	originLat: z
		.number()
		.default(59.443)
		.describe("Origin latitude")
		.meta({ title: "Origin latitude" }),
	originLon: z
		.number()
		.default(18.071)
		.describe("Origin longitude")
		.meta({ title: "Origin longitude" }),
	originName: z
		.string()
		.default("Näsbyvägen 2, Täby")
		.describe("Origin label shown on screen")
		.meta({ title: "Origin name" }),
	numTrips: z
		.number()
		.default(4)
		.describe("Number of trips to display (1–6)")
		.meta({ title: "Number of trips" }),
});

export const dataSchema = z.object({
	trips: z
		.array(
			z.object({
				departureTime: z.string(),
				arrivalTime: z.string(),
				durationMin: z.number(),
				changes: z.number(),
				legs: z.array(
					z.object({
						mode: z.string(),
						line: z.string(),
						from: z.string(),
						to: z.string(),
					}),
				),
			}),
		)
		.default([]),
	origin: z.string().default(""),
	destination: z.string().default("T-Centralen"),
	updatedAt: z.string().default(""),
	error: z.string().optional(),
});

function modeBadge(mode: string, line: string) {
	const label = line ? `${mode.slice(0, 1)} ${line}` : mode.slice(0, 3);
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				padding: "1px 6px",
				border: "1.5px solid #000",
				borderRadius: 4,
				fontSize: 11,
				fontWeight: 700,
				marginRight: 3,
				whiteSpace: "nowrap",
			}}
		>
			{label}
		</span>
	);
}

function TripRow({ trip, index }: { trip: Trip; index: number }) {
	const isEven = index % 2 === 0;
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				padding: "8px 16px",
				backgroundColor: isEven ? "#fff" : "#f5f5f5",
				borderBottom: "1px solid #ddd",
				gap: 12,
			}}
		>
			{/* Departure time — big */}
			<div
				style={{
					fontSize: 28,
					fontWeight: 700,
					lineHeight: 1,
					minWidth: 52,
					color: "#000",
				}}
			>
				{trip.departureTime}
			</div>

			{/* Arrow + arrival */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					fontSize: 11,
					color: "#555",
					minWidth: 48,
				}}
			>
				<span>→ {trip.arrivalTime}</span>
				<span>{trip.durationMin}m</span>
			</div>

			{/* Line badges */}
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					flex: 1,
					gap: 3,
					alignItems: "center",
				}}
			>
				{trip.legs.map((leg, i) => (
					<span key={i} style={{ display: "flex", alignItems: "center" }}>
						{modeBadge(leg.mode, leg.line)}
						{i < trip.legs.length - 1 && (
							<span style={{ fontSize: 10, color: "#888", marginRight: 3 }}>
								→
							</span>
						)}
					</span>
				))}
			</div>

			{/* Changes */}
			{trip.changes > 0 && (
				<div
					style={{
						fontSize: 10,
						color: "#888",
						minWidth: 32,
						textAlign: "right",
					}}
				>
					{trip.changes} chg
				</div>
			)}
		</div>
	);
}

export default function SlDepartures({
	trips = [],
	origin = "",
	destination = "T-Centralen",
	updatedAt = "",
	error,
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
	screen,
}: SlDeparturesData & {
	width?: number;
	height?: number;
	screen?: ScreenProfile;
}) {
	const screenProfile = screen ?? createScreenProfile({ width, height });
	const w = screenProfile.logicalWidth;
	const h = screenProfile.logicalHeight;

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
						padding: "10px 16px",
						borderBottom: "2px solid #000",
					}}
				>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div
							style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em" }}
						>
							FROM
						</div>
						<div style={{ fontSize: 16, fontWeight: 700 }}>{origin}</div>
					</div>
					<div style={{ fontSize: 20, color: "#000" }}>→</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "flex-end",
						}}
					>
						<div
							style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em" }}
						>
							TO
						</div>
						<div style={{ fontSize: 16, fontWeight: 700 }}>{destination}</div>
					</div>
					<div style={{ fontSize: 12, color: "#888", marginLeft: 12 }}>
						{updatedAt}
					</div>
				</div>

				{/* Body */}
				{error ? (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 14,
							color: "#666",
						}}
					>
						{error}
					</div>
				) : trips.length === 0 ? (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 14,
							color: "#666",
						}}
					>
						No trips found
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
						{trips.map((trip, i) => (
							<TripRow key={i} trip={trip} index={i} />
						))}
					</div>
				)}
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "sl-departures",
		title: "SL Departures",
		description:
			"Next departures from your address to a destination via ResRobot v2.",
		published: true,
		tags: ["sl", "transit", "sweden", "live-data", "configurable"],
		category: "display-components",
		version: "0.1.0",
		createdAt: "2026-08-22T00:00:00Z",
		updatedAt: "2026-08-22T00:00:00Z",
		renderSettings: {
			supersample: true,
		},
	},
	paramsSchema,
	dataSchema,
	getData: async (params) => {
		const data = await getSlData(params);
		return data as z.infer<typeof dataSchema>;
	},
	Component: ({ width, height, screen, data }) => (
		<SlDepartures
			{...(data as SlDeparturesData)}
			width={width}
			height={height}
			screen={screen}
		/>
	),
};
