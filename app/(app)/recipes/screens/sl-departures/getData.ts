export const dynamic = "force-dynamic";

const BASE = "https://api.resrobot.se/v2.1";

// T-Centralen stop ID in ResRobot national stop database
const TCENTRALEN_ID = "740001617";

type ResRobotLeg = {
	name?: string;
	Origin?: { name?: string; time?: string; date?: string; rtTime?: string };
	Destination?: {
		name?: string;
		time?: string;
		date?: string;
		rtTime?: string;
	};
	Product?: { catOutL?: string; num?: string; name?: string }[];
	type?: string;
	hide?: boolean;
};

type ResRobotTrip = {
	dur?: string;
	chg?: number;
	LegList?: { Leg?: ResRobotLeg | ResRobotLeg[] };
};

export interface Leg {
	mode: string; // "Tunnelbana", "Buss", "Walk", etc.
	line: string; // "14", "612", etc.
	from: string;
	to: string;
}

export interface Trip {
	departureTime: string; // "14:32"
	arrivalTime: string; // "15:14"
	durationMin: number;
	changes: number;
	legs: Leg[];
}

export interface SlDeparturesData {
	trips: Trip[];
	origin: string;
	destination: string;
	updatedAt: string;
	error?: string;
}

function parseTime(time?: string): string {
	if (!time) return "—";
	return time.slice(0, 5); // "14:32:00" → "14:32"
}

function parseDuration(dur?: string): number {
	if (!dur) return 0;
	// Format can be "0:45:00" or "PT45M" or just minutes as string
	if (dur.startsWith("PT")) {
		const m = dur.match(/(\d+)H/);
		const s = dur.match(/(\d+)M/);
		return (m ? parseInt(m[1]) * 60 : 0) + (s ? parseInt(s[1]) : 0);
	}
	const parts = dur.split(":").map(Number);
	if (parts.length === 3) return parts[0] * 60 + parts[1];
	return parseInt(dur) || 0;
}

function legMode(leg: ResRobotLeg): { mode: string; line: string } {
	const product = Array.isArray(leg.Product) ? leg.Product[0] : leg.Product;
	const cat = product?.catOutL ?? leg.name ?? "";
	const line = product?.num ?? "";

	if (leg.type === "WALK" || cat.toLowerCase().includes("walk")) {
		return { mode: "Walk", line: "" };
	}
	return { mode: cat || "Transit", line };
}

function toLegs(raw: ResRobotLeg | ResRobotLeg[] | undefined): Leg[] {
	if (!raw) return [];
	const list = Array.isArray(raw) ? raw : [raw];
	return list
		.filter((l) => !l.hide)
		.map((l) => {
			const { mode, line } = legMode(l);
			return {
				mode,
				line,
				from: l.Origin?.name ?? "",
				to: l.Destination?.name ?? "",
			};
		});
}

export default async function getData(params?: {
	originLat?: number | string;
	originLon?: number | string;
	originName?: string;
	numTrips?: number | string;
}): Promise<SlDeparturesData> {
	const apiKey = process.env.RESROBOT_API_KEY;
	const originLat = Number(params?.originLat ?? 59.443);
	const originLon = Number(params?.originLon ?? 18.071);
	const originName = params?.originName ?? "Näsbyvägen 2, Täby";
	const numTrips = Math.min(6, Math.max(1, Number(params?.numTrips ?? 4)));

	const updatedAt = new Intl.DateTimeFormat("en-SE", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date());

	if (!apiKey) {
		return {
			trips: [],
			origin: originName,
			destination: "T-Centralen",
			updatedAt,
			error: "RESROBOT_API_KEY not set",
		};
	}

	const qs = new URLSearchParams({
		originCoordLat: String(originLat),
		originCoordLong: String(originLon),
		originCoordName: originName,
		destId: TCENTRALEN_ID,
		numF: String(numTrips),
		format: "json",
		accessId: apiKey,
	});

	try {
		const res = await fetch(`${BASE}/trip?${qs}`, {
			signal: AbortSignal.timeout(8000),
		});

		if (!res.ok) {
			return {
				trips: [],
				origin: originName,
				destination: "T-Centralen",
				updatedAt,
				error: `ResRobot error ${res.status}`,
			};
		}

		const json = (await res.json()) as { Trip?: ResRobotTrip[] };
		const rawTrips = json.Trip ?? [];

		const trips: Trip[] = rawTrips.map((t) => {
			const legs = toLegs(t.LegList?.Leg);
			const first = legs.find((l) => l.mode !== "Walk");
			const last = [...legs].reverse().find((l) => l.mode !== "Walk");

			// Get times from raw legs for accuracy
			const rawLegs = Array.isArray(t.LegList?.Leg)
				? t.LegList?.Leg ?? []
				: t.LegList?.Leg
					? [t.LegList.Leg]
					: [];
			const firstRaw = rawLegs.find((l) => !l.hide);
			const lastRaw = [...rawLegs].reverse().find((l) => !l.hide);

			const depRaw = firstRaw?.Origin?.rtTime ?? firstRaw?.Origin?.time;
			const arrRaw = lastRaw?.Destination?.rtTime ?? lastRaw?.Destination?.time;

			return {
				departureTime: parseTime(depRaw),
				arrivalTime: parseTime(arrRaw),
				durationMin: parseDuration(t.dur),
				changes: t.chg ?? Math.max(0, legs.filter((l) => l.mode !== "Walk").length - 1),
				legs: legs.filter((l) => l.mode !== "Walk"),
			};
		});

		return {
			trips,
			origin: originName,
			destination: "T-Centralen",
			updatedAt,
		};
	} catch (err) {
		return {
			trips: [],
			origin: originName,
			destination: "T-Centralen",
			updatedAt,
			error: err instanceof Error ? err.message : "Fetch failed",
		};
	}
}
