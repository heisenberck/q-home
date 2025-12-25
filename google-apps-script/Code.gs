
/**
 * GOOGLE APPS SCRIPT BACKEND - Q-HOME V2.0 (Google Workspace Solution)
 * Chức năng: 
 * 1. Gửi Email thông báo phí (Kèm PDF).
 * 2. Cấp lại mật khẩu.
 * 3. ĐỒNG BỘ CHI PHÍ VẬN HÀNH & DOANH THU VAS SANG GOOGLE SHEETS.
 * 4. BACKUP DỮ LIỆU ĐỊNH KỲ.
 */

const SS_ID = "YOUR_SPREADSHEET_ID_HERE"; // Thay ID Spreadsheet của bạn tại đây hoặc script sẽ tự tạo mới

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
    return createResponse(false, error.message);
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
    } else {
      // Nếu đã có dữ liệu kỳ này, xóa đi để ghi đè (Tránh trùng lặp khi backup lại)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const range = sheet.getRange(2, 2, lastRow - 1, 1); // Cột 2 là Period/Tháng
        const values = range.getValues();
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i][0] == payload.period) {
            sheet.deleteRow(i + 2);
          }
        }
      }
    }

    if (payload.rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, payload.rows.length, payload.headers.length).setValues(payload.rows);
    }

    return createResponse(true, "Đã đồng bộ " + payload.rows.length + " dòng dữ liệu thành công.");
  } catch (e) {
    return createResponse(false, "Lỗi đồng bộ Bulk: " + e.message);
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

    return createResponse(true, "Đã đồng bộ doanh thu sang Sheets thành công");
  } catch (e) {
    return createResponse(false, "Lỗi Sheets: " + e.message);
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
      sheet.getRange(1,1,1,7).setFontWeight("bold").setBackground("#f3f3f3");
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

    return createResponse(true, "Đã đồng bộ sang Sheets thành công");
  } catch (e) {
    return createResponse(false, "Lỗi Sheets: " + e.message);
  }
}

/**
 * Gửi Email thông báo phí (Kèm PDF đính kèm)
 */
function handleSendNotification(data) {
  try {
    const recipient = data.email;
    const subject = data.subject || "Thông báo từ Ban Quản Lý";
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
    return createResponse(true, "Email đã được gửi cho: " + recipient);
  } catch (e) {
    return createResponse(false, "Lỗi gửi mail: " + e.message);
  }
}

function handleResetPassword(data) {
  try {
    const recipient = data.email;
    const resetLink = data.link;

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #006f3a; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Yêu cầu đặt lại mật khẩu</h2>
        </div>
        <div style="padding: 24px; color: #374151; line-height: 1.6;">
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${recipient}</strong> trên hệ thống Q-Home.</p>
          <p>Mật khẩu mặc định sau khi nhấn nút dưới đây sẽ là: <strong>123456</strong></p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background-color: #006f3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xác nhận đặt lại Mật khẩu</a>
          </div>
          <p style="font-size: 12px; color: #9ca3af;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.</p>
        </div>
      </div>
    `;

    GmailApp.sendEmail(recipient, "[Q-Home] Yêu cầu khôi phục mật khẩu", "", {
      name: "Hệ thống Q-Home",
      htmlBody: htmlTemplate
    });

    return createResponse(true, "Link khôi phục đã gửi");
  } catch (e) {
    return createResponse(false, "Lỗi reset pass: " + e.message);
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
      console.warn("Không mở được SS_ID, sử dụng mặc định");
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function createResponse(success, message) {
  const result = { success, message, timestamp: new Date().toISOString() };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
