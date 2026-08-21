// Live data — always fetch fresh.
export const dynamic = "force-dynamic";

const PROMETHEUS =
	"http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090";

async function promQuery(expr: string): Promise<number | null> {
	try {
		const res = await fetch(
			`${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(expr)}`,
			{ signal: AbortSignal.timeout(5000) },
		);
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { result?: { value?: [number, string] }[] };
		};
		const raw = json?.data?.result?.[0]?.value?.[1];
		return raw != null ? parseFloat(raw) : null;
	} catch {
		return null;
	}
}

function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	if (d > 0) return `${d}d ${h}h`;
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}h ${m}m`;
}

export interface HomelabStatsData {
	cpu: number | null;
	ram: number | null;
	disk: number | null;
	podsRunning: number | null;
	podsTotal: number | null;
	uptime: string | null;
	updatedAt: string;
}

export default async function getData(): Promise<HomelabStatsData> {
	const updatedAt = new Intl.DateTimeFormat("en-SE", {
		hour: "2-digit",
		minute: "2-digit",
		weekday: "short",
		hour12: false,
	}).format(new Date());

	const [cpu, ram, disk, podsRunning, podsTotal, uptimeSecs] =
		await Promise.all([
			promQuery(
				`100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`,
			),
			promQuery(
				`100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100)`,
			),
			promQuery(
				`100 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} * 100)`,
			),
			promQuery(`count(kube_pod_status_phase{phase="Running"})`),
			promQuery(`count(kube_pod_info)`),
			promQuery(`time() - node_boot_time_seconds`),
		]);

	return {
		cpu,
		ram,
		disk,
		podsRunning,
		podsTotal,
		uptime: uptimeSecs != null ? formatUptime(uptimeSecs) : null,
		updatedAt,
	};
}
