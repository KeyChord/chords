import { runSudoCommand } from "chord";
import net from "node:net";
import os from "node:os";
//#region ../../node_modules/.pnpm/get-port@7.2.0/node_modules/get-port/index.js
var Locked = class extends Error {
	constructor(port) {
		super(`${port} is locked`);
	}
};
const lockedPorts = {
	old: /* @__PURE__ */ new Set(),
	young: /* @__PURE__ */ new Set()
};
const releaseOldLockedPortsIntervalMs = 1e3 * 15;
const reservedPorts = /* @__PURE__ */ new Set();
let timeout;
const getLocalHosts = () => {
	const interfaces = os.networkInterfaces();
	const results = new Set([void 0, "0.0.0.0"]);
	for (const _interface of Object.values(interfaces)) for (const config of _interface) results.add(config.address);
	return results;
};
const checkAvailablePort = (options) => new Promise((resolve, reject) => {
	const server = net.createServer();
	server.unref();
	server.on("error", reject);
	server.listen(options, () => {
		const { port } = server.address();
		server.close(() => {
			resolve(port);
		});
	});
});
const getAvailablePort = async (options, hosts) => {
	if (options.host || options.port === 0) return checkAvailablePort(options);
	for (const host of hosts) try {
		await checkAvailablePort({
			port: options.port,
			host
		});
	} catch (error) {
		if (!["EADDRNOTAVAIL", "EINVAL"].includes(error.code)) throw error;
	}
	return options.port;
};
const isLockedPort = (port) => lockedPorts.old.has(port) || lockedPorts.young.has(port) || reservedPorts.has(port);
const portCheckSequence = function* (ports) {
	if (ports) yield* ports;
	yield 0;
};
async function getPorts(options) {
	let ports;
	let exclude = /* @__PURE__ */ new Set();
	if (options) {
		if (options.port) ports = typeof options.port === "number" ? [options.port] : options.port;
		if (options.exclude) {
			const excludeIterable = options.exclude;
			if (typeof excludeIterable[Symbol.iterator] !== "function") throw new TypeError("The `exclude` option must be an iterable.");
			for (const element of excludeIterable) {
				if (typeof element !== "number") throw new TypeError("Each item in the `exclude` option must be a number corresponding to the port you want excluded.");
				if (!Number.isSafeInteger(element)) throw new TypeError(`Number ${element} in the exclude option is not a safe integer and can't be used`);
			}
			exclude = new Set(excludeIterable);
		}
	}
	const { reserve, ...netOptions } = options ?? {};
	if (timeout === void 0) {
		timeout = setTimeout(() => {
			timeout = void 0;
			lockedPorts.old = lockedPorts.young;
			lockedPorts.young = /* @__PURE__ */ new Set();
		}, releaseOldLockedPortsIntervalMs);
		if (timeout.unref) timeout.unref();
	}
	const hosts = getLocalHosts();
	for (const port of portCheckSequence(ports)) try {
		if (exclude.has(port)) continue;
		let availablePort = await getAvailablePort({
			...netOptions,
			port
		}, hosts);
		while (isLockedPort(availablePort)) {
			if (port !== 0) throw new Locked(port);
			availablePort = await getAvailablePort({
				...netOptions,
				port
			}, hosts);
		}
		if (reserve) reservedPorts.add(availablePort);
		else lockedPorts.young.add(availablePort);
		return availablePort;
	} catch (error) {
		if (!["EADDRINUSE", "EACCES"].includes(error.code) && !(error instanceof Locked)) throw error;
	}
	throw new Error("No available ports found");
}
//#endregion
//#region src/js/safari.ts
async function buildSafariHandler() {
	await getPorts();
	return async function safari() {
		const result = await runSudoCommand("safaridriver", ["--enable"]);
		console.log(result);
	};
}
//#endregion
export { buildSafariHandler as default };
