
import React, { useState, useEffect } from 'react';
import type { ChargeRaw } from '../types';
import Modal from './ui/Modal';
import { formatCurrency, formatNumber, timeAgo } from '../utils/helpers';
import { CheckCircleIcon, XMarkIcon, MagnifyingGlassIcon, WarningIcon } from './ui/Icons';

interface VerificationModalProps {
    charge: ChargeRaw;
    onClose: () => void;
    onConfirm: (charge: ChargeRaw, amount: number) => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ charge, onClose, onConfirm }) => {
    // Default to scanned amount if valid, else total due
    const initialAmount = (charge.ocrResult?.scannedAmount && charge.ocrResult.scannedAmount > 0) 
        ? charge.ocrResult.scannedAmount 
        : charge.TotalDue;

    const [actualReceived, setActualReceived] = useState<number>(initialAmount);
    const [zoomImage, setZoomImage] = useState(false);

    const difference = actualReceived - charge.TotalDue;
    const isMatch = difference === 0;

    return (
        <Modal title={`Xác thực thanh toán - ${charge.UnitID}`} onClose={onClose} size="4xl">
            <div className="flex flex-col md:flex-row h-[70vh] -m-6 bg-gray-50">
                {/* LEFT: Image Viewer */}
                <div className="md:w-1/2 bg-black flex items-center justify-center relative overflow-hidden group">
                    {charge.proofImage ? (
                        <>
                            <img 
                                src={charge.proofImage} 
                                alt="Payment Proof" 
                                className={`transition-transform duration-300 ${zoomImage ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'} max-h-full max-w-full object-contain`}
                                onClick={() => setZoomImage(!zoomImage)}
                            />
                            <div className="absolute bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/50 text-white text-xs px-2 py-1 rounded">Click để phóng to</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-gray-400 flex flex-col items-center">
                            <XMarkIcon className="w-12 h-12 mb-2 opacity-50"/>
                            <p>Không có ảnh xác thực</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Form & Details */}
                <div className="md:w-1/2 p-6 flex flex-col bg-white overflow-y-auto">
                    <div className="mb-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">{charge.OwnerName}</h3>
                                <p className="text-sm text-gray-500">Kỳ thu: {charge.Period}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Gửi lúc</p>
                                <p className="text-sm font-medium">{timeAgo(charge.submittedAt)}</p>
                            </div>
                        </div>

                        {/* OCR Result Banner */}
                        {charge.ocrResult && (
                            <div className={`p-3 rounded-lg border text-sm mb-6 ${charge.ocrResult.isMatch ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    <MagnifyingGlassIcon className="w-4 h-4"/>
                                    Kết quả quét tự động (OCR)
                                </div>
                                <div className="flex justify-between">
                                    <span>Số tiền đọc được:</span>
                                    <span className="font-mono font-bold">{formatCurrency(charge.ocrResult.scannedAmount)}</span>
                                </div>
                                {!charge.ocrResult.isMatch && (
                                    <p className="text-xs mt-1 opacity-80 flex items-center gap-1">
                                        <WarningIcon className="w-3 h-3"/> Khác với số tiền phải thu
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phải thu (Hệ thống)</label>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(charge.TotalDue)}</div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Thực nhận (VND)</label>
                                <input 
                                    type="number" 
                                    value={actualReceived}
                                    onChange={(e) => setActualReceived(parseFloat(e.target.value) || 0)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-bold text-right"
                                />
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-medium text-gray-600">Chênh lệch:</span>
                                <span className={`font-bold ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-100 flex gap-3">
                        <button 
                            onClick={onClose} 
                            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={() => onConfirm(charge, actualReceived)} 
                            className="flex-1 py-3 bg-primary hover:bg-primary-focus text-white font-bold rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-colors"
                        >
                            <CheckCircleIcon className="w-5 h-5"/>
                            Xác nhận Thu
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VerificationModal;
