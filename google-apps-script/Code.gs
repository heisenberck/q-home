/**
 * GOOGLE APPS SCRIPT BACKEND - Q-HOME V2.0 (Google Workspace Solution)
 * Chức năng: 
 * 1. Gửi Email thông báo phí (Kèm PDF đính kèm).
 * 2. Cấp lại mật khẩu mặc định qua Email.
 * 3. Đồng bộ chi phí vận hành & Doanh thu VAS sang Google Sheets.
 * 4. Tự động khởi tạo cấu trúc bảng tính báo cáo.
 */

const SS_ID = "YOUR_SPREADSHEET_ID_HERE"; 

/**
 * Kiểm tra trạng thái Web App
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Q-Home Apps Script API is running.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý yêu cầu POST từ ứng dụng React
 */
function doPost(e) {
  try {
    let payload;
    let actionType = "";

    if (e.postData && e.postData.type === "application/json") {
      payload = JSON.parse(e.postData.contents);
      actionType = payload.action_type || "RESET_PASSWORD";
    } else {
      payload = e.parameter;
      actionType = payload.action_type || "NOTIFY_BILL";
    }

    switch (actionType) {
      case "RESET_PASSWORD":
        return handleResetPassword(payload);
      
      case "NOTIFY_BILL":
        return handleSendNotification(payload);

      case "SYNC_EXPENSE":
        return handleSyncExpense(payload);

      case "SYNC_VAS":
        return handleSyncVAS(payload);
        
      case "SYNC_BULK":
        return handleSyncBulk(payload);

      default:
        return createResponse(false, "Hành động không hợp lệ: " + actionType);
    }

  } catch (error) {
    return createResponse(false, "Lỗi hệ thống: " + error.message);
  }
}

/**
 * Đồng bộ dữ liệu hàng loạt từ trang Backup & Restore
 */
function handleSyncBulk(data) {
  try {
    const payload = JSON.parse(data.payload);
    const ss = getSpreadsheet();
    let sheetName = "";
    
    if (payload.module === "billing") sheetName = "BaoCao_Phi_DichVu";
    else if (payload.module === "vas") sheetName = "BaoCao_DoanhThu_VAS";
    else if (payload.module === "expenses") sheetName = "BaoCao_ChiPhi_VH";
    
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(payload.headers);
      sheet.getRange(1, 1, 1, payload.headers.length).setFontWeight("bold").setBackground("#d9ead3");
      sheet.setFrozenRows(1);
    } else {
      // Xóa dữ liệu cũ của kỳ này để ghi đè (Tránh trùng lặp)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const range = sheet.getRange(2, 2, lastRow - 1, 1); // Cột 2 thường là Period
        const values = range.getValues();
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i][0] == payload.period) {
            sheet.deleteRow(i + 2);
          }
        }
      }
    }

    if (payload.rows && payload.rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, payload.rows.length, payload.headers.length).setValues(payload.rows);
    }

    return createResponse(true, "Đã đồng bộ " + payload.rows.length + " dòng dữ liệu vào sheet: " + sheetName);
  } catch (e) {
    return createResponse(false, "Lỗi đồng bộ hàng loạt: " + e.message);
  }
}

/**
 * Đồng bộ doanh thu VAS lẻ
 */
function handleSyncVAS(data) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName("DoanhThuVAS");
    
    if (!sheet) {
      sheet = ss.insertSheet("DoanhThuVAS");
      sheet.appendRow(["ID", "Ngày Thu", "Hạng Mục", "Nội Dung", "Số Tiền", "Người Tạo", "Ngày Ghi Sổ"]);
      sheet.getRange(1,1,1,7).setFontWeight("bold").setBackground("#e6f4ea");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.id,
      data.date,
      data.type,
      data.description,
      data.amount,
      data.createdBy,
      new Date()
    ]);

    return createResponse(true, "Đã ghi nhận doanh thu vào Google Sheets");
  } catch (e) {
    return createResponse(false, "Lỗi ghi Sheets: " + e.message);
  }
}

/**
 * Đồng bộ khoản chi lẻ
 */
function handleSyncExpense(data) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName("ChiPhiVanHanh");
    
    if (!sheet) {
      sheet = ss.insertSheet("ChiPhiVanHanh");
      sheet.appendRow(["ID", "Ngày Chi", "Hạng Mục", "Nội Dung", "Số Tiền", "Người Thực Hiện", "Ngày Ghi Sổ"]);
      sheet.getRange(1,1,1,7).setFontWeight("bold").setBackground("#fff2cc");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.id,
      data.date,
      data.category,
      data.description,
      data.amount,
      data.performedBy,
      new Date()
    ]);

    return createResponse(true, "Đã ghi nhận chi phí vào Google Sheets");
  } catch (e) {
    return createResponse(false, "Lỗi ghi Sheets: " + e.message);
  }
}

/**
 * Gửi Email thông báo phí (Kèm PDF đính kèm)
 */
function handleSendNotification(data) {
  try {
    const recipient = data.email;
    const subject = data.subject || "Thông báo từ Ban Quản Lý HUD3";
    const htmlBody = data.htmlBody;
    const senderName = data.senderName || "BQL Chung cư HUD3 Linh Đàm";
    
    const options = {
      name: senderName,
      htmlBody: htmlBody
    };

    if (data.attachmentBase64 && data.attachmentName) {
      const bytes = Utilities.base64Decode(data.attachmentBase64);
      const blob = Utilities.newBlob(bytes, 'application/pdf', data.attachmentName);
      options.attachments = [blob];
    }

    GmailApp.sendEmail(recipient, subject, "", options);
    return createResponse(true, "Email đã được gửi thành công");
  } catch (e) {
    return createResponse(false, "Lỗi gửi mail: " + e.message);
  }
}

/**
 * Xử lý yêu cầu đặt lại mật khẩu
 */
function handleResetPassword(data) {
  try {
    const recipient = data.email;
    const resetLink = data.link;

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #006f3a; color: white; padding: 30px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">Yêu cầu đặt lại mật khẩu</h2>
        </div>
        <div style="padding: 32px; color: #374151; line-height: 1.6;">
          <p>Xin chào,</p>
          <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${recipient}</strong>.</p>
          <p>Mật khẩu sau khi xác nhận sẽ được đặt về mặc định là: <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-weight: bold;">123456</span></p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetLink}" style="background-color: #006f3a; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(0,111,58,0.2);">Xác nhận Thay đổi</a>
          </div>
          <p style="font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; pt: 20px;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email an tâm rằng tài khoản của bạn vẫn an toàn.</p>
        </div>
      </div>
    `;

    GmailApp.sendEmail(recipient, "[Q-Home] Yêu cầu khôi phục mật khẩu", "", {
      name: "Hệ thống Quản lý Q-Home",
      htmlBody: htmlTemplate
    });

    return createResponse(true, "Email hướng dẫn đã được gửi");
  } catch (e) {
    return createResponse(false, "Lỗi cấp lại mật khẩu: " + e.message);
  }
}

/**
 * Helper: Lấy hoặc tạo Spreadsheet báo cáo
 */
function getSpreadsheet() {
  if (SS_ID && SS_ID !== "YOUR_SPREADSHEET_ID_HERE") {
    try {
      return SpreadsheetApp.openById(SS_ID);
    } catch (e) {
      // Nếu ID sai hoặc không truy cập được, fallback về Spreadsheet gắn liền hoặc tạo mới
    }
  }
  
  // Kiểm tra nếu script được gắn vào 1 sheet
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  
  // Nếu là script độc lập, tìm file có tên "Q-Home_Reports"
  const files = DriveApp.getFilesByName("Q-Home_Reports");
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  
  // Nếu không thấy, tạo file mới
  return SpreadsheetApp.create("Q-Home_Reports");
}

function createResponse(success, message) {
  const result = { 
    success: success, 
    message: message, 
    timestamp: new Date().toISOString() 
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}