/**
 * MILITIA war room — Google Apps Script web app.
 *
 * The database behind GOOGLE_SHEETS_WEBAPP_URL. Every recruit is one row on the
 * Recruits tab; the Leaderboard tab sorts them by XP with a formula.
 *
 * Contract with src/lib/store.ts:
 *
 *   GET  ?version          -> { version }
 *   GET  ?handle=name      -> { recruit | null }
 *   GET  ?xid=123          -> { handle | null }
 *   GET  ?list=1           -> { recruits: [...] }
 *   GET                    -> { count }
 *
 *   POST {action:"put", recruit, display, expectRev}
 *        -> { rev }                                  saved
 *        -> { error:"conflict", recruit }            someone saved first; merge and retry
 *   POST {action:"referral", handle}
 *        -> { recruit }                              invites +1, done inside the lock
 *
 *   Any POST may carry `secret`, checked against SHARED_SECRET when that is set.
 *
 * Setup is in README.md next to this file.
 */

/** Bumped whenever this file changes, so `?version` shows which copy is deployed. */
var SCRIPT_VERSION = 1;

var SHEET_NAME = 'Recruits';
var BOARD_NAME = 'Leaderboard';

/**
 * Column order of the Recruits tab. Rows are written by header name, so these
 * can be reordered without breaking anything. "Data" holds the full record the
 * site reads back; the other columns are there for people.
 */
var HEADERS = [
  'Handle',
  'XP',
  'Rank',
  'Faction',
  'Soldier',
  'Wallet',
  'Invites',
  'Referred By',
  'Invite Counts',
  'Best Sweep',
  'Tasks Done',
  'Joined At',
  'Updated At',
  'X User ID',
  'Data',
];

/**
 * Optional shared secret. Leave empty to accept any caller (the URL itself is
 * unguessable). To turn it on, set a value here and the same value as
 * SHEETS_WEBHOOK_SECRET in the site's environment, then redeploy both.
 */
var SHARED_SECRET = '';

// --- entry points -----------------------------------------------------

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};

    if (p.version !== undefined) return json({ version: SCRIPT_VERSION });

    // Reads can expose wallets, so they are gated by the secret too when one is set.
    if (SHARED_SECRET && p.secret !== SHARED_SECRET) return json({ error: 'unauthorised' });

    if (p.handle) {
      var found = findRow(getSheet(), p.handle);
      return json({ recruit: found ? found.recruit : null });
    }

    if (p.xid) {
      var rows = readAll(getSheet());
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].recruit && String(rows[i].recruit.xid || '') === String(p.xid)) {
          return json({ handle: rows[i].recruit.handle });
        }
      }
      return json({ handle: null });
    }

    if (p.list !== undefined) {
      var all = readAll(getSheet()).map(function (r) { return r.recruit; }).filter(Boolean);
      return json({ recruits: all });
    }

    return json({ count: Math.max(0, getSheet().getLastRow() - 1) });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  // One writer at a time, so two saves can't read the same row and both write it.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ error: 'busy' });
  }

  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SHARED_SECRET && body.secret !== SHARED_SECRET) return json({ error: 'unauthorised' });

    if (body.action === 'put') return json(put(body.recruit, body.display || {}, body.expectRev));
    if (body.action === 'referral') return json(addReferral(String(body.handle || '')));

    return json({ error: 'unknown action' });
  } catch (err) {
    return json({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// --- writes -------------------------------------------------------------

/**
 * Saves a recruit. `expectRev` is the revision the site read; if the stored row
 * has moved on since, nothing is written and the stored copy is returned so the
 * site can merge both and try again.
 */
function put(recruit, display, expectRev) {
  if (!recruit || !recruit.handle) return { error: 'missing recruit' };
  var sheet = getSheet();
  var found = findRow(sheet, recruit.handle);
  var storedRev = found && found.recruit ? Number(found.recruit.rev || 0) : null;

  // A row whose Data cell is unreadable is simply overwritten.
  if (found && found.recruit && storedRev !== Number(expectRev || 0)) {
    return { error: 'conflict', recruit: found.recruit };
  }

  recruit.rev = (storedRev || 0) + 1;
  var row = buildRow(recruit, display);

  if (found) sheet.getRange(found.row, 1, 1, HEADERS.length).setValues([row]);
  else sheet.appendRow(row);

  return { rev: recruit.rev };
}

/**
 * Credits an invite. Done here, inside the lock, rather than as a read then a
 * put from the site: two friends signing up at the same moment must both count.
 * The XP and Rank columns refresh on the recruit's next save.
 */
function addReferral(handle) {
  var sheet = getSheet();
  var found = findRow(sheet, handle);
  if (!found || !found.recruit) return { error: 'not found' };

  var r = found.recruit;
  r.referrals = Number(r.referrals || 0) + 1;
  r.rev = Number(r.rev || 0) + 1;

  sheet.getRange(found.row, col('Invites')).setValue(r.referrals);
  sheet.getRange(found.row, col('Updated At')).setValue(new Date().toISOString());
  sheet.getRange(found.row, col('Data')).setValue(JSON.stringify(r));
  return { recruit: r };
}

function buildRow(r, d) {
  var row = [];
  row[col('Handle') - 1] = r.handle;
  row[col('XP') - 1] = Number(d.xp || 0);
  row[col('Rank') - 1] = d.rank || '';
  row[col('Faction') - 1] = d.faction || '';
  row[col('Soldier') - 1] = d.soldier || '';
  row[col('Wallet') - 1] = r.wallet || '';
  row[col('Invites') - 1] = Number(r.referrals || 0);
  row[col('Referred By') - 1] = r.referredBy || '';
  row[col('Invite Counts') - 1] = r.refQualified === false ? 'no' : 'yes';
  row[col('Best Sweep') - 1] = Number(r.drillBest || 0);
  row[col('Tasks Done') - 1] = Number(d.tasksDone || 0);
  row[col('Joined At') - 1] = new Date(Number(r.createdAt || Date.now())).toISOString();
  row[col('Updated At') - 1] = new Date().toISOString();
  row[col('X User ID') - 1] = r.xid || '';
  row[col('Data') - 1] = JSON.stringify(r);
  return row;
}

// --- reads --------------------------------------------------------------

/** Finds a recruit by handle, by scanning the Handle column each time, so a sorted or filtered sheet is still safe. */
function findRow(sheet, handle) {
  var rows = sheet.getLastRow() - 1;
  if (rows < 1) return null;
  var needle = String(handle).trim().toLowerCase();
  var handles = sheet.getRange(2, col('Handle'), rows, 1).getValues();
  for (var i = 0; i < handles.length; i++) {
    if (String(handles[i][0]).trim().toLowerCase() === needle) {
      var data = sheet.getRange(i + 2, col('Data')).getValue();
      return { row: i + 2, recruit: parse(data) };
    }
  }
  return null;
}

/** Every recruit, from the Data column in one read. */
function readAll(sheet) {
  var rows = sheet.getLastRow() - 1;
  if (rows < 1) return [];
  var values = sheet.getRange(2, col('Data'), rows, 1).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) out.push({ row: i + 2, recruit: parse(values[i][0]) });
  return out;
}

function parse(v) {
  try {
    var r = JSON.parse(String(v || ''));
    return r && r.handle ? r : null;
  } catch (err) {
    return null;
  }
}

// --- sheet setup ----------------------------------------------------------

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.hideColumns(col('Data'));
    ensureBoard(ss);
  }
  return sheet;
}

/** A read only tab that always shows recruits sorted by XP, for the team to browse. */
function ensureBoard(ss) {
  if (ss.getSheetByName(BOARD_NAME)) return;
  var board = ss.insertSheet(BOARD_NAME);
  var shown = HEADERS.length - 1; // everything except Data
  board.getRange(1, 1, 1, shown).setValues([HEADERS.slice(0, shown)]);
  board.getRange(1, 1, 1, shown).setFontWeight('bold');
  board.setFrozenRows(1);
  var last = String.fromCharCode(64 + shown);
  board.getRange('A2').setFormula(
    '=IFERROR(SORT(FILTER(' + SHEET_NAME + '!A2:' + last + ', ' + SHEET_NAME + '!A2:A<>""), ' + col('XP') + ', FALSE), "")'
  );
}

function col(name) {
  return HEADERS.indexOf(name) + 1;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --- manual test ------------------------------------------------------------

/**
 * Run from the Apps Script editor, then read the Execution log. It saves a test
 * recruit, proves a stale save is refused, credits an invite and reads it back.
 * Delete the "selftest" row afterwards.
 */
function selfTest() {
  var send = function (body) {
    body.secret = SHARED_SECRET;
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  };
  var get = function (params) {
    params.secret = SHARED_SECRET;
    return JSON.parse(doGet({ parameter: params }).getContent());
  };

  var r = { handle: 'selftest', soldierId: 1, referrals: 0, missions: {}, drillBest: 0, createdAt: Date.now() };
  var saved = send({ action: 'put', recruit: r, display: { xp: 100, rank: 'RECRUIT' }, expectRev: 0 });
  var stale = send({ action: 'put', recruit: r, display: { xp: 100, rank: 'RECRUIT' }, expectRev: 0 });
  var invited = send({ action: 'referral', handle: 'selftest' });
  var back = get({ handle: 'selftest' });

  Logger.log('save              : ' + JSON.stringify(saved));
  Logger.log('stale save        : ' + (stale.error || JSON.stringify(stale)));
  Logger.log('invite            : ' + JSON.stringify(invited.recruit && invited.recruit.referrals));
  Logger.log('read back invites : ' + (back.recruit && back.recruit.referrals));

  var ok = saved.rev === 1 && stale.error === 'conflict' && back.recruit && back.recruit.referrals === 1;
  Logger.log(ok ? 'PASS. Delete the "selftest" row before going live.' : 'FAIL. See the lines above.');
}
