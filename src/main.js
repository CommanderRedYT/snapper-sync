import { args, config } from "./config.js";
import Snapper from "./snapper.js";

const func = async () => {
    const snapper = new Snapper(config, args);
    await snapper.getPaths();
    const id = await snapper.doRsync();
    await snapper.sendSnapshot(id);
}

func();
