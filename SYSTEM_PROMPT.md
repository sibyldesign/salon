Sibyl 美業預約排程系統 (Salon) - AI 系統規格書
1. 業務情境與核心原則
專案網址與定位：獨立美業沙龍（剪燙染、美睫美甲、皮膚管理、SPA）線上預約前台 (index.html)、店長管理後台 (admin.html) 與 9:16 空檔展示單頁 (slots.html)，網址託管於 salon.heysibyl.com。

技術棧：原生 HTML5 + Tailwind CSS (CDN) + SweetAlert2 + Supabase (PostgreSQL REST API) + Google Apps Script (GAS 後端 Webhook) + Resend REST API + Supabase Storage。

核心架構與設計哲學：

極致 0 則數營運：LINE 官方帳號所有顧客互動（價目表、最新活動、預約查詢）必須全走 replyToken (Reply API)，禁止呼叫 Push API 扣除付費額度；店家端通知優先使用 PWA Web Push 橫幅與 Resend 郵件備援。

非侵入式資料庫結構：前端寫入 Supabase bookings 時嚴格採用白名單解構，排除所有非資料庫之前端暫存變數（如 custType, staffName），杜絕 Schema Cache 報錯。

數位存證與法律規範：手寫簽名轉為 PNG 直傳私有 Supabase Storage signatures bucket，取得公開 URL 寫入資料庫，並由 Resend API 發送附帶親筆簽名與時間戳記的合約副本至顧客與店家信箱。

莫蘭迪極簡美學：主色調為低飽和大地拿鐵棕（#8C7355 / #7A6246），時段與選項選中時保持高對比深底純白字，未選中維持白底黑字。

2. 資料庫 Schema 清單 (Supabase)
本系統僅使用以下資料表，嚴禁擅自引用非清單內欄位：

stores (店家租戶主檔)：

欄位：id (UUID, PK), store_name, slug, admin_token, admin_pin, industry_type ('beauty'), plan_name, plan_status ('active'|'locked'|'expired'), billing_cycle ('monthly'|'yearly'), expires_at (timestamptz), owner_email, owner_phone, owner_line_name, owner_line_uid, line_channel_token, created_at (timestamptz)

store_settings (營運與功能開關設定)：

欄位：store_id (UUID, PK, FK), display_title, display_subtitle, enable_logo (bool), logo_url, promo_text, promo_imgs (text[]), address, business_hours, booking_buffer_hours (numeric), ig_url, line_url, map_url, care_text, weekly_off_days (int[]), custom_off_dates (text[]), shift_start_time, shift_end_time, shift_interval (int), staff_list (jsonb), staff_schedules (jsonb), care_rules (jsonb), published_slots (jsonb), promo_rules_text (text)

訂金設定：enable_deposit (bool), deposit_mode ('all'|'new_only'), deposit_amount (numeric), deposit_info (text)

契約設定：enable_contract (bool), contract_title (text), contract_content (text)

模組開關：enable_email_copy (bool), enable_audit_booking (bool), enable_staff_select (bool), enable_multi_staff_schedule (bool), enable_carousel (bool), enable_cust_type (bool), enable_portfolio (bool), enable_care (bool), enable_show_price (bool), enable_cust_notes (bool), enable_quick_contact (bool), enable_cancel_reason (bool), enable_line_auto_notify (bool), enable_line_one_click_audit (bool), enable_featured_shop (bool), enable_flex_menu (bool), enable_auto_reminder (bool), enable_wallet (bool), enable_packages (bool), enable_coupons (bool), enable_reviews (bool)

認證更新：line_channel_token (text), updated_at (timestamptz)

services (服務項目)：

欄位：id (UUID, PK), store_id (UUID, FK), service_name, price (text), duration_minutes (int), service_type ('Group_A'|'Group_B'), is_addon (bool), sort_order (int), created_at (timestamptz)

bookings (預約紀錄與合約存證)：

欄位：id (UUID, PK), store_id (UUID, FK), customer_name, customer_phone, customer_type ('old'|'new'), customer_notes, cancel_reason, referrer_name, line_name, service_names, price (numeric), final_price (numeric), notes, staff_id, staff_name, appointment_time (timestamptz), status ('待確認'|'已確認'|'已結單'|'婉拒'|'已取消')

訂金與數位簽章：deposit_reported (bool), deposit_last5 (text), deposit_confirmed (bool), deposit_deducted (numeric), signature_url (text), signed_at (timestamptz), created_at (timestamptz)

customers (會員帳戶與儲值金)：

欄位：id (UUID, PK), store_id (UUID, FK), name, phone, wallet_balance (numeric), member_discount (numeric), created_at (timestamptz)

customer_packages (包卡堂票管理)：

欄位：id (UUID, PK), store_id (UUID, FK), customer_name, phone, service_name, total_times (int), remaining_times (int), created_at (timestamptz)

coupons (活動折扣碼)：

欄位：id (UUID, PK), store_id (UUID, FK), code, discount_type ('cash'|'percent'), discount_value (numeric), is_active (bool), created_at (timestamptz)

customer_reviews (好評審核牆)：

欄位：id (UUID, PK), store_id (UUID, FK), customer_name, rating (int 1-5), tags (text[]), comment, is_approved (bool), created_at (timestamptz)

portfolios (作品展示)：

欄位：id (UUID, PK), store_id (UUID, FK), category, title, link, img_url, sort_order (int), created_at (timestamptz)

system_announcements (全域公告與維護)：

欄位：id (UUID, PK), content, is_maintenance (bool), is_active (bool), created_at (timestamptz)

feature_wishes (功能許願池)：

欄位：id (UUID, PK), store_id (UUID, FK), store_name, content, status, admin_reply, created_at (timestamptz)

3. 儲存空間與發信服務協議 (Storage & Mail)
Supabase Storage：

儲存桶名稱：signatures (Public)。

存放內容：顧客親筆手寫數位簽章 PNG，路徑為 ${SUPABASE_URL}/storage/v1/object/public/signatures/{filename}。

Resend 郵件服務 API：

發信端點：POST [https://api.resend.com/emails](https://api.resend.com/emails)。

發信人：Sibyl 數位管家 <notice@heysibyl.com>。

郵件內容：顧客預約憑證（嵌入條款與簽名圖檔）、店家新訂單即時通報信。

4. 核心 API 清單與溝通協議 (Google Apps Script)
前端與後端透過 POST 呼叫 GAS Webhook，action 規範如下：

submitBooking：

觸發時機：顧客於前台送出預約表單。

處理邏輯：白名單欄位寫入 Supabase bookings，透過 Resend API 發送存證信給客人與老闆；若店家有設定 owner_line_uid 則推播審核卡片。

auditBookingAction：

觸發時機：店長於後台或 LINE 對話框點擊「核准接單」或「婉拒」。

處理邏輯：更新 bookings.status（婉拒寫入 cancel_reason），若顧客具備 LINE UID 則主動發送結果通知。

payuniWebhook：

觸發時機：PAYUNi 扣款成功回調。

處理邏輯：比對店家 Email 或手機，更新 stores.plan_status = 'active' 並自動展延到期日，寄送正式開通信。

LINE Webhook (doPost 監聽)：

管理員綁定：輸入 綁定店家 {storeId} ➔ 寫入 stores.owner_line_uid。

免扣費指令 (Reply API)：

價目表 / 價格 / 服務項目 ➔ 0 則數回傳服務項目輪播 Flex 卡片。

最新活動 / 本月活動 / 查看最新公告 ➔ 0 則數回傳活動圖文 Flex 卡片。

查詢預約 / 確認我的預約 / 預約進度 ➔ 0 則數回傳顧客當前排程卡片。

真人客服 ➔ 0 則數回傳轉接文字。

Postback 審核：接收卡片按鈕之 action=auditBooking&id=...&status=...，變更預約狀態。

dailySubscriptionCheck：

排程作業：每日凌晨 02:00 自動巡檢，逾期自動將 stores.plan_status 標記為 expired。

sendDailyUpcomingReminders：

排程作業：每日早上 08:00~09:00 執行，撈取隔日有效預約，針對具備 LINE UID 之顧客自動推播到來前提醒。
