
/**
 * Tự động gửi thông báo phí tới Firestore khi Admin chốt số liệu trên Spreadsheet
 * Yêu cầu: Đã bật Firestore Library trong Apps Script
 */

const FIREBASE_CONFIG = {
  project_id: "q-home2",
  database_url: "https://q-home2.firebaseio.com"
};

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  // Ví dụ: Khi cột "Trạng thái" (cột 10) chuyển thành "Đã duyệt"
  if (sheet.getName() === "Billing" && range.getColumn() === 10 && e.value === "Đã duyệt") {
    const row = range.getRow();
    const unitId = sheet.getRange(row, 1).getValue(); // Cột A
    const amount = sheet.getRange(row, 8).getValue(); // Cột H
    const period = sheet.getRange(row, 2).getValue(); // Cột B
    
    sendNotificationToResident(unitId, {
      type: "bill",
      title: "Thông báo phí mới " + period,
      body: "Căn hộ " + unitId + " có thông báo phí mới: " + amount.toLocaleString() + " VND. Vui lòng thanh toán.",
      link: "portalBilling"
    });
  }
}

/**
 * Gửi thông báo vào collection 'notifications' trên Firestore
 */
function sendNotificationToResident(unitId, data) {
  const firestore = FirestoreApp.getFirestore(
    FIREBASE_CONFIG.project_id, 
    FIREBASE_CONFIG.database_url
  );
  
  const notification = {
    userId: unitId,
    type: data.type || "system",
    title: data.title,
    body: data.body,
    isRead: false,
    createdAt: new Date(),
    link: data.link || ""
  };
  
  firestore.createDocument("notifications", notification);
  console.log("Đã đẩy thông báo tới cư dân: " + unitId);
}

/**
 * Hàm gửi tin nhắn khẩn cấp hàng loạt
 */
function broadcastUrgentNews(title, body) {
  const firestore = FirestoreApp.getFirestore(FIREBASE_CONFIG.project_id);
  const units = firestore.getDocuments("units");
  
  units.forEach(doc => {
    const unitId = doc.name.split('/').pop();
    sendNotificationToResident(unitId, {
      type: "news",
      title: "KHẨN: " + title,
      body: body,
      link: "portalNews"
    });
  });
}
