const fs = require('fs');
const axios = require('axios/dist/node/axios.cjs');
const https = require('https');

let lockfile = {}, entitlements = {}, val = {}, content = {};
let basicAuthHeader;

const readFile = (path) => {
  return new Promise((resolve, reject) => {
    try {
      const data = fs.readFileSync(path.replace('$LOCALAPPDATA', process.env.LOCALAPPDATA), {
        encoding: 'UTF-8'
      });
      resolve(data);
    } catch (e) {
      reject(e.code);
    }
  });
};

const getLockfile = () => {
  return new Promise((resolve, reject) => {
    readFile('$LOCALAPPDATA/Riot Games/Riot Client/Config/lockfile').then((res) => {
      const data = res.split(':');
      lockfile.name = data[0];
      lockfile.pid = data[1];
      lockfile.port = data[2];
      lockfile.password = data[3];
      lockfile.protocol = data[4];
      basicAuthHeader = Buffer.from(`riot:${lockfile.password}`).toString('base64');
      resolve();
    }).catch(reject);
  });
};

const getLogfile = () => {
  return new Promise((resolve, reject) => {
    readFile('$LOCALAPPDATA/VALORANT/Saved/Logs/ShooterGame.log').then((res) => {
      for (let line of res.split('\n')) {
        if (line.includes('CI server version:')) {
          const version_without_shipping = line.split('CI server version: ')[1].trim().split('-');
          version_without_shipping.splice(2, 0, 'shipping');
          val.version = version_without_shipping.join('-');
        }
        if (line.includes('.a.pvp.net/account-xp/v1/')) {
          val.shard = line.split('.a.pvp.net/account-xp/v1/')[0].split('.').pop();
        } else if (line.includes('https://glz')) {
          val.region = line.split('https://glz-')[1].split('.')[0].split('-')[0];
        }
      }
      resolve();
    }).catch(reject);
  });
};

const getEntitlements = () => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://127.0.0.1:${lockfile.port}/entitlements/v1/token`,
      headers: {
        Authorization: `Basic ${basicAuthHeader}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      entitlements.accessToken = res.data.accessToken;
      entitlements.subject = res.data.subject;
      entitlements.token = res.data.token;
      resolve();
    }).catch(reject);
  });
};

const getPresence = () => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://127.0.0.1:${lockfile.port}/chat/v4/presences`,
      headers: {
        Authorization: `Basic ${basicAuthHeader}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      resolve(res.data.presences);
    }).catch(reject);
  });
};

const getContent = () => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://shared.${val.shard}.a.pvp.net/content-service/v3/content`,
      headers: {
        'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9',
        'X-Riot-ClientVersion' : val.version
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      const seasons = {};
      let curSeason = 0;
      for (let season of res.data.Seasons) {
        if (season.Type == 'act') {
          seasons[season.ID] = `e${curSeason}${season.Name.replace('ACT ', 'a')}`;
          if (season.IsActive) {
            content.activeSeason = season.ID;
          }
        }
        if (season.Type == 'episode') {
          curSeason++;
        }
      }
      content.seasons = seasons;
      resolve();
    }).catch(reject);
  });
};

const getPartyData = (partyId) => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://glz-${val.region}-1.${val.shard}.a.pvp.net/parties/v1/parties/${partyId}`,
      headers: {
        'X-Riot-Entitlements-JWT': entitlements.token,
        'Authorization': `Bearer ${entitlements.accessToken}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      resolve(res.data);
    }).catch(reject);
  });
};

const getUserData = (puuid) => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://pd.${val.shard}.a.pvp.net/mmr/v1/players/${puuid}`,
      headers: {
        'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9',
        'X-Riot-ClientVersion': val.version,
        'X-Riot-Entitlements-JWT': entitlements.token,
        'Authorization': `Bearer ${entitlements.accessToken}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      resolve(res.data);
    }).catch(reject);
  });
};

const getUsername = (body) => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'put',
      url: `https://pd.${val.shard}.a.pvp.net/name-service/v2/players`,
      headers: {
        'X-Riot-Entitlements-JWT': entitlements.token,
        'Authorization': `Bearer ${entitlements.accessToken}`
      },
      data: body,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }).then((res) => {
      resolve(res.data);
    }).catch(reject);
  });
};

module.exports = {
  lockfile: lockfile,
  entitlements: entitlements,
  val: val,
  content: content,
  basicAuthHeader: basicAuthHeader,
  getLockfile: getLockfile,
  getContent: getContent,
  getEntitlements: getEntitlements,
  getLogfile: getLogfile,
  getPartyData: getPartyData,
  getPresence: getPresence,
  getUserData: getUserData,
  getUsername: getUsername,
};
