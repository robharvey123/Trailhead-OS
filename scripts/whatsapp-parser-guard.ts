/**
 * WhatsApp parser guard. Pure — no database, no network — so it is safe to run
 * anywhere. Inline fixtures for the wire-format edge cases plus the real QOLA
 * group export (whatsapp-logs/qola-uk-development.json), re-rendered as an iOS
 * export with the invisible characters the phone actually emits.
 *
 * Run: `npm run test:whatsapp-parser`. Exits non-zero on any failure.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseWhatsAppExport, parseCoworkJsonExport, type CoworkJsonExport } from '../lib/whatsapp/parse-export'
import { cleanDisplayName, normaliseParticipantName, stripInvisible } from '../lib/whatsapp/normalise'
import { localToUtcIso } from '../lib/whatsapp/time'
import { captureMessageId, importMessageId } from '../lib/whatsapp/ids'

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}
const LRM = '‎'
const NNBSP = ' '

// ── Normalisation ───────────────────────────────────────────────────────────
console.log('normalise')
ok('~ + narrow nbsp stripped', normaliseParticipantName(`~${NNBSP}Steve`) === 'steve')
ok('display keeps case, drops ~', cleanDisplayName(`~${NNBSP}Steve`) === 'Steve')
ok('isolates and LRM stripped', cleanDisplayName(`⁨@Rob Harvey⁩${LRM}`) === '@Rob Harvey')
ok('whitespace collapsed', normaliseParticipantName('  NOAH   WENG ') === 'noah weng')

// ── Timezone ────────────────────────────────────────────────────────────────
console.log('timezone')
ok('BST → UTC (Aug)', localToUtcIso('2026-08-26T08:16:23', 'Europe/London') === '2026-08-26T07:16:23.000Z')
ok('GMT → UTC (Jan)', localToUtcIso('2026-01-15T09:00:00', 'Europe/London') === '2026-01-15T09:00:00.000Z')
ok('Beijing → UTC', localToUtcIso('2026-08-14T18:45:06', 'Asia/Shanghai') === '2026-08-14T10:45:06.000Z')

// ── IDs ─────────────────────────────────────────────────────────────────────
console.log('ids')
const c = '11111111-1111-1111-1111-111111111111'
ok('import id deterministic', importMessageId(c, '2026-08-26T07:16:23.000Z', 'Rob Harvey', 'x') === importMessageId(c, '2026-08-26T07:16:23.000Z', 'rob harvey', 'x'))
ok('capture id ignores seconds', captureMessageId(c, '2026-08-26T07:16:23Z', '~ Steve', 'hi') === captureMessageId(c, '2026-08-26T07:16:59Z', 'Steve', 'hi'))
ok('capture id differs by minute', captureMessageId(c, '2026-08-26T07:16:23Z', 'Steve', 'hi') !== captureMessageId(c, '2026-08-26T07:17:00Z', 'Steve', 'hi'))
ok('capture id prefixed cw:', captureMessageId(c, '2026-08-26T07:16:23Z', 'Steve', 'hi').startsWith('cw:'))

// ── iOS with seconds, invisibles, group events, continuation, colons ────────
console.log('iOS group export')
const ios = [
  `${LRM}[29/07/2026, 18:55:14] QOLA UK development: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen, or share them.`,
  `${LRM}[29/07/2026, 18:55:14] Ciprian Boboi: ${LRM}Ciprian Boboi created group “QOLA UK development”`,
  `${LRM}[29/07/2026, 18:55:14] QOLA UK development: ${LRM}Ciprian Boboi added you`,
  `${LRM}[29/07/2026, 18:56:31] Ciprian Boboi: ${LRM}Ciprian Boboi changed this group's icon`,
  `${LRM}[30/07/2026, 02:04:45] ~${NNBSP}Steve: ${LRM}NOAH WENG added ~${NNBSP}Steve`,
  `${LRM}[31/07/2026, 03:22:46] ~${NNBSP}Samuel: ${LRM}NOAH WENG added ~${NNBSP}Samuel`,
  `${LRM}[02/08/2026, 04:35:45] Lee: ${LRM}NOAH WENG added Lee`,
  `[14/08/2026, 10:44:27] Rob Harvey: Hi all: back from holiday: call Tuesday?`,
  `[14/08/2026, 10:45:06] NOAH WENG: No problem`,
  `${LRM}[14/08/2026, 10:52:17] NOAH WENG: ${LRM}image omitted`,
  `[26/08/2026, 06:55:27] ~${NNBSP}Steve: ⁨@Rob Harvey⁩ Hi Rob, offer attached`,
  `${LRM}[26/08/2026, 06:55:31] ~${NNBSP}Steve: ${LRM}<attached: 00000021-PHOTO-2026-08-26-06-55-31.jpg>`,
  `[26/08/2026, 08:16:23] Rob Harvey: Hi Steve,`,
  `Had a proper look. Questions below:`,
  `- Where exactly does the banner sit?`,
  `- Above or below the fold?`,
  `[26/08/2026, 08:20:00] Rob Harvey: This message was deleted.`,
  `[26/08/2026, 08:21:00] Rob Harvey: ok`,
  `[26/08/2026, 08:21:00] Rob Harvey: ok`,
  `[26/08/2026, 09:00:00] Lee: Lee left`,
  `[26/08/2026, 09:05:00] NOAH WENG: Traffic numbers attached: 30k ${LRM}<This message was edited>`,
  `${LRM}[26/08/2026, 09:06:00] NOAH WENG: ${LRM}<attached: 00000030-PHOTO.jpg> <This message was edited>`,
].join('\r\n')
const r = parseWhatsAppExport(ios, 'MDY') // caller says MDY; file must override to DMY
ok('detected DMY from 29/07', r.detectedDateOrder === 'DMY')
ok('title from created line', r.title === 'QOLA UK development', r.title ?? 'null')
ok('is_group', r.isGroup)
ok('six participants incl. Samuel & Lee', r.participants.length === 6 && r.participants.includes('Samuel') && r.participants.includes('Lee'), r.participants.join(', '))
ok('group pseudo-sender is not a participant', !r.participants.some((p) => p.toLowerCase() === 'qola uk development'))
ok('"added you" sets selfReferenced', r.selfReferenced)
ok('participant events: created + 3 joins + 1 left', r.participantEvents.filter((e) => e.kind === 'created').length === 1 && r.participantEvents.filter((e) => e.kind === 'joined').length === 4 && r.participantEvents.filter((e) => e.kind === 'left').length === 1, JSON.stringify(r.participantEvents.map((e) => `${e.kind}:${e.subject}`)))
ok('icon change discarded, encryption notice discarded', !r.messages.some((m) => /changed this group|end-to-end/.test(m.body)))
const rob = r.messages.find((m) => m.body.startsWith('Hi all'))
ok('split on first ": " only', rob?.sender === 'Rob Harvey' && rob.body === 'Hi all: back from holiday: call Tuesday?', rob?.body)
const multi = r.messages.find((m) => m.body.startsWith('Hi Steve'))
ok('multi-line message is one row with newlines', multi !== undefined && multi.body.split('\n').length === 4 && multi.body.includes('- Above or below the fold?'))
ok('image omitted → media, row kept', r.messages.some((m) => m.type === 'media' && m.body === 'image omitted' && m.mediaFilename === null))
ok('<attached:> → media with filename', r.messages.some((m) => m.type === 'media' && m.mediaFilename === '00000021-PHOTO-2026-08-26-06-55-31.jpg'))
ok('deleted flagged, row kept', r.messages.some((m) => m.deleted && m.sender === 'Rob Harvey'))
ok('~ Steve sender cleaned to Steve', r.messages.filter((m) => m.sender === 'Steve').length === 2)
ok('mention isolates stripped from body', r.messages.some((m) => m.body.startsWith('@Rob Harvey Hi Rob')))
ok('two identical same-second messages both kept', r.messages.filter((m) => m.body === 'ok').length === 2)
ok('CRLF handled, no stray \\r', !r.messages.some((m) => m.body.includes('\r')))
ok('timestamps local, correct day', r.messages[0].occurredAtLocal === '2026-08-14T10:44:27', r.messages[0].occurredAtLocal)
ok('skippedLines is 0', r.skippedLines === 0, String(r.skippedLines))
const editedText = r.messages.find((m) => m.body.startsWith('Traffic numbers'))
ok('iOS edit marker stripped, edited flag set', editedText?.edited === true && editedText.body === 'Traffic numbers attached: 30k', editedText?.body)
ok('marker never survives in any body', !r.messages.some((m) => /this message was edited/i.test(m.body)))
const editedMedia = r.messages.find((m) => m.mediaFilename === '00000030-PHOTO.jpg')
ok('edited media caption still classifies as media', editedMedia?.type === 'media' && editedMedia.edited === true)
ok('unedited messages have edited=false', r.messages.filter((m) => m.edited).length === 2)

// ── Android without seconds, 12-hour, attachment, 1:1 ───────────────────────
console.log('Android 1:1 export')
const android = [
  `11/08/2026, 9:05 am - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.`,
  `11/08/2026, 9:05 am - Perry McCarthy: Morning Rob`,
  `11/08/2026, 2:32 pm - Rob Harvey: Afternoon`,
  `11/08/2026, 2:33 pm - Rob Harvey: IMG-20260811-WA0001.jpg (file attached)`,
  `11/08/2026, 2:34 pm - Perry McCarthy: <Media omitted>`,
  `11/08/2026, 12:10 am - Perry McCarthy: Late one`,
  `11/08/2026, 12:11 am - Perry McCarthy: Late one, corrected <This message was edited>`,
].join('\n')
const a = parseWhatsAppExport(android, 'DMY')
ok('ambiguous date → caller order used', a.detectedDateOrder === 'ambiguous' && a.messages[0].occurredAtLocal.startsWith('2026-08-11'))
ok('not a group', !a.isGroup && a.title === null)
ok('two participants', a.participants.length === 2, a.participants.join(', '))
ok('12h pm → 14:32', a.messages.some((m) => m.occurredAtLocal === '2026-08-11T14:32:00'))
ok('12:10 am → 00:10', a.messages.some((m) => m.occurredAtLocal === '2026-08-11T00:10:00'))
ok('(file attached) → media filename', a.messages.some((m) => m.type === 'media' && m.mediaFilename === 'IMG-20260811-WA0001.jpg'))
ok('<Media omitted> → media', a.messages.some((m) => m.type === 'media' && m.body === '<Media omitted>'))
ok('encryption notice dropped', !a.messages.some((m) => /encrypted/.test(m.body)))
ok('Android edit marker stripped', a.messages.some((m) => m.edited && m.body === 'Late one, corrected'))

// ── Mixed date order → throws ────────────────────────────────────────────────
console.log('date order')
let threw = false
try {
  parseWhatsAppExport(`[13/08/2026, 10:00:00] A: x\n[08/13/2026, 10:00:00] A: y`, 'DMY')
} catch {
  threw = true
}
ok('mixed DMY/MDY throws', threw)
const mdy = parseWhatsAppExport(`[08/13/2026, 10:00:00] A: x`, 'DMY')
ok('MDY detected from 08/13', mdy.detectedDateOrder === 'MDY' && mdy.messages[0].occurredAtLocal === '2026-08-13T10:00:00')

// ── Real fixture: QOLA export as interim JSON ────────────────────────────────
const fixturePath = join(process.cwd(), 'whatsapp-logs', 'qola-uk-development.json')
if (existsSync(fixturePath)) {
  console.log('fixture: whatsapp-logs/qola-uk-development.json')
  const json = JSON.parse(readFileSync(fixturePath, 'utf8')) as CoworkJsonExport
  const f = parseCoworkJsonExport(json)
  ok('title', f.title === 'QOLA UK development', f.title ?? 'null')
  ok('is_group', f.isGroup)
  ok('six participants', f.participants.length === 6, f.participants.join(', '))
  const expectedTextMedia = json.messages.filter((m) => m.type !== 'system').length
  ok('all text/media messages survive', f.messages.filter((m) => m.type !== 'system').length === expectedTextMedia, `${f.messages.length} vs ${expectedTextMedia}`)
  const long = json.messages.find((m) => m.sender === 'Rob Harvey' && m.body.startsWith('Hi Steve'))!
  const parsedLong = f.messages.find((m) => m.sender === 'Rob Harvey' && m.body.startsWith('Hi Steve'))
  // The fixture body still carries a U+2060 word-joiner the phone emitted; the parser strips it, so compare on the stripped form.
  ok("Rob's 26 Aug reply is one row, identical modulo invisibles", parsedLong !== undefined && parsedLong.body === stripInvisible(long.body), parsedLong ? `${parsedLong.body.length} vs ${stripInvisible(long.body).length} chars` : 'missing')
  ok('~750 words across many lines, bullets intact', (parsedLong?.body.split(/\s+/).length ?? 0) > 600 && (parsedLong?.body.split('\n').length ?? 0) > 20 && (parsedLong?.body.includes('\n- ') ?? false))
  ok('joins for Steve, Samuel, Lee', ['steve', 'samuel', 'lee'].every((n) => f.participantEvents.some((e) => e.kind === 'joined' && e.subject.toLowerCase() === n)))
  ok('two image placeholders kept', f.messages.filter((m) => m.type === 'media').length === 2)
  ok('every message has a sender', f.messages.every((m) => m.sender))
} else {
  console.log('fixture missing — skipped whatsapp-logs/qola-uk-development.json')
}

console.log(`\n${fail === 0 ? '✓ WHATSAPP PARSER GUARD PASSED' : `✗ ${fail} FAILURE(S)`}`)
process.exit(fail === 0 ? 0 : 1)
