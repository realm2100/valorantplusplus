const chalk = require('chalk');
const {table, getBorderCharacters} = require('table');
const axios = require('axios/dist/node/axios.cjs');
const https = require('https');

const {colors} = require('./src/constants.js');
const {readFile} = require('./src/requests.js');

// stops the window from closing after execution
setInterval(() => {}, 100000);

process.on('uncaughtException', (err) => {
  console.log(chalk.hex(colors.red(err)));
});

const partyIcon = '■';

if (!chalk.supportsColor.hasBasic) {
  console.log('터미널이 색깔을 지원하지 않습니다! 정상 작동을 보장하기 어렵습니다.');
}

// 메인 로직
const vppVersion = 'Development Version';
let lockfile = {}, entitlements = {}, val = {}, content = {};
let basicAuthHeader;

process.title = `VALORANT++ ${vppVersion}`;

// 라이엇 클라이언트가 실행중인지 확인
function getLockfile() {
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
}

function getLogfile() {
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
}

function getEntitlements() {
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
}

function getPresence() {
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
}

function getContent() {
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
}

function getPartyData(partyId) {
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
}

function getUserData(puuid) {
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
}

function getUsername(body) {
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
}

let lockfileAttempts = 0;
let presenceAttempts = 0;
let valOpened = false;
function mainLoop() {
  if (!lockfile.port || !basicAuthHeader) {
    getLockfile().then(() => {
      process.stdout.write('\x1bc');
      console.log(chalk.hex(colors.brightGreen)('✔ Lockfile Data Retrieved\u001B[?25l'));
      setTimeout(mainLoop, 500);
    }).catch((eCode) => {
      if (eCode !== 'ENOENT') {
        console.log(chalk.hex(chalk.hex(colors.darkRed))(`FILESYSTEM ERROR: ${eCode}`));
      } else {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Waiting For ${chalk.hex(colors.brightRed)('Riot Client')} (${lockfileAttempts})\u001B[?25l`);
        lockfileAttempts++;
      }
      setTimeout(mainLoop, 2500);
    });
  } else if (!entitlements.accessToken || !entitlements.subject || !entitlements.token) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    getEntitlements().then(() => {
      console.log(chalk.hex(colors.brightGreen)('✔ Entitlements Retrieved'));
      return mainLoop();
    }).catch((e) => {
      if (e.code == 'ECONNREFUSED') {
        if (valOpened) {
          process.exit();
        } else {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`Waiting For ${chalk.hex(colors.brightRed)('Riot Client')} (${lockfileAttempts})`);
          setTimeout(mainLoop, 1000);
        }
      } else {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Waiting For ${chalk.hex(colors.brightRed)('Riot Client')} (${lockfileAttempts})`);
        setTimeout(mainLoop, 1000);
      }
    });
  } else {
    getPresence().then((presences) => {
      if (!presences || presences.length == 0) {
        if (!valOpened) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`Waiting For ${chalk.hex(colors.brightRed)('VALORANT')} (${presenceAttempts})`);
          presenceAttempts++;
        }
        setTimeout(mainLoop, 5000);
      } else {
        let selfPresence;
        for (let presence of presences) {
          if (presence.puuid == entitlements.subject) {
            if (!presence.championId && presence.product == 'valorant') {
              selfPresence = JSON.parse(Buffer.from(presence.private, 'base64').toString());
            }
          }
        }
        if (!selfPresence) {
          if (!valOpened) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Waiting For ${chalk.hex(colors.brightRed)('VALORANT')} (${presenceAttempts})`);
            presenceAttempts++;
          }
          setTimeout(mainLoop, 5000);
        } else {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          valOpened = true;
          presenceAttempts = 0;
          if (!val.shard || !val.region || !val.version) {
            getLogfile().then(() => {
              console.log(chalk.hex(colors.brightGreen)('✔ Logs Retrieved'));
              return mainLoop();
            });
          } else if (!content.seasons || !content.activeSeason) {
            getContent().then(() => {
              console.log(chalk.hex(colors.brightGreen)('✔ Content Retrieved'));
              console.log(`\nWelcome To ${chalk.hex(colors.vppBlue)('VALORANT')}${chalk.hex(colors.white)('++')} ${vppVersion}`);
              setTimeout(mainLoop, 5000);
            });
          } else if (selfPresence.isValid) {
            const gameState = selfPresence.sessionLoopState;
            if (gameState == 'MENUS') {
              mainMenu(selfPresence);
            }
          } else {
            setTimeout(mainLoop, 5000);
          }
        }
      }
    }).catch((e) => {
      if (e.code == 'ECONNREFUSED') {
        if (valOpened) {
          process.exit();
        } else {
          setTimeout(mainLoop, 5000);
        }
      } else if (e.code == 'ERR_BAD_RESPONSE') {
        setTimeout(mainLoop, 5000);
      } else {
        console.log(chalk.hex(colors.brightRed)(e.code));
      }
    });
  }
}

mainLoop();

// GAME STATES


let playersInParty = {};

function mainMenu(selfPresence) {
  getPartyData(selfPresence.partyId).then((partyData) => {
    for (let member of partyData.Members) {
      if (Object.keys(playersInParty).includes(member.Subject)) {
        continue;
      } else {
        playersInParty[member.Subject] = {
          puuid: member.Subject,
          name: '',
          level: member.PlayerIdentity.AccountLevel,
          rank: -1,
          peakRank: -1,
          peakRankAct: 'e0a0',
          isOwner: member.IsOwner
        };
      }
      if (!partyData.Members.map((m) => {
        return m.Subject;
      }).includes(member)) {
        delete playersInParty[member];
      }
    }
    const subjectsToFetchNames = [];
    const subjectsToGetRankData = [];
    for (let i in playersInParty) {
      const player = playersInParty[i];
      if (!player.name) {
        subjectsToFetchNames.push(player.puuid);
      }
      if (player.rank == -1 || player.peakRank == -1 || player.peakRankAct == 'e0a0') {
        subjectsToGetRankData.push(player.puuid);
      }
    }
    getUsername(subjectsToFetchNames).then((names) => {
      for (let player of names) {
        playersInParty[player.Subject].name = `${player.GameName}#${player.TagLine}`;
      }
      console.log(table([
        [
          'Name',
          'Rank',
          'Peak Rank',
          'Level'
        ],
        [
          playersInParty['64d68353-2de7-559d-9b5d-7d2db723144b'].name,
          playersInParty['64d68353-2de7-559d-9b5d-7d2db723144b'].rank,
          playersInParty['64d68353-2de7-559d-9b5d-7d2db723144b'].peakRank,
          playersInParty['64d68353-2de7-559d-9b5d-7d2db723144b'].level,
        ]
      ], {
        border: getBorderCharacters('norc')
      }));
    }).catch(() => {
      console.log(chalk.hex(colors.brightRed)('Failed to Get Player Names'));
    });
  }).catch(() => {
    console.log(chalk.hex(colors.brightRed)('Failed to Get Party Players'));
  });
}

/*
{
  sessionLoopState: 'MENUS',
  partyOwnerMatchMap: '',
  partyOwnerMatchCurrentTeam: '',
  partyOwnerMatchScoreAllyTeam: 0,
  partyOwnerMatchScoreEnemyTeam: 0,
  partyOwnerProvisioningFlow: 'Invalid',
  provisioningFlow: 'Invalid',
  matchMap: '',
  partyId: 'ed968135-34db-43f8-8590-116638327cff',
  isPartyOwner: true,
  partyState: 'DEFAULT',
  queueId: 'unrated',
  partyClientVersion: 'release-07.06-shipping-4-983570',
  partyVersion: 1695653896160,
  accountLevel: 149,
  competitiveTier: 13
}

Members: [
    {
      Subject: '64d68353-2de7-559d-9b5d-7d2db723144b',
      CompetitiveTier: 0,
      PlayerIdentity: {
        PlayerCardID: '6ca6c154-4ec2-3656-ce84-a79b5a29a34e',
        PlayerTitleID: 'f802662f-7a82-43d9-a626-335d65df08c5',
        AccountLevel: 149,
      },
      IsOwner: true,
    }
  ]
*/
