import { readdir } from "fs/promises";

let startingPort = 4040;

class Version { 
    version: string;
    port: number;
    child: Bun.Subprocess;
}

const versionMap = new Map<string, Version[]>();
for (const loader of await readdir("./src")) {
    for (const version of await readdir(`./src/${loader}`)) {
        const child = await Bun.spawn([
            "packwiz", "serve",
            "-p", startingPort.toString(),
        ], {
            cwd: `./src/${loader}/${version}`,
            stdout: "inherit",
            stderr: "inherit"
        });

        const versions = versionMap.get(loader) || [];
        versions.push({ version, port: startingPort++, child });
        versionMap.set(loader, versions);

        console.log(`Started ${loader}${version} on port ${startingPort}`);
    }
}

Bun.serve({
    port: 8081,
    fetch: async (req) => {
        const url = new URL(req.url);
        const split = url.pathname.split("/");
        
        const loader = split[1];
        const version = split[2];
        const path = split.slice(3).join("/");

        const versionInfo = versionMap.get(loader)?.find(v => v.version === version);
        if (!versionInfo) return new Response("Not Found", { status: 404 });

        console.log("Proxying to", `http://127.0.0.1:${versionInfo.port}/${path}`);
        return await fetch(`http://127.0.0.1:${versionInfo.port}/${path}`);
    },
});