
/**
 * Q-HOME V2.0 - GOOGLE APPS SCRIPT BACKEND
 * Triển khai: Deploy -> New Deployment -> Web App -> Anyone (Anonymous)
 */

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; // Thay ID trang tính của bạn vào đây

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: "online", version: "2.0" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload = e.postData && e.postData.type === "application/json" 
      ? JSON.parse(e.postData.contents) 
      : e.parameter;
    
    const action = payload.action_type || "NOTIFY_BILL";

    switch (action) {
      case "NOTIFY_BILL": return handleSendEmail(payload);
      case "RESET_PASSWORD": return handleResetPassword(payload);
      case "SYNC_BULK": return handleSyncBulk(payload);
      default: return createResponse(false, "Hành động không hợp lệ");
    }
  } catch (error) {
    return createResponse(false, error.message);
  }
}

function handleSendEmail(data) {
  const options = {
    name: data.senderName || "BQL Q-Home",
    htmlBody: data.htmlBody
  };
  if (data.attachmentBase64) {
    options.attachments = [Utilities.newBlob(Utilities.base64Decode(data.attachmentBase64), 'application/pdf', data.attachmentName)];
  }
  GmailApp.sendEmail(data.email, data.subject, "", options);
  return createResponse(true, "Đã gửi mail thành công");
}

function handleResetPassword(data) {
  const html = `
    <div style="font-family:sans-serif; padding:20px; border:1px solid #eee; border-radius:10px;">
      <h2 style="color:#006f3a;">Yêu cầu cấp lại mật khẩu</h2>
      <p>Mật khẩu của bạn đã được đặt về mặc định là: <b>123456</b></p>
      <p>Vui lòng nhấn vào link bên dưới để xác nhận và đăng nhập lại:</p>
      <a href="${data.link}" style="background:#006f3a; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; display:inline-block;">Đăng nhập ngay</a>
    </div>
  `;
  GmailApp.sendEmail(data.email, "[Q-Home] Cấp lại mật khẩu", "", { htmlBody: html });
  return createResponse(true, "Mail hướng dẫn đã được gửi");
}

function handleSyncBulk(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID) || SpreadsheetApp.getActiveSpreadsheet();
  const content = JSON.parse(data.payload || "{}");
  let sheet = ss.getSheetByName(content.module) || ss.insertSheet(content.module);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(content.headers);
    sheet.getRange(1, 1, 1, content.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  if (content.rows && content.rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, content.rows.length, content.headers.length).setValues(content.rows);
  }
  return createResponse(true, "Đã đồng bộ dữ liệu sang Sheets");
}

function createResponse(success, msg) {
  return ContentService.createTextOutput(JSON.stringify({ success, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
