import { exec } from "child_process";

export async function asyncExec(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve(stdout);
            }
        });
    });
}

export function parseSnapperConfig(config) {
    const lines = config.split('\n').slice(2, -1);
    const result = {};

    for (const line of lines) {
        const [key, value] = line.split('|');
        result[key.trim()] = value.trim();
    }

    return result;
}

export function parseSnapperList(list) {
    const lines = list.split('\n').slice(2, -1);
    const result = [];

    for (const line of lines) {
        const [number, type, pre, date, user, cleanup, description] = line.split('|');
        result.push({
            number: number.trim(),
            type: type.trim(),
            pre: pre.trim(),
            date: date.trim(),
            user: user.trim(),
            cleanup: cleanup.trim(),
            description: description.trim()
        });
    }
    return result;
}

export function extractSnapshotIds(snapshots) {
    const result = [];
    for (const snapshot of snapshots) {
        if (snapshot.number !== '0' && snapshot.cleanup === '') {
            result.push(parseInt(snapshot.number));
        }
    }
    return result;
}
