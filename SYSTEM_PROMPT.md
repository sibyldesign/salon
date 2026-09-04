# Sibyl 美業預約排程系統 (Salon) - AI 系統規格書

## 1. 業務情境與核心原則
- **網址與定位**：本專案為獨立美業沙龍（剪燙染、美甲、美睫、皮膚管理）預約前台 (`index.html`)、店長管理後台 (`admin.html`) 與空檔展示單頁 (`slots.html`)，網址託管於 `salon.heysibyl.com`。
- **技術棧**：原生 HTML5 + Tailwind CSS (CDN) + SweetAlert2 + Supabase (PostgreSQL REST API) + Google Apps Script (GAS 後端)。
- **核心設計哲學**：
  1. **極致 0 成本營運**：LINE 官方帳號所有顧客互動必須全走 `replyToken` (Reply API)，禁止非必要的 Push API 扣訊；老闆端優先使用 PWA Web Push 或免費 Email 備援。
  2. **非侵入式資料庫結構**：前端表單送出至 Supabase `bookings` 時，嚴格採用白名單解構，禁止直接打包含有前端 CamelCase 暫存變數（如 `custType`, `staffName`）的物件，防止 Schema Cache 報錯。
  3. **法式極簡美學**：系統主色調為低飽和大地拿鐵棕（`#8C7355` / `#7A6246`），選取元素時維持高對比深底白字，確保閱讀清晰。

---

## 2. 資料庫 Schema 清單 (Supabase)
本系統僅使用以下表格，嚴禁擅自引用非清單內欄位：

- `stores`：
  - 欄位：`id (UUID)`, `store_name`, `admin_token`, `admin_pin`, `industry_type ('beauty')`, `plan_status ('active'|'locked'|'expired')`, `expires_at`, `owner_email`, `owner_phone`, `owner_line_name`, `owner_line_uid`, `line_channel_token`
- `store_settings`：
  - 欄位：`store_id (PK)`, `display_title`, `display_subtitle`, `enable_logo`, `logo_url`, `promo_text`, `promo_imgs (text[])`, `address`, `business_hours`, `booking_buffer_hours`, `care_text`, `enable_deposit`, `deposit_mode`, `deposit_amount`, `deposit_info`, `weekly_off_days (int[])`, `custom_off_dates (text[])`, `staff_list (jsonb)`, `staff_schedules (jsonb)`, `shift_start_time`, `shift_end_time`, `shift_interval`, `care_rules (jsonb)`, `published_slots (jsonb)`, `enable_wallet`, `enable_packages`, `enable_coupons`, `enable_reviews`, `enable_featured_shop`, `enable_show_price`, `enable_cust_notes`, `enable_quick_contact`, `enable_cancel_reason`, `enable_flex_menu`, `enable_auto_reminder`, `enable_line_auto_notify`, `enable_line_one_click_audit`
- `services`：
  - 欄位：`id (UUID)`, `store_id`, `service_name`, `price (text)`, `duration_minutes (int)`, `service_type ('Group_A'|'Group_B')`, `is_addon (bool)`, `sort_order (int)`
- `bookings`：
  - 欄位：`id (UUID)`, `store_id`, `customer_name`, `customer_phone`, `customer_type ('old'|'new')`, `customer_notes`, `cancel_reason`, `line_name`, `service_names`, `price (numeric)`, `final_price (numeric)`, `notes`, `staff_id`, `staff_name`, `appointment_time (timestamptz)`, `status ('待確認'|'已確認'|'已結單'|'婉拒'|'已取消')`, `deposit_reported (bool)`, `deposit_last5`
- `portfolios`：
  - 欄位：`id (UUID)`, `store_id`, `category`, `title`, `link`, `img_url`, `sort_order`
- `customers` (會員儲值)：
  - 欄位：`id (UUID)`, `store_id`, `name`, `phone`, `wallet_balance (numeric)`, `member_discount (numeric)`
- `customer_packages` (包卡堂票)：
  - 欄位：`id (UUID)`, `store_id`, `customer_name`, `phone`, `service_name`, `total_times (int)`, `remaining_times (int)`
- `coupons` (活動折扣碼)：
  - 欄位：`id (UUID)`, `store_id`, `code`, `discount_type ('cash'|'percent')`, `discount_value (numeric)`, `is_active (bool)`
- `customer_reviews` (好評審核)：
  - 欄位：`id (UUID)`, `store_id`, `customer_name`, `rating (int 1-5)`, `tags (text[])`, `comment`, `is_approved (bool)`
- `system_announcements` (全域公告與維護)：
  - 欄位：`id (UUID)`, `content`, `is_maintenance (bool)`, `is_active (bool)`
- `feature_wishes` (功能許願)：
  - 欄位：`id (UUID)`, `store_id`, `store_name`, `content`, `status`

---

## 3. 核心 API 清單與溝通協議 (Google Apps Script)
前端與後端透過 `POST` 呼叫 GAS Webhook，`action` 定義如下：

1. `submitBooking`：
   - 觸發時機：顧客於前台送出預約表單。
   - 動作：寫入 Supabase、推播審核卡片至老闆個人 LINE、免費寄送 Email 備援至店家信箱、發送副本信至客人信箱。
2. `auditBookingAction`：
   - 觸發時機：店長於後台或 LINE 卡片點擊「核准接單」或「婉拒」。
   - 動作：更新 `bookings.status`，並透過官方 LINE 推播或 Email 通知顧客。
3. `payuniWebhook`：
   - 觸發時機：PAYUNi 交易成功回調。
   - 動作：比對店家 Email 或手機，自動開通 `stores.plan_status = 'active'` 並寄出正式開通信。
4. `LINE Webhook (handleIncomingLineMessage)`：
   - 監聽指令：
     - `綁定店家 {storeId}` ➔ 綁定發送者為店家管理員 (`owner_line_uid`)。
     - `價目表` / `最新活動` / `查詢預約` ➔ 嚴格使用 `replyToken` 呼叫 Reply API，實現 0 則數免費回覆。
5. `dailySubscriptionCheck`：
   - 排程作業：每日凌晨 02:00 自動檢查訂閱到期日，逾期自動標記為 `expired`。
