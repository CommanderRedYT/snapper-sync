import ini from 'ini';
import fs from 'fs';
import { ArgumentParser } from 'argparse';

const parser = new ArgumentParser({
    description: 'snapper sync client'
});

parser.add_argument('-c', '--config', {
    help: 'config file path',
    default: './config.ini'
});

parser.add_argument('--btrfs-dry', {
    help: 'do not run btrfs command',
    default: false,
    action: 'store_true'
});

export const args = parser.parse_args();
export const config = ini.parse(fs.readFileSync(args.config, 'utf-8'));

export default {
    config,
    args
};
