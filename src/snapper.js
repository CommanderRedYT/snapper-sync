import {
    asyncExec,
    parseSnapperConfig,
    parseSnapperList,
    extractSnapshotIds
} from "./utils.js";
import os from 'os';
import { exec } from "child_process";

class Snapper {
    constructor(config, args) {
        this.config = config;
        this.args = args;
        this.source_path = '';
        this.target_path = '';
        this.source_snapshots = [];
        this.target_snapshots = [];
    }

    async createSnapshot() {
        // returns id of snapshot
        const { snapper_config } = this.config.source;
        const cmd = `snapper -c ${snapper_config} create --print-number`;
        const result = await asyncExec(cmd);
        console.log(`Created snapshot ${result.trim()}`);
        return result.trim();
    }

    async getPaths(source_section = 'source', target_section = 'target') {
        this.source_path = await this.getSubvolumePath(source_section);
        this.target_path = await this.getSubvolumePath(target_section);
    }

    async getSnapshotJSONs(source_section = 'source', target_section = 'target') {
        this.source_snapshots = await this.getSnapshots(source_section);
        this.target_snapshots = await this.getSnapshots(target_section);
    }

    async getSubvolumePath(section) {
        let cmd = '';
        const { ssh: sshConfig, snapper_config } = this.config[section];

        if (typeof sshConfig !== 'undefined') {
            cmd += `ssh ${sshConfig} `;
        }

        cmd += `snapper -c ${snapper_config} get-config`;

        const result = await asyncExec(cmd);
        return parseSnapperConfig(result).SUBVOLUME;
    }

    async getSnapshots(section) {
        let cmd = '';
        const { ssh: sshConfig, snapper_config } = this.config[section];

        if (typeof sshConfig !== 'undefined') {
            cmd += `ssh ${sshConfig} `;
        }

        cmd += `snapper -c ${snapper_config} list`;

        const result = await asyncExec(cmd);
        return parseSnapperList(result);
    }

    async doRsync() {
        const snapshot_id = await this.createSnapshot();
        const { ssh: sourceSshConfig } = this.config.source;
        const { ssh: targetSshConfig } = this.config.target;
        let cmd = `sudo rsync -av --inplace -e 'sudo -u ${os.userInfo().username} ssh' --rsync-path='sudo rsync' --exclude=snapshot `;

        if (typeof sourceSshConfig !== 'undefined') {
            cmd += `${sourceSshConfig}:`;
        }

        cmd += `${this.source_path}/.snapshots/${snapshot_id} `;

        if (typeof targetSshConfig !== 'undefined') {
            cmd += `${targetSshConfig}:`;
        }

        cmd += `${this.target_path}/.snapshots/`;

        try {
            const result = await asyncExec(cmd);
            console.log('success', result);
            return snapshot_id;
        } catch (e) {
            console.log('error', e);
        }
    }

    async sendSnapshot(id) {
        await this.getSnapshotJSONs();

        const { ssh: sourceSshConfig } = this.config.source;
        const { ssh: targetSshConfig } = this.config.target;

        const source_snapshot_ids = extractSnapshotIds(this.source_snapshots);
        const target_snapshot_ids = extractSnapshotIds(this.target_snapshots);

        let from_id = null;

        console.log(`Searching for ids below ${source_snapshot_ids[source_snapshot_ids.length - 1]} in 'target' ...`);

        target_snapshot_ids.sort((a, b) => b - a);

        for (const id of target_snapshot_ids) {
            if (id < source_snapshot_ids[source_snapshot_ids.length - 1]) {
                console.log(`Found id ${id} in 'target'`);
                from_id = id;
                break;
            }
        }

        if (from_id === null) {
            throw new Error('Could not find a suitable snapshot id in target');
        }

        let cmd = '';

        if (typeof sourceSshConfig !== 'undefined') {
            cmd += `ssh ${sourceSshConfig} `;
        }

        cmd += `sudo btrfs send ${this.source_path}/.snapshots/${id}/snapshot -p /${this.source_path}/.snapshots/${from_id}/snapshot | pv | `;

        if (typeof targetSshConfig !== 'undefined') {
            cmd += `ssh ${targetSshConfig} `;
        }

        cmd += `sudo btrfs receive /${this.target_path}/.snapshots/${id}/`;

        if (this.args.btrfs_dry) {
            console.log(`If you want to sync, execute '${cmd}'`);
            return;
        }

        console.log(`Executing '${cmd}'...`);

        try {
            // exec and stream to stdout
            const child = exec(cmd);
            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);
            child.on('exit', (code) => {
                console.log('exit', code);
            });
        } catch (e) {
            console.log('error', e);
        }
    }
}

export default Snapper;
