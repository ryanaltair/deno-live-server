import * as file_server from "https://deno.land/std/http/file_server.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import * as fs from "https://deno.land/std/fs/mod.ts";
import { serve, Server, ServerRequest } from "https://deno.land/std/http/server.ts";
import {
    acceptWebSocket,
    isWebSocketCloseEvent,
    isWebSocketPingEvent,
    WebSocket,
} from "https://deno.land/std/ws/mod.ts";

const server: Server = serve({
    port: 8000,
});


console.log("http://localhost:8000/");
let staticDir = '.'
// const staticDir = '/Users/ryanaltair/Github/hegu/lunar/suanpan-visualization/web/viewer'
const jsFileTypes = ['js', 'mjs', 'map']
const imageFileTypes = ['png', 'jpg', 'jpeg']
const normalFileTypes = ['html', 'css', 'glb']
const staticFileType = [...normalFileTypes, ...jsFileTypes, ...imageFileTypes]
let injectHotReload = false

async function handleWs(sock: WebSocket) {
    console.log("socket connected!");
    try {
        for await (const ev of sock) {
            if (typeof ev === "string") {
                // text message
                console.log("ws:Text", ev);
                await sock.send(ev);
            } else if (ev instanceof Uint8Array) {
                // binary message
                console.log("ws:Binary", ev);
            } else if (isWebSocketPingEvent(ev)) {
                const [, body] = ev;
                // ping
                console.log("ws:Ping", body);
            } else if (isWebSocketCloseEvent(ev)) {
                // close
                const { code, reason } = ev;
                console.log("ws:Close", code, reason);
            }
        }
    } catch (err) {
        console.error(`failed to receive frame: ${err}`);
        if (!sock.isClosed) {
            await sock.close(1000).catch(console.error);
        }
    }
}

async function handleStatic(request: ServerRequest) {
    console.log(`post ${request.method} url ${request.url}`)
    const lastPath = request.url.split('/').pop() || '/'
    if (lastPath === '/') {
        request.respond(await file_server.serveFile(request, path.join(staticDir, 'index.html')))
    } else if (lastPath.lastIndexOf('.') === -1) { // no extent name
        request.respond(await file_server.serveFile(request, path.join(staticDir, `${request.url}.html`)))
    } else if (lastPath.lastIndexOf('.') === 0) {
        request.respond(await file_server.serveFile(request, path.join(staticDir, 'web/illegal.html')))
    } else {
        const extName = lastPath.split('.').pop() || '';
        console.log('extName', extName)
        if (staticFileType.includes(extName)) {
            let filePath = path.join(staticDir, request.url)
            if (await fs.exists(filePath)) {
                let response = await file_server.serveFile(request, filePath)
                request.respond(response);
            } else {
                request.respond({ status: 404 })
            }
        } else {
            request.respond(await file_server.serveFile(request, path.join(staticDir, 'web/illegal.html')))
        }
    }

}
for await (const request of server) {
    const { conn, r: bufReader, w: bufWriter, headers } = request;
    acceptWebSocket({
        conn,
        bufReader,
        bufWriter,
        headers,
    })
        .then(handleWs)
        .catch(async (err) => {
            console.error(`failed to accept websocket: ${err}`);
            // await request.respond({ status: 400 });
            handleStatic(request)
        });

}
