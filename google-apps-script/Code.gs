
/**
 * GOOGLE APPS SCRIPT BACKEND FOR Q-HOME V2.0
 * Chức năng: Gửi Email thông báo phí, Gửi mã đặt lại mật khẩu, Log báo cáo vào Spreadsheet.
 */

// Cấu hình bảo mật đơn giản (Tùy chọn: Thêm token để xác thực request từ App)
const SHARED_SECRET = "QHOME_SECURE_TOKEN_2024";

/**
 * Xử lý yêu cầu POST từ ứng dụng React
 */
function doPost(e) {
  try {
    let payload;
    let actionType = "";

    // 1. Phân tích dữ liệu đầu vào (Hỗ trợ cả JSON và Form-encoded)
    if (e.postData && e.postData.type === "application/json") {
      payload = JSON.parse(e.postData.contents);
      actionType = payload.action_type || "RESET_PASSWORD";
    } else {
      payload = e.parameter;
      actionType = "NOTIFY_BILL";
    }

    // 2. Định tuyến xử lý theo loại hành động
    switch (actionType) {
      case "RESET_PASSWORD":
        return handleResetPassword(payload);
      
      case "NOTIFY_BILL":
      case "TEST_CONNECTION":
        return handleSendNotification(payload);

      default:
        throw new Error("Hành động không hợp lệ: " + actionType);
    }

  } catch (error) {
    console.error("Lỗi doPost:", error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Gửi lời nhắc nợ định kỳ (Dùng cho Trigger ngày 15/20 hàng tháng)
 * Lưu ý: Để dùng hàm này thực tế, bạn cần tích hợp Firebase Admin SDK hoặc REST API
 */
function scheduledDebtReminder() {
  const now = new Date();
  const date = now.getDate();
  
  if (date !== 15 && date !== 20) return;

  Logger.log("Bắt đầu chạy tiến trình nhắc nợ định kỳ ngày " + date);
  // Thực tế: Query danh sách các căn hộ có nợ từ Firestore/Database
  // Gửi email/notification qua FCM
}

/**
 * Xử lý gửi Email thông báo phí (Có đính kèm PDF nếu có)
 */
function handleSendNotification(data) {
  const recipient = data.email;
  const subject = data.subject || "Thông báo từ Ban Quản Lý";
  const htmlBody = data.htmlBody;
  const senderName = data.senderName || "BQL Chung cư Q-Home";
  
  const options = {
    name: senderName,
    htmlBody: htmlBody
  };

  // Xử lý file đính kèm (PDF base64 từ frontend)
  if (data.attachmentBase64 && data.attachmentName) {
    const bytes = Utilities.base64Decode(data.attachmentBase64);
    const blob = Utilities.newBlob(bytes, 'application/pdf', data.attachmentName);
    options.attachments = [blob];
  }

  // Thực hiện gửi mail
  GmailApp.sendEmail(recipient, subject, "", options);

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Email đã được gửi tới " + recipient
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý gửi link đặt lại mật khẩu
 */
function handleResetPassword(data) {
  const recipient = data.email;
  const resetLink = data.link;

  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #006f3a; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Yêu cầu đặt lại mật khẩu</h2>
      </div>
      <div style="padding: 24px; color: #374151; line-height: 1.6;">
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${recipient}</strong> trên hệ thống Quản lý cư dân Q-Home.</p>
        <p>Vui lòng nhấn vào nút bên dưới để tiến hành đặt lại mật khẩu của bạn:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #006f3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đặt lại Mật khẩu</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này. Link sẽ hết hạn trong vòng 24 giờ.</p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        Đây là email tự động, vui lòng không trả lời.
      </div>
    </div>
  `;

  GmailApp.sendEmail(recipient, "[Q-Home] Yêu cầu khôi phục mật khẩu", "", {
    name: "Hệ thống Q-Home",
    htmlBody: htmlTemplate
  });

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Mã khôi phục đã gửi tới " + recipient
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Hàm hỗ trợ cho Admin: Kiểm tra lịch sử gửi mail
 */
function checkQuota() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log("Số lượng email còn lại trong ngày: " + remaining);
  return remaining;
}
