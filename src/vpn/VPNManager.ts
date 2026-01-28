import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import http from 'http';
import dns from 'dns';
import ip from 'ip';
import { SocksClient } from 'socks';
import { app } from 'electron';

const exec = promisify(require('child_process').exec);

function atob(str: string): string {
    return Buffer.from(str, 'base64').toString('binary');
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const STATUSES = {
    DISCONNECTED: 'disconnected',
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    DISCONNECTING: 'disconnecting',
} as const;

export type VPNStatus = (typeof STATUSES)[keyof typeof STATUSES];

interface V2RayConfig {
    config: string;
    port: number;
    uid: string;
    endpoint: string;
}

interface ProcessTree {
    isGatewayAdapterNameResolved: boolean;
    isConfigToDisk: boolean;
    isResolvedServerIp: boolean;
    isEstablishV2RAYTunnel: boolean;
    isv2rayConfigCleaned: boolean;
    isEstablishedInternalTunnel: boolean;
    isInternetConnectivityCheckPassed: boolean;
    isAdapterIpAssigned: boolean;
    isDnsAssigned: boolean;
    isGlobalTrafficRouteRuleAssigned: boolean;
    isGatewayAdapterIpResolved: boolean;
    isVpnTrafficRouteRuleAssigned: boolean;
}

const DNS_SERVERS = [
    { name: 'cloudflare', ipv4: ['1.1.1.1', '1.0.0.1'], ipv6: ['2606:4700:4700::1111', '2606:4700:4700::1001'] },
    { name: 'google', ipv4: ['8.8.8.8', '8.8.4.4'], ipv6: ['2001:4860:4860::8888', '2001:4860:4860::8844'] },
];

export class VPNManager {
    private adapterName = 'masyavpn';
    private currentDNS = DNS_SERVERS[0];

    private binaryDirPath: string;
    private configDirPath: string;
    private v2rayBinaryPath: string;
    private tun2socksBinPath: string;
    private v2rayconfpath: string;
    private logPath: string;

    private v2rayProcess: ChildProcess | null = null;
    private tun2socksProcess: ChildProcess | null = null;

    private gatewayIp: string | null = null;
    private gatewayAdapterName: string | null = null;
    private serverIp: string | null = null;

    private status: VPNStatus = STATUSES.DISCONNECTED;
    private processTree: ProcessTree;

    constructor() {
        // Set paths based on whether running in dev or production
        const resourcesPath = app.isPackaged
            ? path.join(process.resourcesPath, 'bin')
            : path.join(__dirname, '../../resources/bin');

        this.binaryDirPath = resourcesPath;
        this.configDirPath = path.join(app.getPath('userData'), 'vpn-config');
        this.logPath = path.join(app.getPath('userData'), 'vpn-debug.log');
        this.v2rayBinaryPath = path.join(this.binaryDirPath, 'xray.exe');
        this.tun2socksBinPath = path.join(this.binaryDirPath, 'tun2socks.exe');
        this.v2rayconfpath = path.join(this.configDirPath, 'v2ray_config.json');

        this.processTree = this.getCleanProcessTree();

        this.log('VPNManager initialized:');
        this.log(`  Binary dir: ${this.binaryDirPath}`);
        this.log(`  Config dir: ${this.configDirPath}`);
        this.log(`  Log file: ${this.logPath}`);
    }

    private log(message: string) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        console.log(message);
        try {
            fs.appendFileSync(this.logPath, logLine);
        } catch (e) {
            console.error('Failed to write to log file', e);
        }
    }

    private getCleanProcessTree(): ProcessTree {
        return {
            isGatewayAdapterNameResolved: false,
            isConfigToDisk: false,
            isResolvedServerIp: false,
            isEstablishV2RAYTunnel: false,
            isv2rayConfigCleaned: false,
            isEstablishedInternalTunnel: false,
            isInternetConnectivityCheckPassed: false,
            isAdapterIpAssigned: false,
            isDnsAssigned: false,
            isGlobalTrafficRouteRuleAssigned: false,
            isGatewayAdapterIpResolved: false,
            isVpnTrafficRouteRuleAssigned: false,
        };
    }

    getStatus(): VPNStatus {
        return this.status;
    }

    // Helper to get a free port
    async getFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const port = (server.address() as net.AddressInfo).port;
                server.close(() => {
                    resolve(port);
                });
            });
        });
    }

    decodeV2RAYConf(payload: string, uid: string, socksPort: number, httpPort: number): V2RayConfig {
        const bytes = Buffer.from(atob(payload), 'binary');

        if (bytes.length !== 7) {
            throw new Error('Invalid V2Ray payload length');
        }

        const address = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
        const port = (bytes[4] << 8) + bytes[5];

        const config = `{
      "dns": {
        "hosts": { "domain:googleapis.cn": "googleapis.com" },
        "servers": ["1.1.1.1", "1.0.0.1", "8.8.8.8"]
      },
      "inbounds": [
        {
          "listen": "127.0.0.1",
          "port": ${socksPort},
          "protocol": "socks",
          "settings": { "auth": "noauth", "udp": true, "userLevel": 8 },
          "sniffing": {
            "destOverride": ["http", "tls", "quic"],
            "metadataOnly": false,
            "routeOnly": false,
            "enabled": true
          },
          "tag": "socks"
        },
        {
          "listen": "127.0.0.1",
          "port": ${httpPort},
          "protocol": "http",
          "settings": { "userLevel": 8, "allowTransparent": false },
          "tag": "http"
        }
      ],
      "log": { "loglevel": "debug" },
      "outbounds": [
        {
          "mux": { "concurrency": 8, "enabled": true, "xudpConcurrency": 16, "xudpProxyUDP443": "reject" },
          "protocol": "vmess",
          "settings": {
            "vnext": [{
              "address": "${address}",
              "port": ${port},
              "users": [{
                "alterId": 0,
                "encryption": "",
                "flow": "",
                "id": "${uid}",
                "level": 8,
                "security": "auto"
              }]
            }]
          },
          "streamSettings": {
            "network": "grpc",
            "grpcSettings": { "serviceName": "", "multiMode": false },
            "sockopt": { "mark": 0, "tcpFastOpen": false, "tproxy": "off" }
          },
          "tag": "proxy"
        },
        {
          "protocol": "freedom",
          "settings": { "domainStrategy": "UseIPv4" },
          "tag": "direct"
        },
        {
          "protocol": "blackhole",
          "settings": { "response": { "type": "http" } },
          "tag": "block"
        }
      ],
      "routing": {
        "domainStrategy": "AsIs",
        "rules": [
          { "type": "field", "inboundTag": ["socks", "http"], "outboundTag": "proxy" },
          { "type": "field", "domain": ["geosite:private"], "outboundTag": "direct" },
          { "type": "field", "ip": ["geoip:private"], "outboundTag": "direct" }
        ]
      },
      "policy": {
        "levels": { "8": { "connIdle": 300, "downlinkOnly": 1, "handshake": 4, "uplinkOnly": 1 } },
        "system": { "statsOutboundUplink": true, "statsOutboundDownlink": true }
      }
    }`;

        return { config, port, uid, endpoint: address };
    }

    async getGatewayAdapterIp(): Promise<string> {
        try {
            const defaultGateway = await import('default-gateway');
            const { gateway4sync } = defaultGateway.default;
            const { gateway: gatewayIp } = gateway4sync();
            this.gatewayIp = gatewayIp;
            return gatewayIp;
        } catch (error) {
            console.log('default-gateway failed, trying fallback');
            const { stdout } = await exec('route print 0.0.0.0');
            const lines = stdout.split('\n');

            for (const line of lines) {
                if (line.includes('0.0.0.0')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const gatewayIp = parts[2];
                        if (net.isIPv4(gatewayIp)) {
                            this.gatewayIp = gatewayIp;
                            return gatewayIp;
                        }
                    }
                }
            }
            throw new Error('Could not find default gateway');
        }
    }

    async getGatewayInterfaceName(): Promise<string> {
        if (!this.gatewayIp) {
            await this.getGatewayAdapterIp();
        }

        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            if (!networkInterface) continue;

            for (const alias of networkInterface) {
                if (alias.family === 'IPv4' && !alias.internal) {
                    const subnet = ip.subnet(alias.address, alias.netmask);
                    if (subnet.contains(this.gatewayIp!)) {
                        this.gatewayAdapterName = interfaceName;
                        return interfaceName;
                    }
                }
            }
        }
        throw new Error(`No interface found for gateway ${this.gatewayIp}`);
    }

    async getIPv4FromDomain(endpoint: string): Promise<string> {
        let host = endpoint;
        if (endpoint.includes(':')) {
            host = endpoint.split(':')[0];
        }

        if (net.isIPv4(host)) {
            return host;
        }

        return new Promise((resolve, reject) => {
            dns.resolve4(host, (err, addresses) => {
                if (err) {
                    reject(new Error(`Failed to resolve ${host}: ${err.message}`));
                } else {
                    resolve(addresses[0]);
                }
            });
        });
    }

    async checkSocksInternetConnectivity(proxyIp: string, proxyPort: number): Promise<boolean> {
        const maxRetries = 3;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                this.log(`Checking connectivity via ${proxyIp}:${proxyPort} (attempt ${retries + 1}/${maxRetries})...`);
                const agent = await SocksClient.createConnection({
                    proxy: { host: proxyIp, port: proxyPort, type: 5 },
                    command: 'connect',
                    destination: { host: 'cp.cloudflare.com', port: 80 },
                    timeout: 2000,
                });

                await new Promise((resolve, reject) => {
                    const req = http.request(
                        {
                            hostname: 'cp.cloudflare.com',
                            port: 80,
                            path: '/',
                            method: 'GET',
                            timeout: 2000,
                            createConnection: () => agent.socket,
                        },
                        (res) => {
                            // Any response is good
                            res.resume();
                            resolve(true);
                        }
                    );

                    req.on('error', (e) => reject(e));
                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Request Timeout'));
                    });
                    req.end();
                });
                
                this.log('Connectivity check passed!');
                return true;
            } catch (error) {
                this.log(`Connectivity check failed (attempt ${retries + 1}/${maxRetries}): ${error instanceof Error ? error.message : String(error)}`);
                retries++;
                if (retries >= maxRetries) {
                     this.log('Max retries reached. Proceeding anyway (soft fail).');
                     return true;
                }
                await delay(1000);
            }
        }
        return true;
    }

    async assignStaticIp(): Promise<void> {
        const staticIPv4 = '192.168.123.1';
        const staticIPv6 = 'fd12:3456:789a:1::1/64';
        const staticIPv4Mask = '255.255.255.0';

        await exec(`netsh interface ipv4 set address name="${this.adapterName}" source=static addr=${staticIPv4} mask=${staticIPv4Mask}`);
        await exec(`netsh interface ipv6 set address interface="${this.adapterName}" address=${staticIPv6} store=persistent`);
    }

    async removeStaticIp(): Promise<void> {
        try {
            await exec(`netsh interface ipv4 set address name="${this.adapterName}" source=dhcp`);
            await exec(`netsh interface ipv6 set address name="${this.adapterName}" source=dhcp`);
        } catch (e) {
            // Ignore errors
        }
    }

    async assignDns(defaultInterface: string | null): Promise<void> {
        const dns = this.currentDNS;

        await exec(`netsh interface ipv4 set dnsservers name="${this.adapterName}" static address=${dns.ipv4[0]} register=none validate=no`);
        await exec(`netsh interface ipv4 add dnsservers name="${this.adapterName}" address=${dns.ipv4[1]} index=2 validate=no`);
        await exec(`netsh interface ipv6 set dnsservers name="${this.adapterName}" static address=${dns.ipv6[0]} register=none validate=no`);
        await exec(`netsh interface ipv6 add dnsservers name="${this.adapterName}" address=${dns.ipv6[1]} index=2 validate=no`);

        if (defaultInterface) {
            await exec(`netsh interface ipv4 set dnsservers name="${defaultInterface}" static address=${dns.ipv4[0]} register=none validate=no`);
            await exec(`netsh interface ipv4 add dnsservers name="${defaultInterface}" address=${dns.ipv4[1]} index=2 validate=no`);
        }

        await exec('ipconfig /flushdns');
    }

    async removeDns(defaultInterface: string | null): Promise<void> {
        try {
            if (defaultInterface) {
                await exec(`netsh interface ipv4 set dnsservers name="${defaultInterface}" source=dhcp`);
            }
            await exec(`netsh interface ipv4 set dnsservers name="${this.adapterName}" source=dhcp`);
            await exec('ipconfig /flushdns');
        } catch (e) {
            // Ignore errors
        }
    }

    async assignGlobalTrafficRouteRule(): Promise<void> {
        const staticIPv4 = '192.168.123.1';
        const staticIPv6 = 'fd12:3456:789a:1::1';

        await exec(`netsh interface ipv4 add route 0.0.0.0/0 "${this.adapterName}" ${staticIPv4} metric=1`);
        await exec(`netsh interface ipv6 add route ::/0 "${this.adapterName}" ${staticIPv6} metric=1`);
    }

    async removeGlobalTrafficRouteRule(): Promise<void> {
        try {
            const staticIPv4 = '192.168.123.1';
            const staticIPv6 = 'fd12:3456:789a:1::1';
            await exec(`netsh interface ipv4 delete route 0.0.0.0/0 "${this.adapterName}" ${staticIPv4}`);
            await exec(`netsh interface ipv6 delete route ::/0 "${this.adapterName}" ${staticIPv6}`);
        } catch (e) {
            // Ignore errors
        }
    }

    async vpnTrafficRouteRule(serverIp: string, gatewayIp: string): Promise<void> {
        await exec(`route add ${serverIp} mask 255.255.255.255 ${gatewayIp}`);
    }

    async removeVpnTrafficRouteRule(serverIp: string): Promise<void> {
        try {
            await exec(`route delete ${serverIp}`);
        } catch (e) {
            // Ignore errors
        }
    }

    async writeConfigToDisk(config: string): Promise<void> {
        if (!fs.existsSync(this.configDirPath)) {
            await fsPromises.mkdir(this.configDirPath, { recursive: true });
        }
        await fsPromises.writeFile(this.v2rayconfpath, config, { flag: 'w' });
    }

    async deleteConfigFromDisk(): Promise<void> {
        try {
            await fsPromises.access(this.v2rayconfpath);
            await fsPromises.rm(this.v2rayconfpath);
        } catch (e) {
            // Ignore errors
        }
    }

    async establishV2RAYTunnel(): Promise<boolean> {
        if (!fs.existsSync(this.v2rayBinaryPath)) {
            throw new Error(`xray binary not found: ${this.v2rayBinaryPath}`);
        }
        if (!fs.existsSync(this.v2rayconfpath)) {
            throw new Error(`xray config not found: ${this.v2rayconfpath}`);
        }

        const spawnOpts = { cwd: this.binaryDirPath, windowsHide: true };

        // Validate config first to surface clear errors
        await new Promise<void>((resolve, reject) => {
            this.log('Validating xray config...');
            const validator = spawn(this.v2rayBinaryPath, ['-test', '-config', this.v2rayconfpath], spawnOpts as any);
            let stderrBuf = '';
            let stdoutBuf = '';

            validator.stdout?.on('data', (d) => {
                const s = d.toString();
                stdoutBuf += s;
                this.log(`xray test stdout: ${s.trim()}`);
            });
            validator.stderr?.on('data', (d) => {
                const s = d.toString();
                stderrBuf += s;
                this.log(`xray test stderr: ${s.trim()}`);
            });
            validator.on('error', (err) => {
                reject(new Error(`Failed to run xray test: ${err.message}`));
            });
            validator.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`xray config validation failed (code ${code}): ${stderrBuf || stdoutBuf}`));
                }
            });
        });

        // Start xray
        return new Promise((resolve, reject) => {
            this.log(`Starting xray process: ${this.v2rayBinaryPath}`);
            const v2ray = spawn(this.v2rayBinaryPath, ['-config', this.v2rayconfpath], spawnOpts as any);
            this.v2rayProcess = v2ray;
            let stderrBuf = '';
            let stdoutBuf = '';

            const timeout = setTimeout(() => {
                reject(new Error('xray startup timeout'));
            }, 30000);

            v2ray.stdout?.on('data', (data) => {
                const output = data.toString().trim();
                stdoutBuf += output + '\n';
                if (output) this.log(`xray stdout: ${output}`);

                if (output.toLowerCase().includes('started')) {
                    clearTimeout(timeout);
                    resolve(true);
                }
            });

            v2ray.stderr?.on('data', (data) => {
                const output = data.toString().trim();
                stderrBuf += output + '\n';
                if (output) this.log(`xray stderr: ${output}`);
            });

            v2ray.on('error', (error) => {
                clearTimeout(timeout);
                this.log(`Failed to start xray: ${error.message}`);
                reject(new Error(`Failed to start xray: ${error.message}`));
            });

            v2ray.on('close', (code) => {
                clearTimeout(timeout);
                this.log(`xray exited with code ${code}`);
                if (code !== 0) {
                    reject(new Error(`xray exited with code ${code}: ${stderrBuf || stdoutBuf}`));
                }
            });
        });
    }

    async closeV2RAYTunnel(): Promise<void> {
        if (this.v2rayProcess) {
            this.v2rayProcess.kill();
            this.v2rayProcess = null;
        }
    }

    async startInternalTunnel(socksPort: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.log(`Starting tun2socks: ${this.tun2socksBinPath}`);

            const tun2socks = spawn(this.tun2socksBinPath, [
                '-tcp-auto-tuning',
                '-device', `tun://${this.adapterName}`,
                '-proxy', `socks5://127.0.0.1:${socksPort}`,
            ], { cwd: this.binaryDirPath, windowsHide: true });
            this.tun2socksProcess = tun2socks;

            tun2socks.stdout?.on('data', (data) => {
                const output = data.toString();
                this.log(`tun2socks: ${output.trim()}`);

                if (output.includes(`tun://${this.adapterName}`) && output.includes(`socks5://127.0.0.1:${socksPort}`)) {
                    resolve(true);
                }
            });

            tun2socks.stderr?.on('data', (data) => {
                this.log(`tun2socks stderr: ${data.toString().trim()}`);
            });

            tun2socks.on('error', (error) => {
                this.log(`Failed to start tun2socks: ${error.message}`);
                reject(new Error(`Failed to start tun2socks: ${error.message}`));
            });

            tun2socks.on('close', (code) => {
                this.log(`tun2socks exited with code ${code}`);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('tun2socks startup timeout'));
            }, 30000);
        });
    }

    async stopInternalTunnel(): Promise<void> {
        if (this.tun2socksProcess) {
            this.tun2socksProcess.kill();
            this.tun2socksProcess = null;
        }
    }

    async cleanupZombieProcesses(): Promise<void> {
        console.log('Cleaning up potential zombie processes...');
        try {
            // Force kill any existing xray.exe processes
            // /F = Forcefully terminate the process
            // /IM = Image Name
            await exec('taskkill /F /IM xray.exe');
            console.log('Killed zombie xray.exe processes');
        } catch (e: any) {
            // Ignore error if process not found (exit code 128)
            if (!e.message.includes('not found')) {
                console.log('No zombie xray.exe found or cleanup failed:', e.message);
            }
        }

        try {
            // Force kill any existing tun2socks.exe processes
            await exec('taskkill /F /IM tun2socks.exe');
            console.log('Killed zombie tun2socks.exe processes');
        } catch (e: any) {
             if (!e.message.includes('not found')) {
                console.log('No zombie tun2socks.exe found or cleanup failed:', e.message);
            }
        }
    }

    async connect(payload: string, uid: string): Promise<boolean> {
        if (this.status === STATUSES.CONNECTED || this.status === STATUSES.CONNECTING) {
            throw new Error('Already connected or connecting');
        }

        this.status = STATUSES.CONNECTING;
        this.processTree = this.getCleanProcessTree();

        try {
            // Cleanup any zombie processes before starting
            await this.cleanupZombieProcesses();

            // Get free ports for this session
            const socksPort = await this.getFreePort();
            const httpPort = await this.getFreePort();
            this.log(`Allocated ports - Socks: ${socksPort}, HTTP: ${httpPort}`);

            // Decode V2Ray config
            this.log('Decoding V2Ray config...');
            const { config, endpoint } = this.decodeV2RAYConf(payload, uid, socksPort, httpPort);

            // Get gateway interface name
            this.log('Getting gateway interface name...');
            const gatewayInterfaceName = await this.getGatewayInterfaceName();
            this.processTree.isGatewayAdapterNameResolved = true;

            // Write config to disk
            this.log('Writing config to disk...');
            await this.writeConfigToDisk(config);
            this.processTree.isConfigToDisk = true;

            // Resolve server IP
            this.log(`Resolving server IP for: ${endpoint}`);
            this.serverIp = await this.getIPv4FromDomain(endpoint);
            this.log(`Resolved server IP: ${this.serverIp}`);
            this.processTree.isResolvedServerIp = true;

            // Establish V2Ray tunnel
            this.log('Establishing V2Ray tunnel...');
            await this.establishV2RAYTunnel();
            this.processTree.isEstablishV2RAYTunnel = true;

            // Clean up config
            this.log('Cleaning up config...');
            await this.deleteConfigFromDisk();
            this.processTree.isv2rayConfigCleaned = true;

            // Check connectivity
            this.log(`Checking connectivity through socks proxy on port ${socksPort}...`);
            await this.checkSocksInternetConnectivity('127.0.0.1', socksPort);
            this.processTree.isInternetConnectivityCheckPassed = true;

            // Start internal tunnel
            this.log('Starting internal tunnel...');
            await this.startInternalTunnel(socksPort);
            this.processTree.isEstablishedInternalTunnel = true;

            // Assign static IP
            console.log('Assigning static IP...');
            await this.assignStaticIp();
            this.processTree.isAdapterIpAssigned = true;

            // Assign DNS
            console.log('Assigning DNS...');
            await this.assignDns(gatewayInterfaceName);
            this.processTree.isDnsAssigned = true;

            // Assign global route
            console.log('Assigning global route...');
            await this.assignGlobalTrafficRouteRule();
            this.processTree.isGlobalTrafficRouteRuleAssigned = true;

            // Get gateway IP
            console.log('Getting gateway IP...');
            await this.getGatewayAdapterIp();
            this.processTree.isGatewayAdapterIpResolved = true;

            // Assign VPN route
            console.log('Assigning VPN route...');
            await this.vpnTrafficRouteRule(this.serverIp, this.gatewayIp!);
            this.processTree.isVpnTrafficRouteRuleAssigned = true;

            console.log('VPN connection established!');
            this.status = STATUSES.CONNECTED;
            return true;

        } catch (error) {
            console.error('VPN connection failed:', error);
            await this.disconnect();
            throw error;
        }
    }

    async disconnect(): Promise<boolean> {
        this.status = STATUSES.DISCONNECTING;

        try {
            if (this.processTree.isGlobalTrafficRouteRuleAssigned) {
                console.log('Removing global route...');
                await this.removeGlobalTrafficRouteRule();
            }

            if (this.processTree.isVpnTrafficRouteRuleAssigned && this.serverIp) {
                console.log('Removing VPN route...');
                await this.removeVpnTrafficRouteRule(this.serverIp);
            }

            if (this.processTree.isDnsAssigned) {
                console.log('Removing DNS...');
                await this.removeDns(this.gatewayAdapterName);
            }

            if (this.processTree.isAdapterIpAssigned) {
                console.log('Removing static IP...');
                await this.removeStaticIp();
            }

            if (this.processTree.isEstablishedInternalTunnel) {
                console.log('Stopping internal tunnel...');
                await this.stopInternalTunnel();
            }

            if (this.processTree.isEstablishV2RAYTunnel) {
                console.log('Closing V2Ray tunnel...');
                await this.closeV2RAYTunnel();
            }

            if (this.processTree.isConfigToDisk) {
                console.log('Cleaning up config...');
                await this.deleteConfigFromDisk();
            }

        } finally {
            this.processTree = this.getCleanProcessTree();
            this.serverIp = null;
        }

        console.log('VPN disconnected');
        this.status = STATUSES.DISCONNECTED;
        return true;
    }
}

export const vpnManager = new VPNManager();
export default vpnManager;
