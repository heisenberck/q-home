// utils/importHelpers.ts

// Declare XLSX for TypeScript since it's loaded from a script tag
declare const XLSX: any;

interface ParsedRow {
    [key: string]: unknown;
}

/**
 * REFACTORED: Detects columns from an Excel file header based on a prioritized list of keywords and exclusions.
 * This function was moved from ResidentsPage.tsx to be a reusable utility.
 * @param headers An array of header strings from the file.
 * @returns A map from the original header string to the target field name (e.g., { 'Mã căn hộ': 'unitId' }).
 */
export const mapExcelHeaders = (headers: string[]): { [key: string]: string } => {
    const headerMap: { [key: string]: string } = {};
    const usedHeaders = new Set<string>();

    // This list explicitly defines the search priority. More specific matches (like 'ô tô a') MUST come before general ones ('ô tô').
    const prioritizedMappings = [
        // Most specific vehicle types first
        { field: 'vehicles_car_a', keywords: ['ô tô a', 'o to a', 'car-a', 'car a', 'hạng a'] },
        
        // General vehicle types
        { field: 'vehicles_car', keywords: ['ô tô', 'o to', 'car'], exclude: ['ô tô a', 'o to a', 'car-a', 'car a', 'hạng a'] },
        { field: 'vehicles_motorbike', keywords: ['xe máy', 'xe may'] },
        { field: 'vehicles_ebike', keywords: ['xe điện', 'xe dien'] },
        { field: 'vehicles_bicycle', keywords: ['xe đạp', 'xe dap'] },

        // Core fields for residents
        { field: 'unitId', keywords: ['căn hộ', 'mã căn', 'unit', 'room'], exclude: ['họ tên', 'chủ', 'name'] },
        { field: 'ownerName', keywords: ['chủ hộ', 'họ tên', 'tên chủ', 'name'] },
        
        // Other resident fields
        { field: 'status', keywords: ['trạng thái', 'status'] },
        { field: 'parkingStatus', keywords: ['lốt đỗ', 'parking'] },
        { field: 'area', keywords: ['diện tích', 'dien tich', 'dt', 'area'] },
        { field: 'phone', keywords: ['sđt', 'sdt', 'tel', 'mobile', 'điện thoại', 'dien thoai'] },
        { field: 'email', keywords: ['email'] },
        
        // Fields for other import types (e.g., water)
        { field: 'reading', keywords: ['chỉ số', 'reading', 'index', 'số nước', 'chỉ số mới', 'mới'] },
    ];

    // A single pass through the prioritized mappings ensures the correct field is matched first.
    prioritizedMappings.forEach(({ field, keywords, exclude }) => {
        // Find the first available header that matches the keywords for this field.
        for (const header of headers) {
            if (usedHeaders.has(header)) {
                continue; // This header is already mapped, skip it.
            }

            const normalizedHeader = header.toLowerCase();
            
            const isMatch = keywords.some(kw => normalizedHeader.includes(kw));
            const isExcluded = exclude?.some(ex => normalizedHeader.includes(ex)) ?? false;

            if (isMatch && !isExcluded) {
                headerMap[header] = field;
                usedHeaders.add(header);
                break; // Found a match for this field, move to the next field in the priority list.
            }
        }
    });

    return headerMap;
};


/**
 * Processes an Excel or CSV file to extract structured data.
 * @param file The file to process.
 * @param columnMappings A map defining keywords for each column to extract.
 * @returns A promise that resolves to an array of objects.
 */
export const processImportFile = (
    file: File,
    columnMappings: { [key: string]: string[] }
): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event: ProgressEvent<FileReader>) => {
            try {
                if (!event.target?.result) {
                    return reject(new Error("File is empty or could not be read."));
                }
                const data = new Uint8Array(event.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                const json: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (json.length === 0) {
                    resolve([]);
                    return;
                }
                
                const rawHeaders = (json[0] as unknown[]).map(h => String(h ?? "").trim());
                const mappedHeaders = mapExcelHeaders(rawHeaders);
                
                const dataRows = json.slice(1);
                
                const parsedData = dataRows
                    .map(rowArray => {
                        if (!Array.isArray(rowArray) || rowArray.every(cell => cell === "")) return null;
                        const rowObject: ParsedRow = {};
                        rawHeaders.forEach((header, index) => {
                            const targetField = mappedHeaders[header];
                            if (targetField) {
                                rowObject[targetField] = (rowArray as unknown[])[index];
                            }
                        });
                        return rowObject;
                    })
                    .filter((obj): obj is ParsedRow => obj !== null && Object.keys(obj).length > 0 && !!obj.unitId); 

                resolve(parsedData);

            } catch (error) {
                console.error("Error processing file:", error);
                reject(new Error("Không thể đọc hoặc xử lý file. Vui lòng kiểm tra định dạng file."));
            }
        };

        reader.onerror = () => {
            reject(new Error("Lỗi khi đọc file."));
        };

        reader.readAsArrayBuffer(file);
    });
};