// Targeted suite: TTĐ market sessions (phien-cho) — session list/focus, registration lifecycle
// (add, approve with point, waitlist ordering, reject, withdraw), close list, transitions, attendance,
// replacement, session save, create/delete, denied paths. Added before batch 15.19; baseline recorded
// from the pre-migration runtime (see README).
module.exports = function sessions(r) {
  const { snap, login, ch, act, go, input, A, h } = r;
  const optionsOf = (id, html) => {
    const m = (html || h.modal()).match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
    return m ? Array.from(m[1].matchAll(/value="([^"]*)"/g)).map(x => x[1]).filter(Boolean) : [];
  };
  const regs = sid => (A.db.sessionRegistrations || []).filter(x => x.sessionId === sid);
  const S = 'PC-TTD-20260919';

  login('AC-NV01', 'TTD'); go('phien-cho');
  snap('phien-cho render', () => A.current);
  snap('session date filter', () => ch('session-date-filter', '2026-09-19'));
  snap('session focus', () => act('session-focus', { id: S }));
  ['pending', 'official', 'waitlist', 'inactive'].forEach(t => snap('registration tab ' + t, () => act('session-registration-tab', { tab: t })));
  act('session-registration-tab', { tab: 'pending' });

  const pending = regs(S).filter(x => x.status === 'registered').map(x => x.id);
  snap('reg approve open', () => act('reg-approve-open', { id: pending[0] }));
  const pt = optionsOf('reg-point')[0];
  snap('reg approve save', () => { input('#reg-point', pt || ''); input('#reg-note', 'Duyệt'); act('reg-approve-save', { id: pending[0] }); return regs(S).find(x => x.id === pending[0]); });
  snap('reg waitlist', () => act('reg-waitlist', { id: pending[1] }));
  snap('reg waitlist 2', () => act('reg-waitlist', { id: pending[2] }));
  snap('reg wait up', () => act('reg-wait-up', { id: pending[2] }));
  snap('reg wait down', () => act('reg-wait-down', { id: pending[2] }));
  const pending2 = regs(S).filter(x => x.status === 'registered').map(x => x.id);
  snap('reg reject open', () => pending2[0] && act('reg-reject-open', { id: pending2[0] }));
  snap('reg reject save', () => { input('#reg-note', 'Không đủ điều kiện'); return pending2[0] && act('reg-reject-save', { id: pending2[0] }); });
  snap('reg withdraw open', () => pending2[1] && act('reg-withdraw-open', { id: pending2[1] }));
  snap('reg withdraw save', () => { input('#reg-note', 'Rút'); return pending2[1] && act('reg-withdraw-save', { id: pending2[1] }); });
  snap('reg add open', () => act('reg-add-open', { id: S }));
  const tr = optionsOf('reg-trader')[0];
  snap('reg add save', () => { input('#reg-trader', tr || ''); input('#reg-kind', optionsOf('reg-kind')[0] || ''); input('#reg-at', '2026-09-15T08:00'); input('#reg-note', 'Thêm tại quầy'); input('#reg-section', optionsOf('reg-section')[0] || ''); act('reg-add-save', { id: S }); return regs(S).length; });
  snap('registrations after edits', () => regs(S).map(x => [x.id, x.status, x.pointId || null, x.waitlistOrder || null]));

  // Close registration list, then move the session forward.
  snap('close list confirm', () => act('session-close-list-confirm', { id: S }));
  snap('close list save', () => act('session-close-list-save', { id: S }));
  const ms = () => (A.db.marketSessions || []).find(x => x.id === S);
  // Operational steps (prepare, start, attendance, replacement, close) belong to the TTĐ collector.
  login('AC-NV07', 'TTD'); go('phien-cho'); act('session-focus', { id: S });
  snap('transition preparing', () => { act('session-transition', { id: S, to: 'preparing' }); return ms() && ms().status; });
  snap('attendance tab', () => act('session-attendance-tab', { tab: 'all' }));
  const official = regs(S).filter(x => ['approved', 'official', 'confirmed'].includes(x.status)).map(x => x.id);
  snap('attendance open', () => official[0] && act('attendance-open', { session: S, reg: official[0] }));
  snap('attendance save', () => { input('#att-status', 'absent'); input('#att-reason', 'Vắng'); input('#att-note', ''); return official[0] && act('attendance-save', { session: S, reg: official[0] }); });
  snap('replacement open', () => official[0] && act('replacement-open', { session: S, reg: official[0] }));
  const rep = optionsOf('rep-reg')[0];
  snap('replacement save', () => { input('#rep-reg', rep || ''); input('#rep-reason', 'Thay thế người vắng'); return official[0] && act('replacement-save', { session: S, absent: official[0] }); });
  const repl = (A.db.sessionReplacements || []).slice(-1)[0];
  snap('replacement cancel open', () => repl && act('replacement-cancel-open', { id: repl.id }));
  snap('replacement cancel save', () => { input('#rep-cancel-reason', 'Nhầm'); return repl && act('replacement-cancel-save', { id: repl.id }); });
  snap('transition live', () => { act('session-transition', { id: S, to: 'live' }); return ms() && ms().status; });
  snap('transition pending_close', () => { act('session-transition', { id: S, to: 'pending_close' }); return ms() && ms().status; });
  snap('session open (close form)', () => act('session-open', { id: S }));
  snap('session save', () => { input('#ses-visitors', '120'); input('#ses-rev', '3.5'); act('session-save', { id: S }); return ms(); });
  snap('session model after close', () => [ms(), (A.db.sessions || []).find(x => x.id === S)]);

  // Create and delete a session (market manager).
  login('AC-NV01', 'TTD'); go('phien-cho');
  snap('session create', () => act('session-create', {}));
  snap('session create save', () => { input('#ses-date', '2026-10-03'); input('#ses-start', '06:00'); input('#ses-end', '11:00'); input('#ses-reg-start', '2026-09-26T08:00'); input('#ses-deadline', '2026-10-01T17:00'); input('#ses-note', 'Phiên thử'); act('session-create-save', {}); return (A.db.marketSessions || []).map(x => x.id); });
  const created = (A.db.marketSessions || []).find(x => x.sessionDate === '2026-10-03');
  snap('session delete open', () => created && act('session-delete-open', { id: created.id }));
  snap('session delete save', () => created && act('session-delete-save', { id: created.id }));
  snap('session transition postpone (next)', () => act('session-transition', { id: 'PC-TTD-20260926', to: 'postponed' }));

  // Denied paths: collector cannot manage registrations/create; manager cannot run attendance; CL has no sessions screen.
  snap('denied attendance (manager)', () => { const x = regs(S)[0]; return x && act('attendance-open', { session: S, reg: x.id }); });
  login('AC-NV07', 'TTD'); go('phien-cho');
  snap('phien-cho collector view', () => A.current);
  snap('denied session create (collector)', () => act('session-create', {}));
  snap('denied reg approve (collector)', () => { const x = regs('PC-TTD-20260926')[0] || regs(S)[0]; return x && act('reg-approve-open', { id: x.id }); });
  login('AC-NV01', 'CL'); go('phien-cho');
  snap('phien-cho not available in CL', () => A.current);
};
