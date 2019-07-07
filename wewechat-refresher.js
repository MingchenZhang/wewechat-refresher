#!/usr/bin/env node

const Log = require('loglevel');
const Express = require('express');
const BodyParser = require('body-parser')
const Request = require('request-promise-native');

const GetDelayPromise = (delay) => new Promise((resolve, reject) => setTimeout(resolve, delay));

if (process.env.DEBUG) Log.setLevel('debug');

let uinMap = new Map();
let uinLastUpdate = new Map();

let refresher = async function(uin, info) {
    let existed = uinMap.has(info.uin);
    uinMap.set(info.uin, info);
    uinLastUpdate.set(info.uin, Date.now());
    if (existed) return;
    Log.debug(`uin:${uin} refresher started`);
    try {
        while (true) {
            await GetDelayPromise(60 * 1000);
            // only proceed to send refresh sync call if user has gone offline for more than a minute
            if (Date.now() - uinLastUpdate.get(uin) < 60 * 1000) {
                Log.debug(`uin:${uin} refreshing skipped`);
                continue;
            }
            Log.debug(`uin:${uin} refreshing`);
            let info = uinMap.get(uin);
            let responseBody = await Request({
                method: 'GET',
                uri: info.baseURL + 'cgi-bin/mmwebwx-bin/synccheck',
                qs: {
                    r: Math.floor(Date.now() / 1000),
                    sid: info.sid,
                    uin: info.uin,
                    skey: info.skey,
                    synckey: info.synckey,
                },
                jar: info.jar,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8'
                },
            }).catch((err) => {
                Log.info(err);
                return null;
            });
            if (!responseBody) {
                Log.error(`An error occurred during refresh for uin:${uin}, terminate refreshing for this user. `);
                break;
            }
            let result = responseBody.match(/window\.synccheck=\{retcode:\"(\d+)\",selector:\"(\d+)\"\}/);
            if (!result) {
                Log.error(`Wrong format returned during refresh for uin:${uin}, terminate refreshing for this user. body is as follows: \n${responseBody}`);
                break;
            }
            if (result[1] !== "0") {
                Log.info(`An non-zero retcode(${result[1]}) received during refresh for uin:${uin}, terminate refreshing for this user. `);
                break;
            }
            Log.debug(`uin:${uin} refreshed with selector: ${result[2]}`);
        }
    } catch (e) {
        Log.error(e);
    } finally {
        Log.debug(`uin:${uin} refresher ended`);
        uinMap.delete(info.uin);
        uinLastUpdate.delete(info.uin);
    }
};

let app = Express();

app.use(BodyParser.json());

app.get('/ping', (req, res, next) => {
    res.send('pong');
});

/**
body format
baseURL, sid, uin, skey, synckey,
cookies: webwxuvid, mm_lang, webwx_auth_ticket, wxloadtime, wxpluginkey, wxuin, wxsid, webwx_data_ticket
*/
app.post('/register-new-credential', (req, res, next) => {
    try {
        let cookiesIn = req.body.cookies;
        let jar = Request.jar();
        cookiesIn.forEach((cookie) => jar.setCookie(Request.cookie(`${cookie.name}=${cookie.value}; Domain=${cookie.domain}`, '/'), req.body.baseURL));
        let info = {
            baseURL: req.body.baseURL,
            sid: req.body.sid,
            uin: req.body.uin,
            skey: req.body.skey,
            synckey: req.body.synckey,
            jar,
        }
        refresher(info.uin, info);
        res.send({
            result: true
        });
    } catch (e) {
        Log.info(e);
        res.status(400).send({
            result: false
        });
    }
});

if (process.env.USE_HTTPS) {
    if (!process.env.SERVER_NAME) {
        Log.error('SERVER_NAME need to be specified to use USE_HTTPS option');
        process.exit(1);
    }
    const Green = require("greenlock-express");
    let greenServer = Green.create({
        email: process.env.LE_EMAIL || "noreply@example.com", // The email address of the ACME user / hosting provider
        servername: process.env.SERVER_NAME,
        agreeTos: true, // You must accept the ToS as the host which handles the certs
        configDir: "~/.config/acme/", // Writable directory where certs will be saved
        communityMember: false, // Join the community to get notified of important updates
        telemetry: false, // Contribute telemetry data to the project
        app: app
    }).listen(80, 443);
} else {
    let port = parseInt(process.argv[2] | '8080');
    app.listen(port, () => Log.info(`wewechat refresher listening on port ${port}!`));
}
