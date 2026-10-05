/* Thông báo đa kênh (route thong-bao): Lịch nghiệp vụ (template lịch kỳ thu — SERVICE_CFG.billingCycle), quy tắc thông báo
 * tự động (A.db.notificationEventConfigs), thông báo thủ công và lịch sử gửi (A.db.notifications).
 * Bộ phát (cuối file) tạo bản ghi A.db.notifications theo mốc kỳ thu của từng chợ và theo sự kiện nghiệp vụ; kênh gửi là
 * MÔ PHỎNG (chưa tích hợp Zalo OA/SMS thật). Quy tắc chưa có nguồn sự kiện được gắn nhãn "Chưa kích hoạt (prototype)". */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // ---------- Thông báo đa kênh ----------
  const CHANNELS = ['Web app quản lý', 'Web app tiểu thương', 'Zalo', 'SMS'];
  const CHANNEL_MIGRATION = { 'Mini app':'Web app quản lý', 'Zalo OA':'Zalo', 'Email':'SMS' };
  const t = (title, body) => ({ title, body });
  const clone = x => JSON.parse(JSON.stringify(x));
  function eventDefaults() { return [
    { eventKey: 'PERIOD_PREPARATION_STARTED', label: 'Bắt đầu chuẩn bị kỳ thu', trigger: 'Khi kỳ thu tới ngày bắt đầu chuẩn bị.', enabled: true, recipients: ['market_manager', 'fee_collector', 'trader'], channels: ['Mini app', 'Zalo OA'], templates: { market_manager: t('Sắp đến kỳ thu {period}', 'Kỳ thu {period} của {marketName} sẽ bắt đầu chuẩn bị từ ngày {preparationDate}.\nVui lòng theo dõi tiến độ ghi chỉ số và chuẩn bị các khoản phải thu.'), fee_collector: t('Chuẩn bị ghi chỉ số kỳ thu {period}', 'Kỳ thu {period} của {marketName} đã đến giai đoạn chuẩn bị.\nVui lòng ghi chỉ số điện, nước của các điểm kinh doanh được phân công trước ngày {meterReadDate}.'), trader: t('Sắp đến kỳ thu {period}', 'Kỳ thu {period} của {marketName} sắp bắt đầu.\nThời gian dự kiến thu từ {collectionStartDate} đến {dueDate}.\nVui lòng chuẩn bị thanh toán.') } },
    { eventKey: 'RECEIVABLE_ISSUED', label: 'Phát hành khoản phải thu', trigger: 'Khi Tổ trưởng phát hành khoản phải thu thành công.', enabled: true, recipients: ['trader', 'fee_collector'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Khoản phải thu kỳ {period} đã được phát hành', 'Khoản phải thu kỳ {period} tại {marketName} đã được phát hành.\nTổng tiền: {totalAmount}.\nHạn thanh toán: {dueDate}.\nVui lòng xem chi tiết và thực hiện thanh toán.'), fee_collector: t('Đã phát hành khoản phải thu kỳ {period}', 'Chợ {marketName} đã phát hành {receivableCount} khoản phải thu.\nTổng cần thu: {totalAmount}.\nHạn thanh toán: {dueDate}.\nVui lòng theo dõi danh sách thu.') } },
    { eventKey: 'COLLECTION_STARTED', label: 'Bắt đầu thời gian thu', trigger: 'Khi kỳ thu chuyển từ Đang chuẩn bị sang Đang thu.', enabled: true, recipients: ['fee_collector', 'market_manager'], channels: ['Mini app'], templates: { fee_collector: t('Kỳ thu {period} đã bắt đầu', 'Kỳ thu {period} đã bắt đầu.\nVui lòng theo dõi danh sách tiểu thương chưa thanh toán và thực hiện thu theo phân công.'), market_manager: t('Kỳ thu {period} đã bắt đầu', 'Kỳ thu {period} đã bắt đầu.\nBạn có thể theo dõi tiến độ thu của {marketName}.') } },
    { eventKey: 'PAYMENT_DUE_SOON', label: 'Sắp đến hạn thanh toán', trigger: 'Gửi cho tiểu thương có khoản phải thu chưa thanh toán.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA', 'SMS'], leadDays: 1, templates: { trader: t('Sắp đến hạn thanh toán kỳ {period}', 'Khoản phải thu {period} của bạn còn {amount}.\nHạn thanh toán: {dueDate}.\nVui lòng hoàn tất thanh toán đúng hạn.') } },
    { eventKey: 'PAYMENT_SUCCESS', label: 'Thanh toán thành công', trigger: 'Khi thanh toán được khớp thành công hoặc NV thu phí xác nhận đủ tiền mặt.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Thanh toán thành công', 'Hệ thống đã ghi nhận thanh toán {amount} cho kỳ {period}.\nBiên lai điện tử: {receiptCode}.\nVui lòng xem chi tiết biên lai.') } },
    { eventKey: 'TRANSACTION_REVIEW_REQUIRED', label: 'Giao dịch cần tra soát', trigger: 'Khi giao dịch có trạng thái NEEDS_REVIEW, UNMATCHED hoặc tương đương.', enabled: true, recipients: ['fee_collector', 'accountant'], channels: ['Mini app'], templates: { fee_collector: t('Có giao dịch cần tra soát', 'Phát hiện giao dịch {transactionCode} liên quan kỳ {period} chưa thể tự động khớp.\nVui lòng kiểm tra.'), accountant: t('Có giao dịch cần tra soát', 'Phát hiện giao dịch {transactionCode} liên quan kỳ {period} chưa thể tự động khớp.\nVui lòng kiểm tra.') } },
    { eventKey: 'PERIOD_FULLY_COLLECTED', label: 'Thu đủ 100% kỳ', trigger: 'Khi toàn bộ khoản phải thu của kỳ đã thanh toán.', enabled: true, recipients: ['market_manager', 'fee_collector'], channels: ['Mini app'], templates: { market_manager: t('Kỳ thu {period} đã thu đủ 100%', 'Toàn bộ khoản phải thu của {marketName} trong kỳ {period} đã được thanh toán.\nCó thể thực hiện hoàn tất thu và chuyển sang đối soát.'), fee_collector: t('Kỳ thu {period} đã thu đủ 100%', 'Toàn bộ khoản phải thu của {marketName} trong kỳ {period} đã được thanh toán.\nCó thể thực hiện hoàn tất thu và chuyển sang đối soát.') } },
    { eventKey: 'RECONCILIATION_COMPLETED', label: 'Đối soát hoàn tất', trigger: 'Khi đối soát kỳ hoàn tất.', enabled: true, recipients: ['market_manager'], channels: ['Mini app'], templates: { market_manager: t('Đối soát kỳ {period} đã hoàn tất', 'Kết quả thu kỳ {period} của {marketName} đã được đối soát đầy đủ.\nKỳ đủ điều kiện để kiểm tra và chốt.') } },
    { eventKey: 'CONTRACT_EXPIRY_30', label: 'Hợp đồng còn 30 ngày hết hạn', trigger: 'Khi hợp đồng sắp hết hạn 30 ngày.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Hợp đồng sắp hết hạn', 'Hợp đồng tại {marketName} sắp hết hạn. Vui lòng xem chi tiết hợp đồng.') } },
    { eventKey: 'COMPLAINT_COMPLETED', label: 'Phản ánh được xử lý xong', trigger: 'Khi phản ánh hoàn thành.', enabled: true, recipients: ['trader'], channels: ['Mini app'], templates: { trader: t('Phản ánh đã được xử lý', 'Phản ánh của bạn tại {marketName} đã được xử lý xong.') } }
  ]; }
  function ensureEvents() {
    let changed = false; A.db.notificationEventConfigs = Array.isArray(A.db.notificationEventConfigs) ? A.db.notificationEventConfigs : [];
    eventDefaults().forEach(base => { const cur = A.db.notificationEventConfigs.find(x => x.eventKey === base.eventKey); if (!cur) { A.db.notificationEventConfigs.push(clone(base)); changed = true; return; } ['label', 'trigger', 'enabled', 'recipients', 'channels', 'templates', 'leadDays'].forEach(k => { if (cur[k] === undefined && base[k] !== undefined) { cur[k] = clone(base[k]); changed = true; } }); if (!cur.templates || typeof cur.templates !== 'object') { cur.templates = {}; changed = true; } Object.keys(base.templates).forEach(actor => { if (!cur.templates[actor]) { cur.templates[actor] = clone(base.templates[actor]); changed = true; } }); if (base.eventKey === 'RECEIVABLE_ISSUED' && !cur.receivableIssuedRecipientSchema) { if (!cur.recipients.includes('fee_collector')) cur.recipients.push('fee_collector'); cur.receivableIssuedRecipientSchema = 2; changed = true; } });
    // Không seed lịch sử phát hành khoản phải thu: record RECEIVABLE_ISSUED chỉ
    // được tạo từ handler phát hành thành công. Demo cũ nếu đã lưu vẫn được giữ.
    // Historical demo notifications must come from their workflow trigger, not from opening this screen.
    if (changed) A.save(); return A.db.notificationEventConfigs;
  }
  // Workflow thu phí chuẩn: chỉ các rule này được hiển thị và được phép phát.
  // Các cấu hình cũ được retire tại chỗ trong cùng store, không đụng lịch sử gửi.
  const STANDARD_RULES = [
    ['PERIOD_PREPARATION', 'Chuẩn bị kỳ thu', 'PERIOD_MILESTONE', 'PREPARATION', 'Chuẩn bị kỳ', ['market_manager', 'fee_collector'], ['Mini app', 'Zalo OA'], { default: t('Kỳ thu {period} sắp bắt đầu', 'Kỳ thu {period} tại {marketName} đang bước vào giai đoạn chuẩn bị.\nVui lòng kiểm tra các công việc cần thực hiện theo lịch nghiệp vụ.') }],
    ['PERIOD_METER_READ', 'Nhắc ghi chỉ số điện nước', 'PERIOD_MILESTONE', 'METER_READ', 'Ghi chỉ số điện nước', ['fee_collector'], ['Mini app', 'Zalo OA'], { default: t('Đến thời gian ghi chỉ số điện nước', 'Kỳ thu {period} của {marketName} đã đến thời gian ghi chỉ số điện, nước.\nVui lòng hoàn tất ghi chỉ số theo các điểm kinh doanh được phân công.') }],
    ['PERIOD_COLLECTION_START', 'Mở kỳ thu', 'PERIOD_MILESTONE', 'COLLECTION_START', 'Mở kỳ thu', ['market_manager', 'fee_collector', 'contract_traders'], ['Mini app', 'Zalo OA'], { default: t('Bắt đầu kỳ thu {period}', 'Kỳ thu {period} tại {marketName} đã bắt đầu.\nCác khoản phải thu sẽ được hiển thị trên Web App Tiểu thương sau khi được phát hành.') }],
    ['PERIOD_REMINDER_1', 'Nhắc thanh toán lần 1', 'PERIOD_MILESTONE', 'REMINDER_1', 'Nhắc thanh toán lần 1', ['unpaid_traders'], ['Mini app', 'Zalo OA', 'SMS'], { default: t('Nhắc thanh toán kỳ {period}', 'Bạn còn khoản phải thanh toán trong kỳ {period} tại {marketName}.\nVui lòng kiểm tra chi tiết trên Web App Tiểu thương và hoàn tất trước {dueDate}.') }],
    ['PERIOD_REMINDER_2', 'Nhắc thanh toán lần 2', 'PERIOD_MILESTONE', 'REMINDER_2', 'Nhắc thanh toán lần 2', ['unpaid_traders'], ['Mini app', 'Zalo OA', 'SMS'], { default: t('Nhắc thanh toán kỳ {period}', 'Kỳ thu {period} sắp đến hạn.\nBạn vẫn còn khoản chưa thanh toán tại {marketName}.\nVui lòng hoàn tất trước {dueDate}.') }],
    ['PERIOD_DUE_DATE', 'Thông báo đến hạn thanh toán', 'PERIOD_MILESTONE', 'DUE_DATE', 'Hạn thanh toán', ['unpaid_traders'], ['Mini app', 'Zalo OA'], { default: t('Đến hạn thanh toán kỳ {period}', 'Hôm nay là hạn thanh toán kỳ {period} tại {marketName}.\nVui lòng kiểm tra các khoản chưa hoàn thành trên Web App Tiểu thương.') }],
    ['RECEIVABLE_ISSUED', 'Phát hành kỳ thu', 'BUSINESS_EVENT', '', 'Phát hành kỳ thu thành công', ['trader', 'fee_collector'], ['Mini app', 'Zalo OA'], { trader: t('Đã phát hành khoản phải thu kỳ {period}', 'Khoản phải thu kỳ {period} tại {marketName} đã được phát hành.\nTổng cần thanh toán: {amount}.\nVui lòng xem chi tiết và thanh toán trên Web App Tiểu thương trước {dueDate}.'), fee_collector: t('Bắt đầu thu phí kỳ {period}', 'Khoản phải thu của {marketName} đã được phát hành.\nBạn có thể bắt đầu thực hiện thu phí theo phạm vi được phân công.') }],
    ['PAYMENT_SUCCESS', 'Thanh toán thành công', 'BUSINESS_EVENT', '', 'Thanh toán thành công', ['trader'], ['Mini app', 'Zalo OA'], { trader: t('Thanh toán thành công', 'Hệ thống đã ghi nhận thanh toán {amount} cho kỳ {period} tại {marketName}.\nBiên lai đã được tạo và có thể xem trên Web App Tiểu thương.') }],
    ['MARKET_COLLECTION_COMPLETED', 'Thu đủ 100%', 'BUSINESS_EVENT', '', 'Chợ đạt 100% khoản phải thu đã thanh toán', ['market_manager', 'fee_collector'], ['Mini app'], { default: t('Đã thu đủ kỳ {period}', '{marketName} đã hoàn thành 100% khoản phải thu của kỳ {period}.\nNV thu phí có thể thực hiện “Hoàn tất thu & chuyển đối soát”.') }],
    ['MARKET_RECONCILED', 'Đối soát hoàn tất', 'BUSINESS_EVENT', '', 'Đối soát thành công và khớp 100%', ['market_manager', 'central_accountant', 'fee_collector'], ['Mini app'], { default: t('Đối soát hoàn tất', '{marketName} đã đối soát thành công kỳ {period} và khớp 100%.') }],
    ['PERIOD_CLOSED', 'Chốt kỳ thu', 'BUSINESS_EVENT', '', 'Chốt kỳ thu thành công', ['market_manager', 'central_accountant', 'fee_collector'], ['Mini app'], { default: t('Kỳ thu {period} đã được chốt', 'Kỳ thu {period} đã hoàn tất và được chốt thành công.\nTổng số chợ hoàn tất: {completedMarkets}.\nKhông áp dụng: {notApplicableMarkets}.') }]
  ];
  const LEGACY_RULE_KEYS = { PERIOD_PREPARATION_STARTED:'PERIOD_PREPARATION', COLLECTION_STARTED:'PERIOD_COLLECTION_START', PAYMENT_DUE_SOON:'PERIOD_DUE_DATE', PERIOD_FULLY_COLLECTED:'MARKET_COLLECTION_COMPLETED', RECONCILIATION_COMPLETED:'MARKET_RECONCILED' };
  function ensureEvents() {
    const list = A.db.notificationEventConfigs = Array.isArray(A.db.notificationEventConfigs) ? A.db.notificationEventConfigs : [];
    const found = new Map(), actor = A.currentAccount && A.currentAccount(), by = actor && (actor.fullName || actor.code) || 'Hệ thống'; let changed = false;
    list.forEach(r => { if (!r || r.retired) return; const key = LEGACY_RULE_KEYS[r.eventKey] || r.eventKey; if (!found.has(key)) { if (key !== r.eventKey) { r.eventKey = key; changed = true; } found.set(key, r); } else { r.retired = true; r.retiredAt = U.today(); r.retiredReason = 'Trùng quy tắc sau chuẩn hóa'; changed = true; } });
    STANDARD_RULES.forEach(x => { let r = found.get(x[0]), state = r && (r.status === 'DISABLED' || r.enabled === false) ? 'DISABLED' : 'ENABLED'; if (!r) { r = { eventKey:x[0] }; list.push(r); changed = true; } if (r.workflowSchema !== 2) { Object.assign(r, { label:x[1], recipients:clone(x[5]), channels:clone(x[6]), templates:clone(x[7]), workflowSchema:2 }); changed = true; } Object.assign(r, { triggerType:x[2] === 'PERIOD_MILESTONE' ? 'TIME' : 'EVENT', triggerEvent:x[3], systemEventKey:x[2] === 'BUSINESS_EVENT' ? x[0] : '', trigger:x[4], marketIds:[], status:state, enabled:state === 'ENABLED', retired:false }); });
    const allowed = new Set(STANDARD_RULES.map(x => x[0])); list.forEach(r => { if (r && !r.retired && !allowed.has(r.eventKey) && !String(r.eventKey || '').startsWith('CUSTOM_RULE_')) { r.retired = true; r.retiredAt = U.today(); r.retiredReason = 'Ngoài workflow thu phí hiện tại'; changed = true; } });
    list.filter(r => r && !r.retired).forEach(r => { if (normalizeRecipientSchema(r)) changed = true; });
    if (changed) A.save(); return list.filter(r => r && !r.retired);
  }
  const eventByKey = key => ensureEvents().find(x => x.eventKey === (LEGACY_RULE_KEYS[key] || key));
  A.NOTIFICATIONS = A.NOTIFICATIONS || {};
  A.NOTIFICATIONS.eventByKey = eventByKey;

  const RECIPIENT_GROUPS = [
    ['SYSTEM_ADMIN', 'Quản trị viên hệ thống'],
    ['CENTER_LEADERSHIP', 'Lãnh đạo / Giám đốc Trung tâm / Phó Giám đốc Trung tâm'],
    ['MARKET_MANAGEMENT_LEADERS', 'Tổ trưởng / Tổ phó Tổ quản lý chợ'],
    ['FEE_COLLECTOR', 'Nhân viên thu phí'],
    ['TECHNICAL_STAFF', 'Nhân viên kỹ thuật'],
    ['OFFICE_LEADERS', 'Tổ trưởng Tổ văn phòng'],
    ['CENTRAL_ACCOUNTANT', 'Kế toán Trung tâm'],
    ['TRADER', 'Tiểu thương']
  ];
  const RECIPIENT_GROUP_LABEL = Object.fromEntries(RECIPIENT_GROUPS);
  const LEGACY_RECIPIENT = {
    market_manager: ['MARKET_MANAGEMENT_LEADERS', 'CURRENT_MARKET'], fee_collector: ['FEE_COLLECTOR', 'ASSIGNED_TO_EVENT_MARKET'],
    central_accountant: ['CENTRAL_ACCOUNTANT', 'CURRENT_MARKET'], accountant: ['CENTRAL_ACCOUNTANT', 'CURRENT_MARKET'],
    contract_traders: ['TRADER', 'HAS_ACTIVE_CONTRACT'], unpaid_traders: ['TRADER', 'HAS_UNPAID_RECEIVABLE'], trader: ['TRADER', 'HAS_ISSUED_RECEIVABLE']
  };
  const DEFAULT_CONDITION = { TRADER: 'ALL_RELATED', FEE_COLLECTOR: 'ASSIGNED_TO_EVENT_MARKET', TECHNICAL_STAFF: 'ASSIGNED_TO_INCIDENT', MARKET_MANAGEMENT_LEADERS: 'CURRENT_MARKET' };
  const CONDITION_LABEL = { ALL_RELATED: 'Tất cả tiểu thương liên quan', HAS_ACTIVE_CONTRACT: 'Tiểu thương có hợp đồng đang hiệu lực', HAS_ISSUED_RECEIVABLE: 'Tiểu thương có khoản vừa phát hành', HAS_UNPAID_RECEIVABLE: 'Tiểu thương chưa thanh toán', JUST_PAID: 'Tiểu thương vừa thanh toán', CONTRACT_EXPIRING: 'Tiểu thương có hợp đồng sắp hết hạn', ASSIGNED_TO_EVENT_MARKET: 'NV phụ trách chợ phát sinh sự kiện', ALL_COLLECTORS: 'Tất cả NV thu phí', ASSIGNED_TO_INCIDENT: 'NV được phân công xử lý sự cố', ALL_TECHNICIANS: 'Tất cả NV kỹ thuật', CURRENT_MARKET: 'Theo chợ phát sinh sự kiện' };
  const TIME_SEED = { PREPARATION:[28,'previous'], METER_READ:[28,'previous'], COLLECTION_START:[1,'next'], REMINDER_1:[1,'next'], REMINDER_2:[3,'next'], DUE_DATE:[15,'next'] };
  function normalizeRecipientSchema(rule) {
    let changed = false;
    const recipients = (rule.recipients || []).map(x => {
      if (x && typeof x === 'object' && x.actorGroup) return x;
      const legacy = LEGACY_RECIPIENT[x] || ['TRADER', 'ALL_RELATED'];
      changed = true; return { actorGroup: legacy[0], condition: legacy[1] };
    });
    if (!recipients.length) { recipients.push({ actorGroup:'TRADER', condition:'ALL_RELATED' }); changed = true; }
    if (rule.eventKey === 'PAYMENT_SUCCESS') recipients.forEach(x => { if (x.actorGroup === 'TRADER' && x.condition !== 'JUST_PAID') { x.condition = 'JUST_PAID'; changed = true; } });
    if (rule.eventKey === 'RECEIVABLE_ISSUED') recipients.forEach(x => { if (x.actorGroup === 'TRADER' && x.condition !== 'HAS_ISSUED_RECEIVABLE') { x.condition = 'HAS_ISSUED_RECEIVABLE'; changed = true; } });
    if (changed) rule.recipients = recipients;
    if (rule.triggerType === 'PERIOD_MILESTONE') { rule.triggerType = 'TIME'; changed = true; }
    if (rule.triggerType === 'BUSINESS_EVENT' || rule.triggerType === 'SYSTEM_EVENT') { rule.triggerType = 'EVENT'; changed = true; }
    if (rule.triggerType === 'TIME' && !rule.time) { const x = TIME_SEED[rule.triggerEvent] || [1, 'current']; rule.time = { day:x[0], month:x[1], at:'08:00' }; changed = true; }
    const channels = Array.from(new Set((rule.channels || []).map(x => CHANNEL_MIGRATION[x] || x).filter(x => CHANNELS.includes(x))));
    if (JSON.stringify(channels) !== JSON.stringify(rule.channels || [])) { rule.channels = channels.length ? channels : ['Web app quản lý']; changed = true; }
    if (changed) rule.workflowSchema = 2;
    return changed;
  }

  // Notification workspace v2. Rules remain in notificationEventConfigs and
  // actual sends remain in notifications; no scheduler or parallel store.
  const PERIOD_TRIGGERS = [
    ['PERIOD_PREPARATION', 'Chuẩn bị kỳ', 'PREPARATION'],
    ['PERIOD_METER_READ', 'Ghi chỉ số điện, nước', 'METER_READ'],
    ['PERIOD_COLLECTION_START', 'Bắt đầu thu', 'COLLECTION_START'],
    ['PERIOD_REMINDER_1', 'Nhắc thanh toán lần 1', 'REMINDER_1'],
    ['PERIOD_REMINDER_2', 'Nhắc thanh toán lần 2', 'REMINDER_2'],
    ['PERIOD_DUE_DATE', 'Hạn thanh toán', 'DUE_DATE']
  ];
  const PERIOD_DATE_FIELD = { PREPARATION: 'preparationDate', METER_READ: 'meterReadDate', COLLECTION_START: 'startDate', REMINDER_1: 'reminder1Date', REMINDER_2: 'reminder2Date', DUE_DATE: 'dueDate' };
  function ensurePeriodRules() {
    ensureEvents(); let changed = false;
    PERIOD_TRIGGERS.forEach(([eventKey, label, triggerEvent]) => {
      let rule = A.db.notificationEventConfigs.find(x => x.eventKey === eventKey);
      if (!rule) {
        rule = { eventKey, label, trigger: label, group: 'PERIOD', triggerEvent, enabled: true, marketIds: [], recipientMode: triggerEvent === 'REMINDER_1' || triggerEvent === 'REMINDER_2' || triggerEvent === 'DUE_DATE' ? 'unpaid_traders' : 'period_traders', recipients: ['trader'], channels: ['Mini app'], templates: { trader: t(label + ' · kỳ {period}', 'Thông báo kỳ {period} tại {marketName}. Vui lòng theo dõi thời điểm {dueDate}.') } };
        A.db.notificationEventConfigs.push(rule); changed = true;
      } else {
        if (!rule.group) { rule.group = 'PERIOD'; changed = true; }
        if (!rule.triggerEvent) { rule.triggerEvent = triggerEvent; changed = true; }
        if (!Array.isArray(rule.marketIds)) { rule.marketIds = []; changed = true; }
        if (!rule.recipientMode) { rule.recipientMode = 'period_traders'; changed = true; }
      }
    });
    if (changed) A.save();
    return A.db.notificationEventConfigs.filter(rule => rule && !rule.retired);
  }
  A.NOTIFICATIONS.resolvePeriodTrigger = function (rule, billingPeriod) {
    if (!rule || rule.group !== 'PERIOD' || !billingPeriod) return null;
    const field = PERIOD_DATE_FIELD[rule.triggerEvent];
    const date = field && billingPeriod[field];
    return date ? { billingPeriodId: billingPeriod.id, marketId: billingPeriod.marketId, period: billingPeriod.period || (A.periods && A.periods.periodKey(billingPeriod)), trigger: rule.triggerEvent, date } : null;
  };
  function notificationTabs() { return [['auto', 'Thiết lập tự động'], ['manual', 'Thông báo thủ công'], ['history', 'Lịch sử gửi']]; }
  function notificationMarketOptions(selected, required) {
    const markets = (A.D.MARKETS || []).filter(m => A.allowedMarkets(A.currentAccount()).includes(m.id));
    return `${required ? '<option value="">Chọn chợ</option>' : '<option value="">Tất cả chợ</option>'}${markets.map(m => `<option value="${m.id}" ${selected === m.id ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}`;
  }
  function ruleStatus(rule) { const enabled = rule.status !== 'DISABLED' && rule.enabled !== false; return `<span class="tag ${enabled ? 'ok' : ''}">${enabled ? 'Đang bật' : 'Đang tắt'}</span>`; }
  function periodTriggerOptions(rule) { return PERIOD_TRIGGERS.map(x => `<option value="${x[2]}" ${rule.triggerEvent === x[2] ? 'selected' : ''}>${x[1]}</option>`).join(''); }
  function historyTab() {
    const type = ui.notificationHistoryType || '', channel = ui.notificationHistoryChannel || '', q = String(ui.notificationHistorySearch || '').toLowerCase();
    const rows = (A.db.notifications || []).filter(n => (!type || (type === 'auto') === !!n.auto) && (!channel || (n.channels || []).includes(channel)) && (!q || [n.title,n.group,n.body].join(' ').toLowerCase().includes(q)));
    return `<section class="card notification-history"><div class="card-h"><h3>LỊCH SỬ GỬI</h3></div><div class="card-b"><div class="notification-history-filters"><select class="input" data-ch="notification-history-type"><option value="">Loại thông báo</option><option value="auto" ${type === 'auto' ? 'selected' : ''}>Tự động</option><option value="manual" ${type === 'manual' ? 'selected' : ''}>Thủ công</option></select><select class="input" data-ch="notification-history-channel"><option value="">Kênh gửi</option>${CHANNELS.map(c => `<option ${channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select><input class="input" data-in="notification-history-search" placeholder="Tìm kiếm nội dung/người nhận..." value="${U.esc(ui.notificationHistorySearch || '')}"></div>${U.table([{t:'Thời gian gửi'},{t:'Loại'},{t:'Tên thông báo'},{t:'Chợ'},{t:'Đối tượng nhận'},{t:'Kênh gửi'},{t:'Số người nhận'},{t:'Trạng thái'},{t:'Thao tác'}], rows.map(n => `<tr><td>${U.dmy(n.at)}</td><td>${n.auto ? '<span class="tag info">Tự động</span>' : '<span class="tag">Thủ công</span>'}</td><td><b>${U.esc(n.title || '—')}</b></td><td>${U.esc((U.market(n.marketId || n.market) || {}).name || n.market || '—')}</td><td>${U.esc(n.group || n.recipientMode || '—')}</td><td>${U.esc((n.channels || []).join(', '))}</td><td class="num">${n.sent == null ? '—' : n.sent}</td><td><span class="tag ok">${n.deliveryStatus || 'Thành công'}</span></td><td><button class="btn sm" data-act="notification-history-detail" data-id="${n.id}">Xem</button></td></tr>`), {empty: q || type || channel ? 'Không tìm thấy thông báo phù hợp.' : 'Chưa có thông báo nào được gửi.'})}</div></section>`;
  }
  A.ACT['notification-tab'] = el => { ui.notificationTab = el.dataset.id; A.render(); };
  A.ACT['notification-rule-select'] = el => { const rule = eventByKey(el.dataset.id); if (!rule) return; A.modal(A.mHead('CHỈNH SỬA QUY TẮC') + `<div class="modal-b">${ruleDetailV3(rule, normalizeTriggerTypes(), A.canDo('thong-bao.gui', ui.market))}</div>`); };
  A.ACT['notification-rule-toggle'] = el => { const rule = eventByKey(el.dataset.id); if (!rule || !A.canDo('thong-bao.gui', ui.market)) return; rule.enabled = !rule.enabled; rule.status = rule.enabled ? 'ENABLED' : 'DISABLED'; rule.updatedAt = U.today() + ' ' + U.nowTime(); rule.updatedBy = ((A.currentAccount() || {}).fullName || (A.currentAccount() || {}).code || 'Hệ thống'); if (Array.isArray(rule.audit)) rule.audit.unshift({ at:rule.updatedAt, by:rule.updatedBy, action:rule.enabled ? 'Bật quy tắc' : 'Tắt quy tắc' }); A.save(); A.closeModal(); A.render(); U.toast(rule.enabled ? 'Đã bật quy tắc.' : 'Đã tắt quy tắc.'); };
  A.CH['notification-rule-group'] = el => { ui.notificationRuleGroup = el.value; A.render(); }; A.CH['notification-rule-status'] = el => { ui.notificationRuleStatus = el.value; A.render(); }; A.IN['notification-rule-search'] = el => { ui.notificationRuleSearch = el.value; A.render(); };
  A.CH['notification-manual-market'] = el => { ui.notificationManualDraft.marketId = el.value; A.render(); }; A.IN['notification-manual-title'] = el => { ui.notificationManualDraft.title = el.value; }; A.IN['notification-manual-body'] = el => { ui.notificationManualDraft.body = el.value; };
  function manualRecipients(d, groups, traderCondition) {
    const inMarket = a => d.marketId === 'ALL' || A.allowedMarkets(a).includes('ALL') || A.allowedMarkets(a).includes(d.marketId);
    const active = a => A.ACCOUNTS.isActive(a) && inMarket(a), add = (map, key, value) => { if (!map.has(key)) map.set(key, value); };
    const out = new Map(), accounts = A.ACCOUNTS.currentList().filter(active), roleFor = group => ({ SYSTEM_ADMIN:'system_admin', CENTER_LEADERSHIP:'ward_leader', MARKET_MANAGEMENT_LEADERS:'market_manager', FEE_COLLECTOR:'collector', TECHNICAL_STAFF:'technician', OFFICE_LEADERS:'office_leader', CENTRAL_ACCOUNTANT:'central_accountant' })[group];
    groups.filter(g => g !== 'TRADER').forEach(group => accounts.filter(a => A.ACCOUNTS.primaryRole(a) === roleFor(group) && (group !== 'TECHNICAL_STAFF' || A.ACCOUNTS.isActive(a))).forEach(a => add(out, 'ACCOUNT:' + a.id, { key:'ACCOUNT:' + a.id, type:'ACCOUNT', id:a.id, name:a.fullName, group })));
    if (groups.includes('TRADER')) {
      let traders = (A.db.traders || []).filter(t => d.marketId === 'ALL' || t.market === d.marketId);
      if (traderCondition === 'UNPAID') { const ids = new Set((A.db.invoices || []).filter(i => (d.marketId === 'ALL' || A.receivableMarket(i) === d.marketId) && i.status !== 'paid').map(i => i.traderId)); traders = traders.filter(t => ids.has(t.id)); }
      if (traderCondition === 'ACTIVE_CONTRACT') { const ids = new Set((A.db.contracts || []).filter(c => c.status === 'ACTIVE' && (d.marketId === 'ALL' || c.market === d.marketId)).map(c => c.traderId)); traders = traders.filter(t => ids.has(t.id)); }
      traders.forEach(t => add(out, 'TRADER:' + t.id, { key:'TRADER:' + t.id, type:'TRADER', id:t.id, name:t.name, group:'TRADER' }));
    }
    return Array.from(out.values());
  }
  function manualSelection() { const d = ui.notificationManualDraft || {}, groups = Array.from(document.querySelectorAll('.notification-manual-recipient:checked')).map(x => x.value), traderCondition = (A.$('#notification-manual-trader-condition') || {}).value || 'ALL'; return { d, groups, traderCondition, recipients:manualRecipients(d, groups, traderCondition), channels:Array.from(document.querySelectorAll('.notification-manual-channel:checked')).map(x => x.value) }; }
  function manualSummaryHtml(x) { const counts = x.groups.map(g => [RECIPIENT_GROUP_LABEL[g], x.recipients.filter(r => r.group === g).length]); return `<dl class="kv"><dt>Phạm vi</dt><dd>${U.esc(x.d.marketId === 'ALL' ? 'Tất cả chợ' : ((U.market(x.d.marketId) || {}).name || x.d.marketId || '—'))}</dd><dt>Người nhận</dt><dd>${counts.map(a => U.esc(a[0]) + ': ' + a[1]).join('<br>') || '—'}<br><b>Tổng: ${x.recipients.length} người</b></dd><dt>Kênh</dt><dd>${U.esc(x.channels.join(', ') || '—')}</dd></dl>`; }
  A.ACT['notification-manual-preview'] = () => { const x = manualSelection(); A.modal(A.mHead('XEM TRƯỚC THÔNG BÁO') + `<div class="modal-b">${manualSummaryHtml(x)}<h3>${U.esc(x.d.title || 'Chưa có tiêu đề')}</h3><p style="white-space:pre-wrap">${U.esc(x.d.body || 'Chưa có nội dung')}</p></div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`); };
  A.ACT['notification-manual-send'] = () => { const x = manualSelection(), { d } = x; if (!d.marketId || !x.groups.length || !x.recipients.length || !d.title.trim() || !d.body.trim() || !x.channels.length) return U.toast(!x.groups.length ? 'Vui lòng chọn ít nhất một nhóm người nhận.' : !x.recipients.length ? 'Không tìm thấy người nhận phù hợp.' : 'Cần chọn phạm vi chợ, kênh gửi, tiêu đề và nội dung.'); if (!A.canDo('thong-bao.gui', d.marketId === 'ALL' ? ui.market : d.marketId)) return; const actor = A.currentAccount() || {}, at = U.today() + ' ' + U.nowTime(), batchId = 'TBM-' + Date.now(), groupNames = x.groups.map(g => RECIPIENT_GROUP_LABEL[g]); x.recipients.forEach((r, index) => A.db.notifications.unshift({ id:'TB-' + U.pad(32 + A.db.notifications.length + index,3), batchId, at, sentAt:at, sentBy:actor.fullName || actor.code || 'Hệ thống', market:d.marketId, marketId:d.marketId, title:d.title.trim(), body:d.body.trim(), group:groupNames.join(', '), recipientGroups:x.groups, recipientType:r.type, recipientId:r.id, traderId:r.type === 'TRADER' ? r.id : undefined, recipientMode:d.traderCondition, channels:x.channels, sent:x.recipients.length, delivered:1, read:0, auto:false, deliveryStatus:'Đã gửi (mô phỏng)' })); A.save(); ui.notificationTab = 'history'; ui.notificationManualDraft = null; A.render(); U.toast('Đã gửi thông báo đến ' + x.recipients.length + ' người nhận.'); };
  A.CH['notification-history-type'] = el => { ui.notificationHistoryType = el.value; A.render(); }; A.CH['notification-history-channel'] = el => { ui.notificationHistoryChannel = el.value; A.render(); }; A.IN['notification-history-search'] = el => { ui.notificationHistorySearch = el.value; A.render(); };
  A.ACT['notification-history-detail'] = el => { const n = (A.db.notifications || []).find(x => x.id === el.dataset.id); if (!n) return; A.modal(A.mHead('CHI TIẾT LẦN GỬI') + `<div class="modal-b"><dl class="kv"><dt>Tên thông báo</dt><dd>${U.esc(n.title || '—')}</dd><dt>Loại</dt><dd>${n.auto ? 'Tự động' : 'Thủ công'}</dd><dt>Chợ</dt><dd>${U.esc((U.market(n.marketId || n.market) || {}).name || n.market || '—')}</dd><dt>Thời gian gửi</dt><dd>${U.dmy(n.at)}</dd><dt>Đối tượng</dt><dd>${U.esc(n.group || '—')}</dd><dt>Kênh</dt><dd>${U.esc((n.channels || []).join(', '))}</dd><dt>Số người nhận</dt><dd>${n.sent || 0}</dd><dt>Trạng thái</dt><dd>${n.deliveryStatus || 'Thành công'}</dd></dl><h4>Nội dung</h4><p style="white-space:pre-wrap">${U.esc(n.body || '')}</p></div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`); };
  // Trigger-type normalization is additive and keeps legacy event keys/data.
  const LEGACY_PERIOD_TRIGGER = { PERIOD_PREPARATION_STARTED: 'PREPARATION', COLLECTION_STARTED: 'COLLECTION_START', PAYMENT_DUE_SOON: 'DUE_DATE' };
  function normalizeTriggerTypes() {
    let changed = false;
    ensurePeriodRules().forEach(rule => {
      const periodTrigger = rule.triggerEvent || LEGACY_PERIOD_TRIGGER[rule.eventKey];
      const type = periodTrigger ? 'TIME' : 'EVENT';
      if (rule.triggerType !== type) { rule.triggerType = type; changed = true; }
      if (periodTrigger && rule.triggerEvent !== periodTrigger) { rule.triggerEvent = periodTrigger; changed = true; }
      if (periodTrigger && rule.scheduleId !== 'BILLING_MONTHLY') { rule.scheduleId = 'BILLING_MONTHLY'; changed = true; }
      if (periodTrigger && rule.milestoneId !== periodTrigger) { rule.milestoneId = periodTrigger; changed = true; }
      if (!rule.trigger) { rule.trigger = type === 'PERIOD_MILESTONE' ? (PERIOD_TRIGGERS.find(x => x[2] === periodTrigger) || [,''])[1] : rule.label; changed = true; }
    });
    if (changed) A.save();
    return A.db.notificationEventConfigs.filter(rule => rule && !rule.retired);
  }
  const triggerTypeLabel = rule => rule.triggerType === 'TIME' ? 'Theo thời gian' : 'Khi có sự kiện phát sinh';
  const systemEventOptions = (rules, selected) => rules.filter(r => r.triggerType === 'SYSTEM_EVENT').map(r => `<option value="${r.eventKey}" ${r.eventKey === selected ? 'selected' : ''}>${U.esc(r.label)}</option>`).join('');
  function autoListV3(rules, canEdit) {
    const q = String(ui.notificationRuleSearch || '').toLowerCase(), type = ui.notificationRuleGroup || '', status = ui.notificationRuleStatus || '';
    const rows = rules.filter(r => (!type || r.triggerType === type) && (!status || status === (r.enabled === false ? 'DISABLED' : 'ENABLED')) && (!q || [r.label, r.trigger, triggerTypeLabel(r)].join(' ').toLowerCase().includes(q)));
    const rec = r => (r.recipients || []).map(x => ({market_manager:'Tổ trưởng',fee_collector:'NV thu phí',contract_traders:'Tiểu thương có HĐ áp dụng',unpaid_traders:'Tiểu thương chưa thanh toán',trader:'Tiểu thương',central_accountant:'Kế toán Trung tâm'})[x] || x).join(' + ');
    return `<section class="notification-rules-list"><div class="notification-panel-head"><h3>DANH SÁCH QUY TẮC THÔNG BÁO TỰ ĐỘNG</h3>${canEdit ? '<button class="btn primary" data-act="notification-rule-new">+ Tạo quy tắc</button>' : ''}</div><div class="notification-rule-filters"><select class="input" data-ch="notification-rule-group"><option value="">Loại kích hoạt</option><option value="PERIOD_MILESTONE" ${type === 'PERIOD_MILESTONE' ? 'selected' : ''}>Theo mốc lịch nghiệp vụ</option><option value="SYSTEM_EVENT" ${type === 'SYSTEM_EVENT' ? 'selected' : ''}>Theo sự kiện nghiệp vụ</option></select><select class="input" data-ch="notification-rule-status"><option value="">Trạng thái</option><option value="ENABLED" ${status === 'ENABLED' ? 'selected' : ''}>Đang bật</option><option value="DISABLED" ${status === 'DISABLED' ? 'selected' : ''}>Đang tắt</option></select><input class="input" data-in="notification-rule-search" value="${U.esc(ui.notificationRuleSearch || '')}" placeholder="Tìm kiếm quy tắc..."></div><div class="notification-rule-table">${U.table([{t:'Tên quy tắc'},{t:'Loại kích hoạt'},{t:'Kích hoạt khi'},{t:'Người nhận'},{t:'Kênh gửi'},{t:'Trạng thái'},{t:'Thao tác'}], rows.map(r => `<tr><td><b>${U.esc(r.label)}</b></td><td>${triggerTypeLabel(r)}</td><td>${U.esc(r.trigger)}</td><td>${U.esc(rec(r))}</td><td>${U.esc((r.channels || []).join(', '))}</td><td>${ruleStatus(r)}</td><td><button class="btn sm" data-act="notification-rule-detail" data-id="${r.eventKey}">Chi tiết</button></td></tr>`), {empty:'Chưa có quy tắc thông báo tự động.'})}</div></section>`;
  }
  function ruleDetailV3(rule, rules, canEdit) {
    if (!rule) return `<section class="notification-rule-detail"><h3>CHI TIẾT QUY TẮC</h3><div class="empty">Chọn một quy tắc để xem và cấu hình.</div></section>`;
    const disabled = canEdit ? '' : 'disabled', period = rule.triggerType === 'PERIOD_MILESTONE', isNew = !!rule.isNew, isStandard = !String(rule.eventKey || '').startsWith('CUSTOM_RULE_') && !isNew, template = (rule.templates && (rule.templates.default || rule.templates.trader || Object.values(rule.templates)[0])) || { title:'', body:'' };
    const scope = isStandard ? '<section><h4>PHẠM VI ÁP DỤNG</h4><div class="small">Toàn bộ 12 chợ thuộc Tổ Quản lý chợ</div></section>' : `<section><h4>PHẠM VI ÁP DỤNG</h4><div class="field"><label>Chợ áp dụng *</label><select class="input" id="notification-rule-market" ${disabled}>${notificationMarketOptions((rule.marketIds || [])[0] || '', false)}</select></div></section>`;
    return `<section class="notification-rule-detail"><div class="notification-panel-head"><h3>${isNew ? 'TẠO QUY TẮC TỰ ĐỘNG' : 'CHỈNH SỬA QUY TẮC'}</h3>${ruleStatus(rule)}</div><div class="notification-form"><div class="field"><label>Tên quy tắc *</label><input class="input" id="notification-rule-label" value="${U.esc(rule.label || '')}" ${disabled}></div><div class="field"><label>Loại kích hoạt *</label><select class="input" id="notification-rule-trigger-type" ${disabled}><option value="PERIOD_MILESTONE" ${period ? 'selected' : ''}>Theo mốc lịch nghiệp vụ</option><option value="SYSTEM_EVENT" ${!period ? 'selected' : ''}>Theo sự kiện nghiệp vụ</option></select></div><div class="field"><label>${period ? 'Mốc lịch nghiệp vụ *' : 'Sự kiện nghiệp vụ *'}</label>${period ? `<select class="input" id="notification-rule-trigger" ${disabled}>${periodTriggerOptions(rule)}</select>` : `<select class="input" id="notification-rule-system-event" ${disabled}>${systemEventOptions(rules)}</select>`}</div>${scope}<section><h4>NGƯỜI NHẬN</h4><div class="small">${U.esc((rule.recipients || []).map(x => RECIPIENT_TEXT[x] || x).join(' + '))}</div></section><section><h4>KÊNH GỬI</h4><div class="row notification-channel-list">${CHANNELS.map(c => `<label><input class="notification-rule-channel" type="checkbox" value="${c}" ${(rule.channels || []).includes(c) ? 'checked' : ''} ${disabled}> ${c}</label>`).join('')}</div></section><section><h4>NỘI DUNG THÔNG BÁO</h4><div class="field"><label>Tiêu đề *</label><input class="input" id="notification-rule-title" value="${U.esc(template.title || '')}" ${disabled}></div><div class="field"><label>Nội dung *</label><textarea class="input" id="notification-rule-body" rows="5" ${disabled}>${U.esc(template.body || '')}</textarea></div></section></div><div class="notification-rule-actions"><button class="btn" data-act="close">Hủy</button>${canEdit ? `<button class="btn primary" data-act="notification-rule-save" data-id="${rule.eventKey}">Lưu thay đổi</button>` : ''}</div></section>`;
  }
  // Chi tiết luôn chỉ đọc; biểu mẫu chỉ xuất hiện sau khi người dùng bấm Chỉnh sửa.
  A.ACT['notification-rule-detail'] = el => {
    const rule = eventByKey(el.dataset.id); if (!rule) return;
    const template = (rule.templates && (rule.templates.default || rule.templates.trader || Object.values(rule.templates)[0])) || { title:'', body:'' };
    const rec = (rule.recipients || []).map(x => ({market_manager:'Tổ trưởng / Trưởng Ban quản lý',fee_collector:'NV thu phí phụ trách chợ',contract_traders:'Tiểu thương có hợp đồng đang áp dụng trong kỳ',unpaid_traders:'Tiểu thương còn khoản chưa thanh toán',trader:'Tiểu thương có khoản vừa phát hành',central_accountant:'Kế toán Trung tâm'})[x] || x).join('<br>');
    const scope = rule.marketIds && rule.marketIds.length ? ((U.market(rule.marketIds[0]) || {}).name || rule.marketIds[0]) : 'Tất cả chợ';
    const canEdit = A.canDo('thong-bao.gui', ui.market), on = rule.enabled !== false;
    A.modal(A.mHead('THÔNG TIN QUY TẮC') + `<div class="modal-b"><dl class="kv"><dt>Tên quy tắc</dt><dd>${U.esc(rule.label)}</dd><dt>Trạng thái</dt><dd>${ruleStatus(rule)}</dd><dt>Loại kích hoạt</dt><dd>${triggerTypeLabel(rule)}</dd><dt>Kích hoạt khi</dt><dd>${U.esc(rule.trigger)}</dd><dt>Phạm vi</dt><dd>${U.esc(scope)}</dd><dt>Người nhận</dt><dd>${rec}</dd><dt>Kênh gửi</dt><dd>${U.esc((rule.channels || []).join(' · '))}</dd></dl><h4>NỘI DUNG</h4><p><b>Tiêu đề:</b><br>${U.esc(template.title)}</p><p style="white-space:pre-wrap"><b>Nội dung:</b><br>${U.esc(template.body)}</p><h4>THÔNG TIN CẬP NHẬT</h4><dl class="kv"><dt>Cập nhật lần cuối</dt><dd>${U.esc(rule.updatedAt || '—')}</dd><dt>Người cập nhật</dt><dd>${U.esc(rule.updatedBy || '—')}</dd></dl></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button>${canEdit ? `<button class="btn" data-act="notification-rule-toggle" data-id="${rule.eventKey}">${on ? 'Tắt quy tắc' : 'Bật quy tắc'}</button><button class="btn primary" data-act="notification-rule-select" data-id="${rule.eventKey}">Chỉnh sửa</button>` : ''}</div>`);
  };
  // BR-06: Quản trị hệ thống + Tổ trưởng chỉnh Lịch nghiệp vụ (action riêng, không dùng quyền gửi thông báo).
  const canEditSchedule = () => U.can('thong-bao') && A.canDo('thong-bao.lich-nghiep-vu');
  const BILLING_MILESTONES = [['PREPARATION','Chuẩn bị kỳ','preparationDay','preparationMonth'],['METER_READ','Ghi chỉ số điện, nước','meterReadDay','meterReadMonth'],['COLLECTION_START','Mở kỳ thu','collectionStartDay','collectionStartMonth'],['REMINDER_1','Nhắc thanh toán lần 1','reminder1Day','reminder1Month'],['REMINDER_2','Nhắc thanh toán lần 2','reminder2Day','reminder2Month'],['DUE_DATE','Hạn thanh toán','dueDay','dueMonth']];
  const scheduleMonth = v => v === 'previous' ? 'Tháng trước' : v === 'next' ? 'Tháng kế tiếp' : 'Tháng kỳ thu';
  function billingScheduleCard(canEdit) {
    const cycle = A.SERVICE_CFG && A.SERVICE_CFG.cycle ? A.SERVICE_CFG.cycle() : {};
    const marketCount = (typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : A.D.MARKETS).length;
    return `<section class="card notification-schedules"><div class="notification-panel-head"><div><h3>LỊCH NGHIỆP VỤ</h3><div class="small muted">Thiết lập lịch vận hành và các mốc dùng chung để kích hoạt thông báo.</div></div></div><div class="card-b"><article class="notification-schedule-card"><div class="notification-schedule-card-head"><div><h3>Lịch kỳ thu hàng tháng <span class="tag ok">Đang áp dụng</span></h3><p>Áp dụng cho: <b>${marketCount} chợ thuộc Tổ Quản lý chợ</b> · ${BILLING_MILESTONES.length} mốc thời gian</p></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="notification-schedule-detail">Xem chi tiết</button>${canEdit ? '<button class="btn sm" data-act="notification-schedule-edit">Chỉnh sửa lịch</button>' : ''}<button class="btn sm" data-act="notification-open-period-monitor">Xem Theo dõi kỳ thu</button></div></div><div class="notification-schedule-milestones">${BILLING_MILESTONES.map(x => `<div><b>${x[1]}</b><span>Ngày ${U.pad(cycle[x[2]] || 1, 2)} / ${scheduleMonth(cycle[x[3]])}</span></div>`).join('')}</div></article></div></section>`;
  }
  document.addEventListener('change', e => { if (!e.target || e.target.id !== 'notification-rule-trigger-type') return; const rule = eventByKey(ui.notificationRuleId); if (!rule) return; rule.triggerType = e.target.value; if (rule.triggerType === 'PERIOD_MILESTONE') { rule.triggerEvent = rule.triggerEvent || 'REMINDER_1'; rule.trigger = (PERIOD_TRIGGERS.find(x => x[2] === rule.triggerEvent) || [,''])[1]; } else { rule.triggerEvent = ''; } A.render(); });
  function manualTabWorkspace() {
    const draft = ui.notificationManualDraft || (ui.notificationManualDraft = { marketId: ui.market === 'ALL' ? 'ALL' : ui.market, traderCondition:'ALL', recipientGroups:[], channels:['Web app quản lý'], title:'', body:'' }), canSend = A.canDo('thong-bao.gui', ui.market), groups = draft.recipientGroups || [];
    const preview = { d:draft, groups, traderCondition:(A.$('#notification-manual-trader-condition') || {}).value || draft.traderCondition || 'ALL', recipients:manualRecipients(draft, groups, draft.traderCondition || 'ALL'), channels:draft.channels || [] };
    return `<section class="card notification-manual notification-manual-workspace"><div class="card-h"><div><h3>THÔNG BÁO THỦ CÔNG</h3><div class="small muted">Gửi một lần đến nhiều nhóm đối tượng; các kênh gửi là mô phỏng trong prototype.</div></div></div><div class="card-b notification-manual-form"><section class="notification-manual-section"><h4>PHẠM VI &amp; NGƯỜI NHẬN</h4><div class="field"><label>Phạm vi chợ *</label><select class="input" data-ch="notification-manual-market"><option value="ALL" ${draft.marketId === 'ALL' ? 'selected' : ''}>Tất cả chợ</option>${notificationMarketOptions(draft.marketId, false).replace('<option value="">Tất cả chợ</option>', '')}</select></div><div class="field"><label>Đối tượng nhận *</label><div class="notification-channel-list">${RECIPIENT_GROUPS.map(([id,label]) => `<label><input class="notification-manual-recipient" type="checkbox" value="${id}" ${groups.includes(id) ? 'checked' : ''}> ${label}</label><br>`).join('')}</div></div>${groups.includes('TRADER') ? `<div class="field"><label>Phạm vi tiểu thương *</label><select class="input" id="notification-manual-trader-condition"><option value="ALL" ${preview.traderCondition === 'ALL' ? 'selected' : ''}>Tất cả tiểu thương trong chợ</option><option value="UNPAID" ${preview.traderCondition === 'UNPAID' ? 'selected' : ''}>Tiểu thương còn khoản chưa thanh toán</option><option value="ACTIVE_CONTRACT" ${preview.traderCondition === 'ACTIVE_CONTRACT' ? 'selected' : ''}>Tiểu thương có hợp đồng đang hiệu lực</option></select></div>` : ''}<div class="note ${preview.recipients.length ? 'info' : 'warn'}">${preview.recipients.length ? 'Người nhận dự kiến: <b>' + preview.recipients.length + ' người</b>' : 'Không tìm thấy người nhận phù hợp.'}</div><div class="field notification-manual-channels"><label>Kênh gửi *</label><div class="row notification-channel-list">${CHANNELS.map(c => `<label><input type="checkbox" class="notification-manual-channel" value="${c}" ${(draft.channels || []).includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div></div></section><div class="divider"></div><section class="notification-manual-section"><h4>NỘI DUNG THÔNG BÁO</h4><div class="field"><label>Tiêu đề *</label><input class="input" data-in="notification-manual-title" value="${U.esc(draft.title)}"></div><div class="field"><label>Nội dung *</label><textarea class="input notification-manual-body" data-in="notification-manual-body" rows="7">${U.esc(draft.body)}</textarea></div></section><div class="notification-manual-actions">${canSend ? '<button class="btn" data-act="notification-manual-preview">Xem trước</button><button class="btn primary" data-act="notification-manual-send">Gửi thông báo</button>' : ''}</div></div></section>`;
  }
  document.addEventListener('change', e => { if (!e.target) return; if (e.target.classList && e.target.classList.contains('notification-manual-recipient')) { ui.notificationManualDraft.recipientGroups = Array.from(document.querySelectorAll('.notification-manual-recipient:checked')).map(x => x.value); A.render(); } if (e.target.classList && e.target.classList.contains('notification-manual-channel')) ui.notificationManualDraft.channels = Array.from(document.querySelectorAll('.notification-manual-channel:checked')).map(x => x.value); if (e.target.id === 'notification-manual-trader-condition') { ui.notificationManualDraft.traderCondition = e.target.value; A.render(); } });
  // Create mode is an in-memory draft: cancelling never creates or mutates a rule.
  function automaticTabV3() {
    const rules = normalizeTriggerTypes(), canEdit = A.canDo('thong-bao.gui', ui.market);
    return `<div class="notification-info"><span>Phạm vi áp dụng: <b>Toàn bộ 12 chợ thuộc Tổ Quản lý chợ</b>. Quy tắc tự động được kích hoạt theo mốc lịch nghiệp vụ hoặc sự kiện nghiệp vụ trong workflow thu phí.</span></div>${billingScheduleCard(canEditSchedule())}<section class="card notification-rules-workspace"><div class="card-b">${autoListV3(rules, canEdit)}</div></section>`;
  }
  A.ACT['notification-rule-new'] = () => {
    if (!A.canDo('thong-bao.gui', ui.market)) return U.toast('Bạn chưa có quyền tạo quy tắc thông báo.');
    ui.notificationRulePreviousId = ui.notificationRuleId || '';
    ui.notificationRuleDraft = { eventKey:'DRAFT_RULE', label:'', triggerType:'PERIOD_MILESTONE', triggerEvent:'REMINDER_1', trigger:'Nhắc thanh toán lần 1', enabled:true, marketIds:[], recipientMode:'unpaid_traders', recipients:['trader'], channels:['Mini app'], templates:{trader:t('', '')}, isNew:true };
    A.modal(A.mHead('TẠO QUY TẮC TỰ ĐỘNG') + `<div class="modal-b">${ruleDetailV3(ui.notificationRuleDraft, normalizeTriggerTypes(), true)}</div>`);
  };
  A.ACT['notification-rule-cancel'] = () => { if (ui.notificationRuleDraft) { ui.notificationRuleDraft = null; ui.notificationRuleId = ui.notificationRulePreviousId || ''; ui.notificationRulePreviousId = ''; } else ui.notificationRuleId = ''; A.render(); };
  A.ACT['notification-rule-save'] = el => {
    const draft = ui.notificationRuleDraft, rule = draft || eventByKey(el.dataset.id);
    if (!rule || !A.canDo('thong-bao.gui', ui.market)) return;
    const channels = Array.from(document.querySelectorAll('.notification-rule-channel:checked')).map(x => x.value);
    if (!channels.length) return U.toast('Vui lòng chọn ít nhất một kênh gửi.');
    const triggerType = A.$('#notification-rule-trigger-type').value;
    rule.label = A.$('#notification-rule-label').value.trim();
    if (!rule.label) return U.toast('Vui lòng nhập tên quy tắc.');
    rule.triggerType = triggerType;
    if (triggerType === 'PERIOD_MILESTONE') { rule.triggerEvent = A.$('#notification-rule-trigger').value; rule.trigger = (PERIOD_TRIGGERS.find(x => x[2] === rule.triggerEvent) || [,''])[1]; }
    else { const source = eventByKey(A.$('#notification-rule-system-event').value); rule.triggerEvent = ''; rule.systemEventKey = source && source.eventKey; rule.trigger = source ? source.label : ''; }
    const marketField = A.$('#notification-rule-market');
    // Rule chuẩn luôn dùng chung toàn bộ 12 chợ; custom rule mới có thể tự chọn phạm vi.
    rule.marketIds = marketField ? (marketField.value ? [marketField.value] : []) : [];
    rule.recipientMode = (A.$('#notification-rule-recipient') || {}).value || rule.recipientMode; rule.channels = channels;
    rule.templates = Object.assign({}, rule.templates || {}, { default:t(A.$('#notification-rule-title').value.trim(), A.$('#notification-rule-body').value.trim()) });
    rule.status = rule.enabled === false ? 'DISABLED' : 'ENABLED'; rule.updatedAt = U.today() + ' ' + U.nowTime(); rule.updatedBy = ((A.currentAccount() || {}).fullName || (A.currentAccount() || {}).code || 'Hệ thống'); rule.isNew = false;
    if (draft) { rule.eventKey = 'CUSTOM_RULE_' + Date.now(); A.db.notificationEventConfigs.push(rule); ui.notificationRuleDraft = null; ui.notificationRuleId = rule.eventKey; ui.notificationRulePreviousId = ''; }
    A.save(); A.closeModal(); A.render(); U.toast('Đã lưu thay đổi quy tắc thông báo.');
  };
  document.addEventListener('change', e => { if (!e.target || e.target.id !== 'notification-rule-trigger-type' || !ui.notificationRuleDraft) return; const rule = ui.notificationRuleDraft; rule.triggerType = e.target.value; if (rule.triggerType === 'PERIOD_MILESTONE') { rule.triggerEvent = rule.triggerEvent || 'REMINDER_1'; rule.trigger = (PERIOD_TRIGGERS.find(x => x[2] === rule.triggerEvent) || [,''])[1]; } else rule.triggerEvent = ''; A.render(); });
  // Lịch kỳ thu dùng trực tiếp billingCycle: quy tắc chỉ giữ reference mốc, không sao chép ngày.
  function scheduleOrderError(d) {
    if (d.preparationDate > d.meterReadDate) return 'Chuẩn bị kỳ phải diễn ra trước hoặc cùng ngày ghi chỉ số điện, nước.';
    if (d.meterReadDate > d.startDate) return 'Ghi chỉ số điện, nước phải diễn ra trước hoặc cùng ngày bắt đầu thu.';
    if (d.startDate >= d.reminder1Date) return 'Nhắc thanh toán lần 1 phải sau ngày bắt đầu thu.';
    if (d.reminder1Date >= d.reminder2Date) return 'Nhắc thanh toán lần 2 phải sau nhắc thanh toán lần 1.';
    if (d.reminder2Date > d.dueDate) return 'Hạn thanh toán phải cùng hoặc sau nhắc thanh toán lần 2.';
    return '';
  }
  function scheduleEditModal() {
    const cycle = A.SERVICE_CFG.cycle(), editable = canEditSchedule(), disabled = editable ? '' : 'disabled';
    const rows = BILLING_MILESTONES.map(x => `<div class="notification-schedule-edit-row"><b>${x[1]}</b><select class="input" data-schedule-day="${x[2]}" ${disabled}>${Array.from({length:31}, (_, i) => `<option value="${i + 1}" ${Number(cycle[x[2]]) === i + 1 ? 'selected' : ''}>Ngày ${U.pad(i + 1,2)}</option>`).join('')}</select><select class="input" data-schedule-month="${x[3]}" ${disabled}>${['previous','current','next'].map(v => `<option value="${v}" ${cycle[x[3]] === v ? 'selected' : ''}>${scheduleMonth(v)}</option>`).join('')}</select></div>`).join('');
    A.modal(A.mHead('CHỈNH SỬA LỊCH NGHIỆP VỤ') + `<div class="modal-b"><div class="note info">Lịch kỳ thu hàng tháng là template dùng chung cho các chợ. Hệ thống tự tạo kỳ thu theo lịch khi tới mốc Chuẩn bị kỳ; mỗi kỳ lưu snapshot ngày tại thời điểm tạo — sửa lịch chỉ áp dụng cho các kỳ tạo sau.</div><div class="field"><label>Tên lịch</label><input class="input" value="Lịch kỳ thu hàng tháng" disabled></div><div class="field"><label>Loại lịch</label><input class="input" value="Kỳ thu · Hàng tháng" disabled></div><div class="notification-schedule-edit-list">${rows}</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${editable ? '<button class="btn primary" data-act="notification-schedule-save">Lưu lịch</button>' : ''}</div>`);
  }
  A.ACT['notification-schedule-detail'] = () => scheduleEditModal();
  A.ACT['notification-schedule-edit'] = () => { if (canEditSchedule()) scheduleEditModal(); else U.toast('Bạn chưa được cấp quyền chỉnh Lịch nghiệp vụ.'); };
  A.ACT['notification-schedule-save'] = () => {
    if (!canEditSchedule()) return U.toast('Bạn chưa được cấp quyền chỉnh Lịch nghiệp vụ.');
    const patch = {};
    document.querySelectorAll('[data-schedule-day]').forEach(el => { patch[el.dataset.scheduleDay] = Number(el.value) || 1; });
    document.querySelectorAll('[data-schedule-month]').forEach(el => { patch[el.dataset.scheduleMonth] = el.value; });
    if (patch.meterReadDay) patch.meterCutoffDay = patch.meterReadDay;
    // Thứ tự mốc (giữ nguyên quy tắc của trình thiết lập lịch trước đây): kiểm tra trên tháng mẫu kế tiếp.
    const svc = A.features.finance && A.features.finance.marketPeriod, sample = U.today().slice(0, 7);
    const error = svc ? scheduleOrderError(svc.scheduleDates(sample, Object.assign({}, A.SERVICE_CFG.cycle(), patch))) : '';
    if (error) return U.toast(error);
    A.SERVICE_CFG.updateCycle(patch, (A.currentAccount() || {}).fullName || '', 'Cập nhật Lịch kỳ thu hàng tháng từ Thông báo đa kênh');
    A.closeModal(); A.render(); U.toast('Đã lưu Lịch kỳ thu hàng tháng.');
  };
  A.ACT['notification-open-period-monitor'] = () => A.go('theo-doi-ky-thu');
  A.ACT['notification-open-schedule'] = () => { ui.notificationTab = 'auto'; A.go('thong-bao'); };
  // v3 automatic-rule workspace: rule owns its trigger and recipient context; no intermediate schedule entity is exposed.
  const notificationEventOptions = () => ensureEvents().filter(r => r.triggerType === 'EVENT' && ['RECEIVABLE_ISSUED','PAYMENT_SUCCESS','MARKET_COLLECTION_COMPLETED','MARKET_RECONCILED','PERIOD_CLOSED'].includes(r.eventKey));
  const recipientTextV3 = r => (r.recipients || []).map(x => RECIPIENT_GROUP_LABEL[(x && x.actorGroup) || x] || x.actorGroup || x).join(', ');
  const triggerTextV3 = r => r.triggerType === 'TIME' ? `Ngày ${r.time.day} · ${r.time.month === 'previous' ? 'tháng trước kỳ thu' : r.time.month === 'next' ? 'tháng kế tiếp' : 'tháng của kỳ thu'} · ${r.time.at}` : 'Khi ' + (r.trigger || 'có sự kiện phát sinh');
  function ruleFormV3(rule, readOnly) {
    const disabled = readOnly ? 'disabled' : '', isTime = rule.triggerType !== 'EVENT', tpl = (rule.templates && (rule.templates.default || Object.values(rule.templates)[0])) || t('', '');
    const recipients = (rule.recipients || []).map(x => x.actorGroup);
    const scopeMode = rule.scopeMode || ((rule.marketIds || []).length ? 'SELECTED' : 'ALL'), selectedMarkets = rule.marketIds || [];
    const condition = group => (rule.recipients || []).find(x => x.actorGroup === group)?.condition || DEFAULT_CONDITION[group] || '';
    const eventOptions = notificationEventOptions().map(x => `<option value="${x.eventKey}" ${(rule.systemEventKey || rule.eventKey) === x.eventKey ? 'selected' : ''}>${U.esc(x.label)}</option>`).join('');
    const recipientChecks = RECIPIENT_GROUPS.map(([id, label]) => `<label><input class="notification-recipient" type="checkbox" value="${id}" ${recipients.includes(id) ? 'checked' : ''} ${disabled}> ${label}</label>`).join('<br>');
    const recipientSummary = recipients.length ? `${recipients.length} nhóm đã chọn` : 'Chọn nhóm nhận';
    const marketSummary = selectedMarkets.length ? `${selectedMarkets.length} chợ đã chọn` : 'Chọn chợ áp dụng';
    const selectedConditions = (rule.recipients || []).filter(x => ['TRADER','FEE_COLLECTOR','TECHNICAL_STAFF'].includes(x.actorGroup)).map(x => `<div class="field"><label>${x.actorGroup === 'TRADER' ? 'Phạm vi tiểu thương' : x.actorGroup === 'FEE_COLLECTOR' ? 'Phạm vi NV thu phí' : 'Phạm vi NV kỹ thuật'}</label><select class="input notification-recipient-condition" data-group="${x.actorGroup}" ${disabled}>${Object.entries(CONDITION_LABEL).filter(([k]) => x.actorGroup === 'TRADER' ? ['ALL_RELATED','HAS_ACTIVE_CONTRACT','HAS_ISSUED_RECEIVABLE','HAS_UNPAID_RECEIVABLE','JUST_PAID','CONTRACT_EXPIRING'].includes(k) : x.actorGroup === 'FEE_COLLECTOR' ? ['ASSIGNED_TO_EVENT_MARKET','ALL_COLLECTORS'].includes(k) : ['ASSIGNED_TO_INCIDENT','ALL_TECHNICIANS'].includes(k)).map(([k,v]) => `<option value="${k}" ${condition(x.actorGroup) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('');
    return `<section class="notification-rule-detail"><div class="notification-panel-head"><h3>${rule.isNew ? 'TẠO THÔNG BÁO TỰ ĐỘNG' : 'CHỈNH SỬA THÔNG BÁO TỰ ĐỘNG'}</h3>${ruleStatus(rule)}</div><div class="notification-form">
      <h4>A. CẤU HÌNH CHUNG</h4><div class="field"><label>Tên cấu hình *</label><input class="input" id="notification-rule-label-v3" value="${U.esc(rule.label || '')}" ${disabled}><div class="small muted">Tên dùng để quản lý cấu hình trong hệ thống, người nhận không nhìn thấy nội dung này.</div></div>
      <div class="field"><label>Cách gửi *</label><select class="input" id="notification-rule-trigger-type-v3" ${disabled}><option value="TIME" ${isTime ? 'selected' : ''}>Gửi theo lịch</option><option value="EVENT" ${!isTime ? 'selected' : ''}>Gửi tự động khi có phát sinh</option></select></div>
      <h4>B. THỜI ĐIỂM GỬI</h4>${isTime ? `<div class="field"><label>Ngày *</label><input class="input" id="notification-rule-day-v3" type="number" min="1" max="31" value="${rule.time.day}" ${disabled}></div><div class="field"><label>Thuộc tháng *</label><select class="input" id="notification-rule-month-v3" ${disabled}>${[['previous','Tháng trước kỳ thu'],['current','Tháng của kỳ thu'],['next','Tháng kế tiếp']].map(x => `<option value="${x[0]}" ${rule.time.month === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></div><div class="field"><label>Giờ gửi *</label><input class="input" id="notification-rule-time-v3" type="time" value="${U.esc(rule.time.at || '08:00')}" ${disabled}></div>` : `<div class="field"><label>Khi xảy ra *</label><select class="input" id="notification-rule-event-v3" ${disabled}>${eventOptions}</select></div>`}
      <h4>C. PHẠM VI ÁP DỤNG</h4><div class="field"><label><input type="radio" name="notification-rule-scope-v3" value="ALL" ${scopeMode === 'ALL' ? 'checked' : ''} ${disabled}> Tất cả ${A.D.MARKETS.length} chợ</label><br><label><input type="radio" name="notification-rule-scope-v3" value="SELECTED" ${scopeMode === 'SELECTED' ? 'checked' : ''} ${disabled}> Chọn chợ cụ thể</label></div>${scopeMode === 'SELECTED' ? `<div class="field"><label>Chợ áp dụng *</label><details class="notification-multi"><summary>${marketSummary}</summary><div class="notification-channel-list">${A.D.MARKETS.map(m => `<label><input class="notification-rule-market-v3" type="checkbox" value="${m.id}" ${selectedMarkets.includes(m.id) ? 'checked' : ''} ${disabled}> ${U.esc(m.name)}</label><br>`).join('')}</div></details></div>` : ''}
      <h4>D. ĐỐI TƯỢNG NHẬN</h4><div class="field"><label>Đối tượng nhận *</label><details class="notification-multi"><summary>${recipientSummary}</summary><div class="notification-channel-list">${recipientChecks}</div></details></div>${selectedConditions}
      <h4>E. KÊNH GỬI</h4><div class="notification-channel-list">${CHANNELS.map(c => `<label><input class="notification-rule-channel" type="checkbox" value="${c}" ${(rule.channels || []).includes(c) ? 'checked' : ''} ${disabled}> ${c}</label>`).join('')}</div><div class="small muted">Các kênh hiện được mô phỏng trong prototype.</div>
      <h4>F. NỘI DUNG</h4><div class="field"><label>Tiêu đề thông báo *</label><input class="input" id="notification-rule-title-v3" value="${U.esc(tpl.title || '')}" ${disabled}></div><div class="field"><label>Nội dung *</label><textarea class="input" id="notification-rule-body-v3" rows="5" ${disabled}>${U.esc(tpl.body || '')}</textarea><div class="small muted">Thông tin có thể chèn</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="notification-insert-token" data-token="period">Kỳ thu</button><button class="btn sm" data-act="notification-insert-token" data-token="marketName">Tên chợ</button><button class="btn sm" data-act="notification-insert-token" data-token="traderName">Tên tiểu thương</button><button class="btn sm" data-act="notification-insert-token" data-token="amount">Số tiền</button><button class="btn sm" data-act="notification-insert-token" data-token="dueDate">Hạn thanh toán</button><button class="btn sm" data-act="notification-insert-token" data-token="receiptCode">Mã biên lai</button></div></div>
      <h4>F. TRẠNG THÁI</h4><div class="notification-rule-status-control"><label class="notification-switch"><input id="notification-rule-enabled-v3" type="checkbox" ${rule.enabled === false ? '' : 'checked'} ${disabled}><span class="notification-switch-track" aria-hidden="true"></span><span id="notification-rule-enabled-text-v3" class="tag ${rule.enabled === false ? '' : 'ok'}">${rule.enabled === false ? 'Đang tắt' : 'Đang bật'}</span></label><div class="small muted">Khi tắt, quy tắc sẽ không tự động gửi thông báo.</div></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${readOnly ? '' : `<button class="btn primary" data-act="notification-rule-save-v3" data-id="${rule.eventKey}">Lưu</button>`}</div></section>`;
  }
  function openRuleFormV3(rule) { ui.notificationRuleEditing = rule; A.modal(A.mHead(rule.isNew ? 'TẠO QUY TẮC THÔNG BÁO' : 'CHỈNH SỬA QUY TẮC') + `<div class="modal-b">${ruleFormV3(rule, false)}</div>`, true); }
  const scopeTextV3 = r => (r.scopeMode || (!(r.marketIds || []).length ? 'ALL' : 'SELECTED')) === 'ALL' ? `Tất cả ${A.D.MARKETS.length} chợ` : `${(r.marketIds || []).length} chợ đã chọn`;
  const recipientConditionsTextV3 = r => (r.recipients || []).filter(x => x && x.condition && DEFAULT_CONDITION[x.actorGroup] !== x.condition).map(x => CONDITION_LABEL[x.condition] || x.condition).join(', ') || 'Theo phạm vi áp dụng';
  function autoListV4() { const rules = ensureEvents(), canEdit = A.canDo('thong-bao.gui', ui.market); return `<section class="card notification-rules-workspace"><div class="card-b"><div class="notification-panel-head"><h3>QUY TẮC THÔNG BÁO TỰ ĐỘNG</h3>${canEdit ? '<button class="btn primary" data-act="notification-rule-new-v3">Tạo quy tắc</button>' : ''}</div>${U.table([{t:'Tên cấu hình'},{t:'Cách gửi'},{t:'Phạm vi áp dụng'},{t:'Người nhận'},{t:'Kênh gửi'},{t:'Trạng thái'},{t:'Thao tác'}], rules.map(r => `<tr><td><b>${U.esc(r.label)}</b></td><td>${U.esc(r.triggerType === 'TIME' ? 'Gửi theo lịch' : 'Gửi tự động khi có phát sinh')}</td><td>${U.esc(scopeTextV3(r))}</td><td>${U.esc(recipientTextV3(r))}</td><td>${U.esc((r.channels || []).join(', '))}</td><td>${ruleStatus(r)}</td><td><button class="btn sm" data-act="notification-rule-detail-v3" data-id="${r.eventKey}">Xem</button></td></tr>`), {empty:'Chưa có quy tắc thông báo tự động.'})}</div></section>`; }
  A.ACT['notification-rule-new-v3'] = () => { if (!A.canDo('thong-bao.gui', ui.market)) return; openRuleFormV3({ eventKey:'DRAFT_RULE', label:'', triggerType:'TIME', triggerEvent:'REMINDER_1', time:{day:1,month:'next',at:'08:00'}, recipients:[], channels:['Web app quản lý','Zalo'], templates:{default:t('', '')}, enabled:true, status:'ENABLED', isNew:true }); };
  A.ACT['notification-rule-detail-v3'] = el => { const rule = eventByKey(el.dataset.id); if (!rule) return; const canEdit = A.canDo('thong-bao.gui', ui.market), tpl = (rule.templates && (rule.templates.default || Object.values(rule.templates)[0])) || t('', ''); A.modal(A.mHead('THÔNG TIN QUY TẮC') + `<div class="modal-b"><dl class="kv"><dt>Tên cấu hình</dt><dd>${U.esc(rule.label)}</dd><dt>Trạng thái</dt><dd>${ruleStatus(rule)}</dd><dt>Cách gửi</dt><dd>${rule.triggerType === 'TIME' ? 'Gửi theo lịch' : 'Gửi tự động khi có phát sinh'}</dd><dt>Thời gian / Khi xảy ra</dt><dd>${U.esc(triggerTextV3(rule))}</dd><dt>Phạm vi áp dụng</dt><dd>${U.esc(scopeTextV3(rule))}</dd><dt>Đối tượng nhận</dt><dd>${U.esc(recipientTextV3(rule))}</dd><dt>Điều kiện người nhận</dt><dd>${U.esc(recipientConditionsTextV3(rule))}</dd><dt>Kênh gửi</dt><dd>${U.esc((rule.channels || []).join(' · '))}</dd></dl><h4>NỘI DUNG</h4><p><b>${U.esc(tpl.title)}</b></p><p style="white-space:pre-wrap">${U.esc(tpl.body)}</p><dl class="kv"><dt>Cập nhật lần cuối</dt><dd>${U.esc(rule.updatedAt || '—')}</dd><dt>Người cập nhật</dt><dd>${U.esc(rule.updatedBy || '—')}</dd></dl></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button>${canEdit ? `<button class="btn" data-act="notification-rule-toggle" data-id="${rule.eventKey}">${rule.enabled === false ? 'Bật quy tắc' : 'Tắt quy tắc'}</button><button class="btn primary" data-act="notification-rule-edit-v3" data-id="${rule.eventKey}">Chỉnh sửa</button>` : ''}</div>`, true); };
  A.ACT['notification-rule-edit-v3'] = el => { const rule = eventByKey(el.dataset.id); if (rule) openRuleFormV3(rule); };
  A.ACT['notification-insert-token'] = el => { const field = A.$('#notification-rule-body-v3'); if (!field) return; const token = '{' + el.dataset.token + '}'; const start = field.selectionStart == null ? field.value.length : field.selectionStart, end = field.selectionEnd == null ? start : field.selectionEnd; field.value = field.value.slice(0, start) + token + field.value.slice(end); field.focus(); field.selectionStart = field.selectionEnd = start + token.length; };
  A.ACT['notification-rule-save-v3'] = el => { const rule = ui.notificationRuleEditing; if (!rule || !A.canDo('thong-bao.gui', ui.market)) return; const recipients = Array.from(document.querySelectorAll('.notification-recipient:checked')).map(x => ({ actorGroup:x.value, condition:(document.querySelector('.notification-recipient-condition[data-group="' + x.value + '"]') || {}).value || DEFAULT_CONDITION[x.value] || 'CURRENT_MARKET' })); const channels = Array.from(document.querySelectorAll('.notification-rule-channel:checked')).map(x => x.value), type = A.$('#notification-rule-trigger-type-v3').value, label = A.$('#notification-rule-label-v3').value.trim(), title = A.$('#notification-rule-title-v3').value.trim(), body = A.$('#notification-rule-body-v3').value.trim(), scopeMode = (document.querySelector('input[name="notification-rule-scope-v3"]:checked') || {}).value || 'ALL', marketIds = Array.from(document.querySelectorAll('.notification-rule-market-v3:checked')).map(x => x.value), enabled = !!(A.$('#notification-rule-enabled-v3') || {}).checked; if (!label || !recipients.length || !channels.length || !title || !body) return U.toast('Vui lòng nhập đủ Tên cấu hình, đối tượng nhận, kênh gửi, tiêu đề và nội dung.'); if (scopeMode === 'SELECTED' && !marketIds.length) return U.toast('Vui lòng chọn ít nhất một chợ áp dụng.'); if (type === 'TIME') { const day = Number(A.$('#notification-rule-day-v3').value), month = A.$('#notification-rule-month-v3').value, at = A.$('#notification-rule-time-v3').value; if (!day || day > 31 || !month || !at) return U.toast('Vui lòng nhập đủ Ngày, Thuộc tháng và Giờ gửi.'); Object.assign(rule, { triggerType:'TIME', time:{day, month, at} }); } else { const key = A.$('#notification-rule-event-v3').value, event = notificationEventOptions().find(x => x.eventKey === key); if (!event) return U.toast('Vui lòng chọn thời điểm phát sinh.'); Object.assign(rule, { triggerType:'EVENT', systemEventKey:key, trigger:event.label }); } Object.assign(rule, { label, recipients, channels, templates:{default:t(title, body)}, enabled, status:enabled ? 'ENABLED' : 'DISABLED', workflowSchema:2, scopeMode, marketIds:scopeMode === 'ALL' ? [] : marketIds, isNew:false, updatedAt:U.today() + ' ' + U.nowTime(), updatedBy:(A.currentAccount() || {}).fullName || 'Hệ thống' }); if (rule.eventKey === 'DRAFT_RULE') { rule.eventKey = 'CUSTOM_RULE_' + Date.now(); A.db.notificationEventConfigs.push(rule); } A.save(); A.closeModal(); A.render(); U.toast('Đã lưu quy tắc thông báo.'); };
  function retainRuleFormV3(rule) {
    const pick = sel => A.$(sel), label = pick('#notification-rule-label-v3'), title = pick('#notification-rule-title-v3'), body = pick('#notification-rule-body-v3'), type = pick('#notification-rule-trigger-type-v3');
    if (label) rule.label = label.value;
    if (title || body) rule.templates = { default:t(title ? title.value : '', body ? body.value : '') };
    if (type) rule.triggerType = type.value;
    rule.channels = Array.from(document.querySelectorAll('.notification-rule-channel:checked')).map(x => x.value);
    rule.marketIds = Array.from(document.querySelectorAll('.notification-rule-market-v3:checked')).map(x => x.value);
    const scope = document.querySelector('input[name="notification-rule-scope-v3"]:checked'); if (scope) rule.scopeMode = scope.value;
    const enabled = pick('#notification-rule-enabled-v3'); if (enabled) rule.enabled = enabled.checked;
    if (rule.triggerType === 'TIME') { const day = pick('#notification-rule-day-v3'), month = pick('#notification-rule-month-v3'), at = pick('#notification-rule-time-v3'); if (day && month && at) rule.time = { day:Number(day.value) || 1, month:month.value, at:at.value || '08:00' }; }
    else { const event = pick('#notification-rule-event-v3'); if (event) rule.systemEventKey = event.value; }
  }
  document.addEventListener('change', e => { if (!e.target || !ui.notificationRuleEditing) return; const rule = ui.notificationRuleEditing; if (e.target.id === 'notification-rule-enabled-v3') { const text = A.$('#notification-rule-enabled-text-v3'), on = e.target.checked; if (text) { text.textContent = on ? 'Đang bật' : 'Đang tắt'; text.classList.toggle('ok', on); } } if (e.target.id === 'notification-rule-trigger-type-v3') { retainRuleFormV3(rule); if (rule.triggerType === 'TIME') rule.time = rule.time || {day:1,month:'current',at:'08:00'}; openRuleFormV3(rule); } if (e.target.name === 'notification-rule-scope-v3') { retainRuleFormV3(rule); openRuleFormV3(rule); } if (e.target.classList && e.target.classList.contains('notification-recipient')) { retainRuleFormV3(rule); const groups = Array.from(document.querySelectorAll('.notification-recipient:checked')).map(x => x.value), before = new Map((rule.recipients || []).map(x => [x.actorGroup, x.condition])); rule.recipients = groups.map(actorGroup => ({ actorGroup, condition:before.get(actorGroup) || DEFAULT_CONDITION[actorGroup] || 'CURRENT_MARKET' })); if (groups.includes('TRADER') && !rule.channels.includes('Web app tiểu thương')) rule.channels.push('Web app tiểu thương'); if (groups.some(x => x !== 'TRADER') && !rule.channels.includes('Web app quản lý')) rule.channels.push('Web app quản lý'); openRuleFormV3(rule); } });
  // Route/thẻ cũ "Cấu hình lịch thu" nay được thay bằng workspace này; header mô tả rõ quan hệ lịch → rule.
  // ==================== BỘ PHÁT THÔNG BÁO TỰ ĐỘNG (prototype: kênh gửi mô phỏng) ====================
  // Mỗi lần gửi = 1 bản ghi A.db.notifications có notificationKey chống trùng (theo mốc/sự kiện + kỳ của chợ + người nhận,
  // không phụ thuộc quy tắc nên 2 quy tắc trùng mốc không gửi lặp). Người nhận theo mốc (quyết định nghiệp vụ):
  //   Chuẩn bị kỳ → Tổ trưởng + NV thu phí · Ghi chỉ số → NV thu phí · Mở kỳ → Tổ trưởng + NV + Tiểu thương có hợp đồng áp dụng
  //   Nhắc thanh toán / Hạn thanh toán → chỉ Tiểu thương còn khoản chưa thanh toán (kỳ đã phát hành, đang thu).
  const MILESTONE_RECIPIENTS = { PREPARATION: ['market_manager', 'fee_collector'], METER_READ: ['fee_collector'], COLLECTION_START: ['market_manager', 'fee_collector', 'contract_traders'],
    REMINDER_1: ['unpaid_traders'], REMINDER_2: ['unpaid_traders'], DUE_DATE: ['unpaid_traders'] };
  const RECIPIENT_TEXT = { market_manager: 'Tổ trưởng / Trưởng Ban quản lý', fee_collector: 'NV thu phí phụ trách chợ', contract_traders: 'Tiểu thương có hợp đồng áp dụng trong kỳ', unpaid_traders: 'Tiểu thương còn khoản chưa thanh toán', trader: 'Tiểu thương có khoản vừa phát hành', central_accountant: 'Kế toán Trung tâm' };
  function milestoneRecipientText(milestone) { return (MILESTONE_RECIPIENTS[milestone] || []).map(k => RECIPIENT_TEXT[k]).join(' + ') || '—'; }
  // Sự kiện nghiệp vụ đã có nguồn phát trong prototype.
  const WIRED_EVENTS = new Set(['RECEIVABLE_ISSUED', 'PAYMENT_SUCCESS', 'PERIOD_FULLY_COLLECTED', 'RECONCILIATION_COMPLETED']);
  function ruleWired(rule) { return rule.triggerType === 'PERIOD_MILESTONE' ? !!MILESTONE_RECIPIENTS[rule.triggerEvent] : WIRED_EVENTS.has(rule.systemEventKey || rule.eventKey); }
  const fillText = (text, data) => String(text || '').replace(/\{([A-Za-z]+)\}/g, (_, k) => data[k] == null ? '{' + k + '}' : String(data[k]));
  const staffOf = (market, role) => A.ACCOUNTS.currentList().filter(a => A.ACCOUNTS.primaryRole(a) === role && A.ACCOUNTS.isActive(a) && A.allowedMarkets(a).includes(market));
  function recipientsFor(kind, mp) {
    const svc = A.features.finance.marketPeriod, tr = id => { const t = A.idx.trader.get(id) || {}; return { type: 'TRADER', id, name: t.name || id, role: 'trader' }; };
    if (kind === 'market_manager') return staffOf(mp.marketId, 'market_manager').map(a => ({ type: 'MARKET_MANAGER', id: a.id, name: a.fullName, role: 'market_manager' }));
    if (kind === 'fee_collector') { const c = A.ACCOUNTS.getMarketCollector && A.ACCOUNTS.getMarketCollector(mp.marketId); return c ? [{ type: 'FEE_COLLECTOR', id: c.id, name: c.fullName, role: 'fee_collector' }] : []; }
    if (kind === 'central_accountant') return A.ACCOUNTS.currentList().filter(a => A.ACCOUNTS.primaryRole(a) === 'central_accountant' && A.ACCOUNTS.isActive(a) && A.allowedMarkets(a).includes(mp.marketId)).map(a => ({ type: 'ACCOUNTANT', id: a.id, name: a.fullName, role: 'accountant' }));
    if (kind === 'contract_traders') return Array.from(new Set(svc.contracts(mp).map(c => c.traderId).filter(Boolean))).map(tr);
    if (kind === 'unpaid_traders') return svc.canCollect(mp) ? Array.from(new Set(svc.invoices(mp).filter(i => i.status !== 'paid').map(i => i.traderId))).map(tr) : [];
    return [];
  }
  function recipientsForEntry(entry, mp, ctx) {
    const group = (entry && entry.actorGroup) || entry, condition = (entry && entry.condition) || '';
    if (group === 'TRADER') {
      if ((condition === 'JUST_PAID' || condition === 'HAS_ISSUED_RECEIVABLE') && ctx && ctx.traderId) { const x = A.idx.trader.get(ctx.traderId) || {}; return [{ type:'TRADER', id:ctx.traderId, name:x.name || ctx.traderId, role:'trader' }]; }
      if (condition === 'HAS_ISSUED_RECEIVABLE') { const ids = Array.from(new Set(A.features.finance.marketPeriod.invoices(mp).map(i => i.traderId))); return ids.map(id => { const x = A.idx.trader.get(id) || {}; return { type:'TRADER', id, name:x.name || id, role:'trader' }; }); }
      if (condition === 'HAS_UNPAID_RECEIVABLE') return recipientsFor('unpaid_traders', mp);
      return recipientsFor('contract_traders', mp);
    }
    if (group === 'FEE_COLLECTOR') return recipientsFor('fee_collector', mp);
    if (group === 'MARKET_MANAGEMENT_LEADERS') return recipientsFor('market_manager', mp);
    if (group === 'CENTRAL_ACCOUNTANT') return recipientsFor('central_accountant', mp);
    const role = { SYSTEM_ADMIN:'system_admin', CENTER_LEADERSHIP:'ward_leader', TECHNICAL_STAFF:'technician', OFFICE_LEADERS:'office_leader' }[group];
    return role ? staffOf(mp.marketId, role).map(a => ({ type:group, id:a.id, name:a.fullName, role })) : [];
  }
  function pushNotification(rec) {
    A.db.notifications = Array.isArray(A.db.notifications) ? A.db.notifications : [];
    if (A.db.notifications.some(n => n.notificationKey === rec.notificationKey)) return false;
    A.db.notifications.unshift(Object.assign({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), auto: true, sent: 1, delivered: 1, read: 0, deliveryStatus: 'Đã gửi (mô phỏng)', mockDelivery: true }, rec));
    return true;
  }
  function send(rule, kind, recipient, mp, keyParts, extra) {
    const svc = A.features.finance.marketPeriod, mk = U.market(mp.marketId) || {}, tpl = (rule.templates && (rule.templates[recipient.role] || rule.templates.trader || Object.values(rule.templates)[0])) || { title: rule.label, body: '' };
    const unpaid = recipient.type === 'TRADER' ? svc.invoices(mp).filter(i => i.traderId === recipient.id && i.status !== 'paid') : [];
    const data = Object.assign({ period: mp.label || U.per(mp.period), marketName: mk.name || mp.marketId, traderName: recipient.name, collectorName: recipient.name,
      dueDate: U.dmy(svc.dateOf(mp, 'dueDate')), amount: U.money(unpaid.reduce((a, i) => a + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)), 0)), totalAmount: U.money(unpaid.reduce((a, i) => a + Number(i.amount || 0), 0)) }, extra || {});
    return pushNotification({ notificationKey: keyParts.concat([mp.id, recipient.type, recipient.id]).join('|'), eventKey: rule.eventKey, eventConfigKey: rule.eventKey, kind: keyParts[0],
      market: mp.marketId, marketId: mp.marketId, period: mp.period, billingPeriodId: mp.id, recipientType: recipient.type, recipientId: recipient.id, traderId: recipient.type === 'TRADER' ? recipient.id : undefined,
      title: fillText(tpl.title || rule.label, data), body: fillText(tpl.body || '', data), group: recipient.name, channels: rule.channels || ['Web app quản lý'] });
  }
  // Mốc kỳ thu: chạy idempotent khi khởi tạo app cho các kỳ của chợ chưa chốt, có đối tượng thu và đã tới ngày mốc (snapshot).
  A.NOTIFICATIONS.dispatchDueMilestones = function () {
    const svc = A.features && A.features.finance && A.features.finance.marketPeriod;
    if (!svc || !A.db) return 0;
    const rules = normalizeTriggerTypes().filter(r => r.enabled && r.triggerType === 'TIME' && MILESTONE_RECIPIENTS[r.triggerEvent]), today = U.today();
    let n = 0;
    (A.db.billingPeriods || []).filter(mp => mp.marketId && !svc.isClosed(mp) && svc.isApplicable(mp)).forEach(mp => rules.forEach(rule => {
      if ((rule.marketIds || []).length && !rule.marketIds.includes(mp.marketId)) return;
      const date = svc.dateOf(mp, PERIOD_DATE_FIELD[rule.triggerEvent]);
      if (!date || date > today) return;
      (rule.recipients || []).forEach(entry => recipientsForEntry(entry, mp, {}).forEach(r => { if (send(rule, r.role, r, mp, ['MILESTONE', rule.triggerEvent])) n++; }));
    }));
    if (n) A.save();
    return n;
  };
  // Sự kiện nghiệp vụ (Thu đủ 100%, Đối soát hoàn tất, …): gửi cho người nhận nội bộ theo quy tắc đang bật.
  A.NOTIFICATIONS.dispatchEvent = function (eventKey, ctx) {
    const mp = ctx && ctx.period;
    if (!mp || !mp.marketId) return 0;
    const configuredEventKey = LEGACY_RULE_KEYS[eventKey] || eventKey;
    let n = 0;
    ensureEvents().filter(r => r.enabled && (r.eventKey === configuredEventKey || r.systemEventKey === configuredEventKey)).forEach(rule => (rule.recipients || []).forEach(entry => {
      recipientsForEntry(entry, mp, ctx).forEach(r => { if (send(rule, r.role, r, mp, ['EVENT', eventKey, ctx.paymentId || ''], ctx)) n++; });
    }));
    if (n) A.save();
    return n;
  };
  A.VIEWS['thong-bao'] = function () { const tab = ui.notificationTab || 'auto'; return `<section class="notification-page"><div class="notification-page-head"><h2>THÔNG BÁO ĐA KÊNH</h2><p>Quản lý quy tắc tự động theo thời gian hoặc khi có sự kiện phát sinh.</p></div><div class="seg notification-tabs">${notificationTabs().map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-act="notification-tab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>${tab === 'auto' ? autoListV4() : tab === 'manual' ? manualTabWorkspace() : historyTab()}</section>`; };
})(window.APP);
